import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildFluencyStats,
  canCountFluencySession,
  type FluencySession,
  type FluencySessionInput,
} from '../lib/ontology/fluency'

describe('ontology fluency sessions', () => {
  it('only counts sessions completed without live explanation', () => {
    const clean: FluencySessionInput = {
      reviewedItems: '2 entries',
      primaryMove: 'attach_evidence',
      domainsUsed: ['Sleep', 'Affect'],
      statusChanges: 'candidate stayed candidate',
      neededExplanation: false,
      updatedOntologyState: true,
    }

    const assisted: FluencySessionInput = {
      ...clean,
      neededExplanation: true,
    }

    const incomplete: FluencySessionInput = {
      ...clean,
      updatedOntologyState: false,
    }

    assert.equal(canCountFluencySession(clean), true)
    assert.equal(canCountFluencySession(assisted), false)
    assert.equal(canCountFluencySession(incomplete), false)
  })

  it('summarizes counted progress toward the 50 session proof standard', () => {
    const sessions: FluencySession[] = [
      {
        id: '1',
        createdAt: '2026-05-08T12:00:00.000Z',
        reviewedItems: 'morning note',
        primaryMove: 'classify',
        domainsUsed: ['Learning'],
        statusChanges: 'none',
        neededExplanation: false,
        updatedOntologyState: true,
      },
      {
        id: '2',
        createdAt: '2026-05-08T12:05:00.000Z',
        reviewedItems: 'energy metric',
        primaryMove: 'training_only',
        domainsUsed: ['Affect'],
        statusChanges: 'none',
        neededExplanation: true,
        updatedOntologyState: true,
      },
    ]

    assert.deepEqual(buildFluencyStats(sessions), {
      countedSessions: 1,
      trainingSessions: 1,
      remainingSessions: 49,
      percentComplete: 2,
    })
  })
})
