import { LIFE_DOMAINS, type OntologyAxiomScope, type OntologyAxiomStatus } from '@/types/ontology'

export type OntologyAxiomPromptRow = {
  antecedent: string
  consequent: string
  confidence: number | string
  status?: OntologyAxiomStatus | string | null
  scope?: OntologyAxiomScope | string | null
}

export interface OntologyPromptSectionOptions {
  confidenceGate?: number
}

/** Appended to infer-entry (and similar) system/user prompts. */
export function buildOntologyPromptSection(
  axioms: OntologyAxiomPromptRow[],
  options: OntologyPromptSectionOptions = {}
): string {
  const confidenceGate = options.confidenceGate ?? 0.5
  const activeAxioms = axioms.filter((axiom) => {
    const confidence = normalizeConfidence(axiom.confidence)
    return (
      axiom.status === 'confirmed' &&
      axiom.scope === 'personal' &&
      axiom.antecedent.trim().length > 0 &&
      axiom.consequent.trim().length > 0 &&
      confidence >= confidenceGate
    )
  })

  if (!activeAxioms.length) return ''

  const lines = activeAxioms.map((a) => {
    const c = typeof a.confidence === 'number' ? a.confidence : Number(a.confidence)
    const conf = Number.isFinite(c) ? c : 0
    return `- ${a.antecedent} → ${a.consequent} (confidence ${conf})`
  })

  const domainList = LIFE_DOMAINS.join(' | ')

  return `

## Personal ontology rules
Active axioms (use as formal hypotheses when classifying and tagging):
${lines.join('\n')}

Also set **life_domains** to zero or more values from this closed set (exact spelling, JSON array of strings):
${domainList}
Only include domains clearly supported by the entry text; otherwise use [].
`
}

function normalizeConfidence(raw: number | string): number {
  const confidence = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(confidence) ? confidence : 0
}
