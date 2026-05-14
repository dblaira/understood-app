import type { LifeDomain } from '@/types/ontology'

export interface DeferredOntologyAdapter {
  domain: LifeDomain
  phase: 'later_adapter'
  role: 'reference_vocabulary' | 'normalization' | 'clinical_guardrails'
  candidateOntologies: string[]
  boundary: string
}

/**
 * Outside ontologies are adapters around precise domains, not the source of
 * truth for a user's personal ontology.
 */
export const DEFERRED_ONTOLOGY_ADAPTERS: readonly DeferredOntologyAdapter[] = [
  {
    domain: 'Exercise',
    phase: 'later_adapter',
    role: 'normalization',
    candidateOntologies: ['OPE', 'PACO', 'EXMO', 'HeLiFit'],
    boundary: 'Normalize activity type, intensity, duration, equipment, and recovery context.',
  },
  {
    domain: 'Nutrition',
    phase: 'later_adapter',
    role: 'reference_vocabulary',
    candidateOntologies: ['FoodOn', 'CDNO', 'ONS', 'HeLiFit'],
    boundary: 'Normalize food, nutrient, meal, supplement, and dietary pattern terms.',
  },
  {
    domain: 'Sleep',
    phase: 'later_adapter',
    role: 'normalization',
    candidateOntologies: ['HeLiFit', 'FHIR Observation profiles'],
    boundary: 'Normalize sleep duration, timing, recovery, device, and observation metadata.',
  },
  {
    domain: 'Health',
    phase: 'later_adapter',
    role: 'clinical_guardrails',
    candidateOntologies: ['SNOMED CT', 'ICD', 'FHIR', 'HeLiFit'],
    boundary: 'Provide safety vocabulary for symptoms, conditions, care context, and constraints.',
  },
] as const

export function getDeferredOntologyAdapter(domain: LifeDomain): DeferredOntologyAdapter | null {
  return DEFERRED_ONTOLOGY_ADAPTERS.find((adapter) => adapter.domain === domain) ?? null
}
