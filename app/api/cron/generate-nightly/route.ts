import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Entry } from '@/types'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const dateString = sevenDaysAgo.toISOString().split('T')[0]

    // Query entries needing version generation
    // - generating_versions = false
    // - versions IS NULL
    // - created within last 7 days
    const { data: entries, error: fetchError } = await supabase
      .from('entries')
      .select('*')
      .eq('generating_versions', false)
      .is('versions', null)
      .neq('skip_auto_generate', true)
      .neq('entry_type', 'connection')
      .gte('created_at', dateString)
      .order('created_at', { ascending: false })
      .limit(10) // Process up to 10 entries per run

    if (fetchError) {
      console.error('Error fetching entries:', fetchError)
      return NextResponse.json(
        { error: `Failed to fetch entries: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        message: 'No entries to process',
        processed: 0,
        errors: 0,
        timestamp: new Date().toISOString(),
      })
    }

    let processed = 0
    let errors = 0
    const errorDetails: string[] = []

    // Process entries sequentially to avoid rate limits
    for (const entry of entries) {
      try {
        // Set generating flag
        await supabase
          .from('entries')
          .update({ generating_versions: true })
          .eq('id', entry.id)

        // Generate versions
        const versions = await generateVersionsForEntry(entry as Entry, apiKey)

        // Update entry with versions
        const { error: updateError } = await supabase
          .from('entries')
          .update({
            versions,
            generating_versions: false,
          })
          .eq('id', entry.id)

        if (updateError) {
          throw new Error(`Failed to update entry: ${updateError.message}`)
        }

        processed++
        
        // Add delay between entries to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        errors++
        const errorMsg = `Entry ${entry.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errorDetails.push(errorMsg)
        console.error(errorMsg)

        // Reset generating flag on error
        await supabase
          .from('entries')
          .update({ generating_versions: false })
          .eq('id', entry.id)
      }
    }

    return NextResponse.json({
      message: 'Nightly generation completed',
      processed,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function generateVersionsForEntry(entry: Entry, apiKey: string) {
  const styles = [
    {
      name: 'literary',
      title: 'Literary/Personal Essay',
      prompt: createLiteraryPrompt(entry),
    },
    {
      name: 'news',
      title: 'News Feature',
      prompt: createNewsPrompt(entry),
    },
    {
      name: 'poetic',
      title: 'Poetic',
      prompt: createPoeticPrompt(entry),
    },
  ]

  const results = await Promise.all(
    styles.map(async (style) => {
      const content = await callClaudeAPI(style.prompt, apiKey)
      
      // Parse structured JSON response for news style
      if (style.name === 'news') {
        try {
          const cleanedContent = content
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim()
          
          const parsed = JSON.parse(cleanedContent)
          return {
            name: style.name,
            title: style.title,
            content: `${parsed.headline}\n\n${parsed.body}`,
            headline: parsed.headline,
            body: parsed.body,
          }
        } catch (e) {
          // Fallback if JSON parsing fails - provide explicit empty headline/body
          // to avoid naive string splitting on malformed JSON in the modal
          console.error('Failed to parse news JSON:', e)
          return {
            name: style.name,
            title: style.title,
            content: content,
            headline: 'News Feature',
            body: content,
          }
        }
      }
      
      return {
        name: style.name,
        title: style.title,
        content: content,
      }
    })
  )

  return results
}

async function callClaudeAPI(prompt: string, apiKey: string): Promise<string> {
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
    } catch (e) {
      bodyText = '<unable to read response body>'
    }
    throw new Error(`API request failed: ${response.status} - ${bodyText}`)
  }

  const data = await response.json()
  return data.content[0].text
}

function createPoeticPrompt(entry: Entry): string {
  return `Transform this journal entry into a poetic style. Use evocative imagery, rhythm, and carefully chosen language. Make it feel contemplative and artistic without being fragmented or disjointed.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

IMPORTANT FORMATTING RULES:
- Write ONLY the poetic version
- Do NOT include a title, heading, or any introductory line
- Do NOT use markdown formatting (no asterisks, no bold, no italics)
- Do NOT use decorative symbols or ornaments
- Start directly with the first line of poetry/prose
- Use plain text only`
}

function createNewsPrompt(entry: Entry): string {
  return `Rewrite this journal entry as a compelling news feature article in the style of the New York Times. Use journalistic structure and make it feel significant. IMPORTANT: Only include facts and details that are explicitly present in the original entry—do not invent quotes, statistics, or embellish with fabricated details.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

Return your response as valid JSON with this exact structure:
{
  "headline": "Your compelling news headline here",
  "body": "The full article body text here"
}

Write ONLY the JSON object. No preamble, explanation, or markdown formatting.`
}

function createLiteraryPrompt(entry: Entry): string {
  return `Rewrite this journal entry as a literary personal essay. Make it thoughtful, introspective, and beautifully written. Keep metaphors sparse so each one carries more weight. Explore the deeper meanings and universal themes with a lean, economical prose style.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

IMPORTANT FORMATTING RULES:
- Write ONLY the essay body text
- Do NOT include a title, heading, or any introductory line
- Do NOT use markdown formatting (no asterisks, no bold, no italics)
- Do NOT use decorative symbols or ornaments
- Start directly with the first sentence of prose
- Use plain text only`
}

