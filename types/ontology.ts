/** Primary ontology life domains — entry category and sidebar filters use this set. */
export type LifeDomain =
  | 'Exercise'
  | 'Sleep'
  | 'Nutrition'
  | 'Ambition'
  | 'Health'
  | 'Work'
  | 'Social'
  | 'Learning'
  | 'Purchase'
  | 'Belief'
  | 'Affect'
  | 'Insight'
  | 'Entertainment'

export const LIFE_DOMAINS: readonly LifeDomain[] = [
  'Exercise',
  'Sleep',
  'Nutrition',
  'Ambition',
  'Health',
  'Work',
  'Social',
  'Learning',
  'Purchase',
  'Belief',
  'Affect',
  'Insight',
  'Entertainment',
] as const

export const STANDARD_AXIOM_STATUSES = [
  'candidate',
  'confirmed',
  'rejected',
  'retired',
] as const

export type OntologyAxiomStatus = (typeof STANDARD_AXIOM_STATUSES)[number]

export const STANDARD_AXIOM_SCOPES = [
  'personal',
  'starter_hypothesis',
  'demo',
] as const

export type OntologyAxiomScope = (typeof STANDARD_AXIOM_SCOPES)[number]

export const STANDARD_RELATIONSHIP_TYPES = [
  'supports',
  'predicts',
  'conflicts_with',
  'follows',
  'amplifies',
  'inhibits',
  'correlates_with',
  'causes',
  'prevents',
  'intended_to_achieve',
  'has_outcome',
  'affects',
] as const

export type OntologyRelationshipType = (typeof STANDARD_RELATIONSHIP_TYPES)[number]

export interface StandardDomain {
  name: LifeDomain
  description: string
  childLabels: string[]
  outsideOntologyAdapter: 'now' | 'later' | 'not_planned'
}

export interface StandardOntologyVocabulary {
  parentDomains: readonly StandardDomain[]
  relationshipTypes: readonly OntologyRelationshipType[]
  axiomStatuses: readonly OntologyAxiomStatus[]
  exampleAxioms: readonly []
}

export interface OntologyAxiomReviewPolicy {
  minimumEvidenceCount: number
  confirmationConfidence: number
  retirementConfidence: number
  staleAfterDays: number
}

export const STANDARD_AXIOM_REVIEW_POLICY: OntologyAxiomReviewPolicy = {
  minimumEvidenceCount: 3,
  confirmationConfidence: 0.5,
  retirementConfidence: 0.25,
  staleAfterDays: 90,
}

export const STANDARD_ONTOLOGY_VOCABULARY: StandardOntologyVocabulary = {
  parentDomains: [
    {
      name: 'Exercise',
      description: 'Movement, training, physical effort, and recovery inputs tied to the body.',
      childLabels: ['Cardio', 'Strength', 'Mobility'],
      outsideOntologyAdapter: 'later',
    },
    {
      name: 'Sleep',
      description: 'Rest, recovery, sleep timing, sleep quality, and fatigue signals.',
      childLabels: ['Duration', 'Quality', 'Recovery'],
      outsideOntologyAdapter: 'later',
    },
    {
      name: 'Nutrition',
      description: 'Food, hydration, supplements, cravings, meals, and dietary patterns.',
      childLabels: ['Meals', 'Hydration', 'Supplements'],
      outsideOntologyAdapter: 'later',
    },
    {
      name: 'Ambition',
      description: 'Drive, standards, goals, future orientation, and meaningful striving.',
      childLabels: ['Goals', 'Standards', 'Momentum'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Health',
      description: 'Symptoms, medical care, body state, injury, illness, and treatment context.',
      childLabels: ['Symptoms', 'Care', 'Constraints'],
      outsideOntologyAdapter: 'later',
    },
    {
      name: 'Work',
      description: 'Professional output, obligations, decisions, collaboration, and execution.',
      childLabels: ['Output', 'Meetings', 'Decisions'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Social',
      description: 'Relationships, conversations, belonging, conflict, and shared context.',
      childLabels: ['Family', 'Friends', 'Community'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Learning',
      description: 'Study, research, skill growth, knowledge intake, and synthesis.',
      childLabels: ['Reading', 'Practice', 'Research'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Purchase',
      description: 'Buying decisions, spending, subscriptions, tools, and material choices.',
      childLabels: ['Needs', 'Wants', 'Subscriptions'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Belief',
      description: 'Principles, identity claims, worldview, conviction, and meaning.',
      childLabels: ['Principles', 'Identity', 'Worldview'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Affect',
      description: 'Mood, emotion, stress, energy, motivation, and felt state.',
      childLabels: ['Mood', 'Stress', 'Energy'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Insight',
      description: 'Realizations, pattern recognition, conclusions, and mental updates.',
      childLabels: ['Realization', 'Pattern', 'Decision'],
      outsideOntologyAdapter: 'not_planned',
    },
    {
      name: 'Entertainment',
      description: 'Play, leisure, media, novelty, fun, and restorative enjoyment.',
      childLabels: ['Media', 'Play', 'Novelty'],
      outsideOntologyAdapter: 'not_planned',
    },
  ],
  relationshipTypes: STANDARD_RELATIONSHIP_TYPES,
  axiomStatuses: STANDARD_AXIOM_STATUSES,
  exampleAxioms: [],
} as const

const LIFE_DOMAIN_SET = new Set<string>(LIFE_DOMAINS)
const AXIOM_STATUS_SET = new Set<string>(STANDARD_AXIOM_STATUSES)
const AXIOM_SCOPE_SET = new Set<string>(STANDARD_AXIOM_SCOPES)

export function parseLifeDomains(raw: unknown): LifeDomain[] {
  if (!Array.isArray(raw)) return []
  const out: LifeDomain[] = []
  for (const item of raw) {
    if (typeof item === 'string' && LIFE_DOMAIN_SET.has(item)) {
      out.push(item as LifeDomain)
    }
  }
  return [...new Set(out)]
}

export function parseOntologyAxiomStatus(raw: unknown): OntologyAxiomStatus {
  return typeof raw === 'string' && AXIOM_STATUS_SET.has(raw)
    ? (raw as OntologyAxiomStatus)
    : 'candidate'
}

export function parseOntologyAxiomScope(raw: unknown): OntologyAxiomScope {
  return typeof raw === 'string' && AXIOM_SCOPE_SET.has(raw)
    ? (raw as OntologyAxiomScope)
    : 'personal'
}

export interface OntologyAxiom {
  id: string
  name: string
  description: string
  antecedent: string
  consequent: string
  confidence: number
  sources: string[]
  status: OntologyAxiomStatus
  scope: OntologyAxiomScope
  relationshipType: OntologyRelationshipType
  provenance: Record<string, unknown>
  evidenceEntryIds: string[]
  evidenceCount: number
  createdAt: Date
  confirmedAt?: Date | null
  rejectedAt?: Date | null
  retiredAt?: Date | null
}

export interface InferredInsight {
  id: string
  weekStart: Date
  insightText: string
  relatedAxioms: string[]
  confidence: number
}
