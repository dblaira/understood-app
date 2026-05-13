export type PublicOntologyScope =
  | 'bfo_upper'
  | 'mid_level_reference'
  | 'domain_reference'
  | 'public_reference'

export type PublicOntologyDomain =
  | 'upper'
  | 'agent'
  | 'process'
  | 'information'
  | 'time'
  | 'relation'
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
  sourceUrl: string
  ontologyIri: string
  trustRole: 'upper_standard' | 'mid_level_standard' | 'domain_standard' | 'descriptive_schema'
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
    sourceUrl: 'http://purl.obolibrary.org/obo/bfo.owl',
    ontologyIri: 'http://purl.obolibrary.org/obo/BFO_0000002',
    trustRole: 'upper_standard',
    description: 'An entity that persists through time while possibly changing.',
  },
  {
    id: 'bfo:occurrent',
    label: 'Occurrent',
    scope: 'bfo_upper',
    domain: 'upper',
    source: 'Basic Formal Ontology',
    sourceUrl: 'http://purl.obolibrary.org/obo/bfo.owl',
    ontologyIri: 'http://purl.obolibrary.org/obo/BFO_0000003',
    trustRole: 'upper_standard',
    description: 'A process, event, or happening that unfolds through time.',
  },
  {
    id: 'bfo:quality',
    label: 'Quality',
    scope: 'bfo_upper',
    domain: 'upper',
    source: 'Basic Formal Ontology',
    sourceUrl: 'http://purl.obolibrary.org/obo/bfo.owl',
    ontologyIri: 'http://purl.obolibrary.org/obo/BFO_0000019',
    trustRole: 'upper_standard',
    description: 'A dependent feature or attribute of an entity.',
  },
  {
    id: 'cco:agent-ontology',
    label: 'Agent Ontology',
    scope: 'mid_level_reference',
    domain: 'agent',
    source: 'Common Core Ontologies',
    sourceUrl: 'https://github.com/CommonCoreOntology/CommonCoreOntologies',
    ontologyIri: 'https://www.commoncoreontologies.org/AgentOntology',
    trustRole: 'mid_level_standard',
    description: 'A BFO-aligned mid-level source for agents, persons, organizations, roles, and agent participation in processes.',
  },
  {
    id: 'cco:event-ontology',
    label: 'Event Ontology',
    scope: 'mid_level_reference',
    domain: 'process',
    source: 'Common Core Ontologies',
    sourceUrl: 'https://github.com/CommonCoreOntology/CommonCoreOntologies',
    ontologyIri: 'https://www.commoncoreontologies.org/EventOntology',
    trustRole: 'mid_level_standard',
    description: 'A BFO-aligned mid-level source for acts, planned acts, natural processes, and process boundaries.',
  },
  {
    id: 'cco:information-entity-ontology',
    label: 'Information Entity Ontology',
    scope: 'mid_level_reference',
    domain: 'information',
    source: 'Common Core Ontologies',
    sourceUrl: 'https://github.com/CommonCoreOntology/CommonCoreOntologies',
    ontologyIri: 'https://www.commoncoreontologies.org/InformationEntityOntology',
    trustRole: 'mid_level_standard',
    description: 'A BFO-aligned mid-level source for information content entities, descriptions, prescriptions, identifiers, and information bearing entities.',
  },
  {
    id: 'cco:time-ontology',
    label: 'Time Ontology',
    scope: 'mid_level_reference',
    domain: 'time',
    source: 'Common Core Ontologies',
    sourceUrl: 'https://github.com/CommonCoreOntology/CommonCoreOntologies',
    ontologyIri: 'https://www.commoncoreontologies.org/TimeOntology',
    trustRole: 'mid_level_standard',
    description: 'A BFO-aligned mid-level source for temporal instants, temporal intervals, and interval relations such as before, during, overlaps, and contains.',
  },
  {
    id: 'cco:extended-relation-ontology',
    label: 'Extended Relation Ontology',
    scope: 'mid_level_reference',
    domain: 'relation',
    source: 'Common Core Ontologies',
    sourceUrl: 'https://github.com/CommonCoreOntology/CommonCoreOntologies',
    ontologyIri: 'https://www.commoncoreontologies.org/ExtendedRelationOntology',
    trustRole: 'mid_level_standard',
    description: 'A BFO-aligned mid-level source for relation semantics such as affects, is cause of, has input, has output, and process starts.',
  },
  {
    id: 'ro:causal-relations',
    label: 'Causal Relations',
    scope: 'mid_level_reference',
    domain: 'relation',
    source: 'OBO Relation Ontology',
    sourceUrl: 'https://oborel.github.io/obo-relations/causal-relations/',
    ontologyIri: 'http://purl.obolibrary.org/obo/ro.owl',
    trustRole: 'mid_level_standard',
    description: 'A BFO/OBO-aligned relation source used to supplement causal and prevention semantics when CCO relation coverage is not specific enough.',
  },
  {
    id: 'domain:sleep',
    label: 'Sleep',
    scope: 'domain_reference',
    domain: 'health',
    source: 'Basic Formal Ontology process reference',
    sourceUrl: 'http://purl.obolibrary.org/obo/bfo.owl',
    ontologyIri: 'http://purl.obolibrary.org/obo/BFO_0000015',
    trustRole: 'upper_standard',
    description: 'A recurring biological process relevant to recovery, cognition, and health.',
  },
  {
    id: 'domain:caffeine',
    label: 'Caffeine',
    scope: 'domain_reference',
    domain: 'nutrition',
    source: 'FoodOn and ChEBI reference layer',
    sourceUrl: 'http://purl.obolibrary.org/obo/foodon.owl',
    ontologyIri: 'http://purl.obolibrary.org/obo/CHEBI_27732',
    trustRole: 'domain_standard',
    description: 'A stimulant compound commonly relevant to energy, alertness, and sleep timing.',
  },
  {
    id: 'domain:software-system',
    label: 'Software system',
    scope: 'domain_reference',
    domain: 'software',
    source: 'Schema.org',
    sourceUrl: 'https://schema.org/SoftwareApplication',
    ontologyIri: 'https://schema.org/SoftwareApplication',
    trustRole: 'descriptive_schema',
    description: 'An engineered system made of components, interfaces, data, and behavior.',
  },
  {
    id: 'domain:habit',
    label: 'Habit',
    scope: 'domain_reference',
    domain: 'behavior',
    source: 'Public behavior reference placeholder',
    sourceUrl: 'http://purl.obolibrary.org/obo/bfo.owl',
    ontologyIri: 'http://purl.obolibrary.org/obo/BFO_0000015',
    trustRole: 'upper_standard',
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

export function getPublicReferencesByDomain(domain: PublicOntologyDomain): PublicOntologyReference[] {
  return PUBLIC_ONTOLOGY_REFERENCES.filter((reference) => reference.domain === domain)
}

export function getPersonalPublicBridgeSummary(): string {
  return PERSONAL_PUBLIC_BRIDGES.map((bridge) => {
    const reference = getPublicReferenceById(bridge.publicReferenceId)
    return `${bridge.personalLabel} ${bridge.relation} ${reference?.label ?? bridge.publicReferenceId}`
  }).join('\n')
}

export function buildPublicOntologyGuardrailSection(
  references: PublicOntologyReference[] = PUBLIC_ONTOLOGY_REFERENCES
): string {
  if (!references.length) return ''

  const lines = references.map((reference) => {
    return `- ${reference.label} (${reference.source}): ${reference.description} [${reference.trustRole}]`
  })

  return `

## Public ontology guardrails
These public/BFO/mid-level references discipline interpretation. They do not override the user's confirmed personal axioms, and they are not medical, dietary, legal, or financial advice. Use them to keep concepts separated, avoid overclaiming, and identify when a domain expert or stronger source is needed.
${lines.join('\n')}
`
}
