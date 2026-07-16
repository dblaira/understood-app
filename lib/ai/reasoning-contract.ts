import { createHash, randomUUID } from 'node:crypto'

export interface ReasoningRequest {
  request_id: string
  conversation_id: string
  raw_words: string
  attachments?: unknown[]
  source_references?: string[]
  current_app_surface?: string
  connectivity_state?: 'offline' | 'local_network' | 'online'
  requested_operation?: 'reason' | 'deep_local' | 'frontier_claude' | 'frontier_codex' | 'capture'
}

export interface AcceptedAxiomRow {
  id: string
  antecedent: string
  consequent: string
  confidence: number
  provenance: unknown
}

export interface WorkerReasoningPayload {
  final_answer?: string
  accepted_belief_ids_used?: string[]
  evidence_ids_used?: string[]
  candidate_relationships?: Array<{
    statement?: string
    relationship?: string
    evidence_ids?: string[]
  }>
}

export function parseWorkerReasoningPayload(text: string): WorkerReasoningPayload {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(unfenced) as WorkerReasoningPayload
  } catch {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1)) as WorkerReasoningPayload
      } catch {
        // Preserve the worker's text as inference, without inventing authority metadata.
      }
    }
    return { final_answer: text }
  }
}

export function buildCloudReasoningEnvelope(
  request: ReasoningRequest,
  workerText: string,
  axioms: AcceptedAxiomRow[],
  worker: { name: string; model: string },
  graphRevision: string
) {
  const payload = parseWorkerReasoningPayload(workerText)
  const axiomById = new Map(axioms.map((axiom) => [axiom.id, axiom]))
  const authority = (payload.accepted_belief_ids_used ?? [])
    .map((id) => axiomById.get(id))
    .filter((axiom): axiom is AcceptedAxiomRow => Boolean(axiom))
    .map((axiom) => ({
      belief_id: axiom.id,
      antecedent: axiom.antecedent,
      consequent: axiom.consequent,
      confidence: axiom.confidence,
      provenance: axiom.provenance,
    }))
  const evidenceById = new Map(
    axioms
      .filter((axiom) => axiom.provenance != null)
      .map((axiom) => [
        `axiom:${axiom.id}`,
        {
          evidence_id: `axiom:${axiom.id}`,
          label: typeof axiom.provenance === 'string' ? axiom.provenance : JSON.stringify(axiom.provenance),
          source: null,
          belief_id: axiom.id,
        },
      ])
  )
  const evidence = (payload.evidence_ids_used ?? [])
    .map((id) => evidenceById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const candidates = (payload.candidate_relationships ?? [])
    .filter((candidate) => Boolean(candidate.statement?.trim()))
    .map((candidate) => ({
      candidate_id: randomUUID(),
      statement: candidate.statement!.trim(),
      relationship: candidate.relationship ?? null,
      evidence_ids: (candidate.evidence_ids ?? []).filter((id) => evidenceById.has(id)),
      status: 'candidate',
    }))

  return {
    request_id: request.request_id,
    conversation_id: request.conversation_id,
    final_answer: payload.final_answer?.trim() || workerText.trim(),
    accepted_authority_used: authority,
    supporting_evidence_used: evidence,
    candidate_relationships_generated: candidates,
    route: 'cloud_worker_without_personal_model',
    route_trace: [
      {
        worker: worker.name,
        role: 'cloud labor without Cowboy AI personal model',
        model: worker.model,
        status: 'completed',
      },
    ],
    graph_revision: graphRevision,
    adapter_version: 'not-used',
    pending_offline_sync: false,
    raw_words_sha256: createHash('sha256').update(request.raw_words).digest('hex'),
    completed_at: new Date().toISOString(),
  }
}
