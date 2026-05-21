import type { SearchChatMindMap, SearchChatMindMapNode } from '@/types/search-chat-display'

export interface MindMapLayoutNode {
  id: string
  label: string
  x: number
  y: number
  depth: number
  parentId?: string
  weight?: number
}

export interface MindMapLayoutLink {
  from: string
  to: string
}

export interface MindMapLayout {
  nodes: MindMapLayoutNode[]
  links: MindMapLayoutLink[]
}

const CENTER = 50
const BRANCH_RADIUS = 25
const CHILD_RADIUS = 23

function toPoint(angle: number, radius: number, originX = CENTER, originY = CENTER) {
  return {
    x: Math.round((originX + Math.cos(angle) * radius) * 10) / 10,
    y: Math.round((originY + Math.sin(angle) * radius) * 10) / 10,
  }
}

function getBranchAngle(index: number, count: number): number {
  if (count <= 1) return -Math.PI / 2
  const start = -Math.PI * 0.85
  const end = Math.PI * 0.85
  return start + ((end - start) * index) / (count - 1)
}

function addChildren(
  nodes: MindMapLayoutNode[],
  links: MindMapLayoutLink[],
  parent: MindMapLayoutNode,
  children: SearchChatMindMapNode[] | undefined,
  branchAngle: number
) {
  if (!children?.length) return

  children.forEach((child, index) => {
    const siblingOffset = children.length === 1 ? 0 : index - (children.length - 1) / 2
    const outward = toPoint(branchAngle, CHILD_RADIUS, parent.x, parent.y)
    const point = {
      x: outward.x + Math.cos(branchAngle + Math.PI / 2) * siblingOffset * 10,
      y: outward.y + Math.sin(branchAngle + Math.PI / 2) * siblingOffset * 10,
    }
    const id = `${parent.id}-${index}`

    nodes.push({
      id,
      label: child.label,
      x: Math.min(84, Math.max(16, point.x)),
      y: Math.min(88, Math.max(12, point.y)),
      depth: parent.depth + 1,
      parentId: parent.id,
      weight: child.weight,
    })
    links.push({ from: parent.id, to: id })
  })
}

export function computeMindMapLayout(mindMap: SearchChatMindMap): MindMapLayout {
  const nodes: MindMapLayoutNode[] = [
    {
      id: 'root',
      label: mindMap.central,
      x: CENTER,
      y: CENTER,
      depth: 0,
    },
  ]
  const links: MindMapLayoutLink[] = []

  mindMap.nodes.forEach((node, index) => {
    const angle = getBranchAngle(index, mindMap.nodes.length)
    const point = toPoint(angle, BRANCH_RADIUS)
    const id = `branch-${index}`
    const layoutNode: MindMapLayoutNode = {
      id,
      label: node.label,
      x: Math.min(84, Math.max(16, point.x)),
      y: Math.min(88, Math.max(12, point.y)),
      depth: 1,
      parentId: 'root',
      weight: node.weight,
    }

    nodes.push(layoutNode)
    links.push({ from: 'root', to: id })
    addChildren(nodes, links, layoutNode, node.children, angle)
  })

  return { nodes, links }
}
