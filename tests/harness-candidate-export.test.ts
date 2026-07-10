import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  exportAtMostOneHarnessCandidate,
  type UnderstoodHarnessAxiom,
  type UnderstoodHarnessSourceEvidence,
} from '../lib/ontology/harness-candidate-export'

const exactSource = 'When I use ranked priorities, my productivity and satisfaction improve.'

function eligibleAxiom(overrides: Partial<UnderstoodHarnessAxiom> = {}): UnderstoodHarnessAxiom {
  return {
    id: 'axiom-eligible',
    userId: 'user-adam',
    name: 'Ranked priorities improve work',
    antecedent: 'I use ranked priorities',
    consequent: 'my productivity and satisfaction improve',
    confidence: 0.8,
    status: 'confirmed',
    scope: 'personal',
    relationshipType: 'predicts',
    evidenceEntryIds: ['entry-1'],
    evidenceCount: 1,
    provenance: {
      source: 'entry_extracted',
      entryId: 'entry-1',
      lifeDomains: ['Work', 'Affect'],
    },
    confirmedAt: '2026-07-09T12:00:00.000Z',
    ...overrides,
  }
}

function sourceEvidence(
  overrides: Partial<UnderstoodHarnessSourceEvidence> = {}
): UnderstoodHarnessSourceEvidence {
  return {
    id: 'entry-1',
    content: exactSource,
    createdAt: '2026-07-08T12:00:00.000Z',
    lifeDomains: ['Work', 'Affect'],
    ...overrides,
  }
}

describe('Understood to Harness candidate export', () => {
  it('exports one eligible confirmed personal axiom as a pending proposal', () => {
    const result = exportAtMostOneHarnessCandidate([eligibleAxiom()], [sourceEvidence()])

    assert.equal(result.selectedAxiomId, 'axiom-eligible')
    assert.equal(result.candidate?.status, 'pending')
    assert.match(result.candidate?.plain ?? '', /^AGENT PROPOSAL:/)
    assert.equal(result.candidate?.domain_a, 'work')
    assert.equal(result.candidate?.domain_b, 'affect')
    assert.equal(result.candidate?.connection_type, 'predicts')
  })

  it('rejects a rejected axiom even when its evidence and provenance exist', () => {
    const result = exportAtMostOneHarnessCandidate(
      [eligibleAxiom({ status: 'rejected' })],
      [sourceEvidence()]
    )

    assert.equal(result.candidate, null)
    assert.deepEqual(result.diagnostics[0].reasons, ['status rejected is not confirmed'])
  })

  it('rejects a confirmed axiom whose direct evidence cannot be resolved', () => {
    const result = exportAtMostOneHarnessCandidate([eligibleAxiom()], [])

    assert.equal(result.candidate, null)
    assert.deepEqual(result.diagnostics[0].reasons, [
      'attached evidence could not be resolved to source wording',
    ])
  })

  it('rejects product scope before treating it as a personal candidate', () => {
    const result = exportAtMostOneHarnessCandidate(
      [eligibleAxiom({ scope: 'product' })],
      [sourceEvidence()]
    )

    assert.equal(result.candidate, null)
    assert.deepEqual(result.diagnostics[0].reasons, ['scope product is not personal'])
  })

  it('preserves the exact source wording in evidence', () => {
    const wording = '  When I protect focus, my work satisfaction improves.\n'
    const result = exportAtMostOneHarnessCandidate(
      [eligibleAxiom()],
      [sourceEvidence({ content: wording })]
    )

    assert.equal(result.candidate?.evidence, wording)
  })

  it('normalizes Understood domain casing to the Harness queue vocabulary', () => {
    const result = exportAtMostOneHarnessCandidate(
      [eligibleAxiom({ provenance: {
        source: 'entry_extracted',
        entryId: 'entry-1',
        lifeDomains: ['WORK', 'affect'],
      } })],
      [sourceEvidence({ lifeDomains: [] })]
    )

    assert.equal(result.candidate?.domain_a, 'work')
    assert.equal(result.candidate?.domain_b, 'affect')
  })

  it('returns at most one candidate using deterministic quality ordering', () => {
    const lowerConfidence = eligibleAxiom({ id: 'axiom-lower', confidence: 0.6 })
    const higherConfidence = eligibleAxiom({ id: 'axiom-higher', confidence: 0.9 })
    const result = exportAtMostOneHarnessCandidate(
      [lowerConfidence, higherConfidence],
      [sourceEvidence()]
    )

    assert.equal(result.selectedAxiomId, 'axiom-higher')
    assert.equal(result.candidate?.id, 'cand-understood-20260709-axiom-higher')
    assert.deepEqual(result.eligibleAxiomIds, ['axiom-higher', 'axiom-lower'])
    assert.equal(Array.isArray(result.candidate), false)
  })
})
