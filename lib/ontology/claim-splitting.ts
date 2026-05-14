import type { LifeDomain, OntologyAxiomStatus } from '@/types/ontology'

export type ClaimSplitClassification =
  | 'single_claim'
  | 'multiple_claims'
  | 'unclear'

export type ClaimSplitRecommendedMove =
  | 'continue_normal_review'
  | 'split_before_review'
  | 'keep_as_note_until_human_review'

export interface ClaimSplitInput {
  sourceEntryId: string
  rawText: string
  suggestedDomains: LifeDomain[]
}

export interface SplitCandidateClaim {
  sourceEntryId: string
  originalRawText: string
  claimText: string
  suggestedDomains: LifeDomain[]
  provenance: 'entry_extracted'
  requiresHumanReview: true
  status: Extract<OntologyAxiomStatus, 'candidate'>
}

export interface ClaimSplitResult {
  classification: ClaimSplitClassification
  recommendedMove: ClaimSplitRecommendedMove
  claims: SplitCandidateClaim[]
  reason: string
}

export function splitEntryIntoClaims(input: ClaimSplitInput): ClaimSplitResult {
  const rawText = input.rawText.trim()
  const claimTexts = extractClaimTexts(rawText)

  if (!claimTexts.length || isVagueReflection(rawText)) {
    return {
      classification: 'unclear',
      recommendedMove: 'keep_as_note_until_human_review',
      claims: [],
      reason: 'Entry is too vague to split into testable claims.',
    }
  }

  if (claimTexts.length === 1) {
    return {
      classification: 'single_claim',
      recommendedMove: 'continue_normal_review',
      claims: [buildClaim(input, claimTexts[0])],
      reason: 'Entry appears to contain one focused claim.',
    }
  }

  return {
    classification: 'multiple_claims',
    recommendedMove: 'split_before_review',
    claims: claimTexts.map((claimText) => buildClaim(input, claimText)),
    reason: 'Entry contains multiple distinct claims that should be reviewed separately.',
  }
}

function buildClaim(input: ClaimSplitInput, claimText: string): SplitCandidateClaim {
  return {
    sourceEntryId: input.sourceEntryId,
    originalRawText: input.rawText,
    claimText,
    suggestedDomains: input.suggestedDomains,
    provenance: 'entry_extracted',
    requiresHumanReview: true,
    status: 'candidate',
  }
}

function extractClaimTexts(rawText: string): string[] {
  return rawText
    .split(/(?<=[.!?])\s+/)
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 0)
    .filter((claim) => !isLowSignalFragment(claim))
}

function isVagueReflection(rawText: string): boolean {
  const normalized = rawText.trim().toLowerCase()
  const vagueSignals = [
    'something about',
    'felt important',
    'things change',
    'stuff',
    'vibes',
  ]

  return normalized.length < 80 && vagueSignals.some((signal) => normalized.includes(signal))
}

function isLowSignalFragment(claim: string): boolean {
  const normalized = claim.toLowerCase()
  return normalized.length < 8 || normalized === 'yes.' || normalized === 'no.'
}
