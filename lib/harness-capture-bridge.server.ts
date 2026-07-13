import { timingSafeEqual } from 'node:crypto'

import {
  canonicalHarnessCaptureJSON,
  findHarnessCaptureRecord,
  HarnessCaptureContentChangedError,
  harnessCaptureSHA256,
  readNextPendingHarnessCapture,
  type UnderstoodHarnessCaptureSource,
} from './harness-capture-runtime.server'

export interface HarnessCaptureBridgeDependencies {
  source: UnderstoodHarnessCaptureSource
  userId: string
  token: string
  now?: Date
}

export async function handleHarnessCaptureBridgeRequest(
  request: Request,
  dependencies: HarnessCaptureBridgeDependencies
): Promise<Response> {
  if (dependencies.token.trim().length < 32 || !dependencies.userId.trim()) {
    return bridgeJSON({ error: 'Harness capture bridge is not configured' }, 503)
  }
  if (!authorized(request.headers.get('authorization'), dependencies.token)) {
    return bridgeJSON({ error: 'Unauthorized' }, 401)
  }

  if (request.method === 'GET') {
    const capture = await readNextPendingHarnessCapture(dependencies.source, dependencies.userId)
    if (!capture) return bridgeJSON({ status: 'empty', capture: null })
    const captureJSON = canonicalHarnessCaptureJSON(capture)
    return bridgeJSON({
      status: 'pending',
      capture: JSON.parse(captureJSON) as unknown,
      capture_json: captureJSON,
      capture_sha256: harnessCaptureSHA256(capture),
    })
  }

  if (request.method === 'POST') {
    const identity = await captureIdentityFromRequest(request)
    if (!identity) {
      return bridgeJSON({
        error: 'capture_id and capture_sha256 must identify the exact received Understood capture',
      }, 400)
    }
    const record = await findHarnessCaptureRecord(
      dependencies.source,
      dependencies.userId,
      identity.captureID
    )
    if (!record) {
      return bridgeJSON({ error: 'Capture is not an Understood outbox item' }, 409)
    }
    if (harnessCaptureSHA256(record.capture) !== identity.captureSHA256) {
      return bridgeJSON({ error: 'Capture content changed before acknowledgement' }, 409)
    }
    if (record.receipt) {
      if (record.receipt.captureSHA256 !== identity.captureSHA256) {
        return bridgeJSON({ error: 'Capture receipt identity does not match' }, 409)
      }
      return bridgeJSON({
        status: 'already_acknowledged',
        capture_id: identity.captureID,
        capture_sha256: identity.captureSHA256,
      })
    }

    try {
      await dependencies.source.recordReceipt(
        dependencies.userId,
        record.capture.source_record_id,
        {
          captureId: identity.captureID,
          captureSHA256: identity.captureSHA256,
          receivedAt: (dependencies.now ?? new Date()).toISOString(),
          transport: 'vercel_https_bridge',
        }
      )
    } catch (error) {
      if (error instanceof HarnessCaptureContentChangedError) {
        return bridgeJSON({ error: 'Capture content changed before acknowledgement' }, 409)
      }
      throw error
    }
    return bridgeJSON({
      status: 'acknowledged',
      capture_id: identity.captureID,
      capture_sha256: identity.captureSHA256,
    })
  }

  return bridgeJSON({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
}

function authorized(header: string | null, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false
  const provided = Buffer.from(header.slice('Bearer '.length), 'utf8')
  const expected = Buffer.from(token, 'utf8')
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

async function captureIdentityFromRequest(request: Request): Promise<{
  captureID: string
  captureSHA256: string
} | null> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return null
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const captureID = (body as Record<string, unknown>).capture_id
  const captureSHA256 = (body as Record<string, unknown>).capture_sha256
  return typeof captureID === 'string' &&
    /^capture-understood-entry-[a-f0-9]{24}$/.test(captureID) &&
    typeof captureSHA256 === 'string' &&
    /^[a-f0-9]{64}$/.test(captureSHA256)
    ? { captureID, captureSHA256 }
    : null
}

function bridgeJSON(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      ...headers,
    },
  })
}
