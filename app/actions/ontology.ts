'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildAxiomReviewUpdate, canReviewAxiomScope } from '@/lib/ontology/axiom-review'
import { parseOntologyAxiomScope, parseOntologyAxiomStatus, type OntologyAxiomStatus } from '@/types/ontology'

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
