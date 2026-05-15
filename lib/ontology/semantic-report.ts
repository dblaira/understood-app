import type { RdfExportableAxiom, RdfExportMetadata } from '@/lib/ontology/rdf-export'
import { ONTOLOGY_VOCAB_VERSION, exportAxiomsToTurtle } from '@/lib/ontology/rdf-export'
import { validateOntologyAxiomTurtle, type TurtleValidationResult } from '@/lib/ontology/semantic-validation'
import { buildOntologyShaclShapes } from '@/lib/ontology/shacl-shapes'
import {
  buildContradictionEvidenceQuery,
  buildGraphProjectionQuery,
  buildPromptEligibleAxiomsQuery,
  buildProvenanceSourceQuery,
  buildRelationSemanticsQuery,
} from '@/lib/ontology/sparql-queries'
import { isUnsafePlaceholderRule } from '@/lib/ontology/rule-quality'

export interface OntologySemanticReport {
  exportedAxiomCount: number
  vocabularyVersion: string
  appVersion: string
  turtle: string
  shacl: string
  validation: TurtleValidationResult
  queryTemplateCount: number
  queryNames: string[]
}

export function buildOntologySemanticReport(
  axioms: RdfExportableAxiom[],
  metadata: RdfExportMetadata = {}
): OntologySemanticReport {
  const vocabularyVersion = metadata.vocabularyVersion ?? ONTOLOGY_VOCAB_VERSION
  const appVersion = metadata.appVersion ?? 'unknown'
  const turtle = exportAxiomsToTurtle(axioms, { ...metadata, vocabularyVersion, appVersion })
  const validation = validateOntologyAxiomTurtle(turtle)
  const queries = [
    { name: 'CQ-005 prompt eligibility', query: buildPromptEligibleAxiomsQuery() },
    { name: 'CQ-006 graph projection', query: buildGraphProjectionQuery() },
    { name: 'CQ-009 contradiction evidence', query: buildContradictionEvidenceQuery() },
    { name: 'CQ-010 provenance source', query: buildProvenanceSourceQuery() },
    { name: 'CQ-018 relation semantics', query: buildRelationSemanticsQuery() },
  ]

  return {
    exportedAxiomCount: axioms.filter((axiom) => (
      axiom.status === 'confirmed' &&
      axiom.scope === 'personal' &&
      !isUnsafePlaceholderRule(axiom)
    )).length,
    vocabularyVersion,
    appVersion,
    turtle,
    shacl: buildOntologyShaclShapes(),
    validation,
    queryTemplateCount: queries.length,
    queryNames: queries.map((query) => query.name),
  }
}
