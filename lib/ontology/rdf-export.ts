import type { OntologyAxiomScope, OntologyAxiomStatus, OntologyRelationshipType } from '@/types/ontology'
import { getRelationSemanticPolicy } from '@/lib/ontology/mid-level-reference'
import { isUnsafePlaceholderRule } from '@/lib/ontology/rule-quality'

const BASE_IRI = 'https://understood.app/ontology'
export const ONTOLOGY_VOCAB_VERSION = 'understood-ontology-v1'

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

export interface RdfExportMetadata {
  vocabularyVersion?: string
  appVersion?: string
  exportedAt?: string
}

export function exportAxiomsToTurtle(
  axioms: RdfExportableAxiom[],
  metadata: RdfExportMetadata = {}
): string {
  const confirmedPersonalAxioms = axioms.filter((axiom) => {
    return axiom.status === 'confirmed' && axiom.scope === 'personal' && !isUnsafePlaceholderRule(axiom)
  })

  const sections = [
    `# vocabularyVersion: ${escapeComment(metadata.vocabularyVersion ?? ONTOLOGY_VOCAB_VERSION)}`,
    `# appVersion: ${escapeComment(metadata.appVersion ?? 'unknown')}`,
    metadata.exportedAt ? `# exportedAt: ${escapeComment(metadata.exportedAt)}` : null,
    '',
    '@prefix understood: <https://understood.app/ontology#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '',
    ...getUsedRelationshipTypes(confirmedPersonalAxioms).map((relationshipType) => relationPolicyTurtle(relationshipType)),
    ...confirmedPersonalAxioms.flatMap((axiom) => [
      conceptTurtle(axiom.antecedent),
      conceptTurtle(axiom.consequent),
      axiomTurtle(axiom),
    ]),
  ]

  return `${sections.filter((section) => section != null).join('\n\n')}\n`
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
    `  understood:relationshipPolicy ${relationPolicyIri(axiom.relationshipType)} ;`,
    `  understood:relationshipType "${escapeTurtleString(axiom.relationshipType)}" ;`,
    `  understood:confidence "${formatDecimal(axiom.confidence)}"^^xsd:decimal ;`,
    `  understood:evidenceCount ${Math.max(axiom.evidenceCount, axiom.evidenceEntryIds.length)} ;`,
    `  understood:status "${axiom.status}" ;`,
    `  understood:scope "${axiom.scope}" ;`,
    `  understood:provenanceSource "${escapeTurtleString(provenanceSource)}" .`,
  ].join('\n')
}

function relationPolicyTurtle(relationshipType: OntologyRelationshipType): string {
  const policy = getRelationSemanticPolicy(relationshipType)

  if (!policy) {
    return [
      `${relationPolicyIri(relationshipType)} a understood:RelationPolicy ;`,
      `  understood:relationshipType "${escapeTurtleString(relationshipType)}" .`,
    ].join('\n')
  }

  return [
    `${relationPolicyIri(relationshipType)} a understood:RelationPolicy ;`,
    `  understood:relationshipType "${escapeTurtleString(policy.relationshipType)}" ;`,
    `  understood:relationLabel "${escapeTurtleString(policy.label)}" ;`,
    `  understood:semanticKind "${escapeTurtleString(policy.semanticKind)}" ;`,
    `  understood:evidenceExpectation "${escapeTurtleString(policy.evidenceExpectation)}" ;`,
    `  understood:assistantRule "${escapeTurtleString(policy.assistantRule)}" ;`,
    `  understood:sourceReferenceIds "${escapeTurtleString(policy.sourceReferenceIds.join(','))}" .`,
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

function relationPolicyIri(relationshipType: OntologyRelationshipType): string {
  return iri('relation', relationshipType)
}

function iri(kind: 'axiom' | 'concept' | 'relation', value: string): string {
  return `<${BASE_IRI}/${kind}/${encodeURIComponent(value)}>`
}

function getUsedRelationshipTypes(axioms: RdfExportableAxiom[]): OntologyRelationshipType[] {
  return [...new Set(axioms.map((axiom) => axiom.relationshipType))]
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

function escapeComment(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim()
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(value)
}
