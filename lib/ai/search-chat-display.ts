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

  const hasTree =
    display.tree &&
    typeof display.tree.root === 'string' &&
    Array.isArray(display.tree.nodes) &&
    display.tree.nodes.length >= 1

  if (!hasTable && !hasMatrix && !hasTree) {
    violations.push(
      'Display must include table (2+ columns), matrix, or tree — not prose.'
    )
  }

  const blob = JSON.stringify(display)
  if (/\*\*|^#{1,6}\s|\|[^|]+\|/m.test(blob)) {
    violations.push('Display must not contain markdown syntax.')
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
## COGNITIVE FIT — pick ONE primary component (research-aligned)

| User intent | Component | When |
|-------------|-----------|------|
| What/who/when/list/find | display.table | Exact categories, lookup (≤3 variables per row) |
| Compare/vs/intersect/correlate | display.matrix | Two axes crossing (week × domain) |
| How it works/flow/architecture | display.tree | Parent-child logic, dependencies |
| Why/so what (little data) | lead only + tiny table | Punchline then structure |

FORBIDDEN: markdown, prose essays, ASCII |---| tables, spatial chart descriptions.
Numbers live in cells — never buried in sentences.
`

export const SEARCH_CHAT_DISPLAY_PROMPT = `
## VISIBLE ANSWER (JSON only — UI renders table / matrix / visual node tree)

No prose outside JSON. Follow FORMAT ROUTE injected below.

\`\`\`json
{
  "display": {
    "lead": "Punchline max 12 words",
    "table": null,
    "matrix": null,
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
- tree: { "root": "System", "nodes": [{ "label": "Part", "children": [{ "label": "Child" }] }] }

Pick ONE primary (others null). Cells = short phrases with · not sentences.
${SEARCH_CHAT_FORMAT_SELECTION_GUIDE}
`
