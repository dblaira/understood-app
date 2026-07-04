import { ExtractionFromClaude } from '@/types/extraction'

interface EntryForExtraction {
  id: string
  content: string
  created_at: string
  metadata?: {
    captured_at?: string
    day_of_week?: string
    time_of_day?: string
    location?: { display_name?: string }
  }
}

export function buildExtractionPrompt(entries: EntryForExtraction[]): string {
  const entriesBlock = entries.map((e, i) => {
    const timestamp = e.metadata?.captured_at || e.created_at
    const dayOfWeek = e.metadata?.day_of_week || ''
    const timeOfDay = e.metadata?.time_of_day || ''
    const location = e.metadata?.location?.display_name || ''

    const contextParts = [dayOfWeek, timeOfDay, location].filter(Boolean).join(' · ')
    const context = contextParts ? ` (${contextParts})` : ''

    return `--- ENTRY ${i + 1} [id: ${e.id}] ---
Timestamp: ${timestamp}${context}

${e.content}
`
  }).join('\n')

  return `You are a structured data extractor for a personal journal. You receive raw journal entries and return structured extractions.

## Your Job

Read the journal entries below. For each meaningful signal — explicit or implicit — produce a structured extraction.

## Categories

Start with these seed categories, but you may propose new ones if the data demands it:

- **nutrition**: food, drink, meals, supplements, fasting, diet choices
- **exercise**: workouts, movement, gym, sports, physical activity, skipping activity
- **purchase**: spending, buying, orders, subscriptions, financial transactions
- **affect**: emotional state, mood, feelings, energy level, mental state
- **belief**: convictions, values, worldview shifts, identity statements
- **ambition**: goals, aspirations, plans, intentions, desires for the future
- **insight**: realizations, patterns noticed, cross-domain tensions, contradictions
- **social**: people, relationships, interactions, conversations, social dynamics
- **sleep**: rest, sleep quality, naps, fatigue, insomnia, sleep schedule
- **health**: symptoms, conditions, medications, doctor visits, body state
- **work**: professional tasks, projects, career moves, productivity, meetings

If an entry contains data that doesn't fit these categories, propose a new lowercase single-word category. Keep new categories rare — only when the seeds genuinely don't fit.

## Extraction Rules

1. **One entry can produce zero or many extractions.** Don't force extractions where there's nothing.
2. **Capture implicit data.** "Skipped the gym" = exercise with status "skipped". "Feeling off" = affect with state "off". "Grabbed coffee with Sarah" = social + nutrition.
3. **Cross-domain tensions go in "insight".** Example: buying fitness gear on the same day as skipping a workout. The tension itself is the extraction.
4. **Data is key-value pairs.** Keys should be short, descriptive, lowercase. Values should be concrete — strings, numbers, or booleans. No nested objects.
5. **source_text is the snippet** from the original entry that this extraction comes from. Keep it short — the relevant phrase or sentence, not the whole entry.
6. **Confidence scoring:**
   - **1.0** = explicitly stated ("I ate salmon for dinner")
   - **0.7** = strongly implied ("Grabbed something quick on the way home" → nutrition, implied meal)
   - **0.4** = loosely inferred ("Long day" → affect, inferred fatigue)

## Output Format

Return a JSON array. Each element:

\`\`\`json
{
  "entry_id": "uuid-from-entry",
  "category": "category_name",
  "data": { "key": "value", "key2": "value2" },
  "confidence": 1.0,
  "source_text": "the relevant snippet"
}
\`\`\`

If no extractions are found, return an empty array: \`[]\`

Return ONLY the JSON array. No markdown fences. No explanation.

## Entries

${entriesBlock}`
}

export function parseExtractionResponse(text: string): ExtractionFromClaude[] {
  let cleaned = text.trim()

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed)) {
    throw new Error('Extraction response is not an array')
  }

  return parsed.map((item: Record<string, unknown>) => {
    if (!item.entry_id || !item.category || !item.data) {
      throw new Error(`Invalid extraction: missing required fields — ${JSON.stringify(item)}`)
    }

    const confidence = typeof item.confidence === 'number' ? item.confidence : 0.7
    const clampedConfidence = Math.round(Math.min(1.0, Math.max(0, confidence)) * 10) / 10

    return {
      entry_id: String(item.entry_id),
      category: String(item.category).toLowerCase(),
      data: item.data as Record<string, string | number | boolean>,
      confidence: clampedConfidence,
      source_text: item.source_text ? String(item.source_text) : undefined,
    }
  })
}

export async function callExtractionAPI(
  prompt: string,
  apiKey: string
): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let bodyText: string
      try {
        bodyText = await response.text()
      } catch {
        bodyText = '<unable to read response body>'
      }
      throw new Error(`Anthropic API error (${response.status}): ${bodyText}`)
    }

    const data = await response.json()

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response format from Anthropic API')
    }

    return data.content[0].text
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Extraction request timed out after 90 seconds')
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error calling Anthropic API: ${error.message}`)
    }

    throw error
  }
}
