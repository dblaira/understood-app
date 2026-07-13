import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildUnderstoodEntryCapture, type UnderstoodSuiteCaptureEnvelope } from '../lib/harness-capture.server'
import { handleHarnessCaptureBridgeRequest } from '../lib/harness-capture-bridge.server'
import {
  canonicalHarnessCaptureJSON,
  deliverUnderstoodHarnessCapture,
  harnessCaptureSHA256,
  type HarnessCaptureOutboxRecord,
  type HarnessCaptureReceipt,
  type UnderstoodHarnessCaptureSource,
} from '../lib/harness-capture-runtime.server'

const token = 'bridge-token-with-enough-entropy-for-tests'

class InMemoryCaptureSource implements UnderstoodHarnessCaptureSource {
  readonly records: HarnessCaptureOutboxRecord[] = []

  async stageCapture(_userId: string, capture: UnderstoodSuiteCaptureEnvelope): Promise<void> {
    if (!this.records.some((record) => record.capture.capture_id === capture.capture_id)) {
      this.records.push({ capture, receipt: null })
    }
  }

  async readOutbox(_userId: string): Promise<HarnessCaptureOutboxRecord[]> {
    return this.records
  }

  async recordReceipt(
    _userId: string,
    sourceRecordId: string,
    receipt: HarnessCaptureReceipt
  ): Promise<'acknowledged' | 'already_acknowledged'> {
    const record = this.records.find((item) => item.capture.source_record_id === sourceRecordId)
    if (!record || record.capture.capture_id !== receipt.captureId) throw new Error('capture not staged')
    if (harnessCaptureSHA256(record.capture) !== receipt.captureSHA256) {
      throw new Error('capture content changed')
    }
    if (record.receipt) {
      if (record.receipt.captureSHA256 !== receipt.captureSHA256) {
        throw new Error('capture receipt identity changed')
      }
      return 'already_acknowledged'
    }
    record.receipt = receipt
    return 'acknowledged'
  }
}

function capture(id: string, capturedAt: string): UnderstoodSuiteCaptureEnvelope {
  return buildUnderstoodEntryCapture({
    entryRecord: {
      id,
      user_id: 'user-adam',
      headline: `Entry ${id}`,
      content: `Raw content for ${id}`,
      created_at: capturedAt,
    },
    createInput: {
      headline: `Entry ${id}`,
      content: `Raw content for ${id}`,
    },
  })
}

describe('authenticated Understood capture bridge', () => {
  it('offers the oldest staged capture without acknowledging it', async () => {
    const source = new InMemoryCaptureSource()
    const first = capture('entry-first', '2026-07-11T18:00:00.000Z')
    const second = capture('entry-second', '2026-07-11T19:00:00.000Z')
    await source.stageCapture('user-adam', second)
    await source.stageCapture('user-adam', first)

    const response = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('GET', token),
      { source, userId: 'user-adam', token }
    )
    const body = await responseJSON(response)

    assert.equal(response.status, 200)
    assert.equal(body.status, 'pending')
    assert.deepEqual(body.capture, first)
    assert.equal(body.capture_json, canonicalHarnessCaptureJSON(first))
    assert.equal(body.capture_sha256, harnessCaptureSHA256(first))
    assert.equal(source.records[1]?.receipt, null)
    assert.equal('candidate' in body, false)
  })

  it('acknowledges only the capture_id and SHA-256 identity Harness durably received', async () => {
    const source = new InMemoryCaptureSource()
    const first = capture('entry-first', '2026-07-11T18:00:00.000Z')
    const second = capture('entry-second', '2026-07-11T19:00:00.000Z')
    await source.stageCapture('user-adam', first)
    await source.stageCapture('user-adam', second)

    const fetched = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('GET', token),
      { source, userId: 'user-adam', token }
    )
    const fetchedBody = await responseJSON(fetched)
    assert.equal(fetchedBody.capture.capture_id, first.capture_id)
    const firstSHA256 = fetchedBody.capture_sha256 as string

    const rejected = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', 'wrong-token', {
        capture_id: first.capture_id,
        capture_sha256: firstSHA256,
      }),
      { source, userId: 'user-adam', token }
    )
    assert.equal(rejected.status, 401)
    assert.equal(source.records[0]?.receipt, null)

    const acknowledged = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', token, {
        capture_id: first.capture_id,
        capture_sha256: firstSHA256,
      }),
      { source, userId: 'user-adam', token, now: new Date('2026-07-11T20:00:00.000Z') }
    )
    assert.deepEqual(await responseJSON(acknowledged), {
      status: 'acknowledged',
      capture_id: first.capture_id,
      capture_sha256: firstSHA256,
    })
    assert.deepEqual(source.records[0]?.receipt, {
      captureId: first.capture_id,
      captureSHA256: firstSHA256,
      receivedAt: '2026-07-11T20:00:00.000Z',
      transport: 'vercel_https_bridge',
    })

    const next = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('GET', token),
      { source, userId: 'user-adam', token }
    )
    assert.equal((await responseJSON(next)).capture.capture_id, second.capture_id)

    const repeated = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', token, {
        capture_id: first.capture_id,
        capture_sha256: firstSHA256,
      }),
      { source, userId: 'user-adam', token }
    )
    assert.deepEqual(await responseJSON(repeated), {
      status: 'already_acknowledged',
      capture_id: first.capture_id,
      capture_sha256: firstSHA256,
    })
  })

  it('can acknowledge the fetched capture after another entry is staged', async () => {
    const source = new InMemoryCaptureSource()
    const fetchedCapture = capture('entry-fetched', '2026-07-11T19:00:00.000Z')
    await source.stageCapture('user-adam', fetchedCapture)

    const fetched = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('GET', token),
      { source, userId: 'user-adam', token }
    )
    const fetchedBody = await responseJSON(fetched)
    assert.equal(fetchedBody.capture.capture_id, fetchedCapture.capture_id)

    await source.stageCapture(
      'user-adam',
      capture('entry-new-earlier', '2026-07-11T18:00:00.000Z')
    )
    const ack = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', token, {
        capture_id: fetchedCapture.capture_id,
        capture_sha256: fetchedBody.capture_sha256,
      }),
      { source, userId: 'user-adam', token }
    )
    assert.equal(ack.status, 200)
    assert.equal(source.records[0]?.receipt?.captureId, fetchedCapture.capture_id)
  })

  it('refuses to acknowledge when the same capture_id changes after GET', async () => {
    const source = new InMemoryCaptureSource()
    const original = capture('entry-mutated', '2026-07-11T19:00:00.000Z')
    await source.stageCapture('user-adam', original)

    const fetched = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('GET', token),
      { source, userId: 'user-adam', token }
    )
    const fetchedBody = await responseJSON(fetched)
    const originalSHA256 = fetchedBody.capture_sha256 as string

    source.records[0]!.capture = {
      ...source.records[0]!.capture,
      payload: {
        ...source.records[0]!.capture.payload,
        create_input: { content: 'Changed after Harness fetched it' },
      },
    }
    assert.equal(source.records[0]!.capture.capture_id, original.capture_id)
    assert.notEqual(harnessCaptureSHA256(source.records[0]!.capture), originalSHA256)

    const rejected = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', token, {
        capture_id: original.capture_id,
        capture_sha256: originalSHA256,
      }),
      { source, userId: 'user-adam', token }
    )

    assert.equal(rejected.status, 409)
    assert.equal((await responseJSON(rejected)).error, 'Capture content changed before acknowledgement')
    assert.equal(source.records[0]?.receipt, null)
  })

  it('rejects unknown or candidate-shaped acknowledgement bodies', async () => {
    const source = new InMemoryCaptureSource()
    const unknown = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', token, {
        capture_id: 'capture-understood-entry-000000000000000000000000',
        capture_sha256: '0'.repeat(64),
      }),
      { source, userId: 'user-adam', token }
    )
    assert.equal(unknown.status, 409)

    const candidateBody = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('POST', token, { candidate_id: 'cand-understood-old-path' }),
      { source, userId: 'user-adam', token }
    )
    assert.equal(candidateBody.status, 400)
  })

  it('reports empty only when no unacknowledged captures remain', async () => {
    const source = new InMemoryCaptureSource()
    const response = await handleHarnessCaptureBridgeRequest(
      bridgeRequest('GET', token),
      { source, userId: 'user-adam', token }
    )
    assert.deepEqual(await responseJSON(response), { status: 'empty', capture: null })
  })

  it('uses remote_pending to describe transport, never candidate formation', async () => {
    const source = new InMemoryCaptureSource()
    const value = capture('entry-remote', '2026-07-11T21:00:00.000Z')
    const result = await deliverUnderstoodHarnessCapture({
      source,
      userId: 'user-adam',
      capture: value,
      inboxDirectory: null,
      remoteBridge: { enabled: true, target: '/api/harness/captures' },
    })
    assert.equal(result.status, 'remote_pending')
    assert.equal(result.captureId, value.capture_id)
    assert.doesNotMatch(result.detail, /candidate/i)
  })
})

function bridgeRequest(method: string, bearer: string, body?: unknown): Request {
  return new Request('https://understood.example/api/harness/captures', {
    method,
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function responseJSON(response: Response): Promise<any> {
  return response.json()
}
