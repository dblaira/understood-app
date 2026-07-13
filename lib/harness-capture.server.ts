import { createHash } from 'node:crypto'

export const SUITE_CAPTURE_SCHEMA_VERSION = 'suite_capture.v1' as const
export const UNDERSTOOD_CAPTURE_KIND = 'entry.created' as const
export const UNDERSTOOD_SOURCE_APP = 'Understood' as const

export interface UnderstoodEntryCapturePayload {
  entry_record: Record<string, unknown>
  create_input: Record<string, unknown>
}

export interface UnderstoodSuiteCaptureEnvelope {
  schema_version: typeof SUITE_CAPTURE_SCHEMA_VERSION
  capture_id: string
  captured_at: string
  capture_kind: typeof UNDERSTOOD_CAPTURE_KIND
  source_app: typeof UNDERSTOOD_SOURCE_APP
  source_record_id: string
  payload: UnderstoodEntryCapturePayload
  artifact_refs: string[]
}

export function buildUnderstoodEntryCapture(input: {
  entryRecord: Record<string, unknown>
  createInput: Record<string, unknown>
  now?: Date
}): UnderstoodSuiteCaptureEnvelope {
  const entryRecord = jsonRecord(input.entryRecord, 'entry record')
  const createInput = jsonRecord(input.createInput, 'create input')
  const sourceRecordID = requiredText(entryRecord.id, 'entry record id')
  const storedCreatedAt = typeof entryRecord.created_at === 'string'
    ? entryRecord.created_at.trim()
    : ''
  const capturedAt = Number.isFinite(Date.parse(storedCreatedAt))
    ? storedCreatedAt
    : (input.now ?? new Date()).toISOString()

  return {
    schema_version: SUITE_CAPTURE_SCHEMA_VERSION,
    capture_id: captureIDForEntry(sourceRecordID),
    captured_at: capturedAt,
    capture_kind: UNDERSTOOD_CAPTURE_KIND,
    source_app: UNDERSTOOD_SOURCE_APP,
    source_record_id: sourceRecordID,
    payload: {
      entry_record: entryRecord,
      create_input: createInput,
    },
    artifact_refs: artifactReferences(entryRecord, createInput),
  }
}

export function captureIDForEntry(entryID: string): string {
  const normalized = requiredText(entryID, 'entry id')
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 24)
  return `capture-understood-entry-${digest}`
}

function artifactReferences(
  entryRecord: Record<string, unknown>,
  createInput: Record<string, unknown>
): string[] {
  const references: string[] = []
  const append = (value: unknown) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    if (trimmed && !references.includes(trimmed)) references.push(trimmed)
  }
  const appendImages = (value: unknown) => {
    if (!Array.isArray(value)) return
    for (const image of value) {
      if (image && typeof image === 'object' && !Array.isArray(image)) {
        append((image as Record<string, unknown>).url)
      }
    }
  }

  for (const record of [entryRecord, createInput]) {
    append(record.photo_url)
    append(record.image_url)
    appendImages(record.images)
  }
  return references
}

function jsonRecord(value: Record<string, unknown>, name: string): Record<string, unknown> {
  const serialized = JSON.stringify(value)
  const parsed = serialized ? JSON.parse(serialized) as unknown : null
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Understood ${name} must be one JSON object`)
  }
  return parsed as Record<string, unknown>
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Understood ${name} is required before capture`)
  }
  return value.trim()
}
