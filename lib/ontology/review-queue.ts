import type { OntologyAxiomScope, OntologyAxiomStatus } from '@/types/ontology'
import { normalizeProvenanceSource } from '@/lib/ontology/provenance'

export interface ReviewQueueAxiom {
  id: string
  status: OntologyAxiomStatus
  scope: OntologyAxiomScope
  confidence: number
  evidenceCount: number
  evidenceEntryIds: string[]
  provenance: Record<string, unknown>
}

export interface OntologyReviewQueue<TAxiom extends ReviewQueueAxiom> {
  pendingCandidates: TAxiom[]
  reviewedAxioms: TAxiom[]
  pendingCount: number
}

export function buildOntologyReviewQueue<TAxiom extends ReviewQueueAxiom>(
  axioms: TAxiom[]
): OntologyReviewQueue<TAxiom> {
  const pendingCandidates = axioms
    .filter((axiom) => axiom.status === 'candidate' && axiom.scope === 'personal')
    .sort(compareReviewPriority)

  const pendingIds = new Set(pendingCandidates.map((axiom) => axiom.id))

  return {
    pendingCandidates,
    reviewedAxioms: axioms.filter((axiom) => !pendingIds.has(axiom.id)),
    pendingCount: pendingCandidates.length,
  }
}

export function getAxiomProvenanceLabel(provenance: Record<string, unknown>): string {
  const descriptor = normalizeProvenanceSource(provenance)
  if (descriptor.source === 'unknown') return 'No provenance recorded'

  if (descriptor.source === 'ai_proposed') {
    const label = typeof provenance.entryId === 'string'
      ? `AI proposed from entry ${provenance.entryId}`
      : descriptor.label
    const parts = [label]
    if (typeof provenance.competencyQuestion === 'string') {
      parts.push(provenance.competencyQuestion)
    }
    if (provenance.requiresHumanReview === true) {
      parts.push('human review required')
    }
    return parts.join(' · ')
  }

  return descriptor.label
}

function compareReviewPriority<TAxiom extends ReviewQueueAxiom>(a: TAxiom, b: TAxiom): number {
  const evidenceDelta = effectiveEvidenceCount(b) - effectiveEvidenceCount(a)
  if (evidenceDelta !== 0) return evidenceDelta
  return b.confidence - a.confidence
}

function effectiveEvidenceCount(axiom: ReviewQueueAxiom): number {
  return Math.max(axiom.evidenceCount, axiom.evidenceEntryIds.length)
}
