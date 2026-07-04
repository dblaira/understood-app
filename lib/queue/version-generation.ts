import { Entry } from '@/types'

export interface ProcessingResult {
  success: boolean
  entryId: string
  error?: string
}

export async function processEntryVersions(
  entry: Entry,
  apiKey: string
): Promise<ProcessingResult> {
  try {
    const versions = await generateAllVersions(entry, apiKey)
    return {
      success: true,
      entryId: entry.id,
    }
  } catch (error) {
    return {
      success: false,
      entryId: entry.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function generateAllVersions(entry: Entry, apiKey: string) {
  const styles = [
    {
      name: 'poetic',
      title: 'Fragmented/Poetic',
      prompt: createPoeticPrompt(entry),
    },
    {
      name: 'news',
      title: 'News Feature',
      prompt: createNewsPrompt(entry),
    },
    {
      name: 'humorous',
      title: 'Observational/Humorous',
      prompt: createHumorousPrompt(entry),
    },
    {
      name: 'literary',
      title: 'Literary/Personal Essay',
      prompt: createLiteraryPrompt(entry),
    },
  ]

  const results = await Promise.all(
    styles.map(async (style) => {
      const content = await callClaudeAPI(style.prompt, apiKey)
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
  return `Transform this journal entry into a fragmented, poetic style. Use short lines, white space, and evocative imagery. Make it feel contemplative and artistic.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

Write ONLY the transformed version in a fragmented, poetic style. No preamble or explanation.`
}

function createNewsPrompt(entry: Entry): string {
  return `Rewrite this journal entry as a compelling news feature article in the style of the New York Times. Use journalistic structure, vivid details, and make it feel significant.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

Write ONLY the news article version. No preamble or explanation.`
}

function createHumorousPrompt(entry: Entry): string {
  return `Rewrite this journal entry in an observational, humorous style. Keep it conversational and witty, finding the absurd or ironic elements while staying true to the original meaning.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

Write ONLY the humorous version. No preamble or explanation.`
}

function createLiteraryPrompt(entry: Entry): string {
  return `Rewrite this journal entry as a literary personal essay. Make it thoughtful, introspective, and beautifully written. Explore the deeper meanings and universal themes.

Entry:
Category: ${entry.category}
Headline: ${entry.headline}
${entry.subheading ? `Subheading: ${entry.subheading}` : ''}
Mood: ${entry.mood || 'not specified'}

Content:
${entry.content}

Write ONLY the literary essay version. No preamble or explanation.`
}

