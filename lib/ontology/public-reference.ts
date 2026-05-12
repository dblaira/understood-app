export type PublicOntologyScope =
  | 'bfo_upper'
  | 'domain_reference'
  | 'public_reference'

export type PublicOntologyDomain =
  | 'upper'
  | 'health'
  | 'nutrition'
  | 'software'
  | 'behavior'

export interface PublicOntologyReference {
  id: string
  label: string
  scope: PublicOntologyScope
  domain: PublicOntologyDomain
  source: string
  description: string
}

export interface PersonalPublicBridge {
  personalLabel: string
  relation: 'mapsTo' | 'relatesTo' | 'constrainedBy'
  publicReferenceId: string
  note: string
}

export const PUBLIC_ONTOLOGY_REFERENCES: PublicOntologyReference[] = [
  {
    id: 'bfo:continuant',
    label: 'Continuant',
    scope: 'bfo_upper',
    domain: 'upper',
    source: 'Basic Formal Ontology',
    description: 'An entity that persists through time while possibly changing.',
  },
  {
    id: 'bfo:occurrent',
    label: 'Occurrent',
    scope: 'bfo_upper',
    domain: 'upper',
    source: 'Basic Formal Ontology',
    description: 'A process, event, or happening that unfolds through time.',
  },
  {
    id: 'bfo:quality',
    label: 'Quality',
    scope: 'bfo_upper',
    domain: 'upper',
    source: 'Basic Formal Ontology',
    description: 'A dependent feature or attribute of an entity.',
  },
  {
    id: 'domain:sleep',
    label: 'Sleep',
    scope: 'domain_reference',
    domain: 'health',
    source: 'Health domain reference placeholder',
    description: 'A recurring biological process relevant to recovery, cognition, and health.',
  },
  {
    id: 'domain:caffeine',
    label: 'Caffeine',
    scope: 'domain_reference',
    domain: 'nutrition',
    source: 'Nutrition domain reference placeholder',
    description: 'A stimulant compound commonly relevant to energy, alertness, and sleep timing.',
  },
  {
    id: 'domain:software-system',
    label: 'Software system',
    scope: 'domain_reference',
    domain: 'software',
    source: 'Software engineering domain reference placeholder',
    description: 'An engineered system made of components, interfaces, data, and behavior.',
  },
  {
    id: 'domain:habit',
    label: 'Habit',
    scope: 'domain_reference',
    domain: 'behavior',
    source: 'Behavior domain reference placeholder',
    description: 'A repeated behavior pattern that may become easier or more automatic over time.',
  },
]

export const PERSONAL_PUBLIC_BRIDGES: PersonalPublicBridge[] = [
  {
    personalLabel: "Adam's Sleep",
    relation: 'mapsTo',
    publicReferenceId: 'domain:sleep',
    note: 'Personal sleep observations should stay linked to a public health concept without becoming medical advice.',
  },
  {
    personalLabel: "Adam's CaffeineSensitivity",
    relation: 'relatesTo',
    publicReferenceId: 'domain:caffeine',
    note: 'Personal caffeine patterns can be interpreted against a public nutrition/health reference.',
  },
  {
    personalLabel: "Adam's EveningCaffeineRule",
    relation: 'constrainedBy',
    publicReferenceId: 'domain:caffeine',
    note: 'Personal rules about caffeine should surface health-sensitive caution instead of overclaiming.',
  },
  {
    personalLabel: 'Understood app architecture',
    relation: 'mapsTo',
    publicReferenceId: 'domain:software-system',
    note: 'Product/system claims should route to a product ontology lane rather than personal axioms.',
  },
]

export function getPublicReferenceById(id: string): PublicOntologyReference | null {
  return PUBLIC_ONTOLOGY_REFERENCES.find((reference) => reference.id === id) ?? null
}

export function getPersonalPublicBridgeSummary(): string {
  return PERSONAL_PUBLIC_BRIDGES.map((bridge) => {
    const reference = getPublicReferenceById(bridge.publicReferenceId)
    return `${bridge.personalLabel} ${bridge.relation} ${reference?.label ?? bridge.publicReferenceId}`
  }).join('\n')
}

