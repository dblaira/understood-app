/**
 * Cognitive Fit routing (Vessey/Galletta; Samuel et al.):
 * match display component to query task type — not aesthetic preference.
 */

export type PresentationFormatIntent =
  | 'overview'
  | 'cross_reference'
  | 'relationship'
  | 'system_flow'
  | 'pure_conceptual'

export type PrimaryDisplayComponent = 'table' | 'matrix' | 'tree' | 'mind_map' | 'editorial'

export interface FormatRoute {
  intent: PresentationFormatIntent
  primary: PrimaryDisplayComponent
  allowProse: boolean
  researchNote: string
  promptBlock: string
}

const CROSS_REF =
  /\b(compare|contrast|versus|vs\.?|intersect|correlation|matrix|cross.?ref|overlap|both .+ and)\b/i
const RELATIONSHIP =
  /\b(mind.?map|map|relationship|relationships|relate|related|link between|connection between|ties between|between .+ and|how .+ (and|&) .+)\b/i
const SYSTEM_FLOW =
  /\b(how (does|do|it|this)|architecture|flow|pipeline|depend|connects?|wiring|stack|pathway|taxonomy|hierarchy|decision tree|system)\b/i
const CONCEPTUAL =
  /\b(why|meaning|should i|strategic|so what|interpret|recommend|worth it|big picture)\b/i
const OVERVIEW =
  /\b(what|who|when|where|which|list|find|show|recent|about|search|entries)\b/i

export function routeFormatFromQuery(query: string): FormatRoute {
  const q = query.trim()

  if (CROSS_REF.test(q)) {
    return {
      intent: 'cross_reference',
      primary: 'mind_map',
      allowProse: false,
      researchNote: 'Pattern intersection — visible relationship map',
      promptBlock: `FORMAT ROUTE: cross_reference → use display.mind_map for a real mind map. Put the strongest shared pattern in central, the compared areas as first-level nodes, and the links/signals as children. Leave non-map display blocks null.`,
    }
  }

  if (RELATIONSHIP.test(q)) {
    return {
      intent: 'relationship',
      primary: 'mind_map',
      allowProse: false,
      researchNote: 'Linked concepts — visible relationship map',
      promptBlock: `FORMAT ROUTE: relationship → use display.mind_map for a real mind map. central = the pattern. First-level nodes = related life areas. Children = concrete signals and links. Leave non-map display blocks null.`,
    }
  }

  if (SYSTEM_FLOW.test(q)) {
    return {
      intent: 'system_flow',
      primary: 'tree',
      allowProse: false,
      researchNote: 'Hierarchical/procedural logic — node tree (Mayer & Moreno, 2003)',
      promptBlock: `FORMAT ROUTE: system_flow → use display.tree (root + nodes with children). Set display.table and display.matrix to null.`,
    }
  }

  if (CONCEPTUAL.test(q) && !OVERVIEW.test(q)) {
    return {
      intent: 'pure_conceptual',
      primary: 'editorial',
      allowProse: false,
      researchNote: 'Interpretation — max 2-sentence lead, then structure if data exists',
      promptBlock: `FORMAT ROUTE: pure_conceptual → lead = punchline (max 2 sentences). If data supports it, add a small display.table (≤4 rows). No essay.`,
    }
  }

  return {
    intent: 'overview',
    primary: 'table',
    allowProse: false,
    researchNote: 'Categorical lookup — table (Slutsky/King)',
    promptBlock: `FORMAT ROUTE: overview → use display.table (2–4 columns, ≤8 rows). Set display.matrix and display.tree to null.`,
  }
}
