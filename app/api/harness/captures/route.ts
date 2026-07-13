import { createAdminClient } from '@/lib/supabase/admin'
import { handleHarnessCaptureBridgeRequest } from '@/lib/harness-capture-bridge.server'
import { createSupabaseHarnessCaptureSource } from '@/lib/harness-capture-runtime.server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  return bridge(request)
}

export async function POST(request: Request): Promise<Response> {
  return bridge(request)
}

async function bridge(request: Request): Promise<Response> {
  const token = process.env.HARNESS_BRIDGE_TOKEN?.trim()
  const userId = process.env.HARNESS_BRIDGE_USER_ID?.trim()
  if (!token || token.length < 32 || !userId) {
    return Response.json(
      { error: 'Harness capture bridge is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }

  try {
    return await handleHarnessCaptureBridgeRequest(request, {
      source: createSupabaseHarnessCaptureSource(createAdminClient()),
      userId,
      token,
    })
  } catch (error) {
    console.error(
      'Harness capture bridge failed:',
      error instanceof Error ? error.message : 'unknown error'
    )
    return Response.json(
      { error: 'Harness capture bridge failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private' } }
    )
  }
}
