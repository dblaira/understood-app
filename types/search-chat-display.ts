export interface SearchChatTable {
  columns: string[]
  rows: string[][]
}

export interface SearchChatMatrix {
  row_labels: string[]
  col_labels: string[]
  cells: string[][]
}

export interface SearchChatTreeNode {
  label: string
  children?: SearchChatTreeNode[]
}

export interface SearchChatTree {
  root: string
  nodes: SearchChatTreeNode[]
}

export interface SearchChatMindMapNode {
  label: string
  weight?: number
  children?: SearchChatMindMapNode[]
}

export interface SearchChatMindMap {
  central: string
  nodes: SearchChatMindMapNode[]
}

export interface SearchChatDisplay {
  lead: string
  table?: SearchChatTable | null
  matrix?: SearchChatMatrix | null
  mind_map?: SearchChatMindMap | null
  tree?: SearchChatTree | null
  follow_up?: string | null
}

export interface SearchChatPayload {
  display: SearchChatDisplay
  entry_ids: string[]
  relevance_notes?: Record<string, string>
}
