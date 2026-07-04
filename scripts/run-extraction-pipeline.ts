import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { parseAmazon } from '../lib/extraction-pipeline/parse-amazon'
import { parseYouTube } from '../lib/extraction-pipeline/parse-youtube'
import { parseMyFitnessPal } from '../lib/extraction-pipeline/parse-myfitnesspal'
import { parseAppleCalendar, parseAppleNotes } from '../lib/extraction-pipeline/parse-apple'
import { batchByTimeWindow } from '../lib/extraction-pipeline/batcher'
import { buildDomainPrompt, estimateTokens } from '../lib/extraction-pipeline/domain-prompts'
import { DOMAIN_CONFIGS, NormalizedRecord, PipelineResult, ExtractionFromClaudeExternal } from '../lib/extraction-pipeline/types'

config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

// Claude Sonnet 4.6 standard API: $3/M input, $15/M output (aligned with callExtractionAPI model)
const COST_PER_1K_INPUT = 0.003
const COST_PER_1K_OUTPUT = 0.015

interface CLIArgs {
  dryRun: boolean
  source: string | null
  limit: number | null
  userId: string | null
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const result: CLIArgs = {
    dryRun: false,
    source: null,
    limit: null,
    userId: null,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        result.dryRun = true
        break
      case '--source':
        result.source = args[++i]
        break
      case '--limit':
        result.limit = parseInt(args[++i], 10)
        break
      case '--user-id':
        result.userId = args[++i]
        break
    }
  }

  return result
}

const PARSERS: Record<string, (root: string) => NormalizedRecord[]> = {
  amazon: parseAmazon,
  youtube: parseYouTube,
  myfitnesspal: parseMyFitnessPal,
  apple_calendar: parseAppleCalendar,
  apple_notes: parseAppleNotes,
}

async function callExtractionAPI(prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '<unable to read>')
      throw new Error(`Anthropic API error (${response.status}): ${bodyText}`)
    }

    const data = await response.json()
    if (!data.content?.[0]?.text) {
      throw new Error('Invalid response format from Anthropic API')
    }
    return data.content[0].text
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Extraction request timed out after 120 seconds')
    }
    throw error
  }
}

function parseExtractionResponse(text: string): ExtractionFromClaudeExternal[] {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed)) {
    throw new Error('Extraction response is not an array')
  }

  return parsed.map((item: Record<string, unknown>) => {
    if (!item.category || !item.data) {
      throw new Error(`Invalid extraction: missing required fields — ${JSON.stringify(item)}`)
    }
    const confidence = typeof item.confidence === 'number' ? item.confidence : 0.7
    const clampedConfidence = Math.round(Math.min(1.0, Math.max(0, confidence)) * 10) / 10

    return {
      category: String(item.category).toLowerCase(),
      data: item.data as Record<string, string | number | boolean>,
      confidence: clampedConfidence,
      source_text: item.source_text ? String(item.source_text) : undefined,
    }
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function resolveUserId(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from('entries')
    .select('user_id')
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('Could not resolve user_id from entries table. Use --user-id flag.')
  }
  return (data as { user_id: string }).user_id
}

async function main() {
  const args = parseArgs()
  const projectRoot = resolve(__dirname, '..')

  console.log('\n=== Multi-Domain Extraction Pipeline ===\n')
  console.log(`Mode: ${args.dryRun ? 'DRY RUN (no API calls)' : 'LIVE'}`)
  if (args.source) console.log(`Source: ${args.source}`)
  if (args.limit) console.log(`Batch limit: ${args.limit}`)
  console.log('')

  if (!args.dryRun) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
      process.exit(1)
    }
    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY in .env.local')
      process.exit(1)
    }
  }

  const sources = args.source
    ? [args.source]
    : Object.keys(DOMAIN_CONFIGS)

  for (const source of sources) {
    const config = DOMAIN_CONFIGS[source]
    if (!config) {
      console.error(`Unknown source: ${source}. Available: ${Object.keys(DOMAIN_CONFIGS).join(', ')}`)
      process.exit(1)
    }

    const parser = PARSERS[source]
    if (!parser) {
      console.log(`\n⏭ Skipping ${config.label} — parser not yet implemented.`)
      continue
    }

    console.log(`\n--- ${config.label} ---\n`)

    console.log('Parsing records...')
    let records: NormalizedRecord[]
    try {
      records = parser(projectRoot)
    } catch (err) {
      console.error(`Failed to parse ${source}:`, err)
      continue
    }

    if (records.length === 0) {
      console.log('No records found. Skipping.')
      continue
    }

    console.log(`\nBatching into ${config.window_size}ly windows...`)
    const batches = batchByTimeWindow(records, config.window_size)
    console.log(`Created ${batches.length} batches.\n`)

    const effectiveBatches = args.limit
      ? batches.slice(0, args.limit)
      : batches

    if (args.dryRun) {
      let totalTokens = 0
      console.log('Batch preview:')
      console.log('─'.repeat(70))

      for (let i = 0; i < effectiveBatches.length; i++) {
        const batch = effectiveBatches[i]
        const prompt = buildDomainPrompt(batch)
        const tokens = estimateTokens(prompt)
        totalTokens += tokens

        console.log(
          `  [${String(i + 1).padStart(3)}/${effectiveBatches.length}] ` +
          `${batch.window_start} to ${batch.window_end} | ` +
          `${String(batch.records.length).padStart(4)} records | ` +
          `~${tokens.toLocaleString()} input tokens`
        )
      }

      const estimatedOutputTokens = effectiveBatches.length * 1500
      const inputCost = (totalTokens / 1000) * COST_PER_1K_INPUT
      const outputCost = (estimatedOutputTokens / 1000) * COST_PER_1K_OUTPUT
      const totalCost = inputCost + outputCost

      console.log('─'.repeat(70))
      console.log(`\nDry Run Summary — ${config.label}:`)
      console.log(`  Batches: ${effectiveBatches.length}`)
      console.log(`  Total records: ${records.length}`)
      console.log(`  Estimated input tokens: ~${totalTokens.toLocaleString()}`)
      console.log(`  Estimated output tokens: ~${estimatedOutputTokens.toLocaleString()}`)
      console.log(`  Estimated cost: $${totalCost.toFixed(2)} (input: $${inputCost.toFixed(2)}, output: $${outputCost.toFixed(2)})`)
      console.log(`  API calls: ${effectiveBatches.length}`)
      continue
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const userId = args.userId || await resolveUserId(supabase)
    console.log(`User ID: ${userId}`)

    const batchId = crypto.randomUUID()
    const result: PipelineResult = {
      source_domain: source,
      batches_processed: 0,
      batches_skipped: 0,
      total_extractions: 0,
      categories_found: [],
      errors: [],
    }

    for (let i = 0; i < effectiveBatches.length; i++) {
      const batch = effectiveBatches[i]
      const label = `[${String(i + 1).padStart(3)}/${effectiveBatches.length}] ${source} | ${batch.window_start} to ${batch.window_end}`

      try {
        const prompt = buildDomainPrompt(batch)
        console.log(`${label} | ${batch.records.length} records | sending...`)

        const responseText = await callExtractionAPI(prompt)
        const extractions = parseExtractionResponse(responseText)

        if (extractions.length === 0) {
          console.log(`${label} | 0 extractions (empty window)`)
          result.batches_processed++
          continue
        }

        const rows = extractions.map(ext => ({
          user_id: userId,
          entry_id: null,
          category: ext.category,
          data: ext.data,
          confidence: ext.confidence,
          source_text: ext.source_text || null,
          batch_id: batchId,
          source_domain: source,
          time_window_start: batch.window_start,
          time_window_end: batch.window_end,
          batch_size: batch.records.length,
        }))

        const { data: inserted, error } = await supabase
          .from('extractions')
          .insert(rows)
          .select('id, category')

        if (error) {
          throw new Error(`Supabase insert error: ${error.message}`)
        }

        const insertedCount = inserted?.length ?? 0
        result.total_extractions += insertedCount
        result.batches_processed++

        const cats = [...new Set(extractions.map(e => e.category))]
        for (const c of cats) {
          if (!result.categories_found.includes(c)) {
            result.categories_found.push(c)
          }
        }

        console.log(`${label} | ${insertedCount} extractions | categories: ${cats.join(', ')}`)

        if (i < effectiveBatches.length - 1) {
          await sleep(2000)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`${label} | ERROR: ${msg}`)
        result.errors.push(`${batch.window_start}: ${msg}`)
        result.batches_skipped++

        await sleep(2000)
      }
    }

    console.log(`\n${'='.repeat(50)}`)
    console.log(`Results — ${config.label}:`)
    console.log(`  Batch ID: ${batchId}`)
    console.log(`  Batches processed: ${result.batches_processed}`)
    console.log(`  Batches skipped (errors): ${result.batches_skipped}`)
    console.log(`  Total extractions inserted: ${result.total_extractions}`)
    console.log(`  Categories found: ${result.categories_found.join(', ')}`)
    if (result.errors.length > 0) {
      console.log(`  Errors:`)
      for (const e of result.errors) {
        console.log(`    - ${e}`)
      }
    }
    console.log(`${'='.repeat(50)}`)
  }

  console.log('\nDone.\n')
}

main().catch(err => {
  console.error('Pipeline failed:', err)
  process.exit(1)
})
