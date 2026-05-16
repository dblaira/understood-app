import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OntologyReview } from '@/components/ontology-review'
import { AxiomReviewList, type AxiomReviewItem } from '@/components/axiom-review-list'
import { parseOntologyAxiomStatus } from '@/types/ontology'

export const dynamic = 'force-dynamic'

export default async function OntologyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { count: totalExtractions } = await supabase
    .from('extractions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  let axiomUnavailableReason: string | undefined
  let axioms: AxiomReviewItem[] = []

  const { data: axiomRows, error: axiomError } = await supabase
    .from('ontology_axioms')
    .select('id, name, antecedent, consequent, confidence, status, scope, evidence_count')
    .eq('user_id', user.id)
    .order('confidence', { ascending: false })

  if (axiomError) {
    axiomUnavailableReason = 'Axiom review will appear after the ontology axiom migration is applied.'
  } else {
    axioms = (axiomRows ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      antecedent: String(row.antecedent),
      consequent: String(row.consequent),
      confidence: Number(row.confidence) || 0,
      status: parseOntologyAxiomStatus(row.status),
      scope: String(row.scope ?? 'personal'),
      evidence_count: Number(row.evidence_count) || 0,
    }))
  }

  return (
    <>
      <AxiomReviewList axioms={axioms} unavailableReason={axiomUnavailableReason} />
      <OntologyReview totalExtractions={totalExtractions ?? 0} />
    </>
  )
}
