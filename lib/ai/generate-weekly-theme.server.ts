import { createClient } from '@/lib/supabase/server'
import { Entry } from '@/types'
import { createWeeklyThemePrompt, parseWeeklyThemeResponse } from '@/lib/ai/weekly-theme-prompt'

export async function generateWeeklyThemeLogic(entryIds: string[], userId: string) {
  const supabase = await createClient()

  if (entryIds.length !== 7) {
    throw new Error('Exactly 7 entry IDs are required')
  }

  // Fetch all 7 entries (user-scoped)
  const { data: entries, error: fetchError } = await supabase
    .from('entries')
    .select('*')
    .in('id', entryIds)
    .eq('user_id', userId)

  if (fetchError) {
    throw new Error(`Failed to fetch entries: ${fetchError.message}`)
  }

  if (!entries || entries.length !== 7) {
    throw new Error('Could not find all 7 entries')
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is missing from environment')
    throw new Error('API key not configured')
  }

  console.log('API key found, length:', apiKey.length)
  console.log('API key starts with:', apiKey.substring(0, 10))

  // Generate weekly theme using Claude API
  const prompt = createWeeklyThemePrompt(entries as Entry[])
  console.log('Prompt created, length:', prompt.length)
  
  console.log('Calling Anthropic API...')
  const response = await callClaudeAPI(prompt, apiKey)
  console.log('API response received, length:', response.length)
  
  const theme = parseWeeklyThemeResponse(response)
  console.log('Theme parsed:', { headline: theme.headline, subtitle: theme.subtitle })

  // Calculate week start date (Monday of the week)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday
  const weekStart = new Date(now.setDate(diff))
  weekStart.setHours(0, 0, 0, 0)

  // Store weekly theme in database
  const { data: themeData, error: insertError } = await supabase
    .from('weekly_themes')
    .insert([
      {
        user_id: userId,
        headline: theme.headline,
        subtitle: theme.subtitle,
        theme_content: theme.theme_content,
        entry_ids: entryIds,
        week_start_date: weekStart.toISOString().split('T')[0],
      },
    ])
    .select()
    .single()

  if (insertError) {
    console.error('Error inserting weekly theme:', insertError)
    throw new Error(`Failed to save theme: ${insertError.message}`)
  }

  // Update entries with week_theme_id
  const { error: updateError } = await supabase
    .from('entries')
    .update({ week_theme_id: themeData.id })
    .in('id', entryIds)
    .eq('user_id', userId)

  if (updateError) {
    console.error('Error updating entries:', updateError)
    // Don't fail the request, theme was created successfully
  }

  return themeData
}

async function callClaudeAPI(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
  
  try {
    console.log('Making fetch request to Anthropic API...')
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
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
      } catch (e) {
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
    
    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request to Anthropic API timed out after 60 seconds')
    }
    
    // Re-throw with more context if it's a fetch error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Fetch error details:', error)
      throw new Error(`Network error calling Anthropic API: ${error.message}. This might be a DNS, network, or SSL issue.`)
    }
    
    // Handle other errors
    console.error('Error calling Anthropic API:', error)
    throw error
  }
}

