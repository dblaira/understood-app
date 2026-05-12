import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildOntologyPromptSection } from '@/lib/ontology/build-prompt-section'
import { buildConnectionPrinciplesPromptSection, getConnectionPromptPrinciples } from '@/lib/ontology/connections-intake'
import { buildProductOntologyPromptSection } from '@/lib/ontology/product-ontology'
import { buildPublicOntologyGuardrailSection, PUBLIC_ONTOLOGY_REFERENCES } from '@/lib/ontology/public-reference'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface EntryReference {
  id: string
  headline: string
  category: string
  entry_type: string
  created_at: string
  relevance_note: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, conversationHistory = [] } = await request.json()

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
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

    // Fetch all user entries (summaries only for cost efficiency)
    const { data: entries, error: fetchError } = await supabase
      .from('entries')
      .select('id, headline, subheading, category, mood, entry_type, created_at, content, completed_at, due_date')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching entries for chat search:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch entries' },
        { status: 500 }
      )
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        response: "You don't have any entries yet. Create some entries first, and then I can help you search through them.",
        entries: [],
      })
    }

    let ontologyMemorySection = ''
    let confirmedAxiomCount = 0
    try {
      const { data: axiomRows, error: axiomError } = await supabase
        .from('ontology_axioms')
        .select('antecedent, consequent, confidence, status, scope')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('confidence', { ascending: false })

      if (!axiomError && axiomRows?.length) {
        ontologyMemorySection = buildOntologyPromptSection(axiomRows)
        confirmedAxiomCount = axiomRows.length
      }
    } catch {
      // Ontology table may not exist in older environments.
    }

    const connectionPrinciplesSection = buildConnectionPrinciplesPromptSection()
    const connectionPrincipleCount = getConnectionPromptPrinciples().length
    const productPrinciplesSection = buildProductOntologyPromptSection()
    const publicOntologyGuardrailSection = buildPublicOntologyGuardrailSection()

    // Build a compact index of entries for the AI
    const entryIndex = entries.map((e, i) => {
      const date = new Date(e.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const type = e.entry_type || 'story'
      const contentPreview = (e.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
      const status = e.completed_at ? ' [COMPLETED]' : e.due_date ? ` [DUE: ${e.due_date}]` : ''

      return `[${i}] ID:${e.id} | ${date} | ${type.toUpperCase()} | ${e.category} | "${e.headline}"${e.subheading ? ` - ${e.subheading}` : ''}${e.mood ? ` | mood: ${e.mood}` : ''}${status}\n    ${contentPreview}`
    }).join('\n')

    // Build conversation messages for multi-turn support
    const previousMessages: { role: string; content: string }[] = conversationHistory.map(
      (msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content,
      })
    )

    const systemPrompt = `You are a helpful search assistant for a personal journal app called "Understood." The user has journal entries of four types: stories (reflections), notes (reference info), actions (tasks), and connections (user-authored principles).

Your job is to help the user find specific entries by analyzing their natural language query against the entry index below. Be conversational, warm, and concise.

${ontologyMemorySection}${connectionPrinciplesSection}${productPrinciplesSection}${publicOntologyGuardrailSection}

When using the memory context above, distinguish confirmed ontology axioms from user-authored Connections, product/system principles, and public ontology guardrails. Confirmed axioms are stronger personal rules. Connections are helpful operating principles. Product/system principles apply only to product reasoning. Public ontology references discipline terminology and scope, but they do not turn the user's personal observations into medical, dietary, legal, or financial advice. Do not claim a Connection is confirmed unless it appears as a confirmed ontology axiom.

## ENTRY INDEX (${entries.length} entries total):
${entryIndex}

## RESPONSE FORMAT:
1. Provide a brief, natural response to the user's query
2. Reference specific entries by their index number [N] when relevant
3. At the end of your response, include a JSON block with the IDs of relevant entries:

\`\`\`json
{"entry_ids": ["id1", "id2"], "relevance_notes": {"id1": "brief reason", "id2": "brief reason"}}
\`\`\`

## GUIDELINES:
- Search across ALL entry types (stories, notes, actions) unless the user specifies one
- Consider dates, categories, moods, and content when matching
- If the query is vague, ask a clarifying follow-up question
- If no entries match, say so honestly and suggest what to search for instead
- Show at most 10 most relevant entries
- When discussing time periods, use the entry dates to determine relevance
- Be conversational but efficient - users want quick answers`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...previousMessages,
          { role: 'user', content: query },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', response.status, errorText)
      return NextResponse.json(
        { error: `AI service error: ${response.status}` },
        { status: 502 }
      )
    }

    const aiResponse = await response.json()
    const assistantMessage = aiResponse.content?.[0]?.text || 'Sorry, I could not process your query.'

    // Parse out the entry IDs from the JSON block
    let referencedEntries: EntryReference[] = []
    const jsonMatch = assistantMessage.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        const entryIds: string[] = parsed.entry_ids || []
        const relevanceNotes: Record<string, string> = parsed.relevance_notes || {}

        referencedEntries = entryIds
          .map((id: string) => {
            const entry = entries.find((e) => e.id === id)
            if (!entry) return null
            return {
              id: entry.id,
              headline: entry.headline,
              category: entry.category,
              entry_type: entry.entry_type || 'story',
              created_at: entry.created_at,
              relevance_note: relevanceNotes[id] || '',
            }
          })
          .filter(Boolean) as EntryReference[]
      } catch (parseError) {
        console.error('Failed to parse entry IDs from AI response:', parseError)
      }
    }

    // Clean the response text (remove the JSON block for display)
    const cleanResponse = assistantMessage.replace(/```json[\s\S]*?```/, '').trim()

    return NextResponse.json({
      response: cleanResponse,
      entries: referencedEntries,
      memory_context: {
        confirmed_axioms: confirmedAxiomCount,
        connection_principles: connectionPrincipleCount,
        public_guardrails: PUBLIC_ONTOLOGY_REFERENCES.length,
        note: 'Confirmed axioms are trusted rules; Connections are read-only principles; public guardrails discipline scope.',
      },
    })
  } catch (error) {
    console.error('Search chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
