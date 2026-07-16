import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCloudReasoningEnvelope } from '../lib/ai/reasoning-contract'

describe('Cowboy AI reasoning contract', () => {
  it('filters invented authority and keeps candidates separate', () => {
    const request = {
      request_id: 'request-1',
      conversation_id: 'conversation-1',
      raw_words: 'Keep these exact words.',
    }
    const envelope = buildCloudReasoningEnvelope(
      request,
      JSON.stringify({
        final_answer: 'Answer',
        accepted_belief_ids_used: ['accepted-1', 'invented'],
        evidence_ids_used: ['axiom:accepted-1', 'invented'],
        candidate_relationships: [{ statement: 'Maybe connected', evidence_ids: ['axiom:accepted-1'] }],
      }),
      [{
        id: 'accepted-1', antecedent: 'When reviewed', consequent: 'it may govern', confidence: 0.9,
        provenance: 'Adam correction',
      }],
      { name: 'Claude', model: 'test-worker' },
      'revision-1'
    )
    assert.deepEqual(envelope.accepted_authority_used.map((item) => item.belief_id), ['accepted-1'])
    assert.deepEqual(envelope.supporting_evidence_used.map((item) => item.evidence_id), ['axiom:accepted-1'])
    assert.equal(envelope.candidate_relationships_generated[0].status, 'candidate')
    assert.equal(envelope.route, 'cloud_worker_without_personal_model')
  })
})
