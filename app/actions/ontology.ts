'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildAxiomReviewUpdate, canReviewAxiomScope } from '@/lib/ontology/axiom-review'
import {
  buildCandidateAxiomFromConnection,
  type ConnectionOntologyIntakeItem,
} from '@/lib/ontology/connections-intake'
import { parseOntologyAxiomScope, parseOntologyAxiomStatus, type OntologyAxiomStatus } from '@/types/ontology'

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
