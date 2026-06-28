import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/from-request'
import { processEntryPhoto } from '@/lib/image/process-photo.server'
import { MAX_IMAGES_PER_ENTRY, EntryImage } from '@/types'

// Sharp requires Node.js runtime, not Edge
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const entryId = formData.get('entryId') as string
    
    // Support both single file and multiple files
    const files = formData.getAll('files') as File[]
    const singleFile = formData.get('file') as File | null
    
    // Combine single file with multiple files array
    const allFiles = singleFile ? [singleFile, ...files] : files

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    if (!entryId) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      )
    }

    // Verify entry belongs to user and get current images
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('id, images')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single()

    if (entryError || !entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      )
    }

    const currentImages: EntryImage[] = entry.images || []
    const availableSlots = MAX_IMAGES_PER_ENTRY - currentImages.length

    if (availableSlots <= 0) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_ENTRY} images allowed per entry` },
        { status: 400 }
      )
    }

    // Limit files to available slots
    const filesToProcess = allFiles.slice(0, availableSlots)
    const uploadedUrls: string[] = []
    const errors: string[] = []

    // Process each file
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]
      try {
        // Add index to make filenames unique when uploading multiple
        const photoUrl = await processEntryPhoto(file, user.id, entryId, i)
        uploadedUrls.push(photoUrl)
      } catch (err) {
        console.error(`Error processing file ${i}:`, err)
        errors.push(`File ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: 'Failed to upload any files', details: errors },
        { status: 500 }
      )
    }

    // Create new image entries
    const newImages: EntryImage[] = uploadedUrls.map((url, i) => ({
      url,
      is_poster: currentImages.length === 0 && i === 0, // First image is poster if no existing images
      order: currentImages.length + i,
    }))

    // Combine with existing images
    const updatedImages = [...currentImages, ...newImages]

    // Update entry with new images array
    const { error: updateError } = await supabase
      .from('entries')
      .update({
        images: updatedImages,
        // Also update legacy fields for backward compatibility with first image
        photo_url: updatedImages[0]?.url || null,
        photo_processed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update entry: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Return response compatible with both single and multi-image use cases
    return NextResponse.json({
      // Legacy single-image response field
      photoUrl: uploadedUrls[0],
      // New multi-image response fields
      uploadedUrls,
      images: updatedImages,
      totalImages: updatedImages.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
