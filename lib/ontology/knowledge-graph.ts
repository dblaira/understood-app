import type { OntologyAxiomScope, OntologyAxiomStatus, OntologyRelationshipType } from '@/types/ontology'

export interface GraphProjectableAxiom {
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

export interface KnowledgeGraphNode {
  id: string
  label: string
  kind: 'concept'
}

export interface KnowledgeGraphEdge {
  id: string
  sourceId: string
  targetId: string
  relationshipType: OntologyRelationshipType
  confidence: number
  axiomId: string
  evidenceEntryIds: string[]
  evidenceCount: number
  provenance: Record<string, unknown>
}

export interface KnowledgeGraphProjection {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

export function projectAxiomsToKnowledgeGraph(axioms: GraphProjectableAxiom[]): KnowledgeGraphProjection {
  const nodes = new Map<string, KnowledgeGraphNode>()
  const edges: KnowledgeGraphEdge[] = []

  for (const axiom of axioms) {
    if (axiom.status !== 'confirmed' || axiom.scope !== 'personal') continue

    const source = conceptNode(axiom.antecedent)
    const target = conceptNode(axiom.consequent)

    nodes.set(source.id, source)
    nodes.set(target.id, target)
    edges.push({
      id: `axiom:${axiom.id}`,
      sourceId: source.id,
      targetId: target.id,
      relationshipType: axiom.relationshipType,
      confidence: axiom.confidence,
      axiomId: axiom.id,
      evidenceEntryIds: axiom.evidenceEntryIds,
      evidenceCount: axiom.evidenceCount,
      provenance: axiom.provenance,
    })
  }

  return {
    nodes: [...nodes.values()],
    edges,
  }
}

function conceptNode(label: string): KnowledgeGraphNode {
  return {
    id: `concept:${slugifyConcept(label)}`,
    label,
    kind: 'concept',
  }
}

function slugifyConcept(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
