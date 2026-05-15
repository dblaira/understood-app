'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildAxiomReviewUpdate, canReviewAxiomScope } from '@/lib/ontology/axiom-review'
import {
  buildCandidateAxiomFromConnection,
  type ConnectionOntologyIntakeItem,
} from '@/lib/ontology/connections-intake'
import {
  parseLifeDomains,
  parseOntologyAxiomScope,
  parseOntologyAxiomStatus,
  type LifeDomain,
  type OntologyAxiomStatus,
  type OntologyRelationshipType,
} from '@/types/ontology'

export interface SplitClaimRuleCandidateInput {
  sourceEntryId: string
  claimText: string
  suggestedDomains: LifeDomain[]
}

type ExistingAxiomFingerprint = {
  antecedent: string
  consequent: string
}

type SourceEntryLookup = {
  id: string
  headline: string
  life_domains?: unknown
}

export async function createCandidateAxiomsFromSplitClaims(inputs: SplitClaimRuleCandidateInput[]) {
  const cleanedInputs = inputs
    .map((input) => ({
      ...input,
      claimText: input.claimText.trim(),
      suggestedDomains: parseLifeDomains(input.suggestedDomains),
    }))
    .filter((input) => input.sourceEntryId && input.claimText.length > 0)

  if (cleanedInputs.length === 0) {
    return { error: 'No rule candidates to create' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const sourceIds = [...new Set(cleanedInputs.map((input) => input.sourceEntryId))]
  const { data: sourceRows, error: sourceError } = await supabase
    .from('entries')
    .select('id, headline, life_domains')
    .eq('user_id', user.id)
    .in('id', sourceIds)

  if (sourceError) {
    return { error: sourceError.message }
  }

  const sourceById = new Map((sourceRows as SourceEntryLookup[] | null ?? []).map((entry) => [entry.id, entry]))

  const { data: existingRows, error: existingError } = await supabase
    .from('ontology_axioms')
    .select('antecedent, consequent')
    .eq('user_id', user.id)

  if (existingError) {
    return { error: existingError.message }
  }

  const existingFingerprints = new Set(
    ((existingRows as ExistingAxiomFingerprint[] | null) ?? []).map((row) =>
      axiomFingerprint(row.antecedent, row.consequent)
    )
  )
  const batchFingerprints = new Set<string>()
  const now = new Date().toISOString()
  let skipped = 0

  const rows = cleanedInputs.flatMap((input) => {
    const sourceEntry = sourceById.get(input.sourceEntryId)
    if (!sourceEntry) {
      skipped += 1
      return []
    }

    const parsed = parseSplitClaimRule(input.claimText)
    const fingerprint = axiomFingerprint(parsed.antecedent, parsed.consequent)
    if (existingFingerprints.has(fingerprint) || batchFingerprints.has(fingerprint)) {
      skipped += 1
      return []
    }

    batchFingerprints.add(fingerprint)
    const domains = input.suggestedDomains.length ? input.suggestedDomains : parseLifeDomains(sourceEntry.life_domains)

    return [{
      user_id: user.id,
      name: buildSplitClaimCandidateName(input.claimText),
      description: `Candidate rule extracted from "${sourceEntry.headline}". Review before confirming.`,
      antecedent: parsed.antecedent,
      consequent: parsed.consequent,
      confidence: parsed.confidence,
      status: 'candidate',
      scope: 'personal',
      relationship_type: parsed.relationshipType,
      provenance: {
        source: 'entry_extracted',
        entryId: input.sourceEntryId,
        claimText: input.claimText,
        extractedAt: now,
        lifeDomains: domains,
        requiresHumanReview: true,
        parser: parsed.parser,
      },
      evidence_entry_ids: [input.sourceEntryId],
      evidence_count: 1,
      sources: ['entry_extracted'],
    }]
  })

  if (rows.length === 0) {
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

export async function keepSplitClaimAsNote({
  sourceEntryId,
  claimText,
}: {
  sourceEntryId: string
  claimText: string
}) {
  const text = claimText.trim()
  if (!sourceEntryId || text.length === 0) {
    return { error: 'Missing note text' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: sourceEntry, error: sourceError } = await supabase
    .from('entries')
    .select('id, headline, category, life_domains')
    .eq('id', sourceEntryId)
    .eq('user_id', user.id)
    .single()

  if (sourceError || !sourceEntry) {
    return { error: 'Source entry not found' }
  }

  const { data: existing, error: existingError } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_entry_id', sourceEntryId)
    .eq('entry_type', 'note')
    .eq('content', text)
    .maybeSingle()

  if (existingError) {
    return { error: existingError.message }
  }

  if (existing) {
    revalidatePath('/')
    revalidatePath('/ontology')
    return { data: existing, duplicate: true }
  }

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: user.id,
      headline: text.length > 80 ? `${text.slice(0, 77)}...` : text,
      subheading: `Kept from: ${sourceEntry.headline}`,
      content: text,
      category: sourceEntry.category ?? 'Business',
      entry_type: 'note',
      source_entry_id: sourceEntryId,
      life_domains: sourceEntry.life_domains ?? [],
      versions: null,
      generating_versions: false,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/ontology')
  return { data, duplicate: false }
}

function parseSplitClaimRule(claimText: string): {
  antecedent: string
  consequent: string
  relationshipType: OntologyRelationshipType
  confidence: number
  parser: string
} {
  const text = claimText.trim().replace(/\s+/g, ' ')
  const ifThen = text.match(/^if\s+(.+?)[,;]?\s+then\s+(.+)$/i)
  if (ifThen) {
    return {
      antecedent: trimSentence(ifThen[1]),
      consequent: trimSentence(ifThen[2]),
      relationshipType: 'predicts',
      confidence: 0.58,
      parser: 'if_then',
    }
  }

  const whenThen = text.match(/^when\s+(.+?)[,;]\s+(.+)$/i)
  if (whenThen) {
    return {
      antecedent: trimSentence(whenThen[1]),
      consequent: trimSentence(whenThen[2]),
      relationshipType: 'predicts',
      confidence: 0.54,
      parser: 'when_comma',
    }
  }

  const causal = text.match(/^(.+?)\s+(leads to|causes|creates|reduces|improves|helps|makes|drives|prevents)\s+(.+)$/i)
  if (causal) {
    return {
      antecedent: trimSentence(causal[1]),
      consequent: trimSentence(`${causal[2]} ${causal[3]}`),
      relationshipType: relationForVerb(causal[2]),
      confidence: 0.52,
      parser: 'causal_phrase',
    }
  }

  return {
    antecedent: `Adam treats this as a reusable pattern: ${trimSentence(text)}`,
    consequent: 'future reasoning should consider this pattern only after human confirmation',
    relationshipType: 'supports',
    confidence: 0.42,
    parser: 'claim_as_pattern',
  }
}

function relationForVerb(verb: string): OntologyRelationshipType {
  const normalized = verb.toLowerCase()
  if (normalized === 'causes' || normalized === 'creates' || normalized === 'makes' || normalized === 'drives') return 'predicts'
  if (normalized === 'prevents') return 'inhibits'
  if (normalized === 'reduces') return 'inhibits'
  if (normalized === 'helps' || normalized === 'improves') return 'supports'
  return 'predicts'
}

function buildSplitClaimCandidateName(claimText: string): string {
  const cleaned = trimSentence(claimText)
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned
}

function trimSentence(value: string): string {
  return value.trim().replace(/[.!?]+$/g, '').trim()
}

function axiomFingerprint(antecedent: string, consequent: string): string {
  return `${normalizeAxiomPart(antecedent)} -> ${normalizeAxiomPart(consequent)}`
}

function normalizeAxiomPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const REVIEWABLE_STATUSES = new Set<OntologyAxiomStatus>(['confirmed', 'rejected', 'retired'])

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
