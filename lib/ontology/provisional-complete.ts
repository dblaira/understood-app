import { LIFE_DOMAINS, type LifeDomain, type OntologyRelationshipType } from '@/types/ontology'

export const PROVISIONAL_ONTOLOGY_VERSION = 'understood-provisional-complete-v0'

export type ProvisionalOntologySource =
  | 'journal_entries'
  | 'connections'
  | 'purchase_records'
  | 'health_records'
  | 'fitness_records'
  | 'system_scaffold'

export interface ProvisionalOntologyRule {
  id: string
  name: string
  domains: LifeDomain[]
  antecedent: string
  consequent: string
  relationshipType: OntologyRelationshipType
  confidence: number
  source: ProvisionalOntologySource
  rationale: string
}

export const PROVISIONAL_ONTOLOGY_RULES: readonly ProvisionalOntologyRule[] = [
  {
    id: 'prov-capture-first',
    name: 'Capture first, structure later',
    domains: ['Insight', 'Learning', 'Work'],
    antecedent: 'Adam captures the raw thought before forcing a clean structure',
    consequent: 'the signal is preserved and can be organized later without blocking momentum',
    relationshipType: 'supports',
    confidence: 0.64,
    source: 'connections',
    rationale: 'Repeated Connections favor preserving information before perfect formatting.',
  },
  {
    id: 'prov-writing-thinking',
    name: 'Writing changes the relationship',
    domains: ['Insight', 'Belief', 'Affect'],
    antecedent: 'Adam articulates a thought clearly in writing',
    consequent: 'the thought becomes easier to inspect, challenge, and use',
    relationshipType: 'causes',
    confidence: 0.66,
    source: 'connections',
    rationale: 'The app repeatedly treats articulation as a thinking tool, not a recordkeeping chore.',
  },
  {
    id: 'prov-space-cognitive-load',
    name: 'Space lowers cognitive load',
    domains: ['Affect', 'Health', 'Work'],
    antecedent: 'Adam creates space, removes clutter, or reduces immediate pressure',
    consequent: 'stress and cognitive load decrease, making better decisions more likely',
    relationshipType: 'predicts',
    confidence: 0.62,
    source: 'connections',
    rationale: 'Existing connection material links space to anxiety reduction and decision quality.',
  },
  {
    id: 'prov-delegation-three-sentences',
    name: 'Delegation needs three sentences',
    domains: ['Work', 'Learning'],
    antecedent: 'Adam delegates with what he wants, how he thinks about it, and what done looks like',
    consequent: 'handoff quality improves and fewer clarifying loops are needed',
    relationshipType: 'causes',
    confidence: 0.68,
    source: 'connections',
    rationale: 'A calibrated Connection already states this as a strong operating principle.',
  },
  {
    id: 'prov-compute-over-cleverness',
    name: 'Use compute over cleverness',
    domains: ['Work', 'Learning', 'Ambition'],
    antecedent: 'a hand-built or clever solution starts to plateau',
    consequent: 'Adam should use computation, retrieval, or automation to extend the system',
    relationshipType: 'supports',
    confidence: 0.63,
    source: 'connections',
    rationale: 'The ontology build itself depends on replacing ad hoc memory with structured compute.',
  },
  {
    id: 'prov-export-judgment',
    name: 'Export judgment into systems',
    domains: ['Work', 'Ambition', 'Insight'],
    antecedent: 'Adam turns a judgment into a reusable rule, template, or workflow',
    consequent: 'the value compounds beyond the original task',
    relationshipType: 'causes',
    confidence: 0.67,
    source: 'connections',
    rationale: 'Existing material says doing the task once is less valuable than exporting the judgment.',
  },
  {
    id: 'prov-structural-edge',
    name: 'Find the structural edge',
    domains: ['Ambition', 'Work', 'Belief'],
    antecedent: 'Adam looks for the structural edge instead of simply applying more effort',
    consequent: 'progress can compound without relying on overwork',
    relationshipType: 'supports',
    confidence: 0.61,
    source: 'connections',
    rationale: 'The product direction repeatedly favors systems that reduce repeated effort.',
  },
  {
    id: 'prov-vocabulary-gap',
    name: 'Vocabulary gap blocks specification',
    domains: ['Learning', 'Work', 'Affect'],
    antecedent: 'Adam cannot specify what he wants from a builder or model',
    consequent: 'the likely blocker is missing vocabulary or structure, not weak judgment',
    relationshipType: 'predicts',
    confidence: 0.6,
    source: 'journal_entries',
    rationale: 'Recent ontology frustration centers on not being able to scrutinize the build.',
  },
  {
    id: 'prov-question-fatigue',
    name: 'Question fatigue is a failure signal',
    domains: ['Affect', 'Work', 'Insight'],
    antecedent: 'the system keeps asking Adam to answer setup questions',
    consequent: 'the builder should infer a complete provisional version and make it testable',
    relationshipType: 'causes',
    confidence: 0.74,
    source: 'journal_entries',
    rationale: 'The current task explicitly rejects more questions and demands a testable scaffold.',
  },
  {
    id: 'prov-momentum-worthwhile',
    name: 'Momentum has value',
    domains: ['Ambition', 'Affect', 'Work'],
    antecedent: 'an action creates real momentum without pretending to be final truth',
    consequent: 'it is worthwhile as a first step toward a better system',
    relationshipType: 'supports',
    confidence: 0.59,
    source: 'connections',
    rationale: 'The user wants a usable imperfect version to test and revise.',
  },
  {
    id: 'prov-sleep-patience',
    name: 'Sleep affects patience',
    domains: ['Sleep', 'Affect', 'Work'],
    antecedent: 'sleep quality or recovery is low',
    consequent: 'patience, mood stability, and decision quality are more fragile',
    relationshipType: 'predicts',
    confidence: 0.54,
    source: 'health_records',
    rationale: 'A provisional ontology should connect sleep and recovery data to cognitive-emotional state.',
  },
  {
    id: 'prov-exercise-affect',
    name: 'Exercise shifts affect',
    domains: ['Exercise', 'Affect', 'Health'],
    antecedent: 'Adam completes meaningful movement, training, or recovery work',
    consequent: 'energy, agency, and emotional regulation tend to improve',
    relationshipType: 'predicts',
    confidence: 0.55,
    source: 'fitness_records',
    rationale: 'Fitness records are a major data source and need an initial bridge to affect and agency.',
  },
  {
    id: 'prov-nutrition-energy',
    name: 'Nutrition affects energy',
    domains: ['Nutrition', 'Health', 'Affect'],
    antecedent: 'nutrition, hydration, or supplement consistency changes',
    consequent: 'energy, cravings, focus, and body-state interpretation may change',
    relationshipType: 'affects',
    confidence: 0.5,
    source: 'health_records',
    rationale: 'Nutrition data should influence hypotheses without becoming medical advice.',
  },
  {
    id: 'prov-health-constraint',
    name: 'Health constraints change capacity',
    domains: ['Health', 'Work', 'Ambition'],
    antecedent: 'symptoms, injury, treatment, or body constraints appear',
    consequent: 'plans should account for available capacity instead of treating output as a character test',
    relationshipType: 'affects',
    confidence: 0.58,
    source: 'health_records',
    rationale: 'Health context should constrain interpretation of productivity and ambition signals.',
  },
  {
    id: 'prov-purchase-friction',
    name: 'Purchases reveal friction',
    domains: ['Purchase', 'Work', 'Affect'],
    antecedent: 'spending clusters around tools, subscriptions, repairs, or convenience',
    consequent: 'there may be an unmet need, repeated friction, or attempted self-support pattern',
    relationshipType: 'predicts',
    confidence: 0.51,
    source: 'purchase_records',
    rationale: 'Purchase data should be interpreted as behavioral evidence, not only expense history.',
  },
  {
    id: 'prov-subscription-drift',
    name: 'Subscriptions expose abandoned intent',
    domains: ['Purchase', 'Ambition', 'Belief'],
    antecedent: 'a subscription or recurring purchase persists without matching use',
    consequent: 'there may be an old intention, identity claim, or avoidance pattern to review',
    relationshipType: 'predicts',
    confidence: 0.49,
    source: 'purchase_records',
    rationale: 'Recurring transactions are a useful provisional signal for stale goals and unused tools.',
  },
  {
    id: 'prov-social-regulation',
    name: 'Social contact regulates state',
    domains: ['Social', 'Affect', 'Health'],
    antecedent: 'Adam has meaningful contact, repair, belonging, or unresolved social friction',
    consequent: 'mood, stress, and sense of support can shift materially',
    relationshipType: 'affects',
    confidence: 0.52,
    source: 'journal_entries',
    rationale: 'Stories and relationships need a bridge to affect and health context.',
  },
  {
    id: 'prov-entertainment-restoration',
    name: 'Entertainment can restore or avoid',
    domains: ['Entertainment', 'Affect', 'Ambition'],
    antecedent: 'entertainment, novelty, media, or play appears near fatigue or resistance',
    consequent: 'it may be restorative recovery or avoidance depending on surrounding evidence',
    relationshipType: 'affects',
    confidence: 0.48,
    source: 'journal_entries',
    rationale: 'Leisure data should not be judged automatically; context decides whether it restores or displaces.',
  },
  {
    id: 'prov-belief-behavior',
    name: 'Beliefs should predict behavior',
    domains: ['Belief', 'Ambition', 'Insight'],
    antecedent: 'Adam writes a belief, principle, or identity claim',
    consequent: 'the system should look for whether later behavior supports, weakens, or contradicts it',
    relationshipType: 'supports',
    confidence: 0.57,
    source: 'system_scaffold',
    rationale: 'A dependable ontology needs contradiction checks between stated principles and later evidence.',
  },
  {
    id: 'prov-cross-domain-first',
    name: 'Cross-domain patterns matter most',
    domains: ['Insight', 'Work', 'Health', 'Purchase'],
    antecedent: 'the same pattern appears across journal notes, purchases, health data, and actions',
    consequent: 'the pattern deserves higher review priority than a single isolated entry',
    relationshipType: 'supports',
    confidence: 0.65,
    source: 'system_scaffold',
    rationale: 'The value of the lab app is constraining inference with multiple evidence streams.',
  },
] as const

export interface ProvisionalOntologyCoverage {
  coveredDomains: LifeDomain[]
  missingDomains: LifeDomain[]
  rulesByDomain: Record<LifeDomain, ProvisionalOntologyRule[]>
}

export function getProvisionalOntologyCoverage(): ProvisionalOntologyCoverage {
  const rulesByDomain = LIFE_DOMAINS.reduce((acc, domain) => {
    acc[domain] = []
    return acc
  }, {} as Record<LifeDomain, ProvisionalOntologyRule[]>)

  for (const rule of PROVISIONAL_ONTOLOGY_RULES) {
    for (const domain of rule.domains) {
      rulesByDomain[domain].push(rule)
    }
  }

  const coveredDomains = LIFE_DOMAINS.filter((domain) => rulesByDomain[domain].length > 0)

  return {
    coveredDomains,
    missingDomains: LIFE_DOMAINS.filter((domain) => rulesByDomain[domain].length === 0),
    rulesByDomain,
  }
}

export function buildProvisionalOntologyPromptSection(): string {
  const lines = PROVISIONAL_ONTOLOGY_RULES.map((rule) => {
    const domains = rule.domains.join(', ')
    return `- [${rule.id}] ${rule.name} (${domains}, ${rule.relationshipType}, ${(rule.confidence * 100).toFixed(0)}% provisional): If ${rule.antecedent}, then ${rule.consequent}.`
  }).join('\n')

  return `
## Provisional complete ontology test scaffold
These are guessed, provisional rules for testing the ontology mechanism before Adam has confirmed enough personal axioms. Confirmed ontology axioms override these rules. User-authored Connections are stronger than these when directly relevant. Use these only as hypotheses, not facts. If a provisional rule materially shapes an answer, say it is provisional.

${lines}
`
}
