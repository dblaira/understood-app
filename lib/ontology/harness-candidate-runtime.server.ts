import { randomUUID } from 'node:crypto'
import { link, mkdir, open, readFile, stat, unlink } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { isAbsolute, join, normalize, sep } from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  exportAtMostOneHarnessCandidate,
  type HarnessCandidateExportResult,
  type HarnessPendingCandidate,
  type UnderstoodHarnessAxiom,
  type UnderstoodHarnessSourceEvidence,
} from './harness-candidate-export'

const HARNESS_ICLOUD_DOCUMENTS = join(
  'Library',
  'Mobile Documents',
  'iCloud~com~adamblair~harness',
  'Documents'
)

export const UNDERSTOOD_HARNESS_INBOX_RELATIVE_PATH = join(
  HARNESS_ICLOUD_DOCUMENTS,
  'Candidates',
  'Understood'
)

const AXIOM_SELECT = [
  'id',
  'user_id',
  'name',
  'antecedent',
  'consequent',
  'confidence',
  'status',
  'scope',
  'relationship_type',
  'evidence_entry_ids',
  'evidence_count',
  'provenance',
  'confirmed_at',
].join(',')

interface AxiomRow {
  id: string
  user_id: string | null
  name: string
  antecedent: string
  consequent: string
  confidence: number | string
  status: string
  scope: string
  relationship_type: string
  evidence_entry_ids: string[] | null
  evidence_count: number
  provenance: Record<string, unknown> | null
  confirmed_at: string | null
}

interface EntryRow {
  id: string
  content: string | null
  created_at: string
  life_domains: string[] | null
}

export interface UnderstoodHarnessCandidateSource {
  readAxioms(userId: string): Promise<UnderstoodHarnessAxiom[]>
  readEvidence(
    userId: string,
    evidenceIds: readonly string[]
  ): Promise<UnderstoodHarnessSourceEvidence[]>
}

export type HarnessCandidateHandoffResult =
  | {
      status: 'disabled'
      candidateId: null
      candidatePath: null
      checkedAxioms: 0
      detail: string
    }
  | {
      status: 'no_candidate'
      candidateId: null
      candidatePath: null
      checkedAxioms: number
      detail: string
    }
  | {
      status: 'delivered' | 'already_present'
      candidateId: string
      candidatePath: string
      checkedAxioms: number
      detail: string
    }

export interface HarnessCandidateInboxResolutionOptions {
  configuredPath?: string
  homeDirectory?: string
  platformName?: NodeJS.Platform
}

export function createSupabaseHarnessCandidateSource(
  supabase: SupabaseClient
): UnderstoodHarnessCandidateSource {
  return {
    async readAxioms(userId) {
      const { data, error } = await supabase
        .from('ontology_axioms')
        .select(AXIOM_SELECT)
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .returns<AxiomRow[]>()

      if (error) {
        throw new Error(`Understood axiom read failed: ${error.message}`)
      }

      return (data ?? []).map(mapAxiom)
    },

    async readEvidence(userId, evidenceIds) {
      const ids = [...new Set(evidenceIds.filter(Boolean))].sort()
      if (ids.length === 0) return []

      const rows: EntryRow[] = []
      for (let index = 0; index < ids.length; index += 100) {
        const chunk = ids.slice(index, index + 100)
        const { data, error } = await supabase
          .from('entries')
          .select('id,content,created_at,life_domains')
          .eq('user_id', userId)
          .in('id', chunk)
          .order('id', { ascending: true })
          .returns<EntryRow[]>()

        if (error) {
          throw new Error(`Understood evidence read failed: ${error.message}`)
        }
        rows.push(...(data ?? []))
      }

      return rows.map(mapEvidence)
    },
  }
}

export async function resolveHarnessCandidateInbox(
  options: HarnessCandidateInboxResolutionOptions = {}
): Promise<string | null> {
  const configuredPath = options.configuredPath ?? process.env.HARNESS_CANDIDATE_INBOX
  if (configuredPath?.trim()) {
    return validateReviewOnlyInboxPath(configuredPath.trim())
  }

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

  return validateReviewOnlyInboxPath(
    join(homeDirectory, UNDERSTOOD_HARNESS_INBOX_RELATIVE_PATH)
  )
}

export async function handoffCurrentUserHarnessCandidate(input: {
  source: UnderstoodHarnessCandidateSource
  userId: string
  inboxDirectory?: string | null
}): Promise<HarnessCandidateHandoffResult> {
  const inboxDirectory = input.inboxDirectory === undefined
    ? await resolveHarnessCandidateInbox()
    : input.inboxDirectory

  if (!inboxDirectory) {
    return {
      status: 'disabled',
      candidateId: null,
      candidatePath: null,
      checkedAxioms: 0,
      detail: 'Harness candidate inbox is unavailable on this server; nothing was written.',
    }
  }

  const resolvedInbox = validateReviewOnlyInboxPath(inboxDirectory)
  const axioms = await input.source.readAxioms(input.userId)
  const evidenceIds = axioms
    .filter((axiom) => (
      axiom.status === 'confirmed' &&
      axiom.scope === 'personal' &&
      axiom.userId === input.userId
    ))
    .flatMap((axiom) => axiom.evidenceEntryIds)
  const evidence = await input.source.readEvidence(input.userId, evidenceIds)
  const result = exportAtMostOneHarnessCandidate(axioms, evidence)

  return handoffHarnessCandidateExport(result, resolvedInbox, axioms.length)
}

export async function handoffHarnessCandidateExport(
  result: HarnessCandidateExportResult,
  inboxDirectory: string,
  checkedAxioms = result.diagnostics.length
): Promise<HarnessCandidateHandoffResult> {
  if (!result.candidate) {
    return {
      status: 'no_candidate',
      candidateId: null,
      candidatePath: null,
      checkedAxioms,
      detail: `Checked ${checkedAxioms} owned axioms; no eligible confirmed personal candidate exists.`,
    }
  }

  const delivery = await writeHarnessCandidateToInbox(result.candidate, inboxDirectory)
  return {
    ...delivery,
    checkedAxioms,
    detail: delivery.status === 'delivered'
      ? 'One pending candidate was delivered to the Harness review inbox.'
      : 'The same pending candidate is already in the Harness review inbox.',
  }
}

export async function writeHarnessCandidateToInbox(
  candidate: HarnessPendingCandidate,
  inboxDirectory: string
): Promise<Pick<
  Extract<HarnessCandidateHandoffResult, { status: 'delivered' | 'already_present' }>,
  'status' | 'candidateId' | 'candidatePath'
>> {
  assertPendingCandidate(candidate)
  const resolvedInbox = validateReviewOnlyInboxPath(inboxDirectory)
  await mkdir(resolvedInbox, { recursive: true, mode: 0o700 })

  const candidatePath = join(resolvedInbox, `${candidate.id}.json`)
  const payload = `${JSON.stringify(candidate, null, 2)}\n`
  const existing = await readCandidateIfPresent(candidatePath)
  if (existing) {
    if (!sameCandidate(existing, candidate)) {
      throw new Error(`Harness inbox already contains conflicting candidate ${candidate.id}`)
    }
    return { status: 'already_present', candidateId: candidate.id, candidatePath }
  }

  const temporaryPath = join(resolvedInbox, `.${candidate.id}.${randomUUID()}.tmp`)
  const handle = await open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(payload, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await link(temporaryPath, candidatePath)
  } catch (error) {
    if (!isErrno(error, 'EEXIST')) throw error
    const racedCandidate = await readCandidateIfPresent(candidatePath)
    if (!racedCandidate || !sameCandidate(racedCandidate, candidate)) {
      throw new Error(`Harness inbox concurrently received conflicting candidate ${candidate.id}`)
    }
    return { status: 'already_present', candidateId: candidate.id, candidatePath }
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }

  return { status: 'delivered', candidateId: candidate.id, candidatePath }
}

function validateReviewOnlyInboxPath(rawPath: string): string {
  if (!isAbsolute(rawPath)) {
    throw new Error('HARNESS_CANDIDATE_INBOX must be an absolute directory path')
  }

  const normalized = normalize(rawPath)
  const pathSegments = normalized
    .split(sep)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
  if (pathSegments.includes('accepted')) {
    throw new Error('HARNESS_CANDIDATE_INBOX cannot target an accepted-authority directory')
  }
  return normalized
}

async function readCandidateIfPresent(candidatePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(candidatePath, 'utf8')) as unknown
  } catch (error) {
    if (isErrno(error, 'ENOENT')) return null
    if (error instanceof SyntaxError) {
      throw new Error(`Harness inbox candidate is not valid JSON: ${candidatePath}`)
    }
    throw error
  }
}

function sameCandidate(existing: unknown, candidate: HarnessPendingCandidate): boolean {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return false
  const record = existing as Record<string, unknown>
  return (
    record.id === candidate.id &&
    record.status === candidate.status &&
    record.plain === candidate.plain &&
    record.evidence === candidate.evidence &&
    record.source === candidate.source &&
    record.domain_a === candidate.domain_a &&
    record.domain_b === candidate.domain_b &&
    record.connection_type === candidate.connection_type &&
    record.strength === candidate.strength &&
    Object.keys(record).every((key) => [
      'id',
      'status',
      'plain',
      'evidence',
      'source',
      'domain_a',
      'domain_b',
      'connection_type',
      'strength',
    ].includes(key))
  )
}

function assertPendingCandidate(candidate: HarnessPendingCandidate): void {
  if (!/^cand-[a-z0-9][a-z0-9-]*$/.test(candidate.id)) {
    throw new Error('Harness candidate id is not safe for an inbox filename')
  }
  if (candidate.status !== 'pending') {
    throw new Error('Understood may hand off only pending Harness candidates')
  }
  if (!candidate.plain.startsWith('AGENT PROPOSAL:')) {
    throw new Error('Harness candidate is missing the review-only proposal prefix')
  }
}

function mapAxiom(row: AxiomRow): UnderstoodHarnessAxiom {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    antecedent: row.antecedent,
    consequent: row.consequent,
    confidence: Number(row.confidence),
    status: row.status,
    scope: row.scope,
    relationshipType: row.relationship_type,
    evidenceEntryIds: row.evidence_entry_ids ?? [],
    evidenceCount: row.evidence_count,
    provenance: row.provenance ?? {},
    confirmedAt: row.confirmed_at,
  }
}

function mapEvidence(row: EntryRow): UnderstoodHarnessSourceEvidence {
  return {
    id: row.id,
    content: row.content ?? '',
    createdAt: row.created_at,
    lifeDomains: row.life_domains ?? [],
  }
}

function isErrno(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code
}
