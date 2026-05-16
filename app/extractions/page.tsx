import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Extraction, ExtractionWithEntryDate } from '@/types/extraction'
import { ExtractionsReview } from '@/components/extractions-review'
import { aggregateExtractions, aggregateByOntology } from '@/lib/extractions/aggregate'

export const dynamic = 'force-dynamic'

interface BatchInfo {
  batch_id: string
  created_at: string
  count: number
}

export default async function ExtractionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const allExtractions: ExtractionWithEntryDate[] = []
  let offset = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data } = await supabase
      .from('extractions')
      .select('*, entries(created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (!data || data.length === 0) break
    allExtractions.push(...(data as ExtractionWithEntryDate[]))
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const batchMap = new Map<string, BatchInfo>()
  for (const ext of allExtractions) {
    if (!batchMap.has(ext.batch_id)) {
      batchMap.set(ext.batch_id, {
        batch_id: ext.batch_id,
        created_at: ext.created_at,
        count: 0,
      })
    }
    batchMap.get(ext.batch_id)!.count++
  }
  const batches: BatchInfo[] = Array.from(batchMap.values())

  let extractions: Extraction[] = []
  let activeBatchId: string | null = null

  if (batches.length > 0) {
    activeBatchId = batches[0].batch_id
    extractions = allExtractions.filter(e => e.batch_id === activeBatchId)
  }

  const hasOntology = allExtractions.some(e => e.parent_category)
  const parentMapNodes = hasOntology
    ? aggregateByOntology(allExtractions)
    : null
  const mapNodes = aggregateExtractions(allExtractions)

  const { count: totalEntries } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <ExtractionsReview
      initialExtractions={extractions}
      allExtractions={allExtractions}
      initialBatchId={activeBatchId}
      batches={batches}
      totalEntries={totalEntries || 0}
      mapNodes={mapNodes}
      parentMapNodes={parentMapNodes}
    />
  )
}
