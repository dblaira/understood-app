import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { buildWeeklyMatrix } from '../lib/correlations/matrix'
import { computeAllCorrelations, computeLaggedCorrelations, computeCategoryStats, detectAnomalies } from '../lib/correlations/math'
import { Extraction } from '../types/extraction'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!

function parseArgs() {
  const args = process.argv.slice(2)
  let from = '2024-06-01'
  let to = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) from = args[i + 1]
    if (args[i] === '--to' && args[i + 1]) to = args[i + 1]
  }

  return { from, to: to || undefined }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllExtractions(supabase: SupabaseClient<any>): Promise<Extraction[]> {
  const all: Extraction[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('extractions')
      .select('*')
      .not('parent_category', 'is', null)
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Supabase error:', error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as Extraction[]))
    if (data.length < pageSize) break
    offset += pageSize
  }

  return all
}

function printTable(headers: string[], rows: string[][], colWidths: number[]) {
  const sep = colWidths.map(w => '-'.repeat(w)).join(' | ')
  console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(' | '))
  console.log(sep)
  for (const row of rows) {
    console.log(row.map((c, i) => c.padEnd(colWidths[i])).join(' | '))
  }
}

async function main() {
  const { from, to } = parseArgs()
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('=== Cross-Domain Correlation Matrix ===')
  console.log(`Date range: ${from} to ${to || 'present'}`)
  console.log()

  console.log('Fetching extractions...')
  const extractions = await fetchAllExtractions(supabase)
  console.log(`Total extractions with parent_category: ${extractions.length}`)
  console.log()

  console.log('Building weekly matrix...')
  const matrix = buildWeeklyMatrix(extractions, from, to)
  console.log(`Weeks with data: ${matrix.weeks.length}`)
  console.log(`Categories: ${matrix.categories.length} — ${matrix.categories.join(', ')}`)
  console.log(`Extractions in range: ${matrix.totalExtractions}`)
  console.log(`Date range: ${matrix.dateRange.start} to ${matrix.dateRange.end}`)
  console.log()

  // Category stats
  const stats = computeCategoryStats(matrix)
  console.log('=== Category Stats ===')
  const statsHeaders = ['Category', 'Total', 'Mean/wk', 'StdDev', 'Weeks', 'Coverage']
  const statsRows = stats
    .sort((a, b) => b.totalCount - a.totalCount)
    .map(s => [
      s.category,
      String(s.totalCount),
      String(s.mean),
      String(s.stdDev),
      `${s.weeksWithData}/${matrix.weeks.length}`,
      `${s.coveragePercent}%`,
    ])
  printTable(statsHeaders, statsRows, [16, 6, 8, 8, 8, 8])
  console.log()

  // Weekly matrix (most recent 20 weeks)
  const recentWeeks = matrix.weeks.slice(-20)
  console.log(`=== Weekly Matrix (last ${recentWeeks.length} weeks) ===`)
  const cats = matrix.categories
  const matHeaders = ['Week', ...cats.map(c => c.slice(0, 8)), 'Total']
  const matRows = recentWeeks.map(w => [
    w.weekKey,
    ...cats.map(c => String(w.counts[c] || 0)),
    String(w.total),
  ])
  const matWidths = [10, ...cats.map(() => 8), 6]
  printTable(matHeaders, matRows, matWidths)
  console.log()

  // Sparse weeks
  const sparseWeeks = matrix.weeks.filter(w => w.total < 3)
  if (sparseWeeks.length > 0) {
    console.log(`=== Sparse Weeks (< 3 extractions): ${sparseWeeks.length} ===`)
    sparseWeeks.slice(0, 10).forEach(w => console.log(`  ${w.weekKey}: ${w.total} extractions`))
    if (sparseWeeks.length > 10) console.log(`  ... and ${sparseWeeks.length - 10} more`)
    console.log()
  }

  // Correlations
  console.log('=== Same-Week Correlations ===')
  const correlations = computeAllCorrelations(matrix)
  const topPositive = correlations.filter(c => c.coefficient > 0).slice(0, 10)
  const topNegative = correlations.filter(c => c.coefficient < 0).slice(0, 10)

  if (topPositive.length > 0) {
    console.log('Top co-movements (positive):')
    topPositive.forEach(c =>
      console.log(`  ${c.categoryA} <-> ${c.categoryB}: ${c.coefficient > 0 ? '+' : ''}${c.coefficient}`)
    )
  }
  if (topNegative.length > 0) {
    console.log('Top inverse pairs (negative):')
    topNegative.forEach(c =>
      console.log(`  ${c.categoryA} <-> ${c.categoryB}: ${c.coefficient}`)
    )
  }
  console.log(`Total pairs with |r| > 0.15: ${correlations.length}`)
  console.log()

  // Lagged correlations
  console.log('=== Leading Indicators (1-2 week lag) ===')
  const lagged = computeLaggedCorrelations(matrix)
  if (lagged.length === 0) {
    console.log('  No strong leading indicators found')
  } else {
    lagged.slice(0, 10).forEach(c =>
      console.log(`  ${c.categoryA} leads ${c.categoryB} by ${c.lag}wk: ${c.coefficient > 0 ? '+' : ''}${c.coefficient}`)
    )
  }
  console.log()

  // Anomalies
  console.log('=== Anomaly Weeks ===')
  const anomalies = detectAnomalies(matrix)
  if (anomalies.length === 0) {
    console.log('  No anomaly weeks detected')
  } else {
    console.log(`${anomalies.length} anomaly weeks found`)
    anomalies.slice(0, 10).forEach(a => {
      const flags = a.anomalies.map(an =>
        `${an.category} ${an.direction === 'spike' ? '↑' : '↓'}${Math.abs(an.zScore).toFixed(1)}σ`
      ).join(', ')
      console.log(`  ${a.weekKey}: ${flags}`)
    })
    if (anomalies.length > 10) console.log(`  ... and ${anomalies.length - 10} more`)
  }
  console.log()

  console.log('=== Done ===')
}

main().catch(console.error)
