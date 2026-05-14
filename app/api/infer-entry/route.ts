import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EntryType } from '@/types'
import { LIFE_DOMAINS, parseLifeDomains, type LifeDomain } from '@/types/ontology'
import { buildOntologyPromptSection } from '@/lib/ontology/build-prompt-section'
import {
  buildLayeredOntologyPromptContext,
  CONNECTION_PROMPT_LIMIT,
} from '@/lib/ontology/prompt-context'

export interface InferredEntry {
  headline: string
  subheading: string
  category: LifeDomain
  mood: string
  // Unified entry system fields
  entry_type: EntryType
  due_date: string | null
  connection_type: string | null
  life_domains: LifeDomain[]
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

    const { content, selectedType, documentContent } = await request.json()

    console.log('🤖 infer-entry received:', {
      contentLength: content?.length || 0,
      contentPreview: content?.substring(0, 100) || 'none',
      selectedType,
      hasDocumentContent: !!documentContent,
      documentContentLength: documentContent?.length || 0,
      documentContentPreview: documentContent?.substring(0, 200) || 'none'
    })

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
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

    console.log('🤖 Calling AI with:', {
      contentLength: content.trim().length,
      hasDocumentContent: !!documentContent,
      documentContentLength: documentContent?.length || 0
    })

    let ontologySection = ''
    try {
      const { data: axiomRows, error: axiomError } = await supabase
        .from('ontology_axioms')
        .select('antecedent, consequent, confidence, status, scope')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('confidence', { ascending: false })

      if (!axiomError && axiomRows?.length) {
        ontologySection = buildOntologyPromptSection(axiomRows)
      }
    } catch {
      // Table may not exist until migration is applied
    }

    let layeredPromptContext = buildLayeredOntologyPromptContext([])
    try {
      const { data: connectionRows, error: connectionError } = await supabase
        .from('entries')
        .select('id, headline, content, connection_type')
        .eq('user_id', user.id)
        .eq('entry_type', 'connection')
        .order('created_at', { ascending: false })
        .limit(CONNECTION_PROMPT_LIMIT)

      layeredPromptContext = buildLayeredOntologyPromptContext(connectionError ? [] : connectionRows ?? [])
    } catch {
      layeredPromptContext = buildLayeredOntologyPromptContext([])
    }

    const inferred = await inferEntryMetadata(
      content.trim(),
      apiKey,
      documentContent,
      [
        ontologySection,
        layeredPromptContext.connectionPrinciplesSection,
        layeredPromptContext.productPrinciplesSection,
        layeredPromptContext.publicOntologyGuardrailSection,
      ].filter(Boolean).join('')
    )

    // SAFETY NET: If AI returned "story", check if it's actually a connection or action
    if (inferred.entry_type === 'story') {
      const trimmed = content.trim()

      // Check connection FIRST — short declarative principles shouldn't become actions
      const connectionOverride = detectObviousConnectionPatterns(trimmed)
      if (connectionOverride) {
        console.log('[infer-entry] AI said story, but heuristic detected connection patterns')
        inferred.entry_type = 'connection'
        inferred.connection_type = connectionOverride
      } else {
        const actionOverride = detectObviousActionPatterns(trimmed)
        if (actionOverride) {
          console.log('[infer-entry] AI said story, but heuristic detected action patterns')
          inferred.entry_type = 'action'
        }
      }
    }

    // Only override AI inference if user EXPLICITLY selected a type
    // selectedType will be null if user didn't touch the dropdown
    if (selectedType && ['story', 'action', 'note', 'connection'].includes(selectedType)) {
      inferred.entry_type = selectedType as EntryType
      // If user explicitly chose non-action type, clear due_date
      if (selectedType !== 'action') {
        inferred.due_date = null
      }
      // If user explicitly chose non-connection type, clear connection_type
      if (selectedType !== 'connection') {
        inferred.connection_type = null
      }
    }
    // Otherwise, trust the AI inference (which now has improved action detection)

    return NextResponse.json(inferred)
  } catch (error) {
    console.error('Error inferring entry:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function inferEntryMetadata(
  content: string,
  apiKey: string,
  documentContent?: string,
  ontologySection = ''
): Promise<InferredEntry> {
  // Get current date for relative date inference
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  // Calculate common relative dates
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

  // Build document context section if documents were attached
  const documentSection = documentContent ? `
## ATTACHED DOCUMENT(S) - EXTRACTED TEXT:
The user has uploaded document(s). Analyze this extracted text to understand context:
"""
${documentContent}
"""

DOCUMENT ANALYSIS GUIDELINES:
- **Receipts/Invoices**: Often **Purchase** or **Work**; could be "note" (record keeping) or "action" (follow up, return)
- **Contracts/Agreements**: Often **Work** or **Ambition**; frequently "action" (deadlines, signatures)
- **Medical docs**: **Health**
- **Financial statements**: **Purchase** or **Work**, often "note"
- Create a headline that summarizes the document content meaningfully
- If it's a purchase receipt, include the vendor and total in headline (e.g., "Amazon Order: $22.85 - Allergy Meds & Water")
- If user added notes, consider if they're tagging this as something to track (impulse buy, need to return, etc.)

` : ''

  const lifeDomainList = LIFE_DOMAINS.join(' | ')

  const prompt = `You classify entries for a personal ontology app. Your #1 job is detecting ACTIONABLE INTENT.
${documentSection}${ontologySection}

## CRITICAL RULES - READ CAREFULLY:

1. **DEFAULT TO "action"** - If there's ANY doubt, choose "action". Users use this app to capture tasks.
2. **Imperative verbs = action** - Any sentence starting with a verb (Research, Take, Buy, Call, Fix, Get, Send, Check, Schedule, Find, Make, Do, Review, Update, Follow, Remember) is ALWAYS an action.
3. **Multiple sentences with periods = likely action list** - "Do X. Do Y. Do Z." is a task list, not a story.
4. **"Remember to" = action** - This is ALWAYS an action, never a story.

## entry_type Classification:

**"action"** - USE THIS IF ANY OF THESE PATTERNS APPEAR:
- Starts with imperative verb: Research, Take, Buy, Call, Fix, Get, Send, Check, Schedule, Find, Make, Do, Review, Update, Follow up, Look into, Set up, Sign up, Write, Read, Watch, Listen, Try, Test, Finish, Complete, Submit, Pay, Book, Order, Pick up, Drop off, Clean, Organize, Plan, Prepare, Practice, Exercise, Work out, Meditate, Stretch
- Contains: "Remember to", "Don't forget", "Need to", "Have to", "Should", "Must", "Want to", "Going to", "Will", "Gonna", "Gotta"
- Future activities: gym, workout, appointment, meeting, call, email, errand
- Task words: task, tasks, todo, to-do, reminder, checklist
- Multiple short imperative sentences separated by periods
- Anything that could reasonably be a to-do item

**"story"** - USE ONLY WHEN ALL OF THESE ARE TRUE:
- 100% past tense reflection
- ZERO imperative verbs
- ZERO future obligations
- ZERO "remember to" or "need to" phrases
- Pure diary-style "what happened" content

**"note"** - USE FOR:
- Pure information storage (facts, quotes, links, references)
- NOT tasks, NOT things to do

**"connection"** - USE FOR:
- A distilled truth, principle, or identity statement
- Short and declarative (typically under ~50 words)
- Reads as wisdom, a mantra, or a pattern interrupt rather than narrative
- Often imperative or present-tense
- Examples: "Am I building a system or doing a task?", "Feelings aren't facts.", "Work on what I can. Figure out the rest later.", "Anything that gives me a feeling of momentum is worthwhile."
- NOT a story, NOT a task, NOT reference material — it's a belief or principle

## Examples - MEMORIZE THESE:

INPUT: "Research Grok Tasks. Take supplements."
OUTPUT: "action" (imperative verbs: Research, Take)

INPUT: "Take a moment to breathe at noon today. Remember to hold your breath at 1pm."
OUTPUT: "action" (imperative verb: Take, plus "Remember to")

INPUT: "Buy groceries. Call mom. Fix the car."
OUTPUT: "action" (imperative list)

INPUT: "I should really call my mom this weekend"
OUTPUT: "action" (obligation: should)

INPUT: "Thinking I might sign up for that pottery class"
OUTPUT: "action" (future intent)

INPUT: "Had a great meeting today. Need to follow up with Sarah."
OUTPUT: "action" (embedded "Need to")

INPUT: "Gym tomorrow"
OUTPUT: "action" (future activity)

INPUT: "Doctor's appointment Tuesday"
OUTPUT: "action" (scheduled event)

INPUT: "Look into flights for December"
OUTPUT: "action" (imperative: Look into)

## Examples of STORIES (truly no action):

INPUT: "Had the best coffee with Jane today. We talked for hours."
OUTPUT: "story" (100% past tense, no tasks)

INPUT: "Feeling grateful for my family after the holiday gathering"
OUTPUT: "story" (pure reflection, no tasks)

## Other Fields:

1. **headline**: Punchy, newsworthy headline (5-10 words). For actions, make it task-oriented: "Time to Schedule That Doctor Visit"
2. **subheading**: Brief context (10-20 words)
3. **category** (primary life domain — pick exactly one, exact spelling): ${lifeDomainList}
4. **mood**: Emotional tone in 1-2 words
5. **due_date**: For actions with deadlines. Today is ${todayStr}.
   - "today" = ${todayStr}
   - "tomorrow" = ${tomorrowStr}
   - "next week" = ${nextWeekStr}
   - "this weekend" = upcoming Saturday
   - No deadline mentioned = null

## Input:
"""
${content}
"""

6. **connection_type** (only if entry_type is "connection", otherwise null):
   - "identity_anchor" — reconnect with a settled version of yourself
   - "pattern_interrupt" — force a zoom-out when in the weeds
   - "validated_principle" — a conclusion earned through experience
   - "process_anchor" — a specific sequence for a specific situation

Return ONLY valid JSON:
{"headline": "...", "subheading": "...", "category": "...", "mood": "...", "entry_type": "...", "due_date": "..." or null, "connection_type": "..." or null, "life_domains": ["Exercise", ...] or []}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 650,
      messages: [
        {
          role: 'user',
          content: prompt,
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
  
  // Validate response structure
  if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
    throw new Error('Invalid API response: missing content array')
  }
  
  const firstContent = data.content[0]
  if (!firstContent || typeof firstContent.text !== 'string') {
    throw new Error('Invalid API response: missing text in content')
  }
  
  let text = firstContent.text.trim()
  
  // Strip markdown code blocks if present (AI sometimes wraps JSON in ```json ... ```)
  if (text.startsWith('```')) {
    // Remove opening ```json or ``` and closing ```
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(text)
    
    // Validate category
    const validCategories = [...LIFE_DOMAINS] as string[]
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'Insight'
    }

    // Validate entry_type
    const validEntryTypes: EntryType[] = ['story', 'action', 'note', 'connection']
    const entryType: EntryType = validEntryTypes.includes(parsed.entry_type) 
      ? parsed.entry_type 
      : 'story' // Default to story if not recognized

    // Validate connection_type
    const validConnectionTypes = ['identity_anchor', 'pattern_interrupt', 'validated_principle', 'process_anchor']
    const connectionType = (entryType === 'connection' && validConnectionTypes.includes(parsed.connection_type))
      ? parsed.connection_type
      : null

    // Validate and parse due_date
    let dueDate: string | null = null
    if (parsed.due_date && entryType === 'action') {
      // Validate ISO date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (dateRegex.test(parsed.due_date)) {
        dueDate = parsed.due_date
      }
    }

    return {
      headline: parsed.headline || 'Untitled Entry',
      subheading: parsed.subheading || '',
      category: parsed.category,
      mood: parsed.mood || 'reflective',
      entry_type: entryType,
      due_date: dueDate,
      connection_type: connectionType,
      life_domains: parseLifeDomains(parsed.life_domains),
    }
  } catch {
    // If JSON parsing fails, create defaults
    console.error('Failed to parse AI response:', text)
    return {
      headline: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
      subheading: '',
      category: 'Insight',
      mood: 'reflective',
      entry_type: 'story',
      due_date: null,
      connection_type: null,
      life_domains: [],
    }
  }
}

// Heuristic safety net to catch obvious action patterns the AI might miss
function detectObviousActionPatterns(content: string): boolean {
  const lowerContent = content.toLowerCase()
  
  // Common imperative verbs that start sentences (action indicators)
  const imperativeVerbs = [
    'take', 'research', 'call', 'buy', 'get', 'send', 'email', 'text', 'message',
    'schedule', 'book', 'order', 'pick up', 'drop off', 'fix', 'repair', 'clean',
    'organize', 'find', 'look into', 'check', 'review', 'update', 'finish',
    'complete', 'submit', 'pay', 'sign up', 'register', 'cancel', 'return',
    'make', 'do', 'go to', 'visit', 'meet', 'attend', 'follow up', 'reach out',
    'contact', 'remind', 'remember to', "don't forget", 'dont forget', 'need to', 'have to',
    'should', 'must', 'workout', 'exercise', 'meditate', 'practice', 'study',
    'read', 'watch', 'listen', 'try', 'test', 'write', 'plan', 'prepare'
  ]
  
  // Check if content starts with an imperative verb
  for (const verb of imperativeVerbs) {
    if (lowerContent.startsWith(verb)) {
      return true
    }
  }
  
  // Check for multiple sentences that start with imperative verbs
  // Split by period, exclamation, or newline
  const sentences = content.split(/[.!?\n]+/).filter(s => s.trim())
  let imperativeCount = 0
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim().toLowerCase()
    for (const verb of imperativeVerbs) {
      if (trimmed.startsWith(verb)) {
        imperativeCount++
        break
      }
    }
  }
  
  // If 2+ sentences start with imperative verbs, it's definitely an action list
  if (imperativeCount >= 2) {
    return true
  }
  
  // Check for "remember to" or "don't forget" anywhere in the content
  if (lowerContent.includes('remember to') || lowerContent.includes("don't forget") || lowerContent.includes('dont forget')) {
    return true
  }
  
  // Check for task-like words
  if (lowerContent.includes('todo') || lowerContent.includes('to-do') || lowerContent.includes('task')) {
    return true
  }
  
  return false
}

// Heuristic safety net to catch short declarative principles the AI misclassified as stories
function detectObviousConnectionPatterns(content: string): string | null {
  const lowerContent = content.toLowerCase().trim()
  const wordCount = content.split(/\s+/).length

  // Connections are short — if it's longer than 50 words, it's not a connection
  if (wordCount > 50) return null

  // Must be short AND declarative/imperative to be a connection candidate
  // Long narrative text (even short) with past-tense storytelling isn't a connection
  const pastTenseNarrative = /\b(i was|i had|i went|we were|we had|it was|there was|yesterday|last night|last week|earlier today i)\b/i
  if (pastTenseNarrative.test(content)) return null

  // Pattern: starts with "Don't" / "Never" / "Always" / "Stop" + verb — imperative wisdom
  const imperativeWisdom = /^(don'?t|never|always|stop|start|keep|stay|let|avoid|embrace|accept|trust|remember|focus on|work on|build|choose)\b/i
  if (wordCount <= 20 && imperativeWisdom.test(content)) {
    // "Don't forget to X" / "Remember to X" are actions, not connections
    if (/^(don'?t forget|remember to)\b/i.test(content)) return null
    return 'pattern_interrupt'
  }

  // Pattern: short present-tense declarations of truth / identity
  // e.g., "Feelings aren't facts", "Anything that gives me momentum is worthwhile"
  const identityPatterns = /\b(i am|i'm|i can|i choose|i deserve|i create|i build|i decide|my job is|my role is)\b/i
  if (wordCount <= 25 && identityPatterns.test(content)) {
    return 'identity_anchor'
  }

  // Pattern: question-form principles — "Am I building a system or doing a task?"
  if (wordCount <= 25 && content.trim().endsWith('?') && !/(when|where|what time|how much)\b/i.test(content)) {
    return 'pattern_interrupt'
  }

  // Pattern: very short (≤12 words) declarative sentence with no task/date words
  // These are aphorisms: "Less is more.", "Simplicity wins.", "Ship it."
  const taskDateWords = /\b(tomorrow|today|tonight|next week|by friday|deadline|due|schedule|appointment|meeting|call|email)\b/i
  if (wordCount <= 12 && !taskDateWords.test(content) && !content.includes('?')) {
    // Make sure it's not an action — no imperative task verb at start
    const taskImperatives = /^(buy|call|email|send|text|schedule|book|order|pay|pick up|drop off|fix|clean|cancel)\b/i
    if (!taskImperatives.test(content)) {
      return 'validated_principle'
    }
  }

  return null
}
