import type { OntologyBoundary } from '@/lib/ontology/boundary'
import { classifyOntologyBoundary } from '@/lib/ontology/boundary'
import type { ConnectionType } from '@/types'

/** Buckets from Docs/ontology-connections-calibration-001-summary.md */
export type ConnectionOntologyBucket =
  | 'strong_candidate_personal'
  | 'product_system_principle'
  | 'mixed_personal_product'
  | 'remain_connection_only'
  | 'needs_evidence_before_candidate'

export type ConnectionIntakeLocalAction =
  | 'keep_as_connection'
  | 'mark_for_evidence_search'
  | 'mark_for_candidate_review'
  | 'split_personal_product_claim'
  | 'ignore_for_ontology'

export interface ConnectionOntologyIntakeItem {
  id: string
  headline: string
  connectionType: ConnectionType | 'connection' | string
  suggestedBucket: ConnectionOntologyBucket
  candidateAxiomDraft: string | null
  boundary: OntologyBoundary
  provenanceSource: 'self_declared'
  calibrationRecommendedMove: string
}

export interface ConnectionOntologyEntryLike {
  id: string
  headline?: string | null
  content: string
  connection_type?: ConnectionType | 'connection' | string | null
}

export interface ConnectionEvidenceEntryLike {
  id: string
  headline?: string | null
  content: string
  entry_type?: string | null
}

export interface ConnectionEvidenceCandidate {
  entryId: string
  headline: string
  snippet: string
  score: number
  matchedTerms: string[]
}

export const CONNECTION_ONTOLOGY_INTAKE_STORAGE_KEY = 'understood.connectionsOntologyIntake.v1'

export const CONNECTION_ONTOLOGY_BUCKET_LABELS: Record<ConnectionOntologyBucket, string> = {
  strong_candidate_personal: 'Strong candidate personal axiom',
  product_system_principle: 'Product/system principle',
  mixed_personal_product: 'Mixed personal/product claim',
  remain_connection_only: 'Remain connection only',
  needs_evidence_before_candidate: 'Needs evidence before candidate review',
}

export const CONNECTION_INTAKE_ACTION_LABELS: Record<ConnectionIntakeLocalAction, string> = {
  keep_as_connection: 'Keep as connection',
  mark_for_evidence_search: 'Mark for evidence search',
  mark_for_candidate_review: 'Mark for candidate review',
  split_personal_product_claim: 'Split personal/product claim',
  ignore_for_ontology: 'Ignore for ontology',
}

export interface ConnectionPromptPrinciple {
  headline: string
  principle: string
  bucket: ConnectionOntologyBucket
  boundary: OntologyBoundary
}

/**
 * Canonical 18 items from Docs/ontology-connections-calibration-001.md
 * with suggestedBucket from Docs/ontology-connections-calibration-001-summary.md
 * (plus Creating space → strong candidate; omitted from summary bullet list but in calibration table).
 */
export const CONNECTION_ONTOLOGY_INTAKE_ITEMS: ConnectionOntologyIntakeItem[] = [
  {
    id: 'conn-001',
    headline: 'My assignment is to create desire',
    connectionType: 'process_anchor',
    suggestedBucket: 'mixed_personal_product',
    candidateAxiomDraft:
      'If my work creates desire, then the product has a stronger chance of becoming meaningful to users.',
    boundary: 'both',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-002',
    headline: 'Creating space reduces cognitive load',
    connectionType: 'validated_principle',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft:
      'If I create space in life, then cognitive load, stress, and anxiety decrease, improving decision-making.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-003',
    headline: 'What is context without conviction? Regret.',
    connectionType: 'process_anchor',
    suggestedBucket: 'remain_connection_only',
    candidateAxiomDraft: 'If context is not paired with conviction, then it becomes regret rather than action.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-004',
    headline: 'Delegation is three sentences',
    connectionType: 'process_anchor',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft:
      'If delegation includes what I want, how I think about it, and what done looks like, then handoff quality improves.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-005',
    headline: 'Products fight potential slipping away',
    connectionType: 'validated_principle',
    suggestedBucket: 'product_system_principle',
    candidateAxiomDraft: 'If a product captures otherwise-lost potential, then it creates meaningful lift.',
    boundary: 'product_system',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'product candidate',
  },
  {
    id: 'conn-006',
    headline: 'Use compute over cleverness',
    connectionType: 'validated_principle',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft: 'If hand-crafted solutions will plateau, then use compute over cleverness.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-007',
    headline: 'Ten minutes exporting judgment compounds',
    connectionType: 'validated_principle',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft:
      'If I export judgment into a system, then that time compounds; if I only do the task, the value disappears.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-008',
    headline: 'Articulating something well changes relationship to it',
    connectionType: 'validated_principle',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft:
      'If I articulate something clearly, then my relationship to it changes because writing is thinking.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-009',
    headline: 'Anticipatory anxiety lies',
    connectionType: 'validated_principle',
    suggestedBucket: 'needs_evidence_before_candidate',
    candidateAxiomDraft: 'If anticipatory anxiety appears, then treat it as a feeling, not a fact.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-010',
    headline: 'Capture first, structure later',
    connectionType: 'validated_principle',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft:
      'If I capture first and structure later, then I preserve information without blocking action.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-011',
    headline: 'You do not outwork the problem',
    connectionType: 'validated_principle',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft:
      'If I find the structural edge and build the simplest system around it, then results can compound without overwork.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-012',
    headline: 'Does this capture potential that would slip away?',
    connectionType: 'pattern_interrupt',
    suggestedBucket: 'mixed_personal_product',
    candidateAxiomDraft:
      'If a tool captures potential that would otherwise slip away, then it is worth attention.',
    boundary: 'both',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-013',
    headline: 'Am I building a system or doing a task?',
    connectionType: 'pattern_interrupt',
    suggestedBucket: 'needs_evidence_before_candidate',
    candidateAxiomDraft:
      'If I am doing a task repeatedly, then I should ask whether I am really building a system.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-014',
    headline: 'Insights emerge through engagement',
    connectionType: 'identity_anchor',
    suggestedBucket: 'needs_evidence_before_candidate',
    candidateAxiomDraft:
      'If I engage directly with material, then insight emerges through action rather than separate analysis.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-015',
    headline: 'Energy moves forward, not backward',
    connectionType: 'identity_anchor',
    suggestedBucket: 'remain_connection_only',
    candidateAxiomDraft:
      'If an action moves energy forward, then it is more aligned than backward-looking rumination.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-016',
    headline: 'Judgment strong, vocabulary gap',
    connectionType: 'identity_anchor',
    suggestedBucket: 'strong_candidate_personal',
    candidateAxiomDraft: 'If I struggle to specify what I want, then the problem is vocabulary, not judgment.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'confirmed review',
  },
  {
    id: 'conn-017',
    headline: 'Work on what I can',
    connectionType: 'connection',
    suggestedBucket: 'needs_evidence_before_candidate',
    candidateAxiomDraft: 'If I work on what I can control first, then uncertainty becomes easier to tolerate.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
  {
    id: 'conn-018',
    headline: 'Momentum is the metric that matters',
    connectionType: 'connection',
    suggestedBucket: 'needs_evidence_before_candidate',
    candidateAxiomDraft:
      'If something creates momentum, then it is worth pursuing; if it creates stagnation, then it is worth avoiding.',
    boundary: 'personal_pattern',
    provenanceSource: 'self_declared',
    calibrationRecommendedMove: 'candidate',
  },
]

export function loadConnectionIntakeLocalState(): Record<string, ConnectionIntakeLocalAction | null> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CONNECTION_ONTOLOGY_INTAKE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { action: ConnectionIntakeLocalAction | null }>
    const out: Record<string, ConnectionIntakeLocalAction | null> = {}
    for (const [key, value] of Object.entries(parsed)) {
      out[key] = value?.action ?? null
    }
    return out
  } catch {
    return {}
  }
}

export function saveConnectionIntakeLocalState(next: Record<string, ConnectionIntakeLocalAction | null>) {
  if (typeof window === 'undefined') return
  const payload: Record<string, { action: ConnectionIntakeLocalAction | null }> = {}
  for (const [k, v] of Object.entries(next)) {
    payload[k] = { action: v }
  }
  window.localStorage.setItem(CONNECTION_ONTOLOGY_INTAKE_STORAGE_KEY, JSON.stringify(payload))
}

export function getConnectionPromptPrinciples(
  items: ConnectionOntologyIntakeItem[] = CONNECTION_ONTOLOGY_INTAKE_ITEMS
): ConnectionPromptPrinciple[] {
  return items
    .filter((item) =>
      item.suggestedBucket === 'strong_candidate_personal' &&
      item.boundary === 'personal_pattern' &&
      item.candidateAxiomDraft != null &&
      item.candidateAxiomDraft.trim().length > 0
    )
    .map((item) => ({
      headline: item.headline,
      principle: item.candidateAxiomDraft as string,
      bucket: item.suggestedBucket,
      boundary: item.boundary,
    }))
}

export function buildConnectionPrinciplesPromptSection(
  items: ConnectionOntologyIntakeItem[] = CONNECTION_ONTOLOGY_INTAKE_ITEMS
): string {
  const principles = getConnectionPromptPrinciples(items)
  if (!principles.length) return ''

  return `

## User-authored Connections
These are user-authored operating principles from Connections. Treat them as helpful context, not confirmed ontology axioms. Do not use them to auto-confirm, reject, retire, or change confidence on ontology rules.
${principles.map((item) => `- ${item.headline}: ${item.principle}`).join('\n')}
`
}

export function buildConnectionIntakeItemsFromEntries(
  entries: ConnectionOntologyEntryLike[],
  fallbackItems: ConnectionOntologyIntakeItem[] = CONNECTION_ONTOLOGY_INTAKE_ITEMS
): ConnectionOntologyIntakeItem[] {
  if (!entries.length) return fallbackItems

  const calibratedByHeadline = new Map(
    fallbackItems.map((item) => [normalizeConnectionHeadline(item.headline), item])
  )

  return entries.map((entry) => {
    const headline = entry.headline?.trim() || stripHtml(entry.content).slice(0, 80) || 'Untitled connection'
    const calibrated = calibratedByHeadline.get(normalizeConnectionHeadline(headline))
    if (calibrated) {
      return {
        ...calibrated,
        id: entry.id,
        headline,
        connectionType: entry.connection_type ?? calibrated.connectionType,
      }
    }

    const text = stripHtml(entry.content)
    const boundary = classifyOntologyBoundary(`${headline}\n${text}`).boundary
    const suggestedBucket = inferBucketFromConnection(entry.connection_type, boundary)

    return {
      id: entry.id,
      headline,
      connectionType: entry.connection_type ?? 'connection',
      suggestedBucket,
      candidateAxiomDraft: text || headline,
      boundary,
      provenanceSource: 'self_declared',
      calibrationRecommendedMove: inferCalibrationMove(suggestedBucket),
    }
  })
}

function inferBucketFromConnection(
  connectionType: ConnectionOntologyEntryLike['connection_type'],
  boundary: OntologyBoundary
): ConnectionOntologyBucket {
  if (boundary === 'product_system') return 'product_system_principle'
  if (boundary === 'both') return 'mixed_personal_product'

  if (connectionType === 'validated_principle') return 'strong_candidate_personal'
  if (connectionType === 'process_anchor') return 'needs_evidence_before_candidate'
  if (connectionType === 'pattern_interrupt') return 'remain_connection_only'
  if (connectionType === 'identity_anchor') return 'needs_evidence_before_candidate'

  return 'needs_evidence_before_candidate'
}

function inferCalibrationMove(bucket: ConnectionOntologyBucket): string {
  if (bucket === 'strong_candidate_personal') return 'confirmed review'
  if (bucket === 'product_system_principle') return 'product candidate'
  if (bucket === 'mixed_personal_product') return 'split before review'
  if (bucket === 'remain_connection_only') return 'connection only'
  return 'candidate'
}

export function findConnectionEvidenceCandidates(
  connection: ConnectionOntologyIntakeItem,
  entries: ConnectionEvidenceEntryLike[],
  limit = 3
): ConnectionEvidenceCandidate[] {
  const connectionText = `${connection.headline} ${connection.candidateAxiomDraft ?? ''}`
  const terms = extractEvidenceTerms(connectionText)
  if (!terms.length) return []

  return entries
    .filter((entry) => entry.entry_type !== 'connection' && entry.id !== connection.id)
    .map((entry) => {
      const text = stripHtml(`${entry.headline ?? ''} ${entry.content}`)
      const normalized = text.toLowerCase()
      const matchedTerms = terms.filter((term) => normalized.includes(term))
      return {
        entry,
        text,
        matchedTerms,
        score: matchedTerms.length,
      }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, limit)
    .map((candidate) => ({
      entryId: candidate.entry.id,
      headline: candidate.entry.headline?.trim() || 'Untitled entry',
      snippet: candidate.text.slice(0, 180),
      score: candidate.score,
      matchedTerms: candidate.matchedTerms,
    }))
}

function extractEvidenceTerms(value: string): string[] {
  const stopwords = new Set([
    'about',
    'action',
    'around',
    'because',
    'before',
    'being',
    'build',
    'creates',
    'doing',
    'first',
    'from',
    'have',
    'into',
    'looks',
    'more',
    'then',
    'that',
    'this',
    'what',
    'when',
    'with',
    'without',
    'work',
    'system',
  ])

  return [
    ...new Set(
      stripHtml(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 5)
        .filter((term) => !stopwords.has(term))
    ),
  ].slice(0, 16)
}

function normalizeConnectionHeadline(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
