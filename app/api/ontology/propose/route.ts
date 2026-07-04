import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OntologyProposal } from '@/types/extraction'

interface CategorySummary {
  label: string
  count: number
  domains: string[]
}

function buildOntologyPrompt(categories: CategorySummary[]): string {
  const categoryBlock = categories
    .sort((a, b) => b.count - a.count)
    .map(c => `- "${c.label}" — ${c.count} extractions (domains: ${c.domains.join(', ')})`)
    .join('\n')

  return `You are a data ontologist. You receive a list of category labels extracted from a personal journal and external data sources. Your job is to propose a clean two-level hierarchy: broad parent categories (Level 1) and specific child labels (Level 2).

## Input

These are every unique category label currently in the extractions database, with their extraction count and source domains:

${categoryBlock}

Total unique labels: ${categories.length}
Total extractions: ${categories.reduce((sum, c) => sum + c.count, 0)}

## Your Task

Propose a two-level ontology:

**Level 1 (Parent categories):** 10-15 broad, stable, human-readable categories. These will be the primary grouping on a bubble map visualization.

**Level 2 (Child labels):** The specific sub-categories that nest under each parent. These are the original extraction labels, cleaned up and assigned.

## Rules

1. **Target 10-15 parent categories maximum.** Fewer is better if the data supports it.
2. **Every child label must map to exactly one parent.** No duplicates across parents.
3. **Preserve these battle-tested seed categories where possible** — they come from 180+ journal entries and are well-established: insight, affect, belief, ambition, work, social, nutrition, exercise, health, sleep, purchase, learning. These should appear as parent categories (possibly renamed if you have a strong reason).
4. **"HIGH" and similar intensity/confidence markers are NOT categories.** They are artifacts of extraction errors. Flag them in the "unmapped" list — do not assign them to a parent.
5. **Fragments and truncated labels** (e.g., "STEPH...", "COUPL...", "SPOUS...") should be resolved to their full, clean form and merged with the correct parent.
6. **If two labels clearly mean the same thing, merge them.** Keep the cleaner/more common form as the child label.
7. **If a label is too vague or meaningless on its own** (single characters, numbers, generic words), put it in "unmapped".
8. **Propose new parent categories sparingly** — only when the existing seeds genuinely don't cover a significant cluster of labels. Put any new parent proposals in "proposed_new".
9. **Child labels should be lowercase, using underscores for multi-word labels** (e.g., "couple_activity", "dental_visit").

## Output Format

Return ONLY a JSON object matching this exact structure. No markdown fences. No explanation.

{
  "ontology": [
    {
      "parent": "Social",
      "children": ["stephanie", "couple_activity", "spouse", "tennis", "social_event"],
      "description": "Interpersonal relationships, shared activities, social engagements",
      "merge_note": "Collapsed 12 original labels into this parent"
    }
  ],
  "unmapped": ["labels_you_cant_confidently_place"],
  "proposed_new": ["parent_categories_you_think_are_missing_from_the_seeds"]
}`
}

function parseOntologyResponse(text: string): OntologyProposal {
  let cleaned = text.trim()

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const parsed = JSON.parse(cleaned)

  if (!parsed.ontology || !Array.isArray(parsed.ontology)) {
    throw new Error('Ontology response missing "ontology" array')
  }

  for (const group of parsed.ontology) {
    if (!group.parent || !Array.isArray(group.children)) {
      throw new Error(`Invalid ontology group: ${JSON.stringify(group)}`)
    }
  }

  return {
    ontology: parsed.ontology,
    unmapped: Array.isArray(parsed.unmapped) ? parsed.unmapped : [],
    proposed_new: Array.isArray(parsed.proposed_new) ? parsed.proposed_new : [],
  }
}

export async function POST() {
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
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    console.log('=== Ontology Proposal START ===')

    // Paginate to get ALL extractions (Supabase default limit is 1000)
    const allExtractions: { category: string, source_domain: string | null }[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data: page, error: fetchError } = await supabase
        .from('extractions')
        .select('category, source_domain')
        .eq('user_id', user.id)
        .range(from, from + pageSize - 1)

      if (fetchError) {
        console.error('Error fetching extractions:', fetchError)
        return NextResponse.json(
          { error: `Failed to fetch extractions: ${fetchError.message}` },
          { status: 500 }
        )
      }

      if (!page || page.length === 0) break
      allExtractions.push(...page)
      if (page.length < pageSize) break
      from += pageSize
    }

    const extractions = allExtractions

    if (extractions.length === 0) {
      return NextResponse.json(
        { error: 'No extractions found. Run extraction first.' },
        { status: 400 }
      )
    }

    const categoryMap = new Map<string, { count: number, domains: Set<string> }>()
    for (const ext of extractions) {
      const cat = ext.category
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { count: 0, domains: new Set() })
      }
      const acc = categoryMap.get(cat)!
      acc.count++
      acc.domains.add(ext.source_domain || 'journal')
    }

    const categories: CategorySummary[] = Array.from(categoryMap.entries()).map(
      ([label, acc]) => ({
        label,
        count: acc.count,
        domains: Array.from(acc.domains),
      })
    )

    console.log(`Unique categories: ${categories.length}`)
    console.log(`Total extractions: ${extractions.length}`)
    console.log('Categories:', categories.map(c => `${c.label} (${c.count})`).join(', '))

    const prompt = buildOntologyPrompt(categories)

    console.log('Calling Claude Opus 4.6 for ontology proposal...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

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
          max_tokens: 8000,
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

      const responseText = data.content[0].text
      console.log('Raw Claude response length:', responseText.length)

      const proposal = parseOntologyResponse(responseText)

      const totalChildren = proposal.ontology.reduce((sum, g) => sum + g.children.length, 0)
      console.log(`\n=== Ontology Proposal Result ===`)
      console.log(`Parent categories: ${proposal.ontology.length}`)
      console.log(`Total children mapped: ${totalChildren}`)
      console.log(`Unmapped labels: ${proposal.unmapped.length}`)
      console.log(`Proposed new parents: ${proposal.proposed_new.length}`)
      console.log('Parents:', proposal.ontology.map(g => `${g.parent} (${g.children.length} children)`).join(', '))
      if (proposal.unmapped.length > 0) {
        console.log('Unmapped:', proposal.unmapped.join(', '))
      }
      console.log('=== Ontology Proposal END ===')

      return NextResponse.json({
        proposal,
        stats: {
          unique_categories: categories.length,
          total_extractions: extractions.length,
          parents_proposed: proposal.ontology.length,
          children_mapped: totalChildren,
          unmapped_count: proposal.unmapped.length,
        },
        category_details: categories,
      })
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ontology proposal request timed out after 120 seconds')
      }

      throw error
    }
  } catch (error) {
    console.error('Ontology proposal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
