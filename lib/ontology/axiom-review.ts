import {
  STANDARD_AXIOM_REVIEW_POLICY,
  type OntologyAxiomReviewPolicy,
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
