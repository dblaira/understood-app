import type {
  SearchChatDisplay,
  SearchChatPayload,
} from '@/types/search-chat-display'
import type { PresentationValidation } from '@/lib/ai/presentation-linter'

export function extractSearchChatJsonBlock(text: string): string | null {
  const match = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)
  return match ? match[1].trim() : null
}

export function parseSearchChatPayload(text: string): SearchChatPayload | null {
  const raw = extractSearchChatJsonBlock(text)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SearchChatPayload>
    if (!parsed.display || typeof parsed.display !== 'object') return null
    const entry_ids = Array.isArray(parsed.entry_ids) ? parsed.entry_ids : []
    return {
      display: parsed.display as SearchChatDisplay,
      entry_ids: entry_ids.filter((id): id is string => typeof id === 'string'),
      relevance_notes:
        parsed.relevance_notes && typeof parsed.relevance_notes === 'object'
          ? (parsed.relevance_notes as Record<string, string>)
          : {},
    }
  } catch {
    return null
  }
}

export function validateSearchChatDisplay(
  display: SearchChatDisplay
): PresentationValidation {
  const violations: string[] = []

  if (!display.lead || display.lead.trim().length < 3) {
    violations.push('Display missing lead line (max 12 words).')
  }
  if (display.lead && display.lead.split(/\s+/).length > 14) {
    violations.push('Lead line too long (max 12 words).')
  }

  const hasTable =
    display.table &&
    Array.isArray(display.table.columns) &&
    display.table.columns.length >= 2 &&
    Array.isArray(display.table.rows) &&
    display.table.rows.length >= 1

  const hasMatrix =
    display.matrix &&
    Array.isArray(display.matrix.row_labels) &&
    display.matrix.row_labels.length >= 1 &&
    Array.isArray(display.matrix.col_labels) &&
    display.matrix.col_labels.length >= 2

  const hasMindMap =
    display.mind_map &&
    typeof display.mind_map.central === 'string' &&
    display.mind_map.central.trim().length >= 1 &&
    Array.isArray(display.mind_map.nodes) &&
    display.mind_map.nodes.length >= 1

  const hasTree =
    display.tree &&
    typeof display.tree.root === 'string' &&
    Array.isArray(display.tree.nodes) &&
    display.tree.nodes.length >= 1

  if (!hasTable && !hasMatrix && !hasMindMap && !hasTree) {
    violations.push(
      'Display must include mind_map, table (2+ columns), matrix, or tree — not prose.'
    )
  }

  const blob = JSON.stringify(display)
  if (/\*\*|^#{1,6}\s|\|[^|]+\|/m.test(blob)) {
    violations.push('Display must not contain markdown syntax.')
  }

  if (hasMindMap) {
    for (const node of display.mind_map!.nodes) {
      if (!node.label?.trim()) {
        violations.push('Mind map nodes must have short labels.')
        break
      }
      if (typeof node.weight === 'number' && (node.weight < 0 || node.weight > 100)) {
        violations.push('Mind map weight must be a percentage from 0 to 100.')
        break
      }
    }
  }

  if (hasTable) {
    const cols = display.table!.columns.length
    for (const row of display.table!.rows) {
      if (row.length !== cols) {
        violations.push('Table rows must match column count.')
        break
      }
      for (const cell of row) {
        if ((cell.match(/[.!?]\s/g) || []).length > 1) {
          violations.push('Table cells must be short phrases, not paragraphs.')
        }
      }
    }
  }

  return { ok: violations.length === 0, violations: [...new Set(violations)] }
}

export function validateSearchChatResponse(text: string): PresentationValidation {
  const payload = parseSearchChatPayload(text)
  if (!payload) {
    return {
      ok: false,
      violations: [
        'Violated Presentation Rule: Missing JSON display block. Return only ```json with display.table or display.tree.',
      ],
    }
  }
  return validateSearchChatDisplay(payload.display)
}

export const SEARCH_CHAT_FORMAT_SELECTION_GUIDE = `
## COGNITIVE FIT — pick ONE primary component

- Pattern / relationship / "mind map" / compare / correlate → display.mind_map.
- What / who / when / list / find → display.table only when the user needs exact entries.
- How it works / flow / architecture → display.tree.
- Why / so what → punchline lead + display.mind_map when data supports it.

FORBIDDEN: markdown, prose essays, ASCII |---| tables, outline-shaped answers, raw metric dumps.
Percentages are useful only when they show hierarchy, rank, share, or strength of pattern.
Do not surface raw counts as the insight. Use counts only as hidden evidence or when paired with percentage hierarchy.

CONTAINER FIT:
- Cognitive fit chooses relationship map or table.
- Container fit chooses how the UI renders it.
- 1–2 column tables render inline.
- 3 short columns render as a priority grid.
- 3+ columns with long evidence, rationale, learning signature, or notes render as stacked table-cards.
- Keep evidence rows table-shaped; never compensate with prose.
`

export const SEARCH_CHAT_DISPLAY_PROMPT = `
## VISIBLE ANSWER (JSON only — UI renders table, tree, or real visual mind map)

No prose outside JSON. Follow FORMAT ROUTE injected below.

\`\`\`json
{
  "display": {
    "lead": "Punchline max 12 words",
    "table": null,
    "matrix": null,
    "mind_map": null,
    "tree": null,
    "follow_up": "Optional short question"
  },
  "entry_ids": [],
  "relevance_notes": {}
}
\`\`\`

Component schemas:
- table: { "columns": ["A","B"], "rows": [["x","y"]] }
- matrix: { "row_labels": ["R1"], "col_labels": ["C1","C2"], "cells": [["a","b"]] }
- mind_map: { "central": "Pattern", "nodes": [{ "label": "Life area", "weight": 72, "children": [{ "label": "Signal", "weight": 64 }] }] }
- tree: { "root": "Pattern", "nodes": [{ "label": "Life area", "children": [{ "label": "Signal" }] }] }

Pick ONE primary (others null). Cells = short phrases with · not sentences.
For pattern discovery, use display.mind_map: central = pattern; first-level nodes = related areas; children = signals, links, or hierarchy percentages.
For evidence tables, prefer columns like Entry / Date / Signal; the UI will stack long rows into readable table-cards when needed.
${SEARCH_CHAT_FORMAT_SELECTION_GUIDE}
`
