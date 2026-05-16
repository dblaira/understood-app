import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JournalPageClient } from '@/components/journal-page-client'
import { Entry, WeeklyTheme } from '@/types'
import { getCurrentWeeklyTheme, getLatestEntryPerCategory, getLatestEntries, getPinnedEntries } from '@/app/actions/entries'

export const dynamic = 'force-dynamic'

async function getEntries(userId: string): Promise<Entry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading entries:', error)
    return []
  }

  return (data as Entry[]) || []
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const entries = await getEntries(user.id)
  const resolvedSearchParams = await searchParams
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || ''
  const currentTheme = await getCurrentWeeklyTheme(user.id)
  
  // Fetch data for 3-column layout
  const categoryEntries = await getLatestEntryPerCategory(user.id)
  const latestEntries = await getLatestEntries(user.id, 20)
  const pinnedEntries = await getPinnedEntries(user.id)

  // Derive featured entry from the entries array — same query, guaranteed fresh
  const featuredEntry = entries.find(e => e.featured === true) || null

  return (
    <JournalPageClient
      initialEntries={entries}
      initialSearchQuery={searchQuery}
      userId={user.id}
      initialWeeklyTheme={currentTheme}
      categoryEntries={categoryEntries}
      latestEntries={latestEntries}
      pinnedStories={pinnedEntries.stories}
      pinnedNotes={pinnedEntries.notes}
      pinnedActions={pinnedEntries.actions}
      featuredEntry={featuredEntry}
    />
  )
}
