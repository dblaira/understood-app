'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CreateEntryInput, WeeklyTheme, Entry, EntryImage, MAX_IMAGES_PER_ENTRY, Version, VersionHighlight } from '@/types'
import { ImageExtraction } from '@/types/multimodal'
import { buildUnderstoodEntryCapture } from '@/lib/harness-capture.server'
import {
  createSupabaseHarnessCaptureSource,
  deliverUnderstoodHarnessCapture,
  failedCaptureHandoff,
  harnessRemoteCaptureBridgeConfiguration,
  type HarnessCaptureHandoffResult,
} from '@/lib/harness-capture-runtime.server'

export async function createEntry(input: CreateEntryInput) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Debug logging for multimodal capture and metadata
  console.log('createEntry called with:', {
    hasImageUrl: !!input.image_url,
    imageUrlLength: input.image_url?.length,
    hasExtractedData: !!input.image_extracted_data,
    extractedDataType: input.image_extracted_data?.imageType,
    hasMetadata: !!input.metadata,
    metadataLocation: input.metadata?.location?.display_name,
    metadataDevice: input.metadata?.device,
  })

  const { data, error } = await supabase
    .from('entries')
    .insert([
      {
        ...input,
        user_id: user.id,
        versions: null,
        generating_versions: false,
        skip_auto_generate: input.entry_type === 'connection' ? true : undefined,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('createEntry error:', error.message, error.details, error.hint)
    return { error: error.message }
  }

  // Verify the image data was saved
  console.log('Entry created:', {
    id: data.id,
    savedImageUrl: data.image_url,
    savedExtractedData: !!data.image_extracted_data,
  })

  let harnessCapture: HarnessCaptureHandoffResult
  try {
    const capture = buildUnderstoodEntryCapture({
      entryRecord: data as Record<string, unknown>,
      createInput: { ...input },
    })
    try {
      harnessCapture = await deliverUnderstoodHarnessCapture({
        source: createSupabaseHarnessCaptureSource(supabase),
        userId: user.id,
        capture,
        remoteBridge: harnessRemoteCaptureBridgeConfiguration(user.id),
      })
    } catch (captureError) {
      harnessCapture = failedCaptureHandoff(capture, captureError)
    }
  } catch (captureError) {
    harnessCapture = failedCaptureHandoff(null, captureError)
  }
  if (harnessCapture.status === 'failed') {
    console.error('Understood entry was saved but its Harness capture handoff failed:', harnessCapture.detail)
  }

  revalidatePath('/')
  return { data, harnessCapture }
}

export async function deleteEntry(id: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateEntryVersions(id: string, versions: any[], generating: boolean) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('entries')
    .update({
      versions,
      generating_versions: generating,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateVersionHighlights(
  entryId: string,
  versionName: string,
  highlights: VersionHighlight[]
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch current versions
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('versions')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  const versions: Version[] = entry.versions || []
  const updatedVersions = versions.map((v) => {
    if (v.name === versionName) {
      return { ...v, highlights }
    }
    return v
  })

  const { error: updateError } = await supabase
    .from('entries')
    .update({ versions: updatedVersions })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  return { success: true, versions: updatedVersions }
}

export async function toggleActionComplete(entryId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // First, get the current entry to check its completion state
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('id, completed_at')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  // Toggle the completion state
  const newCompletedAt = entry.completed_at ? null : new Date().toISOString()

  const { data, error } = await supabase
    .from('entries')
    .update({
      completed_at: newCompletedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { data, success: true, isCompleted: !!newCompletedAt }
}

export async function updateEntryContent(entryId: string, content: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('entries')
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { data, success: true }
}

export async function updateEntryDetails(
  entryId: string,
  updates: {
    headline?: string
    subheading?: string
    category?: Entry['category']
    mood?: string
    entry_type?: Entry['entry_type']
  }
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Filter out undefined values
  const cleanUpdates: Record<string, any> = {}
  if (updates.headline !== undefined) cleanUpdates.headline = updates.headline
  if (updates.subheading !== undefined) cleanUpdates.subheading = updates.subheading
  if (updates.category !== undefined) cleanUpdates.category = updates.category
  if (updates.mood !== undefined) cleanUpdates.mood = updates.mood
  if (updates.entry_type !== undefined) cleanUpdates.entry_type = updates.entry_type
  cleanUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('entries')
    .update(cleanUpdates)
    .eq('id', entryId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { data, success: true }
}

export async function generateWeeklyTheme(entryIds: string[]) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  if (entryIds.length !== 7) {
    return { error: 'Exactly 7 entry IDs are required' }
  }

  try {
    console.log('Starting weekly theme generation for user:', user.id)
    console.log('Entry IDs:', entryIds)
    
    // Import and call the logic directly instead of making an HTTP request
    console.log('Importing generateWeeklyThemeLogic...')
    const { generateWeeklyThemeLogic } = await import('@/lib/ai/generate-weekly-theme.server')
    console.log('Import successful, calling generateWeeklyThemeLogic...')
    
    const theme = await generateWeeklyThemeLogic(entryIds, user.id)
    console.log('Theme generated successfully:', theme.id)
    
    revalidatePath('/')
    return { data: theme }
  } catch (error) {
    console.error('Error generating weekly theme:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('Error details:', { errorMessage, errorStack })
    
    // Check if it's a fetch error and provide more context
    if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
      return { error: `API call failed: ${errorMessage}. Check Vercel function logs for details.` }
    }
    return { error: errorMessage }
  }
}

export async function getWeeklyThemes(userId: string): Promise<WeeklyTheme[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('weekly_themes')
    .select('*')
    .eq('user_id', userId)
    .order('week_start_date', { ascending: false })

  if (error) {
    console.error('Error fetching weekly themes:', error)
    return []
  }

  return (data as WeeklyTheme[]) || []
}

export async function getCurrentWeeklyTheme(userId: string): Promise<WeeklyTheme | null> {
  const supabase = await createClient()
  
  // Calculate current week start (Monday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff))
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('weekly_themes')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartStr)
    .maybeSingle()

  if (error) {
    // Log actual errors (not just "no rows found")
    console.error('Error fetching current weekly theme:', error)
    return null
  }

  if (!data) {
    // No theme found for this week - normal case
    return null
  }

  return data as WeeklyTheme
}

export async function incrementViewCount(entryId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Use atomic database function to avoid race conditions
  // This prevents the read-modify-write race where concurrent requests
  // could read the same value and both increment to the same result
  const { data: updated, error } = await supabase
    .rpc('increment_entry_view_count', {
      entry_id: entryId,
      owner_id: user.id,
    })

  if (error) {
    return { error: error.message }
  }

  // The function returns false if no rows were updated (entry not found)
  if (!updated) {
    return { error: 'Entry not found or was deleted' }
  }

  return { success: true }
}

export async function getLatestEntryPerCategory(userId: string): Promise<Entry[]> {
  const supabase = await createClient()
  const categories: Entry['category'][] = ['Business', 'Finance', 'Health', 'Spiritual', 'Fun', 'Social', 'Romance']
  
  const entries: Entry[] = []
  
  for (const category of categories) {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (!error && data) {
      entries.push(data as Entry)
    }
  }
  
  return entries
}

export async function getTrendingEntries(userId: string, limit: number = 10): Promise<Entry[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('view_count', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching trending entries:', error)
    return []
  }
  
  return (data as Entry[]) || []
}

export async function getEntriesPaginated(
  userId: string,
  page: number = 0,
  limit: number = 20,
  entryType?: Entry['entry_type'],
  category?: string,
  searchQuery?: string
): Promise<{ entries: Entry[]; hasMore: boolean; total: number }> {
  const supabase = await createClient()
  const offset = page * limit

  let query = supabase
    .from('entries')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (entryType) {
    query = query.eq('entry_type', entryType)
  }

  if (category && category !== 'all') {
    query = query.ilike('category', category)
  }

  if (searchQuery) {
    // Search across headline, subheading, content, mood, category
    query = query.or(
      `headline.ilike.%${searchQuery}%,subheading.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,mood.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching paginated entries:', error)
    return { entries: [], hasMore: false, total: 0 }
  }

  const entries = (data as Entry[]) || []
  const total = count || 0

  return {
    entries,
    hasMore: offset + limit < total,
    total,
  }
}

export async function getLatestEntries(userId: string, limit: number = 20): Promise<Entry[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error fetching latest entries:', error)
    return []
  }
  
  return (data as Entry[]) || []
}

export async function removeEntryPhoto(entryId: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Update entry to remove photo URL
  const { error } = await supabase
    .from('entries')
    .update({
      photo_url: null,
      photo_processed: false,
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateEntryPhoto(entryId: string, photoUrl: string) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('entries')
    .update({
      photo_url: photoUrl,
      photo_processed: true,
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

// =============================================================================
// PIN FEATURE
// =============================================================================

export async function togglePin(entryId: string) {
  console.log('[PIN-SERVER] togglePin called for:', entryId)
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('[PIN-SERVER] Unauthorized - no user')
    return { error: 'Unauthorized' }
  }

  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('id, entry_type, pinned_at')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    console.log('[PIN-SERVER] Entry not found:', fetchError?.message)
    return { error: 'Entry not found' }
  }
  
  console.log('[PIN-SERVER] Current state:', { entry_type: entry.entry_type, pinned_at: entry.pinned_at })

  // Default to 'story' if entry_type is not set (legacy entries)
  const entryType = entry.entry_type || 'story'

  // If already pinned, unpin it
  if (entry.pinned_at) {
    const { error: updateError } = await supabase
      .from('entries')
      .update({ pinned_at: null })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (updateError) {
      return { error: updateError.message }
    }

    revalidatePath('/')
    return { success: true, pinned: false }
  }

  // If not pinned, check how many are already pinned for this entry_type
  const { count, error: countError } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('entry_type', entryType)
    .not('pinned_at', 'is', null)

  if (countError) {
    return { error: countError.message }
  }

  // Maximum 10 pinned items per entry type
  if (count !== null && count >= 10) {
    return { error: `Maximum 10 pinned ${entryType}s allowed. Unpin one first.` }
  }

  // Pin the entry
  const { error: pinError } = await supabase
    .from('entries')
    .update({ pinned_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (pinError) {
    return { error: pinError.message }
  }

  revalidatePath('/')
  return { success: true, pinned: true }
}

// FEATURED ENTRY (Hero Section)
// =============================================================================

export async function toggleFeatured(entryId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('id, featured')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) return { error: 'Entry not found' }

  if (entry.featured) {
    const { error: updateError } = await supabase
      .from('entries')
      .update({ featured: false })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (updateError) return { error: updateError.message }

    revalidatePath('/')
    return { success: true, featured: false }
  }

  // Un-feature any currently featured entry for this user
  await supabase
    .from('entries')
    .update({ featured: false })
    .eq('user_id', user.id)
    .eq('featured', true)

  // Feature the selected entry
  const { error: featureError } = await supabase
    .from('entries')
    .update({ featured: true })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (featureError) return { error: featureError.message }

  revalidatePath('/')
  return { success: true, featured: true }
}

export async function getFeaturedEntry(userId: string): Promise<Entry | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('featured', true)
    .single()

  return (data as Entry) || null
}

export async function getPinnedEntries(userId: string): Promise<{
  stories: Entry[]
  notes: Entry[]
  actions: Entry[]
}> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .not('pinned_at', 'is', null)
    .order('pinned_at', { ascending: false })

  if (error) {
    console.error('Error fetching pinned entries:', error)
    return { stories: [], notes: [], actions: [] }
  }

  const entries = (data as Entry[]) || []
  
  // Default undefined entry_type to 'story' for legacy entries
  return {
    stories: entries.filter(e => (e.entry_type || 'story') === 'story'),
    notes: entries.filter(e => e.entry_type === 'note'),
    actions: entries.filter(e => e.entry_type === 'action'),
  }
}

// =============================================================================
// MULTI-IMAGE GALLERY FEATURE
// =============================================================================

/**
 * Add an image to an entry's gallery (max 6 images)
 */
export async function addEntryImage(
  entryId: string,
  imageUrl: string,
  extractedData?: ImageExtraction,
  isPoster: boolean = false
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch current entry to get existing images
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('images')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  const currentImages: EntryImage[] = entry.images || []

  // Check max limit
  if (currentImages.length >= MAX_IMAGES_PER_ENTRY) {
    return { error: `Maximum ${MAX_IMAGES_PER_ENTRY} images allowed per entry` }
  }

  // Create new image object
  const newImage: EntryImage = {
    url: imageUrl,
    extracted_data: extractedData,
    is_poster: isPoster || currentImages.length === 0, // First image is poster by default
    order: currentImages.length,
  }

  // If setting as poster, unset any existing poster
  let updatedImages = currentImages
  if (newImage.is_poster) {
    updatedImages = currentImages.map(img => ({ ...img, is_poster: false }))
  }

  updatedImages.push(newImage)

  // Update entry
  const { error: updateError } = await supabase
    .from('entries')
    .update({
      images: updatedImages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/')
  return { success: true, images: updatedImages }
}

/**
 * Remove an image from an entry's gallery
 * Also clears legacy fields (photo_url, image_url) when the last image is removed
 */
export async function removeEntryImage(entryId: string, imageIndex: number) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch current entry including legacy fields
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('images, photo_url, image_url')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  const currentImages: EntryImage[] = entry.images || []

  // Handle legacy images that are converted to array format by getEntryImages
  // If images array is empty but legacy fields exist, we're removing a legacy image
  if (currentImages.length === 0 && (entry.photo_url || entry.image_url)) {
    // Clear legacy fields
    const { error: updateError } = await supabase
      .from('entries')
      .update({
        photo_url: null,
        photo_processed: false,
        image_url: null,
        image_extracted_data: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (updateError) {
      return { error: updateError.message }
    }

    revalidatePath('/')
    return { success: true, images: [] }
  }

  if (imageIndex < 0 || imageIndex >= currentImages.length) {
    return { error: 'Invalid image index' }
  }

  const removedImage = currentImages[imageIndex]
  const updatedImages = currentImages
    .filter((_, i) => i !== imageIndex)
    .map((img, i) => ({ ...img, order: i })) // Re-order remaining images

  // If removed image was poster and there are remaining images, make first one poster
  if (removedImage.is_poster && updatedImages.length > 0) {
    updatedImages[0].is_poster = true
  }

  // Build update object - clear legacy fields when last image is removed
  const updateData: Record<string, unknown> = {
    images: updatedImages,
    updated_at: new Date().toISOString(),
  }

  // If no images remain, also clear legacy fields to prevent ghost images
  if (updatedImages.length === 0) {
    updateData.photo_url = null
    updateData.photo_processed = false
    updateData.image_url = null
    updateData.image_extracted_data = null
  }

  // Update entry
  const { error: updateError } = await supabase
    .from('entries')
    .update(updateData)
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/')
  return { success: true, images: updatedImages }
}

/**
 * Set an image as the poster (featured) image for an entry
 */
export async function setEntryPoster(entryId: string, imageIndex: number) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch current entry
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('images')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  const currentImages: EntryImage[] = entry.images || []

  if (imageIndex < 0 || imageIndex >= currentImages.length) {
    return { error: 'Invalid image index' }
  }

  // Update poster status
  const updatedImages = currentImages.map((img, i) => ({
    ...img,
    is_poster: i === imageIndex,
  }))

  // Update entry
  const { error: updateError } = await supabase
    .from('entries')
    .update({
      images: updatedImages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/')
  return { success: true, images: updatedImages }
}

/**
 * Reorder images in an entry's gallery
 */
export async function reorderEntryImages(entryId: string, newOrder: number[]) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch current entry
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('images')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  const currentImages: EntryImage[] = entry.images || []

  // Validate newOrder array
  if (newOrder.length !== currentImages.length) {
    return { error: 'Invalid order array length' }
  }

  // Reorder images according to newOrder
  const updatedImages = newOrder.map((oldIndex, newIndex) => ({
    ...currentImages[oldIndex],
    order: newIndex,
  }))

  // Update entry
  const { error: updateError } = await supabase
    .from('entries')
    .update({
      images: updatedImages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/')
  return { success: true, images: updatedImages }
}

/**
 * Update the focal point of an image in an entry's gallery
 * Focal point coordinates are 0-100 where (50, 50) is center
 */
export async function updateImageFocalPoint(
  entryId: string,
  imageIndex: number,
  focalX: number,
  focalY: number
) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Validate focal point values
  if (focalX < 0 || focalX > 100 || focalY < 0 || focalY > 100) {
    return { error: 'Focal point values must be between 0 and 100' }
  }

  // Fetch current entry
  const { data: entry, error: fetchError } = await supabase
    .from('entries')
    .select('images')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) {
    return { error: 'Entry not found' }
  }

  const currentImages: EntryImage[] = entry.images || []

  if (imageIndex < 0 || imageIndex >= currentImages.length) {
    return { error: 'Invalid image index' }
  }

  // Update focal point for the specified image
  const updatedImages = currentImages.map((img, i) => {
    if (i === imageIndex) {
      return {
        ...img,
        focal_x: Math.round(focalX),
        focal_y: Math.round(focalY),
      }
    }
    return img
  })

  // Update entry
  const { error: updateError } = await supabase
    .from('entries')
    .update({
      images: updatedImages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/')
  return { success: true, images: updatedImages }
}

// =============================================================================
// ENTRY LINEAGE (Water Cycle) — spawn linked entries and query lineage
// =============================================================================

/**
 * Create a new entry linked to a source (parent) entry.
 * Used for the water cycle flow: Story → Note → Action → Story
 */
export async function createLinkedEntry(
  sourceEntryId: string,
  input: {
    headline: string
    content: string
    entry_type: Entry['entry_type']
    category: Entry['category']
    due_date?: string | null
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify the source entry exists and belongs to the user
  const { data: sourceEntry, error: sourceError } = await supabase
    .from('entries')
    .select('id, headline, entry_type')
    .eq('id', sourceEntryId)
    .eq('user_id', user.id)
    .single()

  if (sourceError || !sourceEntry) {
    return { error: 'Source entry not found' }
  }

  const { data, error } = await supabase
    .from('entries')
    .insert([
      {
        headline: input.headline,
        content: input.content,
        entry_type: input.entry_type,
        category: input.category,
        due_date: input.due_date || null,
        source_entry_id: sourceEntryId,
        user_id: user.id,
        versions: null,
        generating_versions: false,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('createLinkedEntry error:', error.message)
    return { error: error.message }
  }

  revalidatePath('/')
  return { data }
}

/**
 * Get the lineage for an entry: its parent (source) and its children.
 * Returns a lightweight summary — not full entry objects.
 */
export async function getEntryLineage(entryId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Fetch the entry itself to get its source_entry_id
  const { data: entry, error: entryError } = await supabase
    .from('entries')
    .select('id, source_entry_id')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  // Fetch parent entry (if this entry has a source)
  let parent: { id: string; headline: string; entry_type: string } | null = null
  if (entry.source_entry_id) {
    const { data: parentData } = await supabase
      .from('entries')
      .select('id, headline, entry_type')
      .eq('id', entry.source_entry_id)
      .eq('user_id', user.id)
      .single()

    if (parentData) {
      parent = {
        id: parentData.id,
        headline: parentData.headline,
        entry_type: parentData.entry_type || 'story',
      }
    }
  }

  // Fetch children (entries that have this entry as their source)
  const { data: childrenData } = await supabase
    .from('entries')
    .select('id, headline, entry_type, created_at')
    .eq('source_entry_id', entryId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const children = (childrenData || []).map((c) => ({
    id: c.id,
    headline: c.headline,
    entry_type: c.entry_type || 'story',
    created_at: c.created_at,
  }))

  // Compounding metrics — walk up the chain to find cycle depth (ancestors)
  let cycleDepth = 0
  let walkId = entry.source_entry_id
  const visited = new Set<string>([entryId])
  while (walkId && cycleDepth < 50) {
    if (visited.has(walkId)) break // prevent infinite loops
    visited.add(walkId)
    const { data: ancestor } = await supabase
      .from('entries')
      .select('id, source_entry_id')
      .eq('id', walkId)
      .eq('user_id', user.id)
      .single()
    if (!ancestor) break
    cycleDepth++
    walkId = ancestor.source_entry_id
  }

  // Count total descendants (BFS down the tree)
  let totalDescendants = 0
  const queue = [entryId]
  const descendantVisited = new Set<string>([entryId])
  while (queue.length > 0 && totalDescendants < 200) {
    const currentId = queue.shift()!
    const { data: kids } = await supabase
      .from('entries')
      .select('id')
      .eq('source_entry_id', currentId)
      .eq('user_id', user.id)
    if (kids) {
      for (const kid of kids) {
        if (!descendantVisited.has(kid.id)) {
          descendantVisited.add(kid.id)
          totalDescendants++
          queue.push(kid.id)
        }
      }
    }
  }

  return { parent, children, cycleDepth, totalDescendants }
}

/**
 * Get the full lineage tree for an entry — walks up to the root, then collects
 * all descendants. Returns a flat list of nodes and edges for visualization.
 */
export async function getLineageTree(entryId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Walk up to find the root of this lineage chain
  let rootId = entryId
  const visited = new Set<string>()
  while (true) {
    if (visited.has(rootId)) break
    visited.add(rootId)
    const { data: entry } = await supabase
      .from('entries')
      .select('id, source_entry_id')
      .eq('id', rootId)
      .eq('user_id', user.id)
      .single()
    if (!entry || !entry.source_entry_id) break
    rootId = entry.source_entry_id
  }

  // BFS from root to collect the entire tree
  interface TreeNode {
    id: string
    headline: string
    entry_type: string
    created_at: string
    source_entry_id: string | null
  }
  const nodes: TreeNode[] = []
  const queue = [rootId]
  const treeVisited = new Set<string>()

  while (queue.length > 0 && nodes.length < 100) {
    const currentId = queue.shift()!
    if (treeVisited.has(currentId)) continue
    treeVisited.add(currentId)

    const { data: nodeData } = await supabase
      .from('entries')
      .select('id, headline, entry_type, created_at, source_entry_id')
      .eq('id', currentId)
      .eq('user_id', user.id)
      .single()

    if (nodeData) {
      nodes.push({
        id: nodeData.id,
        headline: nodeData.headline,
        entry_type: nodeData.entry_type || 'story',
        created_at: nodeData.created_at,
        source_entry_id: nodeData.source_entry_id,
      })

      // Find children
      const { data: children } = await supabase
        .from('entries')
        .select('id')
        .eq('source_entry_id', currentId)
        .eq('user_id', user.id)

      if (children) {
        for (const child of children) {
          if (!treeVisited.has(child.id)) {
            queue.push(child.id)
          }
        }
      }
    }
  }

  // Build edges from source_entry_id relationships
  const edges = nodes
    .filter((n) => n.source_entry_id)
    .map((n) => ({
      id: `${n.source_entry_id}-${n.id}`,
      source: n.source_entry_id!,
      target: n.id,
    }))

  return { nodes, edges, rootId, focusId: entryId }
}
