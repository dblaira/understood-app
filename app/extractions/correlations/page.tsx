import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Extraction } from '@/types/extraction'
import { CorrelationsView } from '@/components/correlations-view'

export const dynamic = 'force-dynamic'

async function fetchAllExtractions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Extraction[]> {
  const all: Extraction[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('extractions')
      .select('*')
      .eq('user_id', userId)
      .not('parent_category', 'is', null)
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) break
    all.push(...(data as Extraction[]))
    if (data.length < pageSize) break
    offset += pageSize
  }

  return all
}

export default async function CorrelationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const extractions = await fetchAllExtractions(supabase, user.id)

  return <CorrelationsView extractions={extractions} />
}
