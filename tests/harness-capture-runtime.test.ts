import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'

import {
  buildUnderstoodEntryCapture,
  type UnderstoodSuiteCaptureEnvelope,
} from '../lib/harness-capture.server'
import {
  deliverUnderstoodHarnessCapture,
  harnessCaptureSHA256,
  harnessRemoteCaptureBridgeConfiguration,
  resolveHarnessCaptureInbox,
  writeHarnessCaptureToInbox,
  type HarnessCaptureOutboxRecord,
  type HarnessCaptureReceipt,
  type UnderstoodHarnessCaptureSource,
} from '../lib/harness-capture-runtime.server'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function entryRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'entry-faithful-1',
    user_id: 'user-adam',
    headline: 'A faithful Understood capture',
    category: 'Business',
    content: 'Record what Adam entered; Harness decides what it means.',
    entry_type: 'note',
    created_at: '2026-07-11T18:30:00.000Z',
    updated_at: '2026-07-11T18:30:00.000Z',
    image_url: 'https://example.test/legacy-image.jpg',
    images: [
      { url: 'https://example.test/gallery-image.jpg', is_poster: true, order: 0 },
    ],
    metadata: {
      captured_at: '2026-07-11T18:29:59.000Z',
      device: 'desktop',
    },
    ...overrides,
  }
}

function createInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    headline: 'A faithful Understood capture',
    category: 'Business',
    content: 'Record what Adam entered; Harness decides what it means.',
    entry_type: 'note',
    photo_url: 'https://example.test/photo.jpg',
    images: [
      { url: 'https://example.test/gallery-image.jpg', is_poster: true, order: 0 },
      { url: 'https://example.test/document.pdf', is_poster: false, order: 1 },
    ],
    ...overrides,
  }
}

function capture(
  entryOverrides: Record<string, unknown> = {},
  inputOverrides: Record<string, unknown> = {}
): UnderstoodSuiteCaptureEnvelope {
  return buildUnderstoodEntryCapture({
    entryRecord: entryRecord(entryOverrides),
    createInput: createInput(inputOverrides),
  })
}

class InMemoryCaptureSource implements UnderstoodHarnessCaptureSource {
  readonly records = new Map<string, HarnessCaptureOutboxRecord>()

  async stageCapture(_userId: string, value: UnderstoodSuiteCaptureEnvelope): Promise<void> {
    const existing = this.records.get(value.capture_id)
    if (existing && !deepEqual(existing.capture, value)) {
      throw new Error(`conflicting capture ${value.capture_id}`)
    }
    if (!existing) this.records.set(value.capture_id, { capture: value, receipt: null })
  }

  async readOutbox(_userId: string): Promise<HarnessCaptureOutboxRecord[]> {
    return [...this.records.values()]
  }

  async recordReceipt(
    _userId: string,
    sourceRecordId: string,
    receipt: HarnessCaptureReceipt
  ): Promise<'acknowledged' | 'already_acknowledged'> {
    const item = [...this.records.values()].find(
      (record) => record.capture.source_record_id === sourceRecordId
    )
    if (!item || item.capture.capture_id !== receipt.captureId) {
      throw new Error(`capture not staged: ${receipt.captureId}`)
    }
    if (harnessCaptureSHA256(item.capture) !== receipt.captureSHA256) {
      throw new Error(`capture content changed: ${receipt.captureId}`)
    }
    if (item.receipt) {
      if (item.receipt.captureSHA256 !== receipt.captureSHA256) {
        throw new Error(`capture receipt identity changed: ${receipt.captureId}`)
      }
      return 'already_acknowledged'
    }
    item.receipt = receipt
    return 'acknowledged'
  }
}

describe('Understood suite_capture.v1 producer', () => {
  it('preserves the durable entry record and original create input without making a candidate', () => {
    const value = capture()

    assert.deepEqual(Object.keys(value).sort(), [
      'artifact_refs',
      'capture_id',
      'capture_kind',
      'captured_at',
      'payload',
      'schema_version',
      'source_app',
      'source_record_id',
    ])
    assert.equal(value.schema_version, 'suite_capture.v1')
    assert.match(value.capture_id, /^capture-understood-entry-[a-f0-9]{24}$/)
    assert.equal(value.captured_at, '2026-07-11T18:30:00.000Z')
    assert.equal(value.capture_kind, 'entry.created')
    assert.equal(value.source_app, 'Understood')
    assert.equal(value.source_record_id, 'entry-faithful-1')
    assert.deepEqual(value.payload.entry_record, entryRecord())
    assert.deepEqual(value.payload.create_input, createInput())
    assert.deepEqual(value.artifact_refs, [
      'https://example.test/legacy-image.jpg',
      'https://example.test/gallery-image.jpg',
      'https://example.test/photo.jpg',
      'https://example.test/document.pdf',
    ])

    const topLevel = value as unknown as Record<string, unknown>
    for (const field of ['plain', 'evidence', 'domain_a', 'domain_b', 'strength', 'connection_type', 'status']) {
      assert.equal(field in topLevel, false, `capture must not include producer decision field ${field}`)
    }
    assert.doesNotMatch(JSON.stringify(value), /AGENT PROPOSAL:/)
  })

  it('creates a capture for a minimal entry without eligibility or confidence thresholds', () => {
    const value = buildUnderstoodEntryCapture({
      entryRecord: {
        id: 'entry-minimal',
        created_at: '2026-07-11T19:00:00.000Z',
        content: '',
      },
      createInput: { headline: '', content: '' },
    })

    assert.equal(value.source_record_id, 'entry-minimal')
    assert.equal(value.payload.entry_record.content, '')
  })

  it('writes one durable local capture and acknowledges only that raw receipt', async () => {
    const root = await tempRoot()
    const source = new InMemoryCaptureSource()
    const value = capture()

    const first = await deliverUnderstoodHarnessCapture({
      source,
      userId: 'user-adam',
      capture: value,
      inboxDirectory: root,
      remoteBridge: { enabled: false, detail: 'remote bridge disabled in local test' },
      now: new Date('2026-07-11T20:00:00.000Z'),
    })
    const second = await deliverUnderstoodHarnessCapture({
      source,
      userId: 'user-adam',
      capture: value,
      inboxDirectory: root,
      remoteBridge: { enabled: false, detail: 'remote bridge disabled in local test' },
      now: new Date('2026-07-11T20:01:00.000Z'),
    })

    assert.equal(first.status, 'delivered')
    assert.equal(second.status, 'already_present')
    assert.equal(first.captureId, value.capture_id)
    assert.deepEqual(JSON.parse(await readFile(join(root, `${value.capture_id}.json`), 'utf8')), value)
    assert.deepEqual(source.records.get(value.capture_id)?.receipt, {
      captureId: value.capture_id,
      captureSHA256: harnessCaptureSHA256(value),
      receivedAt: '2026-07-11T20:00:00.000Z',
      transport: 'icloud_file',
    })
  })

  it('stages the exact capture for the remote bridge without acknowledging candidate formation', async () => {
    const source = new InMemoryCaptureSource()
    const value = capture()

    const result = await deliverUnderstoodHarnessCapture({
      source,
      userId: 'user-adam',
      capture: value,
      inboxDirectory: null,
      remoteBridge: { enabled: true, target: '/api/harness/captures' },
    })

    assert.deepEqual(result, {
      status: 'remote_pending',
      captureId: value.capture_id,
      capturePath: '/api/harness/captures',
      detail: 'Understood capture is durably staged for the authenticated Harness capture bridge.',
    })
    assert.equal(source.records.get(value.capture_id)?.receipt, null)
  })

  it('refuses to overwrite a different event with the same capture id', async () => {
    const root = await tempRoot()
    const value = capture()
    await writeFile(
      join(root, `${value.capture_id}.json`),
      JSON.stringify({ ...value, captured_at: '2026-07-11T22:00:00.000Z' })
    )

    await assert.rejects(
      writeHarnessCaptureToInbox(value, root),
      /conflicting capture/
    )
  })

  it('uses the Harness capture root and rejects authority or candidate directories', async () => {
    const home = await tempRoot()
    const documents = join(
      home,
      'Library/Mobile Documents/iCloud~com~adamblair~harness/Documents'
    )
    await mkdir(documents, { recursive: true })

    assert.equal(
      await resolveHarnessCaptureInbox({ homeDirectory: home, platformName: 'darwin' }),
      join(documents, 'Harness Captures/Understood/Pending')
    )
    await assert.rejects(
      resolveHarnessCaptureInbox({ configuredPath: '/tmp/Harness/accepted' }),
      /cannot target accepted-authority or candidate directories/
    )
    await assert.rejects(
      resolveHarnessCaptureInbox({ configuredPath: '/tmp/Harness/Candidates/Understood' }),
      /cannot target accepted-authority or candidate directories/
    )
  })

  it('configures only the capture endpoint for the owned user', () => {
    const configured = harnessRemoteCaptureBridgeConfiguration('user-adam', {
      HARNESS_BRIDGE_TOKEN: 'x'.repeat(32),
      HARNESS_BRIDGE_USER_ID: 'user-adam',
    })
    assert.deepEqual(configured, { enabled: true, target: '/api/harness/captures' })
  })
})

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'understood-harness-capture-'))
  temporaryRoots.push(root)
  return root
}

function deepEqual(left: unknown, right: unknown): boolean {
  try {
    assert.deepEqual(left, right)
    return true
  } catch {
    return false
  }
}
