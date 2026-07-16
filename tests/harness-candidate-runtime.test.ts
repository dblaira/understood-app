import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import {
  UNDERSTOOD_HARNESS_INBOX_RELATIVE_PATH,
  handoffCurrentUserHarnessCandidate,
  resolveHarnessCandidateInbox,
  writeHarnessCandidateToInbox,
  type UnderstoodHarnessCandidateSource,
} from '../lib/ontology/harness-candidate-runtime.server'
import type {
  HarnessPendingCandidate,
  UnderstoodHarnessAxiom,
  UnderstoodHarnessSourceEvidence,
} from '../lib/ontology/harness-candidate-export'

const userId = 'user-adam'
const evidence: UnderstoodHarnessSourceEvidence = {
  id: 'entry-1',
  content: 'When I protect focus, my work satisfaction improves.',
  createdAt: '2026-07-08T12:00:00.000Z',
  lifeDomains: ['Work', 'Affect'],
}
const axiom: UnderstoodHarnessAxiom = {
  id: 'axiom-focus',
  userId,
  name: 'Protect focus',
  antecedent: 'I protect focus',
  consequent: 'my work satisfaction improves',
  confidence: 0.86,
  status: 'confirmed',
  scope: 'personal',
  relationshipType: 'predicts',
  evidenceEntryIds: [evidence.id],
  evidenceCount: 1,
  provenance: {
    source: 'entry_extracted',
    entryId: evidence.id,
    lifeDomains: ['Work', 'Affect'],
  },
  confirmedAt: '2026-07-09T12:00:00.000Z',
}
const candidate: HarnessPendingCandidate = {
  id: 'cand-understood-20260709-axiom-focus',
  status: 'pending',
  plain: 'AGENT PROPOSAL: For Adam, "I protect focus" predicts "my work satisfaction improves".',
  evidence: evidence.content,
  source: 'Understood entry entry-1 · ontology axiom axiom-focus · confirmed 2026-07-09',
  domain_a: 'work',
  domain_b: 'affect',
  strength: 0.86,
  connection_type: 'predicts',
}

function source(overrides: Partial<UnderstoodHarnessCandidateSource> = {}): UnderstoodHarnessCandidateSource {
  return {
    async readAxioms() {
      return [axiom]
    },
    async readEvidence() {
      return [evidence]
    },
    ...overrides,
  }
}

describe('Understood runtime Harness handoff', () => {
  it('uses the shared Harness iCloud review inbox on a local Mac', async () => {
    const home = await mkdtemp(join(tmpdir(), 'understood-home-'))
    await mkdir(join(
      home,
      'Library',
      'Mobile Documents',
      'iCloud~com~adamblair~harness',
      'Documents'
    ), { recursive: true })

    const resolved = await resolveHarnessCandidateInbox({
      configuredPath: '',
      homeDirectory: home,
      platformName: 'darwin',
    })

    assert.equal(resolved, join(home, UNDERSTOOD_HARNESS_INBOX_RELATIVE_PATH))
  })

  it('reports disabled and does not read private data when no local inbox exists', async () => {
    let read = false
    const result = await handoffCurrentUserHarnessCandidate({
      userId,
      inboxDirectory: null,
      source: source({
        async readAxioms() {
          read = true
          return [axiom]
        },
      }),
    })

    assert.equal(result.status, 'disabled')
    assert.equal(read, false)
  })

  it('writes the exact pending candidate envelope into the review inbox', async () => {
    const inbox = await mkdtemp(join(tmpdir(), 'understood-harness-inbox-'))
    const result = await handoffCurrentUserHarnessCandidate({
      source: source(),
      userId,
      inboxDirectory: inbox,
    })

    assert.equal(result.status, 'delivered')
    assert.equal(result.candidateId, candidate.id)
    assert.ok(result.candidatePath)
    assert.deepEqual(JSON.parse(await readFile(result.candidatePath, 'utf8')), candidate)
  })

  it('is idempotent when the same candidate is already waiting for review', async () => {
    const inbox = await mkdtemp(join(tmpdir(), 'understood-harness-inbox-'))
    const first = await writeHarnessCandidateToInbox(candidate, inbox)
    const second = await writeHarnessCandidateToInbox(candidate, inbox)

    assert.equal(first.status, 'delivered')
    assert.equal(second.status, 'already_present')
    assert.equal(first.candidatePath, second.candidatePath)
  })

  it('refuses to overwrite a conflicting candidate with the same id', async () => {
    const inbox = await mkdtemp(join(tmpdir(), 'understood-harness-inbox-'))
    await writeFile(
      join(inbox, `${candidate.id}.json`),
      JSON.stringify({ ...candidate, evidence: 'different evidence' })
    )

    await assert.rejects(
      writeHarnessCandidateToInbox(candidate, inbox),
      /conflicting candidate/
    )
  })

  it('never permits an accepted-authority directory as the handoff target', async () => {
    await assert.rejects(
      resolveHarnessCandidateInbox({ configuredPath: '/tmp/Harness/accepted' }),
      /cannot target an accepted-authority directory/
    )
  })

  it('writes nothing when current data has no eligible confirmed personal axiom', async () => {
    const inbox = await mkdtemp(join(tmpdir(), 'understood-harness-inbox-'))
    const result = await handoffCurrentUserHarnessCandidate({
      source: source({
        async readAxioms() {
          return [{ ...axiom, status: 'rejected' }]
        },
      }),
      userId,
      inboxDirectory: inbox,
    })

    assert.equal(result.status, 'no_candidate')
    assert.equal(result.candidatePath, null)
  })
})
