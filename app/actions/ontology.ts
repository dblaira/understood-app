'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildAxiomReviewUpdate, canReviewAxiomScope } from '@/lib/ontology/axiom-review'
import {
  buildBeliefDumpPrompt,
  buildFallbackBeliefDumpRules,
  parseBeliefDumpRulesFromJson,
  ruleFingerprint,
  sanitizeBeliefDumpRuleDrafts,
  type BeliefDumpRuleDraft,
} from '@/lib/ontology/belief-dump'
import {
  buildCandidateAxiomFromConnection,
  type ConnectionOntologyIntakeItem,
} from '@/lib/ontology/connections-intake'
import { parseOntologyAxiomScope, parseOntologyAxiomStatus, type OntologyAxiomStatus } from '@/types/ontology'

const REVIEWABLE_STATUSES = new Set<OntologyAxiomStatus>(['confirmed', 'rejected', 'retired'])
const BELIEF_DUMP_MAX_CHARS = 8000

type ExistingAxiomFingerprint = {
  antecedent: string
  consequent: string
}

type AnthropicTextBlock = {
  type?: string
  text?: string
}

export async function proposeBeliefDumpRules(beliefDump: string) {
  const cleanedDump = beliefDump.trim().slice(0, BELIEF_DUMP_MAX_CHARS)
  if (cleanedDump.length < 12) {
    return { error: 'Paste a few beliefs or preferences first.' }
  }

  const fallbackRules = buildFallbackBeliefDumpRules(cleanedDump)
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      data: fallbackRules,
      provider: 'local',
      warning: 'AI is not configured here, so the app used the local rule shaper.',
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: 'You convert user belief dumps into plain-language personal AI rules. Return valid JSON only.',
        messages: [
          {
            role: 'user',
            content: buildBeliefDumpPrompt(cleanedDump),
          },
        ],
      }),
    })

    if (!response.ok) {
      return {
        data: fallbackRules,
        provider: 'local',
        warning: `AI rule shaping failed (${response.status}), so the app used the local rule shaper.`,
      }
    }

    const payload = await response.json() as { content?: AnthropicTextBlock[] }
    const text = payload.content?.map((block) => block.text ?? '').join('\n').trim() ?? ''
    const aiRules = parseBeliefDumpRulesFromJson(text)
    const rules = sanitizeBeliefDumpRuleDrafts(aiRules.length ? aiRules : fallbackRules)

    return {
      data: rules,
      provider: aiRules.length ? 'ai' : 'local',
      warning: aiRules.length ? null : 'AI did not return clean JSON, so the app used the local rule shaper.',
    }
  } catch {
    return {
      data: fallbackRules,
      provider: 'local',
      warning: 'AI rule shaping failed, so the app used the local rule shaper.',
    }
  }
}

export async function saveTrustedBeliefRules(rawRules: BeliefDumpRuleDraft[]) {
  const rules = sanitizeBeliefDumpRuleDrafts(rawRules)
  if (!rules.length) {
    return { error: 'No clean rules selected.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('ontology_axioms')
    .select('antecedent, consequent')
    .eq('user_id', user.id)

  if (existingError) {
    return { error: existingError.message }
  }

  const existingFingerprints = new Set(
    ((existingRows as ExistingAxiomFingerprint[] | null) ?? []).map((row) =>
      ruleFingerprint(row.antecedent, row.consequent)
    )
  )

  const batchFingerprints = new Set<string>()
  const now = new Date().toISOString()
  let skipped = 0
  const rows = rules.flatMap((rule) => {
    const fingerprint = ruleFingerprint(rule.antecedent, rule.consequent)
    if (existingFingerprints.has(fingerprint) || batchFingerprints.has(fingerprint)) {
      skipped += 1
      return []
    }

    batchFingerprints.add(fingerprint)
    return [{
      user_id: user.id,
      name: rule.name,
      description: `Trusted rule created from belief dump: "${rule.sourceText}"`,
      antecedent: rule.antecedent,
      consequent: rule.consequent,
      confidence: rule.confidence,
      status: 'confirmed',
      scope: 'personal',
      relationship_type: rule.relationshipType,
      provenance: {
        source: 'self_declared',
        method: 'belief_dump',
        sourceText: rule.sourceText,
        rationale: rule.rationale,
        confirmedFromDraft: true,
        confirmedAt: now,
      },
      evidence_entry_ids: [],
      evidence_count: 1,
      sources: ['self_declared'],
      confirmed_at: now,
    }]
  })

  if (!rows.length) {
    return { data: [], created: 0, skipped }
  }

  const { data, error } = await supabase
    .from('ontology_axioms')
    .insert(rows)
    .select('id, name, description, antecedent, consequent, confidence, status, scope, relationship_type, provenance, evidence_entry_ids, evidence_count, sources, created_at, confirmed_at, rejected_at, retired_at')

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/ontology')
  return { data: data ?? [], created: data?.length ?? 0, skipped }
}

export async function updateOntologyAxiomStatus(axiomId: string, rawStatus: OntologyAxiomStatus) {
  const status = parseOntologyAxiomStatus(rawStatus)

  if (!axiomId || !REVIEWABLE_STATUSES.has(status)) {
    return { error: 'Invalid axiom review status' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: currentAxiom, error: fetchError } = await supabase
    .from('ontology_axioms')
    .select('id, status, scope, confirmed_at, rejected_at, retired_at')
    .eq('id', axiomId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  if (!canReviewAxiomScope(parseOntologyAxiomScope(currentAxiom.scope))) {
    return { error: 'Only personal axioms can be reviewed' }
  }

  const update = buildAxiomReviewUpdate(
    {
      status: parseOntologyAxiomStatus(currentAxiom.status),
      confirmed_at: currentAxiom.confirmed_at ?? null,
      rejected_at: currentAxiom.rejected_at ?? null,
      retired_at: currentAxiom.retired_at ?? null,
    },
    status,
    new Date().toISOString()
  )

  if ('error' in update) {
    return { error: update.error }
  }

  const { data, error } = await supabase
    .from('ontology_axioms')
    .update(update)
    .eq('id', axiomId)
    .eq('user_id', user.id)
    .select('id, status')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/ontology')
  return { data }
}

export async function createCandidateAxiomFromConnection(item: ConnectionOntologyIntakeItem) {
  const candidate = buildCandidateAxiomFromConnection(item)
  if ('ignored' in candidate) {
    return { error: candidate.reason }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: existing, error: existingError } = await supabase
    .from('ontology_axioms')
    .select('id')
    .eq('user_id', user.id)
    .eq('antecedent', candidate.antecedent)
    .eq('consequent', candidate.consequent)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message }
  }

  if (existing) {
    return { error: 'Candidate already exists' }
  }

  const { data, error } = await supabase
    .from('ontology_axioms')
    .insert({
      user_id: user.id,
      name: candidate.name,
      description: candidate.description,
      antecedent: candidate.antecedent,
      consequent: candidate.consequent,
      confidence: candidate.confidence,
      status: candidate.status,
      scope: candidate.scope,
      relationship_type: candidate.relationshipType,
      provenance: candidate.provenance,
      evidence_entry_ids: candidate.evidenceEntryIds,
      evidence_count: candidate.evidenceCount,
      sources: candidate.sources,
    })
    .select('id, status')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/ontology')
  return { data }
}
