import type { SearchChatTable } from '@/types/search-chat-display'

export type TableContainerFit = 'inline-grid' | 'priority-grid' | 'stacked-cards'

const LONG_CELL_CHARACTER_COUNT = 34
const LONG_TEXT_HEADER =
  /\b(description|evidence|insight|learning|note|notes|rationale|reason|signature|summary|takeaway)\b/i

export function getTableContainerFit(table: SearchChatTable): TableContainerFit {
  const columnCount = table.columns.length

  if (columnCount <= 2) return 'inline-grid'
  if (columnCount >= 4) return 'stacked-cards'

  const hasLongTextColumn = table.columns.some((column) => LONG_TEXT_HEADER.test(column))
  const hasLongCell = table.rows.some((row) =>
    row.some((cell) => cell.trim().length > LONG_CELL_CHARACTER_COUNT)
  )

  if (hasLongTextColumn || hasLongCell) return 'stacked-cards'

  return 'priority-grid'
}
