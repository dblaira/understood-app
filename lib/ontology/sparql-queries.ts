const PREFIXES = `PREFIX understood: <https://understood.app/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`

export function buildPromptEligibleAxiomsQuery(confidenceGate = 0.5): string {
  return `${PREFIXES}

# CQ-005: Assistant Prompt Eligibility
SELECT ?axiom ?antecedent ?consequent ?confidence
WHERE {
  ?axiom a understood:Axiom ;
    understood:status "confirmed" ;
    understood:scope "personal" ;
    understood:antecedent ?antecedent ;
    understood:consequent ?consequent ;
    understood:confidence ?confidence .
  FILTER(?confidence >= ${confidenceGate})
}
ORDER BY DESC(?confidence)
`
}

export function buildGraphProjectionQuery(): string {
  return `${PREFIXES}

# CQ-006: Knowledge Graph Projection
SELECT ?axiom ?antecedent ?relationshipType ?consequent ?confidence
WHERE {
  ?axiom a understood:Axiom ;
    understood:status "confirmed" ;
    understood:scope "personal" ;
    understood:antecedent ?antecedent ;
    understood:relationshipType ?relationshipType ;
    understood:consequent ?consequent ;
    understood:confidence ?confidence .
}
ORDER BY ?antecedent ?relationshipType ?consequent
`
}

export function buildContradictionEvidenceQuery(): string {
  return `${PREFIXES}

# CQ-009: Contradiction Detection
SELECT ?axiom ?contradiction
WHERE {
  ?axiom a understood:Axiom ;
    understood:contradiction ?contradiction .
}
ORDER BY ?axiom
`
}

export function buildProvenanceSourceQuery(): string {
  return `${PREFIXES}

# CQ-010: Provenance and Source Trust
SELECT ?axiom ?provenanceSource
WHERE {
  ?axiom a understood:Axiom ;
    understood:provenanceSource ?provenanceSource .
}
ORDER BY ?provenanceSource ?axiom
`
}

export function buildRelationSemanticsQuery(): string {
  return `${PREFIXES}

# CQ-018: Relation Semantics for Guardrails
SELECT ?axiom ?relationshipType ?relationshipPolicy ?semanticKind ?assistantRule
WHERE {
  ?axiom a understood:Axiom ;
    understood:relationshipType ?relationshipType ;
    understood:relationshipPolicy ?relationshipPolicy .
  OPTIONAL {
    ?relationshipPolicy understood:semanticKind ?semanticKind ;
      understood:assistantRule ?assistantRule .
  }
}
ORDER BY ?relationshipType ?axiom
`
}
