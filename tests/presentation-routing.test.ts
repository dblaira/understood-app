import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_PRESENTATION_CONSTRAINTS } from '../lib/ai/default-presentation-constraints'
import { routeFormatFromQuery } from '../lib/ai/format-intent-router'
import {
  SEARCH_CHAT_FORMAT_SELECTION_GUIDE,
  SEARCH_CHAT_DISPLAY_PROMPT,
  validateSearchChatDisplay,
} from '../lib/ai/search-chat-display'
import { computeMindMapLayout } from '../lib/ai/mind-map-layout'

describe('presentation routing', () => {
  it('routes mind map requests to a visual relationship map', () => {
    const route = routeFormatFromQuery('show me a mind map of relationships in my data')

    assert.equal(route.intent, 'relationship')
    assert.equal(route.primary, 'mind_map')
    assert.match(route.promptBlock, /mind map/i)
    assert.match(route.promptBlock, /display\.mind_map/i)
    assert.doesNotMatch(route.promptBlock, /display\.tree as a visible mind map/i)
    assert.doesNotMatch(route.promptBlock, /matrix/i)
  })

  it('treats percentages as hierarchy and raw counts as noise', () => {
    const labels = DEFAULT_PRESENTATION_CONSTRAINTS.map((constraint) => constraint.target_label)
    const guide = SEARCH_CHAT_FORMAT_SELECTION_GUIDE

    assert.ok(labels.some((label) => /Percentages show hierarchy/i.test(label)))
    assert.ok(labels.some((label) => /Raw counts without hierarchy/i.test(label)))
    assert.match(guide, /Percentages are useful only when they show hierarchy/i)
    assert.match(guide, /Do not surface raw counts as the insight/i)
  })

  it('makes mind_map a first-class display shape', () => {
    assert.match(SEARCH_CHAT_DISPLAY_PROMPT, /"mind_map"/)
    assert.match(SEARCH_CHAT_DISPLAY_PROMPT, /central/)

    const validation = validateSearchChatDisplay({
      lead: 'Patterns orbit relationship energy.',
      mind_map: {
        central: 'Pattern recognition',
        nodes: [
          {
            label: 'Social learning',
            children: [{ label: 'Conversation creates energy', weight: 72 }],
          },
        ],
      },
    })

    assert.equal(validation.ok, true)
  })

  it('computes a node-link layout with a centered root and connector lines', () => {
    const layout = computeMindMapLayout({
      central: 'Pattern recognition',
      nodes: [
        { label: 'Social learning', children: [{ label: 'Conversation energy' }] },
        { label: 'AI leverage', children: [{ label: 'Language literacy' }] },
        { label: 'Hierarchy signal', children: [{ label: 'Percent strength', weight: 81 }] },
      ],
    })

    const root = layout.nodes.find((node) => node.id === 'root')

    assert.ok(root)
    assert.equal(root.x, 50)
    assert.equal(root.y, 50)
    assert.equal(layout.nodes.length, 7)
    assert.equal(layout.links.length, 6)
    assert.ok(layout.links.every((link) => link.from !== link.to))
    assert.ok(layout.nodes.every((node) => node.x >= 16 && node.x <= 84))
    assert.ok(layout.nodes.every((node) => node.y >= 12 && node.y <= 88))
  })
})
