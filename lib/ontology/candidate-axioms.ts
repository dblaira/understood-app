import type {
  LifeDomain,
  OntologyAxiomScope,
  OntologyAxiomStatus,
  OntologyRelationshipType,
} from '@/types/ontology'

export interface ExistingAxiomFingerprint {
  antecedent: string
  consequent: string
}

export interface CandidateAxiomSuggestionInput {
  entryId: string
  content: string
  lifeDomains: LifeDomain[]
  proposedAntecedent: string
  proposedConsequent: string
  relationshipType: OntologyRelationshipType
  confidence: number
  existingAxioms: ExistingAxiomFingerprint[]
  proposedAt: string
}

export interface CandidateAxiomSuggestion {
  name: string
  description: string
  antecedent: string
  consequent: string
  confidence: number
  status: Extract<OntologyAxiomStatus, 'candidate'>
  scope: Extract<OntologyAxiomScope, 'personal'>
  relationshipType: OntologyRelationshipType
  evidenceEntryIds: string[]
  evidenceCount: number
  sources: ['ai_proposed']
  provenance: {
    source: 'ai_proposed'
    entryId: string
    proposedAt: string
    lifeDomains: LifeDomain[]
    competencyQuestion: 'CQ-002'
    requiresHumanReview: true
  }
}

export type CandidateAxiomSuggestionResult =
  | CandidateAxiomSuggestion
  | {
      ignored: true
      reason:
        | 'Entry does not express a reusable pattern'
        | 'Pattern is already represented by an existing axiom'
        | 'Pattern is too vague to test'
    }

export function suggestCandidateAxiomFromEntry(
  input: CandidateAxiomSuggestionInput
): CandidateAxiomSuggestionResult {
  const antecedent = input.proposedAntecedent.trim()
  const consequent = input.proposedConsequent.trim()

  if (!expressesReusablePattern(input.content, antecedent, consequent)) {
    return {
      ignored: true,
      reason: 'Entry does not express a reusable pattern',
    }
  }

  if (!isTestablePhrase(antecedent) || !isTestablePhrase(consequent)) {
    return {
      ignored: true,
      reason: 'Pattern is too vague to test',
    }
  }

  if (isDuplicateAxiom(antecedent, consequent, input.existingAxioms)) {
    return {
      ignored: true,
      reason: 'Pattern is already represented by an existing axiom',
    }
  }

  return {
    name: buildCandidateName(antecedent, consequent, input.relationshipType),
    description: `AI-proposed candidate from entry ${input.entryId}. Requires human review before it can govern reasoning.`,
    antecedent,
    consequent,
    confidence: clampConfidence(input.confidence),
    status: 'candidate',
    scope: 'personal',
    relationshipType: input.relationshipType,
    evidenceEntryIds: [input.entryId],
    evidenceCount: 1,
    sources: ['ai_proposed'],
    provenance: {
      source: 'ai_proposed',
      entryId: input.entryId,
      proposedAt: input.proposedAt,
      lifeDomains: input.lifeDomains,
      competencyQuestion: 'CQ-002',
      requiresHumanReview: true,
    },
  }
}

function expressesReusablePattern(content: string, antecedent: string, consequent: string): boolean {
  const normalizedContent = content.toLowerCase()
  const patternSignals = [
    'when ',
    'if ',
    'whenever ',
    'every time',
    'again',
    'tends to',
    'usually',
    'precedes',
    'leads to',
    'causes',
  ]

  return (
    antecedent.length > 0 &&
    consequent.length > 0 &&
    patternSignals.some((signal) => normalizedContent.includes(signal))
  )
}

function isTestablePhrase(value: string): boolean {
  const normalized = normalizeFingerprint(value)
  const vagueTerms = new Set([
    'something',
    'things',
    'stuff',
    'it',
    'this',
    'that',
    'vibes',
    'life',
  ])

  const words = normalized.split(' ').filter(Boolean)
  if (words.length < 2) return false
  return !words.every((word) => vagueTerms.has(word))
}

function isDuplicateAxiom(
  antecedent: string,
  consequent: string,
  existingAxioms: ExistingAxiomFingerprint[]
): boolean {
  const candidate = `${normalizeFingerprint(antecedent)} -> ${normalizeFingerprint(consequent)}`
  return existingAxioms.some((axiom) => {
    return `${normalizeFingerprint(axiom.antecedent)} -> ${normalizeFingerprint(axiom.consequent)}` === candidate
  })
}

function buildCandidateName(
  antecedent: string,
  consequent: string,
  relationshipType: OntologyRelationshipType
): string {
  const relation = relationshipType.replace(/_/g, ' ')
  return `${sentenceCase(antecedent)} ${relation} ${consequent.toLowerCase()}`
}

function sentenceCase(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`
}

function normalizeFingerprint(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(Math.max(value, 0), 1)
}
