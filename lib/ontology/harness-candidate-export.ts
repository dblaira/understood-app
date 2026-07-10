import { classifyOntologyBoundary } from './boundary'
import { LIFE_DOMAINS, type LifeDomain } from '../../types/ontology'

export const HARNESS_AGENT_PROPOSAL_PREFIX = 'AGENT PROPOSAL:'
export type HarnessLifeDomain = Lowercase<LifeDomain>

export interface UnderstoodHarnessSourceEvidence {
  id: string
  content: string
  createdAt: string
  lifeDomains: readonly string[]
}

export interface UnderstoodHarnessAxiom {
  id: string
  userId: string | null
  name: string
  antecedent: string
  consequent: string
  confidence: number
  status: string
  scope: string
  relationshipType: string
  evidenceEntryIds: readonly string[]
  evidenceCount: number
  provenance: Record<string, unknown>
  confirmedAt: string | null
}

export interface HarnessPendingCandidate {
  id: string
  status: 'pending'
  plain: string
  evidence: string
  source: string
  domain_a: HarnessLifeDomain
  domain_b: HarnessLifeDomain
  strength?: number
  connection_type: string
}

export interface HarnessCandidateDiagnostic {
  axiomId: string
  eligible: boolean
  reasons: string[]
}

export interface HarnessCandidateExportResult {
  candidate: HarnessPendingCandidate | null
  selectedAxiomId: string | null
  eligibleAxiomIds: string[]
  diagnostics: HarnessCandidateDiagnostic[]
}

interface EligibleAxiom {
  axiom: UnderstoodHarnessAxiom
  evidence: UnderstoodHarnessSourceEvidence
  domains: HarnessLifeDomain[]
}

const DURABLE_PROVENANCE_KEYS = [
  'entryId',
  'connectionId',
  'recordId',
  'sourceRecordId',
  'sourcePath',
  'sourceUrl',
  'artifactPath',
] as const

export function exportAtMostOneHarnessCandidate(
  axioms: readonly UnderstoodHarnessAxiom[],
  evidenceRecords: readonly UnderstoodHarnessSourceEvidence[]
): HarnessCandidateExportResult {
  const evidenceById = new Map(evidenceRecords.map((record) => [record.id, record]))
  const diagnostics: HarnessCandidateDiagnostic[] = []
  const eligible: EligibleAxiom[] = []

  for (const axiom of axioms) {
    const assessment = assessAxiom(axiom, evidenceById)
    diagnostics.push({
      axiomId: axiom.id,
      eligible: assessment.eligible,
      reasons: assessment.reasons,
    })

    if (assessment.eligible) {
      eligible.push({
        axiom,
        evidence: assessment.evidence,
        domains: assessment.domains,
      })
    }
  }

  eligible.sort(compareEligibleAxioms)
  const selected = eligible[0]

  return {
    candidate: selected ? buildCandidate(selected) : null,
    selectedAxiomId: selected?.axiom.id ?? null,
    eligibleAxiomIds: eligible.map(({ axiom }) => axiom.id),
    diagnostics,
  }
}

function assessAxiom(
  axiom: UnderstoodHarnessAxiom,
  evidenceById: ReadonlyMap<string, UnderstoodHarnessSourceEvidence>
):
  | { eligible: false; reasons: string[] }
  | {
      eligible: true
      reasons: []
      evidence: UnderstoodHarnessSourceEvidence
      domains: LifeDomain[]
    } {
  if (axiom.status !== 'confirmed') {
    return { eligible: false, reasons: [`status ${axiom.status} is not confirmed`] }
  }

  if (axiom.scope !== 'personal') {
    return { eligible: false, reasons: [`scope ${axiom.scope} is not personal`] }
  }

  if (!axiom.userId) {
    return { eligible: false, reasons: ['record is global rather than owned personal data'] }
  }

  if (!isValidDate(axiom.confirmedAt)) {
    return { eligible: false, reasons: ['confirmation has no durable timestamp'] }
  }

  if (!axiom.antecedent.trim() || !axiom.consequent.trim()) {
    return { eligible: false, reasons: ['axiom is missing an antecedent or consequent'] }
  }

  if (!axiom.relationshipType.trim()) {
    return { eligible: false, reasons: ['axiom is missing a stable relationship type'] }
  }

  if (!Number.isFinite(axiom.confidence) || axiom.confidence < 0 || axiom.confidence > 1) {
    return { eligible: false, reasons: ['confidence is not a decimal between 0 and 1'] }
  }

  const evidenceIds = [...new Set(axiom.evidenceEntryIds.filter(Boolean))].sort()
  if (axiom.evidenceCount < 1 || evidenceIds.length === 0) {
    return { eligible: false, reasons: ['no direct evidence record is attached'] }
  }

  const evidence = evidenceIds
    .map((id) => evidenceById.get(id))
    .find((record): record is UnderstoodHarnessSourceEvidence => Boolean(record?.content.trim()))
  if (!evidence) {
    return { eligible: false, reasons: ['attached evidence could not be resolved to source wording'] }
  }

  if (typeof axiom.provenance.source !== 'string' || !axiom.provenance.source.trim()) {
    return { eligible: false, reasons: ['provenance source is missing'] }
  }

  if (!hasDurableProvenanceReference(axiom.provenance)) {
    return { eligible: false, reasons: ['provenance has no durable record or artifact reference'] }
  }

  const boundary = classifyOntologyBoundary(evidence.content)
  if (boundary.boundary !== 'personal_pattern') {
    return {
      eligible: false,
      reasons: [`source wording is ${boundary.boundary}, not an unambiguous personal pattern`],
    }
  }

  const domains = collectLifeDomains(evidence.lifeDomains, axiom.provenance.lifeDomains)
  if (domains.length === 0) {
    return { eligible: false, reasons: ['source has no allowed Harness life domain'] }
  }

  return { eligible: true, reasons: [], evidence, domains }
}

function hasDurableProvenanceReference(provenance: Record<string, unknown>): boolean {
  return DURABLE_PROVENANCE_KEYS.some((key) => {
    const value = provenance[key]
    return typeof value === 'string' && value.trim().length > 0
  })
}

function collectLifeDomains(
  sourceDomains: readonly string[],
  provenanceDomains: unknown
): HarnessLifeDomain[] {
  const candidates = [
    ...sourceDomains,
    ...(Array.isArray(provenanceDomains) ? provenanceDomains : []),
  ]
  const candidateSet = new Set(
    candidates
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toLowerCase())
  )
  return LIFE_DOMAINS
    .map((domain) => domain.toLowerCase() as HarnessLifeDomain)
    .filter((domain) => candidateSet.has(domain))
}

function compareEligibleAxioms(left: EligibleAxiom, right: EligibleAxiom): number {
  return (
    right.axiom.confidence - left.axiom.confidence ||
    right.axiom.evidenceCount - left.axiom.evidenceCount ||
    Date.parse(right.axiom.confirmedAt ?? '') - Date.parse(left.axiom.confirmedAt ?? '') ||
    left.axiom.id.localeCompare(right.axiom.id)
  )
}

function buildCandidate({
  axiom,
  evidence,
  domains,
}: EligibleAxiom): HarnessPendingCandidate {
  const confirmedDate = axiom.confirmedAt!.slice(0, 10)
  const dateId = confirmedDate.replaceAll('-', '')
  const stableAxiomId = slugify(axiom.id)
  const relationship = axiom.relationshipType.replaceAll('_', ' ')

  return {
    id: `cand-understood-${dateId}-${stableAxiomId}`,
    status: 'pending',
    plain: `${HARNESS_AGENT_PROPOSAL_PREFIX} For Adam, "${axiom.antecedent}" ${relationship} "${axiom.consequent}".`,
    evidence: evidence.content,
    source: `Understood entry ${evidence.id} · ontology axiom ${axiom.id} · confirmed ${confirmedDate}`,
    domain_a: domains[0],
    domain_b: domains[1] ?? domains[0],
    strength: Math.min(1, Math.max(0, axiom.confidence)),
    connection_type: axiom.relationshipType,
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-axiom'
}

function isValidDate(value: string | null): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
