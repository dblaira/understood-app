import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildConstraintNodeTree,
  fetchPresentationConstraints,
  seedPresentationConstraints,
} from '@/lib/ai/presentation-interceptor'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: allRows, error } = await supabase
    .from('presentation_constraints')
    .select(
      'id, trait_key, trait_label, relation, target, target_label, provenance, enabled, sort_order'
    )
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) {
    const fallback = await fetchPresentationConstraints(supabase, user.id)
    return NextResponse.json({
      constraints: fallback,
      node_tree: buildConstraintNodeTree(fallback, 'You'),
      storage: 'memory_fallback',
    })
  }

  let rows = allRows ?? []
  if (!rows.length) {
    await seedPresentationConstraints(supabase, user.id)
    const { data: seeded } = await supabase
      .from('presentation_constraints')
      .select(
        'id, trait_key, trait_label, relation, target, target_label, provenance, enabled, sort_order'
      )
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    rows = seeded ?? []
  }

  const active = rows.filter((r) => r.enabled)

  return NextResponse.json({
    constraints: rows,
    node_tree: buildConstraintNodeTree(active as Parameters<typeof buildConstraintNodeTree>[0], 'You'),
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, enabled } = body as { id?: string; enabled?: boolean }

  if (!id || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'id and enabled required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('presentation_constraints')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const constraints = await fetchPresentationConstraints(supabase, user.id)
  return NextResponse.json({
    ok: true,
    node_tree: buildConstraintNodeTree(constraints, 'You'),
  })
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await seedPresentationConstraints(supabase, user.id)
  const constraints = await fetchPresentationConstraints(supabase, user.id)
  return NextResponse.json({
    ok: true,
    constraints,
    node_tree: buildConstraintNodeTree(constraints, 'You'),
  })
}
