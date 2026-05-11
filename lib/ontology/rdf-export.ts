import type { OntologyAxiomScope, OntologyAxiomStatus, OntologyRelationshipType } from '@/types/ontology'

const BASE_IRI = 'https://understood.app/ontology'

export interface RdfExportableAxiom {
  id: string
  antecedent: string
  consequent: string
  confidence: number
  status: OntologyAxiomStatus
  scope: OntologyAxiomScope
  relationshipType: OntologyRelationshipType
  evidenceEntryIds: string[]
  evidenceCount: number
  provenance: Record<string, unknown>
}

export function exportAxiomsToTurtle(axioms: RdfExportableAxiom[]): string {
  const confirmedPersonalAxioms = axioms.filter((axiom) => {
    return axiom.status === 'confirmed' && axiom.scope === 'personal'
  })

  const sections = [
    '@prefix understood: <https://understood.app/ontology#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '',
    ...confirmedPersonalAxioms.flatMap((axiom) => [
      conceptTurtle(axiom.antecedent),
      conceptTurtle(axiom.consequent),
      axiomTurtle(axiom),
    ]),
  ]

  return `${sections.join('\n\n')}\n`
}

function axiomTurtle(axiom: RdfExportableAxiom): string {
  const provenanceSource = typeof axiom.provenance.source === 'string'
    ? axiom.provenance.source
    : 'unknown'

  return [
    `${iri('axiom', axiom.id)} a understood:Axiom ;`,
    `  understood:axiomId "${escapeTurtleString(axiom.id)}" ;`,
    `  understood:antecedent ${conceptIri(axiom.antecedent)} ;`,
    `  understood:antecedentLabel "${escapeTurtleString(axiom.antecedent)}" ;`,
    `  understood:consequent ${conceptIri(axiom.consequent)} ;`,
    `  understood:consequentLabel "${escapeTurtleString(axiom.consequent)}" ;`,
    `  understood:relationshipType "${escapeTurtleString(axiom.relationshipType)}" ;`,
    `  understood:confidence "${formatDecimal(axiom.confidence)}"^^xsd:decimal ;`,
    `  understood:evidenceCount ${Math.max(axiom.evidenceCount, axiom.evidenceEntryIds.length)} ;`,
    `  understood:status "${axiom.status}" ;`,
    `  understood:scope "${axiom.scope}" ;`,
    `  understood:provenanceSource "${escapeTurtleString(provenanceSource)}" .`,
  ].join('\n')
}

function conceptTurtle(label: string): string {
  return [
    `${conceptIri(label)} a understood:Concept ;`,
    `  understood:label "${escapeTurtleString(label)}" .`,
  ].join('\n')
}

function conceptIri(label: string): string {
  return iri('concept', slugify(label))
}

function iri(kind: 'axiom' | 'concept', value: string): string {
  return `<${BASE_IRI}/${kind}/${encodeURIComponent(value)}>`
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'unnamed'
}

function escapeTurtleString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(value)
}
