import { getAllowedRelationshipTypes } from '@/lib/ontology/mid-level-reference'

export function buildOntologyShaclShapes(): string {
  const allowedRelationshipTypes = getAllowedRelationshipTypes()
    .map((relationshipType) => `"${relationshipType}"`)
    .join(' ')

  return `@prefix understood: <https://understood.app/ontology#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

understood:AxiomShape a sh:NodeShape ;
  sh:targetClass understood:Axiom ;
  sh:property [
    sh:path understood:axiomId ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path understood:antecedent ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path understood:consequent ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path understood:relationshipType ;
    sh:minCount 1 ;
    sh:in (${allowedRelationshipTypes}) ;
  ] ;
  sh:property [
    sh:path understood:confidence ;
    sh:minCount 1 ;
    sh:datatype xsd:decimal ;
  ] ;
  sh:property [
    sh:path understood:evidenceCount ;
    sh:minCount 1 ;
    sh:datatype xsd:integer ;
  ] ;
  sh:property [
    sh:path understood:provenanceSource ;
    sh:minCount 1 ;
  ] .
`
}
