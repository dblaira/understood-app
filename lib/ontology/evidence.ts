export type AxiomEvidenceDirection =
  | 'supports'
  | 'weakens'
  | 'contradicts'
  | 'unrelated'

export interface EvidenceLedgerEntry {
  entryId: string
  direction: Exclude<AxiomEvidenceDirection, 'unrelated'>
  rationale: string
  source: string
  recordedAt: string
}

export interface EvidenceUpdateInput {
  entryId: string
  direction: AxiomEvidenceDirection
  rationale: string
  source: string
  recordedAt: string
}

export interface EvidenceTrackableAxiom {
  evidenceEntryIds: string[]
  evidenceCount: number
  provenance: Record<string, unknown>
}

export interface EvidenceSummarizableAxiom extends EvidenceTrackableAxiom {
  confidence: number
}

export interface AxiomEvidenceSummary {
  supports: number
  weakens: number
  contradicts: number
  totalDirectionalEvidence: number
  hasContradictions: boolean
  latestContradiction: string | null
  confidence: number
}

export interface AxiomEvidenceUpdate {
  evidenceEntryIds: string[]
  evidenceCount: number
  provenance: Record<string, unknown> & {
    evidenceLedger: EvidenceLedgerEntry[]
  }
}

export function buildAxiomEvidenceUpdate(
  current: EvidenceTrackableAxiom,
  evidence: EvidenceUpdateInput
): AxiomEvidenceUpdate | { ignored: true } {
  if (evidence.direction === 'unrelated') {
    return { ignored: true }
  }

  const evidenceEntryIds = current.evidenceEntryIds.includes(evidence.entryId)
    ? current.evidenceEntryIds
    : [...current.evidenceEntryIds, evidence.entryId]

  const existingLedger = parseEvidenceLedger(current.provenance.evidenceLedger)
  const evidenceLedger: EvidenceLedgerEntry[] = [
    ...existingLedger,
    {
      entryId: evidence.entryId,
      direction: evidence.direction,
      rationale: evidence.rationale,
      source: evidence.source,
      recordedAt: evidence.recordedAt,
    },
  ]

  return {
    evidenceEntryIds,
    evidenceCount: evidenceEntryIds.length,
    provenance: {
      ...current.provenance,
      evidenceLedger,
    },
  }
}

export function summarizeAxiomEvidence(axiom: EvidenceSummarizableAxiom): AxiomEvidenceSummary {
  const evidenceLedger = parseEvidenceLedger(axiom.provenance.evidenceLedger)
  const supports = evidenceLedger.filter((entry) => entry.direction === 'supports').length
  const weakens = evidenceLedger.filter((entry) => entry.direction === 'weakens').length
  const contradictions = evidenceLedger.filter((entry) => entry.direction === 'contradicts')
  const latestContradiction = contradictions.at(-1)?.rationale ?? null

  return {
    supports,
    weakens,
    contradicts: contradictions.length,
    totalDirectionalEvidence: evidenceLedger.length,
    hasContradictions: contradictions.length > 0,
    latestContradiction,
    confidence: axiom.confidence,
  }
}

function parseEvidenceLedger(raw: unknown): EvidenceLedgerEntry[] {
  if (!Array.isArray(raw)) return []

  return raw.filter((item): item is EvidenceLedgerEntry => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Record<string, unknown>
    return (
      typeof candidate.entryId === 'string' &&
      (candidate.direction === 'supports' ||
        candidate.direction === 'weakens' ||
        candidate.direction === 'contradicts') &&
      typeof candidate.rationale === 'string' &&
      typeof candidate.source === 'string' &&
      typeof candidate.recordedAt === 'string'
    )
  })
}
