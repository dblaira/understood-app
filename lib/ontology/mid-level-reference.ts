import type { OntologyRelationshipType } from '@/types/ontology'
import { STANDARD_RELATIONSHIP_TYPES } from '@/types/ontology'

export type MidLevelProfileStatus = 'ship_now' | 'deferred'

export interface MidLevelOntologyProfile {
  id: string
  label: string
  status: MidLevelProfileStatus
  sourceReferenceIds: string[]
  failureMode: string
  competencyQuestion: string
  minimumTerms: string[]
  enforcement: string[]
}

export interface RelationSemanticPolicy {
  relationshipType: OntologyRelationshipType
  label: string
  sourceReferenceIds: string[]
  semanticKind:
    | 'support'
    | 'prediction'
    | 'conflict'
    | 'sequence'
    | 'intensifier'
    | 'inhibitor'
    | 'correlation'
    | 'causation'
    | 'prevention'
    | 'intention'
    | 'outcome'
    | 'influence'
  evidenceExpectation: string
  assistantRule: string
  reviewNote: string
}

export const MID_LEVEL_ONTOLOGY_PROFILES: MidLevelOntologyProfile[] = [
  {
    id: 'profile:agent',
    label: 'Agent Profile',
    status: 'ship_now',
    sourceReferenceIds: ['cco:agent-ontology'],
    failureMode: 'Assistant conflates Adam, mentioned people, organizations, and the AI/system.',
    competencyQuestion: 'CQ-018 and future agent-disambiguation review.',
    minimumTerms: ['Agent', 'Person', 'Organization', 'Role', 'agent in'],
    enforcement: ['Prompt guardrail text', 'Future review labels for Adam, other person, organization, assistant/system'],
  },
  {
    id: 'profile:process-event',
    label: 'Process/Event Profile',
    status: 'ship_now',
    sourceReferenceIds: ['bfo:occurrent', 'cco:event-ontology'],
    failureMode: 'Assistant treats one-time milestones as recurring patterns, or recurring patterns as isolated events.',
    competencyQuestion: 'CQ-018 and future recurrence/pattern review.',
    minimumTerms: ['Process', 'Act', 'Planned Act', 'Process Boundary'],
    enforcement: ['Relation semantics', 'Future recurrence classification before axiom promotion'],
  },
  {
    id: 'profile:information-entity',
    label: 'Information Entity Profile',
    status: 'ship_now',
    sourceReferenceIds: ['cco:information-entity-ontology'],
    failureMode: 'Assistant collapses a claim, evidence item, and storage artifact into the same thing.',
    competencyQuestion: 'CQ-010, CQ-017, CQ-018.',
    minimumTerms: ['Information Content Entity', 'Descriptive Information Content Entity', 'is about', 'describes'],
    enforcement: ['Provenance labels', 'Connections review boundary', 'RDF source metadata'],
  },
  {
    id: 'profile:time',
    label: 'Time Profile',
    status: 'ship_now',
    sourceReferenceIds: ['cco:time-ontology'],
    failureMode: 'Assistant cannot anchor or falsify claims using lately, before, after, every morning, or since.',
    competencyQuestion: 'CQ-003, CQ-009, CQ-018.',
    minimumTerms: ['Temporal Instant', 'Temporal Interval', 'interval before', 'interval during', 'interval overlaps', 'interval contains'],
    enforcement: ['Evidence matching', 'Future temporal validation for longitudinal claims'],
  },
  {
    id: 'profile:guardrail-relations',
    label: 'Guardrail Relations Profile',
    status: 'ship_now',
    sourceReferenceIds: ['cco:extended-relation-ontology', 'ro:causal-relations'],
    failureMode: 'Assistant confuses intention, outcome, causation, prevention, support, prediction, and correlation.',
    competencyQuestion: 'CQ-018.',
    minimumTerms: ['supports', 'predicts', 'correlates with', 'causes', 'prevents', 'intended to achieve', 'has outcome'],
    enforcement: ['Relation policy allowlist', 'SHACL sh:in constraint', 'Semantic validation', 'Prompt contract'],
  },
  {
    id: 'profile:quality',
    label: 'Quality Profile',
    status: 'deferred',
    sourceReferenceIds: ['bfo:quality'],
    failureMode: 'Assistant asserts skill, mood, intensity, or quality levels without source evidence.',
    competencyQuestion: 'Future quality/source CQ.',
    minimumTerms: ['Quality', 'quality of'],
    enforcement: ['Deferred until quality assertions create user-visible errors'],
  },
  {
    id: 'profile:units-of-measure',
    label: 'Units of Measure Profile',
    status: 'deferred',
    sourceReferenceIds: ['cco:information-entity-ontology'],
    failureMode: 'Assistant compares incompatible quantities or drops units.',
    competencyQuestion: 'Future units/quantity CQ.',
    minimumTerms: ['Measurement Unit', 'Measurement Information Content Entity', 'is measurement of'],
    enforcement: ['Deferred until unit comparison errors create user-visible failures'],
  },
  {
    id: 'profile:artifact',
    label: 'Artifact Profile',
    status: 'deferred',
    sourceReferenceIds: ['cco:information-entity-ontology'],
    failureMode: 'Tool, device, or storage-medium context changes a recommendation.',
    competencyQuestion: 'Future tool/artifact CQ.',
    minimumTerms: ['Artifact', 'Information Bearing Entity'],
    enforcement: ['Deferred until artifact context matters to behavior'],
  },
  {
    id: 'profile:facility',
    label: 'Facility Profile',
    status: 'deferred',
    sourceReferenceIds: ['cco:agent-ontology'],
    failureMode: 'Assistant ignores that place type matters, such as gym, office, home, clinic, or venue.',
    competencyQuestion: 'Future facility/place-context CQ.',
    minimumTerms: ['Facility', 'Site', 'located in'],
    enforcement: ['Deferred until environment context changes recommendations'],
  },
  {
    id: 'profile:social-organization',
    label: 'Social/Organization Profile',
    status: 'deferred',
    sourceReferenceIds: ['cco:agent-ontology'],
    failureMode: 'Assistant reasons over richer social networks before agent identity and role boundaries are explicit.',
    competencyQuestion: 'Future social-network CQ.',
    minimumTerms: ['Organization', 'Person', 'Role', 'affiliation'],
    enforcement: ['Deferred until Agent profile is too small for social reasoning'],
  },
  {
    id: 'profile:geospatial',
    label: 'Geospatial Profile',
    status: 'deferred',
    sourceReferenceIds: ['cco:time-ontology'],
    failureMode: 'Assistant makes wrong or unsafe recommendations because location reasoning is underspecified.',
    competencyQuestion: 'Future location/geospatial CQ.',
    minimumTerms: ['Spatial Region', 'Site', 'Geospatial Coordinate Reference System'],
    enforcement: ['Deferred until where-errors matter to user-visible behavior'],
  },
  {
    id: 'profile:currency',
    label: 'Currency Profile',
    status: 'deferred',
    sourceReferenceIds: ['cco:information-entity-ontology'],
    failureMode: 'Assistant mishandles monetary values, price comparisons, or currency units.',
    competencyQuestion: 'Future currency/value CQ.',
    minimumTerms: ['Currency Unit', 'Monetary Value', 'Measurement Unit'],
    enforcement: ['Deferred until monetary comparisons need formal unit handling'],
  },
]

export const RELATION_SEMANTIC_POLICIES: RelationSemanticPolicy[] = [
  {
    relationshipType: 'supports',
    label: 'Supports',
    sourceReferenceIds: ['cco:extended-relation-ontology'],
    semanticKind: 'support',
    evidenceExpectation: 'At least one source makes the consequent more plausible, without implying prediction or cause.',
    assistantRule: 'Describe as supporting evidence, not proof and not causation.',
    reviewNote: 'Good default for weak or early-stage evidence.',
  },
  {
    relationshipType: 'predicts',
    label: 'Predicts',
    sourceReferenceIds: ['cco:event-ontology', 'cco:time-ontology'],
    semanticKind: 'prediction',
    evidenceExpectation: 'Evidence should show the antecedent tends to precede the consequent.',
    assistantRule: 'Describe as expected or likely pattern, not a guaranteed outcome.',
    reviewNote: 'Use when timing matters but mechanism is not established.',
  },
  {
    relationshipType: 'conflicts_with',
    label: 'Conflicts With',
    sourceReferenceIds: ['cco:information-entity-ontology'],
    semanticKind: 'conflict',
    evidenceExpectation: 'The relation marks tension or contradiction between claims or patterns.',
    assistantRule: 'Surface the conflict and preserve both sides until human review resolves it.',
    reviewNote: 'Do not auto-retire either side from conflict alone.',
  },
  {
    relationshipType: 'follows',
    label: 'Follows',
    sourceReferenceIds: ['cco:time-ontology'],
    semanticKind: 'sequence',
    evidenceExpectation: 'Evidence should show temporal order, not necessarily influence.',
    assistantRule: 'Narrate sequence only unless another relation establishes influence.',
    reviewNote: 'Use for before/after structure without causal claims.',
  },
  {
    relationshipType: 'amplifies',
    label: 'Amplifies',
    sourceReferenceIds: ['cco:extended-relation-ontology'],
    semanticKind: 'intensifier',
    evidenceExpectation: 'Evidence should show one factor increasing the strength, likelihood, or salience of another.',
    assistantRule: 'Describe as increasing strength, not independently causing the outcome.',
    reviewNote: 'Useful for compounding personal conditions.',
  },
  {
    relationshipType: 'inhibits',
    label: 'Inhibits',
    sourceReferenceIds: ['cco:extended-relation-ontology'],
    semanticKind: 'inhibitor',
    evidenceExpectation: 'Evidence should show one factor weakening or constraining another.',
    assistantRule: 'Describe as dampening or constraining, not fully preventing.',
    reviewNote: 'Use when the outcome can still occur.',
  },
  {
    relationshipType: 'correlates_with',
    label: 'Correlates With',
    sourceReferenceIds: ['ro:causal-relations'],
    semanticKind: 'correlation',
    evidenceExpectation: 'Evidence should show co-occurrence or association without direction or mechanism.',
    assistantRule: 'Never rewrite as causes, prevents, or predicts without explicit review.',
    reviewNote: 'Safest relation for early pattern discovery.',
  },
  {
    relationshipType: 'causes',
    label: 'Causes',
    sourceReferenceIds: ['cco:extended-relation-ontology', 'ro:causal-relations'],
    semanticKind: 'causation',
    evidenceExpectation: 'Requires stronger evidence than support, prediction, or correlation, ideally repeated temporal evidence plus a plausible mechanism or domain support.',
    assistantRule: 'Treat as causal only when confirmed; otherwise phrase as a proposed causal relationship.',
    reviewNote: 'Escalate if evidence is thin or contradicted.',
  },
  {
    relationshipType: 'prevents',
    label: 'Prevents',
    sourceReferenceIds: ['ro:causal-relations'],
    semanticKind: 'prevention',
    evidenceExpectation: 'Requires evidence about the avoided outcome, not just an undesirable outcome.',
    assistantRule: 'Do not promise prevention; phrase as reducing or blocking a risk only when evidence supports it.',
    reviewNote: 'Prefer inhibits when the outcome is merely reduced.',
  },
  {
    relationshipType: 'intended_to_achieve',
    label: 'Intended To Achieve',
    sourceReferenceIds: ['cco:information-entity-ontology', 'cco:extended-relation-ontology'],
    semanticKind: 'intention',
    evidenceExpectation: 'Evidence should show purpose, aim, objective, plan, or projected state.',
    assistantRule: 'Do not imply the intended outcome happened.',
    reviewNote: 'This relation records intent, not success.',
  },
  {
    relationshipType: 'has_outcome',
    label: 'Has Outcome',
    sourceReferenceIds: ['cco:extended-relation-ontology'],
    semanticKind: 'outcome',
    evidenceExpectation: 'Evidence should show an actual resulting state or output.',
    assistantRule: 'Describe observed outcome without inferring intent.',
    reviewNote: 'Pair with intended_to_achieve only when both purpose and result are evidenced.',
  },
  {
    relationshipType: 'affects',
    label: 'Affects',
    sourceReferenceIds: ['cco:extended-relation-ontology'],
    semanticKind: 'influence',
    evidenceExpectation: 'Evidence should show influence without committing to a specific causal mechanism.',
    assistantRule: 'Use influence language and avoid precise causal claims.',
    reviewNote: 'Useful bridge relation when support is too weak and cause is too strong.',
  },
]

const RELATION_POLICY_BY_TYPE = new Map(
  RELATION_SEMANTIC_POLICIES.map((policy) => [policy.relationshipType, policy])
)

export function getRelationSemanticPolicy(
  relationshipType: OntologyRelationshipType | string
): RelationSemanticPolicy | null {
  return RELATION_POLICY_BY_TYPE.get(relationshipType as OntologyRelationshipType) ?? null
}

export function isAllowedRelationshipType(relationshipType: string): relationshipType is OntologyRelationshipType {
  return RELATION_POLICY_BY_TYPE.has(relationshipType as OntologyRelationshipType)
}

export function getAllowedRelationshipTypes(): OntologyRelationshipType[] {
  return [...STANDARD_RELATIONSHIP_TYPES]
}

export function buildRelationSemanticPromptSection(
  policies: RelationSemanticPolicy[] = RELATION_SEMANTIC_POLICIES
): string {
  if (!policies.length) return ''

  const lines = policies.map((policy) => {
    return `- ${policy.relationshipType}: ${policy.assistantRule}`
  })

  return `

## Mid-level relation semantics
Use these relation meanings when interpreting personal axioms. Name the relation type when it matters. Do not upgrade a weaker relation into a stronger one: correlation is not causation, intention is not outcome, inhibition is not prevention, and support is not proof.
${lines.join('\n')}
`
}
