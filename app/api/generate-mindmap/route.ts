import { NextRequest, NextResponse } from 'next/server'
import { MindMap } from '@/types'

const MIND_MAP_SYSTEM_PROMPT = `You are a mind map generator. Given linear text input, extract key concepts and their relationships.

Output valid JSON only, no other text.

Rules:
1. Extract 3-10 key concepts as nodes (fewer is better for clarity)
2. Label nodes with short phrases (2-5 words)
3. Identify meaningful relationships between nodes
4. Assign node types:
   - concept: ideas, themes, observations (default)
   - action: something to do or implement
   - question: unresolved or worth exploring
   - theme: overarching patterns or principles
5. Position nodes spatially:
   - Central/most important concept near (0, 0)
   - Related concepts clustered together
   - Contrasting concepts positioned apart
   - Use positions roughly in range -300 to 300 for x and y

Output schema:
{
  "title": "brief title for this mind map",
  "nodes": [
    {
      "id": "node_1",
      "label": "Short Label",
      "description": "Optional longer context (1 sentence max)",
      "position": { "x": 0, "y": 0 },
      "nodeType": "concept"
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2",
      "relationshipType": "supports",
      "label": "optional edge label"
    }
  ]
}

Relationship types:
- causes: A leads to B
- supports: A reinforces or enables B
- contrasts: A opposes or creates tension with B
- contains: A is a subset or example of B
- related: general meaningful connection`

export async function POST(request: NextRequest) {
  try {
    const { text, entryId } = await request.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text content is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const mindMap = await generateMindMap(text, apiKey)
    
    // Add source entry reference if provided
    if (entryId) {
      mindMap.sourceEntryId = entryId
    }
    mindMap.sourceText = text

    return NextResponse.json(mindMap)
  } catch (error) {
    console.error('Mind map generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate mind map' },
      { status: 500 }
    )
  }
}

async function generateMindMap(text: string, apiKey: string): Promise<MindMap> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: MIND_MAP_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a mind map from this text:\n\n${text}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    let bodyText: string
    try {
      bodyText = await response.text()
    } catch {
      bodyText = '<unable to read response body>'
    }
    throw new Error(`API request failed: ${response.status} - ${bodyText}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text

  if (!content) {
    throw new Error('No content in API response')
  }

  // Clean potential markdown code fences
  const cleanedContent = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleanedContent)
    
    // Validate required fields
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      throw new Error('Invalid mind map structure: missing nodes array')
    }
    if (!parsed.edges || !Array.isArray(parsed.edges)) {
      parsed.edges = [] // Edges are optional
    }

    return {
      title: parsed.title || 'Mind Map',
      nodes: parsed.nodes,
      edges: parsed.edges,
    }
  } catch (parseError) {
    console.error('Failed to parse mind map JSON:', parseError, 'Content:', cleanedContent)
    throw new Error('Failed to parse mind map response')
  }
}

