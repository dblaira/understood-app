import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { runClaudeWithPresentationGuardrail } from '@/lib/ai/presentation-pipeline.server'
import {
  buildCloudReasoningEnvelope,
  type AcceptedAxiomRow,
  type ReasoningRequest,
} from '@/lib/ai/reasoning-contract'

// The iPhone authenticates with `Authorization: Bearer <supabase access token>`
// and sends no cookies; the web client authenticates with session cookies.
async function resolveRequestAuth(request: NextRequest) {
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null
  if (bearer) {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      }
    )
    const { data: { user } } = await supabase.auth.getUser(bearer)
    return { supabase, user }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await resolveRequestAuth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as ReasoningRequest
  if (!body.raw_words?.trim() || !body.request_id || !body.conversation_id) {
    return NextResponse.json({ error: "Adam's raw words, request ID, and conversation ID are required" }, { status: 400 })
  }

  if (body.connectivity_state === 'offline' || body.requested_operation === 'capture') {
    return NextResponse.json({
      request_id: body.request_id,
      conversation_id: body.conversation_id,
      final_answer: 'Captured. Cowboy AI will reason over this when the personal model is available.',
      accepted_authority_used: [],
      supporting_evidence_used: [],
      candidate_relationships_generated: [],
      route: 'capture_only',
      route_trace: [{ worker: 'Understood', role: 'append-only capture', model: null, status: 'queued' }],
      graph_revision: 'not-loaded',
      adapter_version: 'not-used',
      pending_offline_sync: true,
      raw_words_sha256: createHash('sha256').update(body.raw_words).digest('hex'),
      completed_at: new Date().toISOString(),
    })
  }

  const { data: axiomData, error: axiomError } = await supabase
    .from('ontology_axioms')
    .select('id,antecedent,consequent,confidence,provenance')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .eq('scope', 'personal')
    .gte('confidence', 0.7)
    .order('confidence', { ascending: false })

  if (axiomError) {
    return NextResponse.json({ error: 'Accepted authority could not be loaded' }, { status: 502 })
  }
  const axioms = (axiomData ?? []) as AcceptedAxiomRow[]
  const graphRevision = createHash('sha256')
    .update(JSON.stringify([...axioms].sort((a, b) => a.id.localeCompare(b.id))))
    .digest('hex')
    .slice(0, 16)
  const evidence = axioms
    .filter((axiom) => axiom.provenance != null)
    .map((axiom) => ({ evidence_id: `axiom:${axiom.id}`, belief_id: axiom.id, provenance: axiom.provenance }))
  const system = `You are cloud labor for Understood while Cowboy AI on the Mac is unavailable.
Adam's raw request arrives separately and unchanged as the user message. Do not rewrite it.
This response will be visibly labeled "cloud worker without personal model." Do not claim Adam's personal model shaped it.
Only the ACCEPTED AUTHORITY below may be identified as belief. Evidence supports; candidates remain proposals; model inference is never authority.

ACCEPTED AUTHORITY:
${JSON.stringify(axioms)}

SUPPORTING EVIDENCE:
${JSON.stringify(evidence)}

Return JSON only:
{"final_answer":"answer","accepted_belief_ids_used":["valid axiom IDs only"],"evidence_ids_used":["valid evidence IDs only"],"candidate_relationships":[{"statement":"proposal","relationship":"optional","evidence_ids":[]}]}`

  let workerText: string
  let worker = { name: 'Claude', model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5' }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Cloud worker is not configured' }, { status: 503 })
    const result = await runClaudeWithPresentationGuardrail({
      supabase,
      userId: user.id,
      apiKey,
      model: worker.model,
      maxTokens: 1600,
      system,
      messages: [{ role: 'user', content: body.raw_words }],
      skipLint: true,
    })
    workerText = result.text
  } catch (error) {
    console.error('Cloud reasoning worker failed:', error)
    return NextResponse.json({ error: 'Cloud worker failed' }, { status: 502 })
  }

  return NextResponse.json(buildCloudReasoningEnvelope(body, workerText, axioms, worker, graphRevision))
}
