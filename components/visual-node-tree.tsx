'use client'

import type { SearchChatTree, SearchChatTreeNode } from '@/types/search-chat-display'

export function VisualNodeTree({ tree }: { tree: SearchChatTree }) {
  return (
    <div
      style={{
        border: '1px solid #E5E7EB',
        borderLeft: '3px solid #DC143C',
        borderRadius: '8px',
        padding: '0.75rem 0.85rem',
        background: '#FAFAFA',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '0.8rem',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: '#111827',
          marginBottom: '0.65rem',
          fontFamily: "var(--font-bodoni-moda), Georgia, serif",
          fontSize: '0.95rem',
        }}
      >
        {tree.root}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {tree.nodes.map((node, i) => (
          <TreeBranch key={`${node.label}-${i}`} node={node} depth={0} isLast={i === tree.nodes.length - 1} />
        ))}
      </div>
    </div>
  )
}

function TreeBranch({
  node,
  depth,
  isLast,
}: {
  node: SearchChatTreeNode
  depth: number
  isLast: boolean
}) {
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <div style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span style={{ color: '#DC143C', fontWeight: 700, minWidth: '1.25rem' }}>
          {isLast ? '└' : '├'}
        </span>
        <span
          style={{
            flex: 1,
            padding: '0.35rem 0.5rem',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '4px',
            color: '#374151',
            lineHeight: 1.35,
          }}
        >
          {node.label}
        </span>
      </div>
      {hasChildren && (
        <div style={{ marginTop: '0.35rem' }}>
          {node.children!.map((child, ci) => (
            <TreeBranch
              key={`${child.label}-${ci}`}
              node={child}
              depth={depth + 1}
              isLast={ci === node.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
