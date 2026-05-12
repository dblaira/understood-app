import {
  buildConnectionIntakeItemsFromEntries,
  buildConnectionPrinciplesPromptSection,
  getConnectionPromptPrinciples,
  type ConnectionOntologyEntryLike,
  type ConnectionOntologyIntakeItem,
} from '@/lib/ontology/connections-intake'
import { buildProductOntologyPromptSection } from '@/lib/ontology/product-ontology'
import { buildPublicOntologyGuardrailSection, PUBLIC_ONTOLOGY_REFERENCES } from '@/lib/ontology/public-reference'

export const CONNECTION_PROMPT_LIMIT = 50

export interface PromptConnectionEntry extends ConnectionOntologyEntryLike {
  entry_type?: string | null
}

export interface LayeredOntologyPromptContext {
  liveConnectionItems: ConnectionOntologyIntakeItem[]
  connectionPrinciplesSection: string
  connectionPrincipleCount: number
  productPrinciplesSection: string
  publicOntologyGuardrailSection: string
  publicGuardrailCount: number
}

export function buildConnectionItemsForPrompt(
  entries: PromptConnectionEntry[],
  limit = CONNECTION_PROMPT_LIMIT
): ConnectionOntologyIntakeItem[] {
  const connectionRows = entries
    .filter((entry) => entry.entry_type == null || entry.entry_type === 'connection')
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      headline: entry.headline,
      content: entry.content,
      connection_type: entry.connection_type,
    }))

  return buildConnectionIntakeItemsFromEntries(connectionRows)
}

export function buildLayeredOntologyPromptContext(
  entries: PromptConnectionEntry[],
  limit = CONNECTION_PROMPT_LIMIT
): LayeredOntologyPromptContext {
  const liveConnectionItems = buildConnectionItemsForPrompt(entries, limit)

  return {
    liveConnectionItems,
    connectionPrinciplesSection: buildConnectionPrinciplesPromptSection(liveConnectionItems),
    connectionPrincipleCount: getConnectionPromptPrinciples(liveConnectionItems).length,
    productPrinciplesSection: buildProductOntologyPromptSection(liveConnectionItems),
    publicOntologyGuardrailSection: buildPublicOntologyGuardrailSection(),
    publicGuardrailCount: PUBLIC_ONTOLOGY_REFERENCES.length,
  }
}
