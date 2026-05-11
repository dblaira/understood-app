export type OntologyBoundary =
  | 'personal_pattern'
  | 'product_system'
  | 'both'
  | 'unclear'

export type BoundaryRecommendedMove =
  | 'eligible_for_personal_candidate'
  | 'remain_note_or_product_candidate'
  | 'split_into_personal_and_product_claims'
  | 'keep_as_note_until_clear'

export interface OntologyBoundaryClassification {
  boundary: OntologyBoundary
  recommendedMove: BoundaryRecommendedMove
  shouldSplitClaims: boolean
  reason: string
}

const PERSONAL_PATTERN_TERMS = [
  ' i ',
  ' my ',
  ' me ',
  ' myself',
  'adam',
  'life',
  'behavior',
  'preference',
  'relationship',
  'attention',
  'energy',
  'judgment',
  'feel',
  'felt',
  'sleep',
  'exercise',
  'work patience',
  'productivity',
  'satisfaction',
]

const PRODUCT_SYSTEM_TERMS = [
  'understood',
  'app',
  'autosave',
  'save function',
  'architecture',
  'user',
  'users',
  'workflow',
  'bug',
  'feature',
  'strategy',
  'notification',
  'notifications',
  'connections',
  'database',
  'ui',
  'product',
]

export function classifyOntologyBoundary(content: string): OntologyBoundaryClassification {
  const normalized = ` ${content.trim().toLowerCase()} `
  const hasPersonalPattern = PERSONAL_PATTERN_TERMS.some((term) => includesTerm(normalized, term))
  const hasProductSystem = PRODUCT_SYSTEM_TERMS.some((term) => includesTerm(normalized, term))

  if (hasPersonalPattern && hasProductSystem) {
    return {
      boundary: 'both',
      recommendedMove: 'split_into_personal_and_product_claims',
      shouldSplitClaims: true,
      reason: 'Item contains both personal-pattern and product/system material.',
    }
  }

  if (hasProductSystem) {
    return {
      boundary: 'product_system',
      recommendedMove: 'remain_note_or_product_candidate',
      shouldSplitClaims: false,
      reason: 'Item describes Understood, app architecture, users, workflows, bugs, features, or strategy.',
    }
  }

  if (hasPersonalPattern) {
    return {
      boundary: 'personal_pattern',
      recommendedMove: 'eligible_for_personal_candidate',
      shouldSplitClaims: false,
      reason: 'Item describes Adam, life, behavior, preferences, relationships, attention, energy, or judgment.',
    }
  }

  return {
    boundary: 'unclear',
    recommendedMove: 'keep_as_note_until_clear',
    shouldSplitClaims: false,
    reason: 'Item does not clearly indicate whether it belongs to the personal or product ontology.',
  }
}

function includesTerm(normalizedContent: string, rawTerm: string): boolean {
  const term = rawTerm.trim().toLowerCase()
  if (!term) return false

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(normalizedContent)
}
