/**
 * The 8-Step Success Architecture — Adam Pattern
 *
 * Replaces life-area navigation on iOS capture surfaces.
 * Life domains remain in the ontology/extraction layer for historical data;
 * new iOS entries classify by pattern step instead.
 *
 * @see marketing/spine.md §4 The Method
 * @see Docs/ios-suite-product-decisions.md
 */

export const ADAM_PATTERN_STEPS = [
  'Context',
  'Circle',
  'Close the Gap',
  'Choose Success',
  'Code the Pattern',
  'Create Kill Switch',
  'Clear Sign of Success',
  'Compound',
] as const

export type AdamPatternStep = (typeof ADAM_PATTERN_STEPS)[number]

/** User-facing one-line cue for each step (picker subtitle / onboarding) */
export const ADAM_PATTERN_STEP_HINTS: Record<AdamPatternStep, string> = {
  'Context': 'Accept the data you have',
  'Circle': 'Watch before you move',
  'Close the Gap': 'Find the vocabulary you are missing',
  'Choose Success': 'Pick one measurable outcome',
  'Code the Pattern': 'Put the axiom into the rules',
  'Create Kill Switch': 'Define when to stop trusting it',
  'Clear Sign of Success': 'Look for the signal, not the feeling',
  'Compound': 'Keep recording; let it sharpen',
}

export function isAdamPatternStep(value: string): value is AdamPatternStep {
  return (ADAM_PATTERN_STEPS as readonly string[]).includes(value)
}
