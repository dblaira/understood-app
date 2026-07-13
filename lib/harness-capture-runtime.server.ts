import { createHash, randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, stat, unlink } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { isAbsolute, join, normalize, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  SUITE_CAPTURE_SCHEMA_VERSION,
  type UnderstoodSuiteCaptureEnvelope,
} from './harness-capture.server'

const HARNESS_ICLOUD_DOCUMENTS = join(
  'Library',
  'Mobile Documents',
  'iCloud~com~adamblair~harness',
  'Documents'
)

export const UNDERSTOOD_HARNESS_CAPTURE_RELATIVE_PATH = join(
  HARNESS_ICLOUD_DOCUMENTS,
  'Harness Captures',
  'Understood',
  'Pending'
)

export const HARNESS_CAPTURE_OUTBOX_METADATA_KEY = 'harnessCaptureOutbox'

export interface HarnessCaptureReceipt {
  captureId: string
  captureSHA256: string
  receivedAt: string
  transport: 'icloud_file' | 'vercel_https_bridge'
}

export interface HarnessCaptureOutboxRecord {
  capture: UnderstoodSuiteCaptureEnvelope
  receipt: HarnessCaptureReceipt | null
}

export interface UnderstoodHarnessCaptureSource {
  stageCapture(
    userId: string,
    capture: UnderstoodSuiteCaptureEnvelope
  ): Promise<void>
  readOutbox(userId: string): Promise<HarnessCaptureOutboxRecord[]>
  recordReceipt(
    userId: string,
    sourceRecordId: string,
    receipt: HarnessCaptureReceipt
  ): Promise<'acknowledged' | 'already_acknowledged'>
}

export class HarnessCaptureContentChangedError extends Error {}

export type HarnessRemoteCaptureBridgeConfiguration =
  | { enabled: true; target: '/api/harness/captures' }
  | { enabled: false; detail: string }

export type HarnessCaptureHandoffResult =
  | {
      status: 'delivered' | 'already_present' | 'remote_pending'
      captureId: string
      capturePath: string
      detail: string
    }
  | {
      status: 'failed'
      captureId: string | null
      capturePath: null
      detail: string
    }

export interface HarnessCaptureInboxResolutionOptions {
  configuredPath?: string
  homeDirectory?: string
  platformName?: NodeJS.Platform
}

interface EntryOutboxRow {
  id: string
  metadata: Record<string, unknown> | null
}

export function createSupabaseHarnessCaptureSource(
  supabase: SupabaseClient
): UnderstoodHarnessCaptureSource {
  return {
    async stageCapture(userId, capture) {
      const row = await readEntryMetadata(supabase, userId, capture.source_record_id)
      const currentMetadata = plainRecord(row.metadata)
      const current = outboxRecord(row.metadata)
      if (current) {
        if (!isDeepStrictEqual(current.capture, capture)) {
          throw new Error(`Understood entry already has a conflicting capture ${capture.capture_id}`)
        }
        return
      }
      if (HARNESS_CAPTURE_OUTBOX_METADATA_KEY in currentMetadata) {
        throw new Error(`Understood entry has invalid capture outbox metadata: ${capture.source_record_id}`)
      }

      const metadata = {
        ...currentMetadata,
        [HARNESS_CAPTURE_OUTBOX_METADATA_KEY]: {
          capture,
          receipt: null,
        } satisfies HarnessCaptureOutboxRecord,
      }
      const { error } = await supabase
        .from('entries')
        .update({ metadata })
        .eq('id', capture.source_record_id)
        .eq('user_id', userId)
        .select('id')
        .single()
      if (error) {
        throw new Error(`Understood capture staging failed: ${error.message}`)
      }
    },

    async readOutbox(userId) {
      const { data, error } = await supabase
        .from('entries')
        .select('id,metadata')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (error) {
        throw new Error(`Understood capture outbox read failed: ${error.message}`)
      }
      return ((data ?? []) as EntryOutboxRow[])
        .map((row) => outboxRecord(row.metadata))
        .filter((record): record is HarnessCaptureOutboxRecord => record !== null)
    },

    async recordReceipt(userId, sourceRecordId, receipt) {
      const row = await readEntryMetadata(supabase, userId, sourceRecordId)
      const current = outboxRecord(row.metadata)
      if (!current || current.capture.capture_id !== receipt.captureId) {
        throw new Error(`Understood capture is not staged: ${receipt.captureId}`)
      }
      if (harnessCaptureSHA256(current.capture) !== receipt.captureSHA256) {
        throw new HarnessCaptureContentChangedError(
          `Understood capture content changed before acknowledgement: ${receipt.captureId}`
        )
      }
      if (current.receipt) {
        if (
          current.receipt.captureId !== receipt.captureId ||
          current.receipt.captureSHA256 !== receipt.captureSHA256
        ) {
          throw new Error(`Understood entry has a conflicting capture receipt: ${sourceRecordId}`)
        }
        return 'already_acknowledged'
      }

      const metadata = {
        ...plainRecord(row.metadata),
        [HARNESS_CAPTURE_OUTBOX_METADATA_KEY]: {
          capture: current.capture,
          receipt,
        } satisfies HarnessCaptureOutboxRecord,
      }
      const { error } = await supabase
        .from('entries')
        .update({ metadata })
        .eq('id', sourceRecordId)
        .eq('user_id', userId)
        .select('id')
        .single()
      if (error) {
        throw new Error(`Understood capture receipt failed: ${error.message}`)
      }
      return 'acknowledged'
    },
  }
}

export async function deliverUnderstoodHarnessCapture(input: {
  source: UnderstoodHarnessCaptureSource
  userId: string
  capture: UnderstoodSuiteCaptureEnvelope
  inboxDirectory?: string | null
  remoteBridge: HarnessRemoteCaptureBridgeConfiguration
  now?: Date
}): Promise<HarnessCaptureHandoffResult> {
  await input.source.stageCapture(input.userId, input.capture)
  const inboxDirectory = input.inboxDirectory === undefined
    ? await resolveHarnessCaptureInbox()
    : input.inboxDirectory

  if (inboxDirectory) {
    try {
      const delivery = await writeHarnessCaptureToInbox(input.capture, inboxDirectory)
      await input.source.recordReceipt(input.userId, input.capture.source_record_id, {
        captureId: input.capture.capture_id,
        captureSHA256: harnessCaptureSHA256(input.capture),
        receivedAt: (input.now ?? new Date()).toISOString(),
        transport: 'icloud_file',
      })
      return {
        ...delivery,
        detail: delivery.status === 'delivered'
          ? 'Understood capture was written to the durable Harness capture inbox.'
          : 'The exact Understood capture was already present in the durable Harness capture inbox.',
      }
    } catch (error) {
      if (!input.remoteBridge.enabled) return failedCaptureHandoff(input.capture, error)
    }
  }

  if (input.remoteBridge.enabled) {
    return {
      status: 'remote_pending',
      captureId: input.capture.capture_id,
      capturePath: input.remoteBridge.target,
      detail: 'Understood capture is durably staged for the authenticated Harness capture bridge.',
    }
  }

  return failedCaptureHandoff(input.capture, input.remoteBridge.detail)
}

export async function readNextPendingHarnessCapture(
  source: UnderstoodHarnessCaptureSource,
  userId: string
): Promise<UnderstoodSuiteCaptureEnvelope | null> {
  const records = await source.readOutbox(userId)
  return records
    .filter((record) => record.receipt === null)
    .map((record) => record.capture)
    .sort(compareCaptures)[0] ?? null
}

export async function findHarnessCaptureRecord(
  source: UnderstoodHarnessCaptureSource,
  userId: string,
  captureId: string
): Promise<HarnessCaptureOutboxRecord | null> {
  return (await source.readOutbox(userId))
    .find((record) => record.capture.capture_id === captureId) ?? null
}

/// Stable JSON bytes used as the bridge's exact content identity. The bridge
/// sends this text verbatim, Harness stores those bytes, and acknowledgement
/// must echo its SHA-256 before Understood records a receipt.
export function canonicalHarnessCaptureJSON(
  capture: UnderstoodSuiteCaptureEnvelope
): string {
  assertSuiteCapture(capture)
  return JSON.stringify(sortJSONValue(capture))
}

export function harnessCaptureSHA256(
  capture: UnderstoodSuiteCaptureEnvelope
): string {
  return createHash('sha256')
    .update(canonicalHarnessCaptureJSON(capture), 'utf8')
    .digest('hex')
}

export async function resolveHarnessCaptureInbox(
  options: HarnessCaptureInboxResolutionOptions = {}
): Promise<string | null> {
  const configuredPath = options.configuredPath ?? process.env.HARNESS_CAPTURE_INBOX
  if (configuredPath?.trim()) return validateCaptureInboxPath(configuredPath.trim())

  const platformName = options.platformName ?? platform()
  if (platformName !== 'darwin') return null

  const homeDirectory = options.homeDirectory ?? homedir()
  const documentsPath = join(homeDirectory, HARNESS_ICLOUD_DOCUMENTS)
  try {
    const details = await stat(documentsPath)
    if (!details.isDirectory()) return null
  } catch {
    return null
  }
  return validateCaptureInboxPath(
    join(homeDirectory, UNDERSTOOD_HARNESS_CAPTURE_RELATIVE_PATH)
  )
}

export function harnessRemoteCaptureBridgeConfiguration(
  userId: string,
  environment: NodeJS.ProcessEnv = process.env
): HarnessRemoteCaptureBridgeConfiguration {
  if ((environment.HARNESS_BRIDGE_TOKEN?.trim().length ?? 0) < 32) {
    return {
      enabled: false,
      detail: 'Harness capture bridge is not configured: HARNESS_BRIDGE_TOKEN must contain at least 32 characters.',
    }
  }
  const configuredUserID = environment.HARNESS_BRIDGE_USER_ID?.trim()
  if (!configuredUserID) {
    return {
      enabled: false,
      detail: 'Harness capture bridge is not configured: HARNESS_BRIDGE_USER_ID is missing.',
    }
  }
  if (configuredUserID !== userId) {
    return {
      enabled: false,
      detail: 'Harness capture bridge is not enabled for this Understood user.',
    }
  }
  return { enabled: true, target: '/api/harness/captures' }
}

export async function writeHarnessCaptureToInbox(
  capture: UnderstoodSuiteCaptureEnvelope,
  inboxDirectory: string
): Promise<{
  status: 'delivered' | 'already_present'
  captureId: string
  capturePath: string
}> {
  assertSuiteCapture(capture)
  const resolvedInbox = validateCaptureInboxPath(inboxDirectory)
  await mkdir(resolvedInbox, { recursive: true, mode: 0o700 })

  const capturePath = join(resolvedInbox, `${capture.capture_id}.json`)
  const payload = `${JSON.stringify(capture, null, 2)}\n`
  const existing = await readCaptureIfPresent(capturePath)
  if (existing !== null) {
    if (!isDeepStrictEqual(existing, capture)) {
      throw new Error(`Harness inbox already contains conflicting capture ${capture.capture_id}`)
    }
    return { status: 'already_present', captureId: capture.capture_id, capturePath }
  }

  const temporaryPath = join(resolvedInbox, `.${capture.capture_id}.${randomUUID()}.tmp`)
  const handle = await open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(payload, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await link(temporaryPath, capturePath)
  } catch (error) {
    if (!isErrno(error, 'EEXIST')) throw error
    const racedCapture = await readCaptureIfPresent(capturePath)
    if (!isDeepStrictEqual(racedCapture, capture)) {
      throw new Error(`Harness inbox concurrently received conflicting capture ${capture.capture_id}`)
    }
    return { status: 'already_present', captureId: capture.capture_id, capturePath }
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }

  return { status: 'delivered', captureId: capture.capture_id, capturePath }
}

export function failedCaptureHandoff(
  capture: UnderstoodSuiteCaptureEnvelope | null,
  error: unknown
): Extract<HarnessCaptureHandoffResult, { status: 'failed' }> {
  return {
    status: 'failed',
    captureId: capture?.capture_id ?? null,
    capturePath: null,
    detail: error instanceof Error ? error.message : String(error),
  }
}

function assertSuiteCapture(capture: UnderstoodSuiteCaptureEnvelope): void {
  const expectedFields = [
    'schema_version',
    'capture_id',
    'captured_at',
    'capture_kind',
    'source_app',
    'source_record_id',
    'payload',
    'artifact_refs',
  ]
  if (!isDeepStrictEqual(Object.keys(capture).sort(), [...expectedFields].sort())) {
    throw new Error('Understood capture must contain only suite_capture.v1 fields')
  }
  if (capture.schema_version !== SUITE_CAPTURE_SCHEMA_VERSION) {
    throw new Error('Understood capture schema_version must be suite_capture.v1')
  }
  if (!/^capture-understood-entry-[a-f0-9]{24}$/.test(capture.capture_id)) {
    throw new Error('Understood capture id is not safe for an inbox filename')
  }
  if (!Number.isFinite(Date.parse(capture.captured_at))) {
    throw new Error('Understood capture captured_at must be an ISO timestamp')
  }
  if (capture.capture_kind !== 'entry.created' || capture.source_app !== 'Understood') {
    throw new Error('Understood capture kind or descriptive source_app is invalid')
  }
  if (!capture.source_record_id.trim()) {
    throw new Error('Understood capture source_record_id is required')
  }
  if (!capture.payload || typeof capture.payload !== 'object' || Array.isArray(capture.payload)) {
    throw new Error('Understood capture payload must be one object')
  }
  if (!Array.isArray(capture.artifact_refs) || capture.artifact_refs.some((ref) => typeof ref !== 'string')) {
    throw new Error('Understood capture artifact_refs must be text references')
  }
}

function validateCaptureInboxPath(rawPath: string): string {
  if (!isAbsolute(rawPath)) {
    throw new Error('HARNESS_CAPTURE_INBOX must be an absolute directory path')
  }
  const normalized = normalize(rawPath)
  const pathSegments = normalized
    .split(sep)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
  if (pathSegments.some((segment) => ['accepted', 'candidate', 'candidates'].includes(segment))) {
    throw new Error('HARNESS_CAPTURE_INBOX cannot target accepted-authority or candidate directories')
  }
  return normalized
}

async function readCaptureIfPresent(capturePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(capturePath, 'utf8')) as unknown
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return null
    if (error instanceof SyntaxError) {
      throw new Error(`Harness inbox capture is not valid JSON: ${capturePath}`)
    }
    throw error
  }
}

async function readEntryMetadata(
  supabase: SupabaseClient,
  userId: string,
  entryId: string
): Promise<EntryOutboxRow> {
  const { data, error } = await supabase
    .from('entries')
    .select('id,metadata')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single()
  if (error || !data) {
    throw new Error(`Understood entry metadata read failed: ${error?.message ?? 'entry not found'}`)
  }
  return data as EntryOutboxRow
}

function outboxRecord(metadata: Record<string, unknown> | null): HarnessCaptureOutboxRecord | null {
  const value = plainRecord(metadata)[HARNESS_CAPTURE_OUTBOX_METADATA_KEY]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const capture = record.capture
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) return null
  try {
    assertSuiteCapture(capture as UnderstoodSuiteCaptureEnvelope)
  } catch {
    return null
  }
  const receipt = captureReceipt(record.receipt)
  if (record.receipt !== null && record.receipt !== undefined && !receipt) return null
  return { capture: capture as UnderstoodSuiteCaptureEnvelope, receipt }
}

function captureReceipt(value: unknown): HarnessCaptureReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (
    typeof record.captureId !== 'string' ||
    typeof record.captureSHA256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.captureSHA256) ||
    typeof record.receivedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.receivedAt)) ||
    (record.transport !== 'icloud_file' && record.transport !== 'vercel_https_bridge')
  ) return null
  return {
    captureId: record.captureId,
    captureSHA256: record.captureSHA256,
    receivedAt: record.receivedAt,
    transport: record.transport,
  }
}

function sortJSONValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJSONValue)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortJSONValue(record[key])])
  )
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function compareCaptures(
  left: UnderstoodSuiteCaptureEnvelope,
  right: UnderstoodSuiteCaptureEnvelope
): number {
  const timestamp = left.captured_at.localeCompare(right.captured_at)
  return timestamp || left.capture_id.localeCompare(right.capture_id)
}

function isErrno(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code
}
