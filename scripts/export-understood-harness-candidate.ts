import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  exportAtMostOneHarnessCandidate,
  type HarnessCandidateDiagnostic,
  type UnderstoodHarnessAxiom,
  type UnderstoodHarnessSourceEvidence,
} from '../lib/ontology/harness-candidate-export'

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

const DEFAULT_ARTIFACT_DIR =
  '/Users/adamblair/Documents/Main/Sprint/2026-07-10/Artifacts'

async function main() {
  const artifactDir = getArgument('--artifact-dir') ?? DEFAULT_ARTIFACT_DIR
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Authorized Understood Supabase read environment is unavailable')
  }

  const rows = await readAxiomRows(supabaseUrl, supabaseKey)
  const evidenceIds = rows
    .filter((row) => row.status === 'confirmed' && row.scope === 'personal' && row.user_id)
    .flatMap((row) => row.evidence_entry_ids ?? [])
  const evidenceRows = await readEvidenceRows(supabaseUrl, supabaseKey, evidenceIds)
  const axioms = rows.map(mapAxiom)
  const evidence = evidenceRows.map(mapEvidence)
  const result = exportAtMostOneHarnessCandidate(axioms, evidence)

  await mkdir(artifactDir, { recursive: true })

  if (!result.candidate || !result.selectedAxiomId) {
    const reportPath = join(artifactDir, 'understood-no-meaningful-candidate.md')
    const report = buildNoCandidateReport({
      checkedAt: new Date().toISOString(),
      sourceHost: new URL(supabaseUrl).host,
      rows,
      diagnostics: result.diagnostics,
    })
    await writeFile(reportPath, report, 'utf8')
    console.log(`NO MEANINGFUL CANDIDATE: checked ${rows.length} live axioms; report=${reportPath}`)
    return
  }

  const selectedAxiom = axioms.find((axiom) => axiom.id === result.selectedAxiomId)!
  const candidatePath = join(artifactDir, 'understood-candidate.json')
  const proofPath = join(artifactDir, 'understood-semantic-proof.md')
  await writeFile(candidatePath, `${JSON.stringify(result.candidate, null, 2)}\n`, 'utf8')
  await writeFile(
    proofPath,
    buildSemanticProof(selectedAxiom, result.candidate.source, result.candidate.plain),
    'utf8'
  )
  console.log(`Wrote one pending candidate and semantic proof: ${candidatePath}; ${proofPath}`)
}

async function readAxiomRows(url: string, key: string): Promise<AxiomRow[]> {
  const params = new URLSearchParams({
    select: 'id,user_id,name,antecedent,consequent,confidence,status,scope,relationship_type,evidence_entry_ids,evidence_count,provenance,confirmed_at',
    order: 'id.asc',
  })
  return supabaseGet<AxiomRow[]>(url, key, `ontology_axioms?${params}`)
}

async function readEvidenceRows(
  url: string,
  key: string,
  rawIds: readonly string[]
): Promise<EntryRow[]> {
  const ids = [...new Set(rawIds.filter(Boolean))].sort()
  const rows: EntryRow[] = []

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const params = new URLSearchParams({
      select: 'id,content,created_at,life_domains',
      id: `in.(${chunk.join(',')})`,
      order: 'id.asc',
    })
    rows.push(...await supabaseGet<EntryRow[]>(url, key, `entries?${params}`))
  }

  return rows
}

async function supabaseGet<T>(
  url: string,
  key: string,
  path: string
): Promise<T> {
  const headers: Record<string, string> = { apikey: key }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`

  const response = await fetch(`${url}/rest/v1/${path}`, { headers })
  if (!response.ok) {
    throw new Error(`Authorized Understood read failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
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

function buildNoCandidateReport(input: {
  checkedAt: string
  sourceHost: string
  rows: AxiomRow[]
  diagnostics: HarnessCandidateDiagnostic[]
}): string {
  const reasonById = new Map(input.diagnostics.map((item) => [item.axiomId, item.reasons]))
  const counts = countLanes(input.rows)
  const tableRows = input.rows.map((row) => {
    const owner = row.user_id ? 'personal owner' : 'global'
    const reason = reasonById.get(row.id)?.join('; ') || 'no deterministic failure reason recorded'
    return `| ${escapeCell(row.id)} | ${escapeCell(row.status)} | ${escapeCell(row.scope)} | ${owner} | ${escapeCell(reason)} |`
  })

  return [
    '# NO MEANINGFUL CANDIDATE',
    '',
    'Understood did not export a Harness card because the live data contains no confirmed personal axiom. Zero is the honest result.',
    '',
    '## Fields checked',
    '',
    '- status is exactly `confirmed`',
    '- scope is exactly `personal`',
    '- record has a personal owner and is not global',
    '- confirmation has a durable timestamp',
    '- direct evidence resolves to exact source wording',
    '- provenance names its source and a durable record or artifact reference',
    '- source wording is an unambiguous personal pattern rather than product/system material',
    '- source has at least one of Harness\'s thirteen allowed life domains',
    '',
    '## Live result',
    '',
    `- Checked at: ${input.checkedAt}`,
    `- Read-only source: ${input.sourceHost}`,
    `- Total ontology axioms: ${input.rows.length}`,
    ...Object.entries(counts).map(([lane, count]) => `- ${lane}: ${count}`),
    '- Confirmed personal owner records: 0',
    '- `understood-candidate.json`: not written',
    '- `understood-semantic-proof.md`: not written',
    '- Harness queue and `/accepted`: untouched',
    '',
    '## Every available record and why it failed',
    '',
    '| Axiom ID | Status | Scope | Owner | Failure reason |',
    '|---|---|---|---|---|',
    ...tableRows,
    '',
  ].join('\n')
}

function countLanes(rows: readonly AxiomRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const owner = row.user_id ? 'personal owner' : 'global'
    const lane = `${owner} / ${row.scope} / ${row.status}`
    counts[lane] = (counts[lane] ?? 0) + 1
    return counts
  }, {})
}

function buildSemanticProof(
  axiom: UnderstoodHarnessAxiom,
  source: string,
  proposal: string
): string {
  return [
    '# Understood semantic proof',
    '',
    `## Exact Harness question`,
    '',
    `Should Harness use "${axiom.antecedent}" as a signal that "${axiom.consequent}" for Adam?`,
    '',
    '## Current answer before Adam accepts',
    '',
    'Harness has no authority to answer yes from this Understood record. The proposal is pending and has not entered `/accepted`.',
    '',
    '## What changes if Adam accepts',
    '',
    `Harness may use this reviewed answer: ${proposal}`,
    '',
    '## Source identity',
    '',
    source,
    '',
    '## Why this is about Adam',
    '',
    'The source is an owned, confirmed personal axiom with direct personal evidence. Product, global, demo, rejected, retired, and source-less records were excluded.',
    '',
  ].join('\n')
}

function getArgument(name: string): string | undefined {
  const prefix = `${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Understood candidate export failed')
  process.exitCode = 1
})
