import type { LifeDomain, OntologyRelationshipType } from '@/types/ontology'

export interface AdamBenchmarkAxiom {
  name: string
  antecedent: string
  consequent: string
  confidence: number
  relationshipType: OntologyRelationshipType
  domains: LifeDomain[]
  extractionCount: number
  purpose: 'benchmark'
}

export const ADAM_EXAMPLE_EXTRACTION_COUNT = 8069

/**
 * Adam's ontology is proof material for demos and evaluation. It must never be
 * installed as another user's standard vocabulary or confirmed personal truth.
 */
export const ADAM_BENCHMARK_AXIOMS: readonly AdamBenchmarkAxiom[] = [
  {
    name: 'Learning Master Key',
    antecedent: 'High Learning',
    consequent: 'Higher Affect, Ambition, and Insight',
    confidence: 0.67,
    relationshipType: 'predicts',
    domains: ['Learning', 'Affect', 'Ambition', 'Insight'],
    extractionCount: ADAM_EXAMPLE_EXTRACTION_COUNT,
    purpose: 'benchmark',
  },
  {
    name: 'Exercise-Sleep Synergy',
    antecedent: 'High Exercise + High Sleep',
    consequent: 'Excellent stress recovery',
    confidence: 0.57,
    relationshipType: 'predicts',
    domains: ['Exercise', 'Sleep', 'Health', 'Affect'],
    extractionCount: ADAM_EXAMPLE_EXTRACTION_COUNT,
    purpose: 'benchmark',
  },
  {
    name: 'Belief to Entertainment Lag',
    antecedent: 'High Belief week N',
    consequent: 'Higher Entertainment week N+2',
    confidence: 0.6,
    relationshipType: 'predicts',
    domains: ['Belief', 'Entertainment'],
    extractionCount: ADAM_EXAMPLE_EXTRACTION_COUNT,
    purpose: 'benchmark',
  },
  {
    name: 'Zero Negative Impact',
    antecedent: 'Any domain high',
    consequent: 'No strong negative impact on other domains',
    confidence: 0.95,
    relationshipType: 'conflicts_with',
    domains: ['Exercise', 'Sleep', 'Nutrition', 'Ambition', 'Health', 'Work', 'Social', 'Learning', 'Purchase', 'Belief', 'Affect', 'Insight', 'Entertainment'],
    extractionCount: ADAM_EXAMPLE_EXTRACTION_COUNT,
    purpose: 'benchmark',
  },
] as const
