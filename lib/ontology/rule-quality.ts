export interface RuleQualityAxiom {
  antecedent: string
  consequent: string
  provenance?: Record<string, unknown> | null
}

export interface RuleSafetyIssue {
  kind: 'needs_rewrite'
  title: string
  plainReason: string
  originalText: string
}

const PLACEHOLDER_ANTECEDENT_PREFIX = 'Adam treats this as a reusable pattern:'
const PLACEHOLDER_CONSEQUENT = 'future reasoning should consider this pattern only after human confirmation'

export function getRuleSafetyIssue(axiom: RuleQualityAxiom): RuleSafetyIssue | null {
  const parser = typeof axiom.provenance?.parser === 'string' ? axiom.provenance.parser : null
  const antecedent = axiom.antecedent.trim()
  const consequent = axiom.consequent.trim()

  if (
    parser === 'claim_as_pattern' ||
    antecedent.startsWith(PLACEHOLDER_ANTECEDENT_PREFIX) ||
    consequent.toLowerCase() === PLACEHOLDER_CONSEQUENT
  ) {
    return {
      kind: 'needs_rewrite',
      title: 'This is not a rule yet',
      plainReason: 'The app found an idea, but it could not turn it into a clear When/Then rule.',
      originalText: getOriginalRuleText(axiom),
    }
  }

  return null
}

export function isUnsafePlaceholderRule(axiom: RuleQualityAxiom): boolean {
  return getRuleSafetyIssue(axiom) !== null
}

export function getOriginalRuleText(axiom: RuleQualityAxiom): string {
  const rawClaimText = axiom.provenance?.claimText
  if (typeof rawClaimText === 'string' && rawClaimText.trim().length > 0) {
    return rawClaimText.trim()
  }

  if (axiom.antecedent.startsWith(PLACEHOLDER_ANTECEDENT_PREFIX)) {
    return axiom.antecedent.slice(PLACEHOLDER_ANTECEDENT_PREFIX.length).trim()
  }

  return axiom.antecedent.trim()
}
