import { isAllowedRelationshipType } from '@/lib/ontology/mid-level-reference'

export interface TurtleValidationIssue {
  subject: string
  missingPredicates: string[]
  invalidRelationshipTypes?: string[]
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
    const invalidRelationshipTypes = extractRelationshipTypes(block).filter((relationshipType) => {
      return !isAllowedRelationshipType(relationshipType)
    })
    return {
      subject,
      missingPredicates,
      ...(invalidRelationshipTypes.length > 0 ? { invalidRelationshipTypes } : {}),
    }
  }).filter((issue) => issue.missingPredicates.length > 0 || (issue.invalidRelationshipTypes?.length ?? 0) > 0)

  return {
    valid: issues.length === 0,
    checkedSubjects: subjects.length,
    issues,
  }
}

function extractRelationshipTypes(block: string): string[] {
  return [...block.matchAll(/understood:relationshipType\s+"([^"]+)"/g)].map((match) => match[1])
}

function extractAxiomSubjectBlocks(turtle: string): Array<{ subject: string; block: string }> {
  const blocks = turtle
    .split(/\n\.\n?/g)
    .map((block) => block.trim())
    .filter((block) => block.includes('a understood:Axiom'))

  return blocks.map((block) => {
    const subject = block.match(/(?:^|\n)\s*((?:understood:[^\s]+)|(?:<[^>]+>))\s+(?:a\s+understood:Axiom|[\s\S]*?\n\s+a\s+understood:Axiom)/)?.[1] ?? 'unknown'
    return { subject, block }
  })
}
