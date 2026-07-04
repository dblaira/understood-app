import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runClaudeWithPresentationGuardrail } from '@/lib/ai/presentation-pipeline.server'
import { Extraction } from '@/types/extraction'
import { buildWeeklyMatrix } from '@/lib/correlations/matrix'
import {
  computeAllCorrelations,
  computeLaggedCorrelations,
  computeCategoryStats,
  detectAnomalies,
} from '@/lib/correlations/math'
import { CorrelationPair, AnomalyWeek, CategoryStats } from '@/types/correlation'

function weekKeyToDateRange(weekKey: string): string {
  const [y, w] = weekKey.split('-W').map(Number)
  const jan1 = new Date(y, 0, 1)
  const dayOffset = (1 - jan1.getDay() + 7) % 7
  const monday = new Date(y, 0, 1 + dayOffset + (w - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return fmt(monday) + ' – ' + fmt(sunday) + ', ' + y
}

function buildInterpretationPrompt(
  correlations: CorrelationPair[],
  lagged: CorrelationPair[],
  anomalies: AnomalyWeek[],
  stats: CategoryStats[],
  dateFrom: string,
  dateTo: string
): string {
  const positive = correlations
    .filter((c) => c.coefficient > 0)
    .slice(0, 15)
    .map(
      (c) =>
        `${c.categoryA} & ${c.categoryB}: ${Math.round(c.coefficient * 100)}% of the time they rise together`
    )
    .join('\n')

  const negative = correlations
    .filter((c) => c.coefficient < 0)
    .slice(0, 10)
    .map(
      (c) =>
        `${c.categoryA} & ${c.categoryB}: ${Math.round(Math.abs(c.coefficient) * 100)}% of the time one goes up while the other goes down`
    )
    .join('\n')

  const leaders = lagged
    .slice(0, 10)
    .map(
      (c) =>
        `${c.categoryA} → ${c.categoryB} (${c.lag} week${c.lag > 1 ? 's' : ''} later): ${Math.round(Math.abs(c.coefficient) * 100)}%`
    )
    .join('\n')

  const anomalyBlock = anomalies
    .filter((a) => a.anomalies.some((an) => an.category !== 'Sleep'))
    .slice(0, 15)
    .map((a) => {
      const flags = a.anomalies
        .map(
          (an) =>
            `${an.category} ${an.direction === 'spike' ? 'way up' : 'way down'} (${an.value} that week, usually ${an.mean})`
        )
        .join(', ')
      const domains = Object.entries(a.domainBreakdown)
        .map(
          ([cat, doms]) =>
            `${cat}: ${Object.entries(doms)
              .map(([d, c]) => `${d} ${c}`)
              .join(', ')}`
        )
        .join('; ')
      return `${weekKeyToDateRange(a.weekKey)}: ${flags}${domains ? '\n  Sources: ' + domains : ''}`
    })
    .join('\n')

  const statsBlock = stats
    .sort((a, b) => b.totalCount - a.totalCount)
    .map(
      (s) =>
        `${s.category}: ${s.totalCount} total, shows up ${s.coveragePercent}% of weeks, average ${s.mean} per week`
    )
    .join('\n')

  return `You are analyzing one person's life patterns. This data comes from their personal journal entries, Amazon purchase history, YouTube watch history, MyFitnessPal nutrition logs, and Apple account data. The data covers ${dateFrom} to ${dateTo}.

The person wants to understand themselves better. They are NOT a data scientist. Write like you're talking to a smart friend — no technical words, no statistics jargon. Use short sentences. Be specific and direct. If you notice something interesting, say what it means for their actual life, not what it means mathematically.

## Their 13 life categories and how active each one is:

${statsBlock}

## Categories that rise and fall together (same week):

${positive || 'None found above 50%.'}

## Categories that trade off (when one goes up, the other goes down):

${negative || 'None found — nothing in their life works against anything else.'}

## Categories where one predicts the other (1-2 weeks ahead):

${leaders || 'No strong predictions found.'}

## Unusual weeks (things that were way above or below normal):

${anomalyBlock || 'No unusual weeks found.'}

---

Now write your analysis. Use these exact sections:

1. **YOUR PATTERNS** — The 3-5 biggest patterns in how this person lives. Each one gets a short name (2-4 words) and 2-3 sentences explaining what it means in plain English. Focus on what's actually connected in their life and what's independent.

2. **WHAT'S MISSING** — Categories that barely show up, or connections you'd expect to see but don't. Be honest about gaps in the data. If Sleep only shows up 13% of weeks, say that's a blind spot.

3. **YOUR UNUSUAL WEEKS** — Pick the 3-5 most interesting unusual weeks and write 1-2 sentences about each. What might have been going on? Don't guess wildly, but connect the dots where the data supports it.

4. **WHAT TO WATCH** — 2-3 things this person should pay attention to going forward. Based on the patterns, what would be worth tracking more carefully or being aware of?

Write in first person ("You tend to..." not "The user tends to..."). Keep each section short. No bullet points longer than 2 sentences. No jargon. A 10-year-old should be able to read this.

Return valid JSON with this structure:
{
  "patterns": [{ "name": "string", "description": "string", "categories": ["string"] }],
  "blind_spots": ["string"],
  "unusual_weeks": [{ "week": "string", "narrative": "string" }],
  "watch_list": ["string"]
}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const dateFrom = body.dateFrom || '2024-06-01'
    const dateTo = body.dateTo || '2026-03-01'

    console.log('=== Correlation Analysis ===')
    console.log(`Date range: ${dateFrom} to ${dateTo}`)

    const all: Extraction[] = []
    let offset = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('extractions')
        .select('*')
        .eq('user_id', user.id)
        .not('parent_category', 'is', null)
        .range(offset, offset + pageSize - 1)
      if (error || !data || data.length === 0) break
      all.push(...(data as Extraction[]))
      if (data.length < pageSize) break
      offset += pageSize
    }

    console.log(`Extractions fetched: ${all.length}`)

    const matrix = buildWeeklyMatrix(all, dateFrom, dateTo)
    console.log(`Matrix: ${matrix.weeks.length} weeks, ${matrix.categories.length} categories, ${matrix.totalExtractions} extractions`)

    const correlations = computeAllCorrelations(matrix)
    const lagged = computeLaggedCorrelations(matrix)
    const stats = computeCategoryStats(matrix)
    const anomalies = detectAnomalies(matrix, 2.5)

    console.log(`Correlations: ${correlations.length} pairs`)
    console.log(`Leading indicators: ${lagged.length}`)
    console.log(`Anomaly weeks: ${anomalies.length}`)

    const prompt = buildInterpretationPrompt(
      correlations,
      lagged,
      anomalies,
      stats,
      dateFrom,
      dateTo
    )

    console.log('Calling Claude for interpretation...')

    let rawText: string
    let presentationTrace
    try {
      const guarded = await Promise.race([
        runClaudeWithPresentationGuardrail({
          supabase,
          userId: user.id,
          apiKey,
          model: 'claude-opus-4-8',
          maxTokens: 4000,
          messages: [{ role: 'user', content: prompt }],
          system:
            'Return ONLY valid JSON. Every narrative field must use bullet lines or markdown tables — no prose paragraphs.',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Analysis timed out after 120s')), 120000)
        ),
      ])
      rawText = guarded.text
      presentationTrace = guarded.presentation
    } catch (claudeErr) {
      console.error('Claude API error:', claudeErr)
      return NextResponse.json(
        { error: 'Claude API error' },
        { status: 500 }
      )
    }

    console.log('Claude response received, parsing...')

    let interpretation
    try {
      let cleaned = rawText.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned
          .replace(/^```(?:json)?\s*\n?/, '')
          .replace(/\n?```\s*$/, '')
      }
      interpretation = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Claude response as JSON, storing as raw')
      interpretation = { raw: rawText }
    }

    const { data: saved, error: saveError } = await supabase
      .from('correlation_analyses')
      .insert({
        user_id: user.id,
        date_range_start: dateFrom,
        date_range_end: dateTo,
        total_weeks: matrix.weeks.length,
        total_extractions: matrix.totalExtractions,
        correlations: correlations,
        anomaly_weeks: anomalies,
        category_stats: stats,
        interpretation: interpretation,
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('Save error:', saveError)
      return NextResponse.json({
        interpretation,
        correlations,
        anomalies,
        stats,
        saved: false,
        error: saveError.message,
        presentation: presentationTrace,
      })
    }

    console.log(`Analysis saved: ${saved.id}`)

    return NextResponse.json({
      id: saved.id,
      interpretation,
      correlations,
      anomalies,
      stats,
      totalWeeks: matrix.weeks.length,
      totalExtractions: matrix.totalExtractions,
      saved: true,
      presentation: presentationTrace,
    })
  } catch (err) {
    console.error('Correlation analysis error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
