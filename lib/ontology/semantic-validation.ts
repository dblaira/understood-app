export interface TurtleValidationIssue {
  subject: string
  missingPredicates: string[]
}

export interface TurtleValidationResult {
  valid: boolean
  checkedSubjects: number
  issues: TurtleValidationIssue[]
}

export const REQUIRED_AXIOM_TURTLE_PREDICATES = [
  'understood:axiomId',
  'understood:antecedent',
  'understood:consequent',
  'understood:relationshipType',
  'understood:confidence',
  'understood:evidenceCount',
  'understood:provenanceSource',
] as const

export function validateOntologyAxiomTurtle(turtle: string): TurtleValidationResult {
  const subjects = extractAxiomSubjectBlocks(turtle)
  const issues = subjects.map(({ subject, block }) => {
    const missingPredicates = REQUIRED_AXIOM_TURTLE_PREDICATES.filter((predicate) => !block.includes(predicate))
    return { subject, missingPredicates }
  }).filter((issue) => issue.missingPredicates.length > 0)

  return {
    valid: issues.length === 0,
    checkedSubjects: subjects.length,
    issues,
  }
}

function extractAxiomSubjectBlocks(turtle: string): Array<{ subject: string; block: string }> {
  const blocks = turtle
    .split(/\n\.\n?/g)
    .map((block) => block.trim())
    .filter((block) => block.includes('a understood:Axiom'))

  return blocks.map((block) => {
    const subject = block.match(/^(understood:[^\s]+)/)?.[1] ?? 'unknown'
    return { subject, block }
  })
}

