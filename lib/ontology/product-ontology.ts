import {
  CONNECTION_ONTOLOGY_INTAKE_ITEMS,
  type ConnectionOntologyIntakeItem,
} from '@/lib/ontology/connections-intake'

export type ProductOntologyPrincipleKind =
  | 'product_system_principle'
  | 'mixed_product_claim'

export interface ProductOntologyPrinciple {
  id: string
  headline: string
  kind: ProductOntologyPrincipleKind
  draft: string
  sourceConnectionId: string
}

export function extractProductOntologyPrinciples(
  items: ConnectionOntologyIntakeItem[] = CONNECTION_ONTOLOGY_INTAKE_ITEMS
): ProductOntologyPrinciple[] {
  return items
    .filter((item) =>
      item.candidateAxiomDraft != null &&
      (item.suggestedBucket === 'product_system_principle' || item.suggestedBucket === 'mixed_personal_product')
    )
    .map((item) => ({
      id: `product:${item.id}`,
      headline: item.headline,
      kind: item.suggestedBucket === 'product_system_principle' ? 'product_system_principle' : 'mixed_product_claim',
      draft: item.candidateAxiomDraft as string,
      sourceConnectionId: item.id,
    }))
}

export function buildProductOntologyPromptSection(
  items: ConnectionOntologyIntakeItem[] = CONNECTION_ONTOLOGY_INTAKE_ITEMS
): string {
  const principles = extractProductOntologyPrinciples(items)
  if (!principles.length) return ''

  return `

## Product/system principles
These are product or system principles. Use them for product reasoning only. Do not treat them as Adam's personal behavior rules.
${principles.map((principle) => `- ${principle.headline}: ${principle.draft}`).join('\n')}
`
}

