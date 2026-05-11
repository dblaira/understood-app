import {
  STANDARD_AXIOM_REVIEW_POLICY,
  type OntologyAxiomReviewPolicy,
  type OntologyAxiomScope,
  type OntologyAxiomStatus,
} from '@/types/ontology'

export interface ReviewableAxiomState {
  status: OntologyAxiomStatus
  confirmed_at: string | null
  rejected_at: string | null
  retired_at: string | null
}

export interface AxiomReviewUpdate {
  status: OntologyAxiomStatus
  confirmed_at: string | null
  rejected_at: string | null
  retired_at: string | null
}

export type AxiomEvidenceDirectionSummary = 'aligned' | 'mixed' | 'contradictory'

export interface AxiomReviewReadinessInput {
  status: OntologyAxiomStatus
  confidence: number
  evidenceCount: number
  evidenceDirection: AxiomEvidenceDirectionSummary
  provenance: Record<string, unknown>
}

export interface AxiomReviewReadiness {
  recommendation: 'confirm' | 'reject' | 'keep_candidate'
  isReviewReady: boolean
  reason: string
}

export type AxiomRetirementSignal = 'stale_confirmed_axiom' | 'stale_evidence'

export interface AxiomRetirementReadinessInput {
  status: OntologyAxiomStatus
  confidence: number
  confirmedAt: string | null
  retiredAt: string | null
  evidenceEntryIds: string[]
  evidenceCount: number
  provenance: Record<string, unknown>
}

export interface AxiomRetirementReadiness {
  shouldReviewForRetirement: boolean
  signals: AxiomRetirementSignal[]
  daysSinceConfirmation: number | null
  daysSinceLatestEvidence: number | null
  recommendation: 'review_for_retirement' | 'keep_confirmed'
  reason: string
  nextStatus: Extract<OntologyAxiomStatus, 'confirmed'>
  confidence: number
}

export function canReviewAxiomScope(scope: OntologyAxiomScope): boolean {
  return scope === 'personal'
}

export function evaluateAxiomReviewReadiness(
  axiom: AxiomReviewReadinessInput,
  policy: OntologyAxiomReviewPolicy = STANDARD_AXIOM_REVIEW_POLICY
): AxiomReviewReadiness {
  if (axiom.status !== 'candidate') {
    return {
      recommendation: 'keep_candidate',
      isReviewReady: false,
      reason: 'Only candidate axioms are eligible for confirmation review',
    }
  }

  if (
    axiom.evidenceDirection === 'contradictory' ||
    axiom.confidence <= policy.retirementConfidence
  ) {
    return {
      recommendation: 'reject',
      isReviewReady: true,
      reason: 'Candidate has contradictory evidence or confidence below rejection threshold',
    }
  }

  if (
    axiom.evidenceDirection === 'aligned' &&
    axiom.evidenceCount >= policy.minimumEvidenceCount &&
    axiom.confidence >= policy.confirmationConfidence
  ) {
    return {
      recommendation: 'confirm',
      isReviewReady: true,
      reason: 'Candidate has enough aligned evidence and confidence for human confirmation',
    }
  }

  return {
    recommendation: 'keep_candidate',
    isReviewReady: false,
    reason: 'Candidate needs more aligned evidence before review',
  }
}

export function evaluateAxiomRetirementReadiness(
  axiom: AxiomRetirementReadinessInput,
  now: string,
  policy: OntologyAxiomReviewPolicy = STANDARD_AXIOM_REVIEW_POLICY
): AxiomRetirementReadiness {
  const daysSinceConfirmation = daysBetween(axiom.confirmedAt, now)
  const daysSinceLatestEvidence = daysBetween(getLatestEvidenceDate(axiom.provenance), now)
  const signals: AxiomRetirementSignal[] = []

  if (axiom.status === 'confirmed' && isAtLeast(daysSinceConfirmation, policy.staleAfterDays)) {
    signals.push('stale_confirmed_axiom')
  }

  if (axiom.status === 'confirmed' && isAtLeast(daysSinceLatestEvidence, policy.staleAfterDays)) {
    signals.push('stale_evidence')
  }

  return {
    shouldReviewForRetirement: signals.length > 0,
    signals,
    daysSinceConfirmation,
    daysSinceLatestEvidence,
    recommendation: signals.length > 0 ? 'review_for_retirement' : 'keep_confirmed',
    reason: signals.length > 0
      ? 'Confirmed axiom is stale or lacks recent supporting evidence'
      : 'Confirmed axiom has no retirement review signals',
    nextStatus: 'confirmed',
    confidence: axiom.confidence,
  }
}

export function buildAxiomReviewUpdate(
  current: ReviewableAxiomState,
  nextStatus: OntologyAxiomStatus,
  now: string
): AxiomReviewUpdate | { error: string } {
  if (current.status === 'candidate' && nextStatus === 'confirmed') {
    return {
      status: nextStatus,
      confirmed_at: current.confirmed_at ?? now,
      rejected_at: null,
      retired_at: null,
    }
  }

  if (current.status === 'candidate' && nextStatus === 'rejected') {
    return {
      status: nextStatus,
      confirmed_at: current.confirmed_at,
      rejected_at: current.rejected_at ?? now,
      retired_at: null,
    }
  }

  if (current.status === 'confirmed' && nextStatus === 'retired') {
    return {
      status: nextStatus,
      confirmed_at: current.confirmed_at,
      rejected_at: current.rejected_at,
      retired_at: current.retired_at ?? now,
    }
  }

  return { error: `Cannot move axiom from ${current.status} to ${nextStatus}` }
}

function isAtLeast(value: number | null, threshold: number): boolean {
  return value !== null && value >= threshold
}

function daysBetween(start: string | null, end: string): number | null {
  if (!start) return null
  const startTime = Date.parse(start)
  const endTime = Date.parse(end)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null
  return Math.floor((endTime - startTime) / 86_400_000)
}

function getLatestEvidenceDate(provenance: Record<string, unknown>): string | null {
  const rawLedger = provenance.evidenceLedger
  if (!Array.isArray(rawLedger)) return null

  const dates = rawLedger
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const recordedAt = (entry as Record<string, unknown>).recordedAt
      return typeof recordedAt === 'string' ? recordedAt : null
    })
    .filter((value): value is string => value !== null)
    .sort((a, b) => Date.parse(b) - Date.parse(a))

  return dates[0] ?? null
}
