import type { RdfExportableAxiom } from '@/lib/ontology/rdf-export'
import { exportAxiomsToTurtle } from '@/lib/ontology/rdf-export'
import { validateOntologyAxiomTurtle, type TurtleValidationResult } from '@/lib/ontology/semantic-validation'
import { buildOntologyShaclShapes } from '@/lib/ontology/shacl-shapes'
import {
  buildContradictionEvidenceQuery,
  buildGraphProjectionQuery,
  buildPromptEligibleAxiomsQuery,
  buildProvenanceSourceQuery,
} from '@/lib/ontology/sparql-queries'

export interface OntologySemanticReport {
  exportedAxiomCount: number
  turtle: string
  shacl: string
  validation: TurtleValidationResult
  queryTemplateCount: number
  queryNames: string[]
}

export function buildOntologySemanticReport(axioms: RdfExportableAxiom[]): OntologySemanticReport {
  const turtle = exportAxiomsToTurtle(axioms)
  const validation = validateOntologyAxiomTurtle(turtle)
  const queries = [
    { name: 'CQ-005 prompt eligibility', query: buildPromptEligibleAxiomsQuery() },
    { name: 'CQ-006 graph projection', query: buildGraphProjectionQuery() },
    { name: 'CQ-009 contradiction evidence', query: buildContradictionEvidenceQuery() },
    { name: 'CQ-010 provenance source', query: buildProvenanceSourceQuery() },
  ]

  return {
    exportedAxiomCount: axioms.filter((axiom) => axiom.status === 'confirmed' && axiom.scope === 'personal').length,
    turtle,
    shacl: buildOntologyShaclShapes(),
    validation,
    queryTemplateCount: queries.length,
    queryNames: queries.map((query) => query.name),
  }
}
