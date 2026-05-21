'use client'

import { computeMindMapLayout, type MindMapLayoutNode } from '@/lib/ai/mind-map-layout'
import type {
  SearchChatMindMap,
  SearchChatTree,
} from '@/types/search-chat-display'

export function VisualNodeTree({ tree }: { tree: SearchChatTree }) {
  return (
    <MindMapDisplay
      mindMap={{
        central: tree.root,
        nodes: tree.nodes,
      }}
    />
  )
}

export function MindMapDisplay({ mindMap }: { mindMap: SearchChatMindMap }) {
  const layout = computeMindMapLayout(mindMap)
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]))

  return (
    <div
      data-testid="visual-mind-map"
      style={{
        position: 'relative',
        minHeight: '520px',
        border: '1px solid rgba(220, 20, 60, 0.18)',
        borderRadius: '18px',
        background:
          'radial-gradient(circle at 50% 50%, rgba(220, 20, 60, 0.12), rgba(255, 255, 255, 0) 34%), #FFFFFF',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '0.8rem',
        overflow: 'hidden',
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {layout.links.map((link) => {
          const from = nodeById.get(link.from)
          const to = nodeById.get(link.to)
          if (!from || !to) return null

          return (
            <line
              key={`${link.from}-${link.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={to.depth === 1 ? 'rgba(220, 20, 60, 0.42)' : 'rgba(17, 24, 39, 0.18)'}
              strokeWidth={to.depth === 1 ? 0.42 : 0.24}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      {layout.nodes.map((node) => (
        <MindMapNode key={node.id} node={node} />
      ))}
    </div>
  )
}

function MindMapNode({ node }: { node: MindMapLayoutNode }) {
  const isRoot = node.depth === 0
  const isBranch = node.depth === 1
  const label = typeof node.weight === 'number' ? `${node.label} · ${node.weight}%` : node.label

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: isRoot ? 'min(260px, 42%)' : isBranch ? 'min(190px, 28%)' : 'min(148px, 21%)',
        transform: 'translate(-50%, -50%)',
        zIndex: isRoot ? 3 : isBranch ? 2 : 1,
        padding: isRoot ? '0.9rem 1rem' : isBranch ? '0.58rem 0.7rem' : '0.42rem 0.52rem',
        borderRadius: isRoot ? '999px' : isBranch ? '16px' : '999px',
        background: isRoot ? '#111827' : isBranch ? '#FFFFFF' : '#FAFAFA',
        border: isRoot
          ? '1px solid #111827'
          : isBranch
            ? '1px solid rgba(220, 20, 60, 0.34)'
            : '1px solid #E5E7EB',
        color: isRoot ? '#FFFFFF' : '#111827',
        boxShadow: isRoot
          ? '0 16px 36px rgba(17, 24, 39, 0.22)'
          : isBranch
            ? '0 8px 20px rgba(17, 24, 39, 0.08)'
            : '0 3px 10px rgba(17, 24, 39, 0.05)',
        textAlign: 'center',
        fontFamily: isRoot ? "var(--font-bodoni-moda), Georgia, serif" : undefined,
        fontSize: isRoot ? '1.05rem' : isBranch ? '0.76rem' : '0.66rem',
        fontWeight: isRoot ? 400 : 700,
        lineHeight: 1.25,
        overflowWrap: 'anywhere',
      }}
    >
      {label}
    </div>
  )
}
