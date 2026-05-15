'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  createCandidateAxiomsFromSplitClaims,
  keepSplitClaimAsNote,
  updateOntologyAxiomStatus,
} from '@/app/actions/ontology'
import { evaluateAxiomRetirementReadiness, type AxiomRetirementReadiness } from '@/lib/ontology/axiom-review'
import { splitEntryIntoClaims, type ClaimSplitResult } from '@/lib/ontology/claim-splitting'
import { summarizeAxiomEvidence, type AxiomEvidenceSummary } from '@/lib/ontology/evidence'
import { buildOntologySemanticReport } from '@/lib/ontology/semantic-report'
import { getProvenanceSourceDescriptor, normalizeProvenanceSource, type ProvenanceSourceDescriptor } from '@/lib/ontology/provenance'
import { buildOntologyReviewQueue, getAxiomProvenanceLabel } from '@/lib/ontology/review-queue'
import {
  getProvisionalOntologyCoverage,
  PROVISIONAL_ONTOLOGY_RULES,
  PROVISIONAL_ONTOLOGY_VERSION,
  type ProvisionalOntologyRule,
} from '@/lib/ontology/provisional-complete'
import {
  parseLifeDomains,
  LIFE_DOMAINS,
  parseOntologyAxiomScope,
  parseOntologyAxiomStatus,
  type InferredInsight,
  type LifeDomain,
  type OntologyAxiom,
  type OntologyAxiomStatus,
  type OntologyRelationshipType,
} from '@/types/ontology'
import { OntologyConnectionsIntakeSection } from '@/components/ontology-connections-intake-section'

type AxiomRow = {
  id: string
  name: string
  description: string | null
  antecedent: string
  consequent: string
  confidence: number | string
  status?: string | null
  scope?: string | null
  relationship_type?: string | null
  provenance?: Record<string, unknown> | null
  evidence_entry_ids?: string[] | null
  evidence_count?: number | null
  sources: string[] | null
  created_at: string
  confirmed_at?: string | null
  rejected_at?: string | null
  retired_at?: string | null
}

type InsightRow = {
  id: string
  insight_text: string
  related_axioms: string[] | null
  confidence: number | string | null
  created_at: string
  week_start: string
}

type EntryRow = {
  id: string
  headline: string
  content: string
  entry_type?: string | null
  life_domains?: unknown
  created_at: string
}

interface SplitReviewEntry {
  id: string
  headline: string
  entryType: string
  createdAt: Date
  rawText: string
  domains: LifeDomain[]
  split: ClaimSplitResult
}

type ClaimDecision = 'unreviewed' | 'keep_note' | 'candidate_review' | 'ignore'
type LowSignalDecision = 'normal' | 'low_signal'

const SPLIT_CLAIM_TRIAGE_STORAGE_KEY = 'understood.splitClaimReview.v1'

interface SplitClaimTriageState {
  decisions: Record<string, ClaimDecision>
  texts: Record<string, string>
  lowSignal: Record<string, LowSignalDecision>
}

function loadSplitClaimTriageState(): SplitClaimTriageState {
  if (typeof window === 'undefined') {
    return { decisions: {}, texts: {}, lowSignal: {} }
  }

  try {
    const raw = window.localStorage.getItem(SPLIT_CLAIM_TRIAGE_STORAGE_KEY)
    if (!raw) return { decisions: {}, texts: {}, lowSignal: {} }
    const parsed = JSON.parse(raw) as Partial<SplitClaimTriageState>
    return {
      decisions: parsed.decisions ?? {},
      texts: parsed.texts ?? {},
      lowSignal: parsed.lowSignal ?? {},
    }
  } catch {
    return { decisions: {}, texts: {}, lowSignal: {} }
  }
}

function saveSplitClaimTriageState(state: SplitClaimTriageState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SPLIT_CLAIM_TRIAGE_STORAGE_KEY, JSON.stringify(state))
}

function mapAxiom(row: AxiomRow): OntologyAxiom {
  const c = typeof row.confidence === 'number' ? row.confidence : Number(row.confidence)
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    antecedent: row.antecedent,
    consequent: row.consequent,
    confidence: Number.isFinite(c) ? c : 0,
    sources: row.sources ?? [],
    status: parseOntologyAxiomStatus(row.status),
    scope: parseOntologyAxiomScope(row.scope),
    relationshipType: (row.relationship_type ?? 'predicts') as OntologyRelationshipType,
    provenance: row.provenance ?? {},
    evidenceEntryIds: row.evidence_entry_ids ?? [],
    evidenceCount: row.evidence_count ?? 0,
    createdAt: new Date(row.created_at),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
    retiredAt: row.retired_at ? new Date(row.retired_at) : null,
  }
}

function mapInsight(row: InsightRow): InferredInsight {
  const c = row.confidence == null ? 0 : typeof row.confidence === 'number' ? row.confidence : Number(row.confidence)
  return {
    id: row.id,
    weekStart: new Date(row.week_start),
    insightText: row.insight_text,
    relatedAxioms: (row.related_axioms ?? []).map(String),
    confidence: Number.isFinite(c) ? c : 0,
  }
}

export default function OntologyPage() {
  const router = useRouter()
  const [axioms, setAxioms] = useState<OntologyAxiom[]>([])
  const [insights, setInsights] = useState<InferredInsight[]>([])
  const [splitEntries, setSplitEntries] = useState<SplitReviewEntry[]>([])
  const [claimDecisions, setClaimDecisions] = useState<Record<string, ClaimDecision>>({})
  const [claimTexts, setClaimTexts] = useState<Record<string, string>>({})
  const [lowSignalClaims, setLowSignalClaims] = useState<Record<string, LowSignalDecision>>({})
  const [splitTriageLoaded, setSplitTriageLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [skippedRuleIds, setSkippedRuleIds] = useState<Set<string>>(new Set())
  const [skippedSplitKeys, setSkippedSplitKeys] = useState<Set<string>>(new Set())
  const [todayBatch, setTodayBatch] = useState<string[] | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [batchVersion, setBatchVersion] = useState(0)
  const [isCreatingRuleCandidates, setIsCreatingRuleCandidates] = useState(false)
  const [isReviewing, startReviewTransition] = useTransition()
  const reviewQueue = buildOntologyReviewQueue(axioms)
  const semanticReport = useMemo(() => buildOntologySemanticReport(axioms, {
    appVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'local',
  }), [axioms])
  const provisionalCoverage = useMemo(() => getProvisionalOntologyCoverage(), [])
  const trustedAxiomCount = semanticReport.exportedAxiomCount
  const draftClaimCount = useMemo(() => {
    return splitEntries.reduce((total, entry) => total + entry.split.claims.length, 0)
  }, [splitEntries])
  const markedDraftCount = useMemo(() => {
    return Object.values(claimDecisions).filter((decision) => decision === 'candidate_review').length
  }, [claimDecisions])
  const ontologyStatus = buildOntologyStatusCopy({
    trustedAxiomCount,
    pendingCandidateCount: reviewQueue.pendingCount,
    draftClaimCount,
    markedDraftCount,
    semanticValid: semanticReport.validation.valid,
    provisionalRuleCount: PROVISIONAL_ONTOLOGY_RULES.length,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: axiomData, error: axiomErr } = await supabase
          .from('ontology_axioms')
          .select('id, name, description, antecedent, consequent, confidence, status, scope, relationship_type, provenance, evidence_entry_ids, evidence_count, sources, created_at, confirmed_at, rejected_at, retired_at')
          .order('confidence', { ascending: false })

        const { data: insightData, error: insightErr } = await supabase
          .from('inferred_insights')
          .select('id, insight_text, related_axioms, confidence, created_at, week_start')
          .order('created_at', { ascending: false })
          .limit(10)

        const { data: entryData, error: entryErr } = await supabase
          .from('entries')
          .select('id, headline, content, entry_type, life_domains, created_at')
          .order('created_at', { ascending: false })
          .limit(30)

        if (cancelled) return

        if (axiomErr) {
          setError(axiomErr.message)
          setAxioms([])
        } else {
          setAxioms((axiomData as AxiomRow[] | null)?.map(mapAxiom) ?? [])
        }

        if (insightErr && !axiomErr) {
          setError(insightErr.message)
        }
        if (!insightErr) {
          setInsights((insightData as InsightRow[] | null)?.map(mapInsight) ?? [])
        }
        if (entryErr && !axiomErr && !insightErr) {
          setError(entryErr.message)
        }
        if (!entryErr) {
          setSplitEntries((entryData as EntryRow[] | null)?.map(mapSplitReviewEntry).filter((entry) => entry.split.classification === 'multiple_claims') ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load ontology')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const saved = loadSplitClaimTriageState()
    setClaimDecisions(saved.decisions)
    setClaimTexts(saved.texts)
    setLowSignalClaims(saved.lowSignal)
    setSplitTriageLoaded(true)
  }, [])

  useEffect(() => {
    if (!splitTriageLoaded) return
    saveSplitClaimTriageState({
      decisions: claimDecisions,
      texts: claimTexts,
      lowSignal: lowSignalClaims,
    })
  }, [claimDecisions, claimTexts, lowSignalClaims, splitTriageLoaded])

  function handleReviewAxiom(axiomId: string, status: OntologyAxiomStatus) {
    setReviewError(null)
    startReviewTransition(async () => {
      const result = await updateOntologyAxiomStatus(axiomId, status)
      if (result.error) {
        setReviewError(result.error)
        return
      }

      setAxioms((current) =>
        current.map((axiom) =>
          axiom.id === axiomId
            ? {
                ...axiom,
                status,
                confirmedAt: status === 'confirmed' ? new Date() : null,
                rejectedAt: status === 'rejected' ? new Date() : null,
                retiredAt: status === 'retired' ? new Date() : null,
              }
            : axiom
        )
      )
    })
  }

  function handleClaimDecision(entryId: string, claimIndex: number, decision: ClaimDecision) {
    const key = claimDecisionKey(entryId, claimIndex)
    setClaimDecisions((current) => ({
      ...current,
      [key]: decision,
    }))
    if (decision === 'candidate_review') {
      setLowSignalClaims((current) => ({
        ...current,
        [key]: 'normal',
      }))
    }
  }

  function handleClaimTextChange(entryId: string, claimIndex: number, value: string) {
    setClaimTexts((current) => ({
      ...current,
      [claimDecisionKey(entryId, claimIndex)]: value,
    }))
  }

  function handleLowSignalToggle(entryId: string, claimIndex: number) {
    setLowSignalClaims((current) => {
      const key = claimDecisionKey(entryId, claimIndex)
      const nextValue = current[key] === 'low_signal' ? 'normal' : 'low_signal'
      if (nextValue === 'low_signal') {
        setClaimDecisions((claimDecisionState) => ({
          ...claimDecisionState,
          [key]: claimDecisionState[key] === 'candidate_review' ? 'unreviewed' : claimDecisionState[key] ?? 'unreviewed',
        }))
      }
      return {
        ...current,
        [key]: nextValue,
      }
    })
  }

  const pendingRules = reviewQueue.pendingCandidates.filter((axiom) => !skippedRuleIds.has(axiom.id))
  const pendingSplits: { entry: SplitReviewEntry; claimIndex: number }[] = []
  for (const entry of splitEntries) {
    for (let i = 0; i < entry.split.claims.length; i++) {
      const key = claimDecisionKey(entry.id, i)
      const decision = claimDecisions[key] ?? 'unreviewed'
      const lowSignal = lowSignalClaims[key] ?? 'normal'
      if (decision === 'unreviewed' && lowSignal === 'normal' && !skippedSplitKeys.has(key)) {
        pendingSplits.push({ entry, claimIndex: i })
      }
    }
  }
  const totalPendingAll = pendingRules.length + pendingSplits.length

  const lifetimeAnsweredRules = axioms.filter(
    (a) => a.status === 'confirmed' || a.status === 'rejected' || a.status === 'retired'
  ).length
  const lifetimeAnsweredSplitKeys = new Set<string>()
  for (const [k, d] of Object.entries(claimDecisions)) {
    if (d !== 'unreviewed') lifetimeAnsweredSplitKeys.add(k)
  }
  for (const [k, d] of Object.entries(lowSignalClaims)) {
    if (d === 'low_signal') lifetimeAnsweredSplitKeys.add(k)
  }
  const lifetimeAnswered = lifetimeAnsweredRules + lifetimeAnsweredSplitKeys.size

  const BATCH_SIZE = 10

  useEffect(() => {
    if (loading) return
    if (todayBatch !== null) return
    const ids: string[] = []
    for (const axiom of pendingRules) ids.push(`rule:${axiom.id}`)
    for (const p of pendingSplits) ids.push(`split:${p.entry.id}:${p.claimIndex}`)
    if (ids.length > 0) setTodayBatch(ids.slice(0, BATCH_SIZE))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, batchVersion])

  const batchSet = useMemo(() => new Set(todayBatch ?? []), [todayBatch])
  const visibleRules = pendingRules.filter((a) => batchSet.has(`rule:${a.id}`))
  const visibleSplits = pendingSplits.filter((p) => batchSet.has(`split:${p.entry.id}:${p.claimIndex}`))
  const visibleCount = visibleRules.length + visibleSplits.length
  const batchSize = todayBatch?.length ?? 0
  const answeredInBatch = Math.max(0, batchSize - visibleCount)
  const batchDone = todayBatch !== null && batchSize > 0 && visibleCount === 0
  const remainingAfterBatch = Math.max(0, totalPendingAll - visibleCount)

  function showSaved(text: string) {
    setSavedMessage(text)
    window.setTimeout(() => {
      setSavedMessage((current) => (current === text ? null : current))
    }, 2200)
  }

  function handleRuleAnswer(axiom: OntologyAxiom, answer: RuleAnswer) {
    if (answer === 'yes') {
      handleReviewAxiom(axiom.id, 'confirmed')
      showSaved(`Saved ✓ Kept rule: "${axiom.name}"`)
    } else if (answer === 'no') {
      handleReviewAxiom(axiom.id, 'rejected')
      showSaved(`Saved ✓ Dropped rule: "${axiom.name}"`)
    } else {
      setSkippedRuleIds((current) => {
        const next = new Set(current)
        next.add(axiom.id)
        return next
      })
      showSaved('Saved ✓ Set aside for now.')
    }
  }

  async function handleSplitAnswer(entry: SplitReviewEntry, claimIndex: number, answer: SplitAnswer) {
    const entryId = entry.id
    if (answer === 'rule') {
      handleClaimDecision(entryId, claimIndex, 'candidate_review')
      showSaved('Saved ✓ Marked as a rule.')
    } else if (answer === 'note') {
      setReviewError(null)
      const claimText = claimTexts[claimDecisionKey(entryId, claimIndex)] ?? entry.split.claims[claimIndex]?.claimText ?? ''
      const result = await keepSplitClaimAsNote({
        sourceEntryId: entryId,
        claimText,
      })
      if (result.error) {
        setReviewError(result.error)
        showSaved('Could not save note.')
        return
      }
      handleClaimDecision(entryId, claimIndex, 'keep_note')
      showSaved(result.duplicate ? 'Saved ✓ Note already exists.' : 'Saved ✓ Kept as a note.')
    } else if (answer === 'drop') {
      handleClaimDecision(entryId, claimIndex, 'ignore')
      showSaved('Saved ✓ Dropped.')
    } else if (answer === 'short') {
      const key = claimDecisionKey(entryId, claimIndex)
      const isLowSignal = (lowSignalClaims[key] ?? 'normal') === 'low_signal'
      if (!isLowSignal) {
        handleLowSignalToggle(entryId, claimIndex)
      }
      showSaved('Saved ✓ Marked too short.')
    } else {
      const key = claimDecisionKey(entryId, claimIndex)
      setSkippedSplitKeys((current) => {
        const next = new Set(current)
        next.add(key)
        return next
      })
      showSaved('Saved ✓ Set aside for now.')
    }
  }

  async function handleCreateRuleCandidates() {
    setReviewError(null)
    setIsCreatingRuleCandidates(true)
    try {
      const markedClaims = await collectMarkedRuleClaims()
      if (markedClaims.length === 0) {
        showSaved('No marked rules found.')
        return
      }

      const result = await createCandidateAxiomsFromSplitClaims(markedClaims)
      if (result.error) {
        setReviewError(result.error)
        showSaved('Could not create rule candidates.')
        return
      }

      if (result.data?.length) {
        setAxioms((current) => [
          ...(result.data as AxiomRow[]).map(mapAxiom),
          ...current,
        ])
      }

      setTodayBatch(null)
      setBatchVersion((v) => v + 1)
      showSaved(`Created ${result.created ?? 0} rule candidates. ${result.skipped ?? 0} skipped.`)
    } finally {
      setIsCreatingRuleCandidates(false)
    }
  }

  async function collectMarkedRuleClaims() {
    const marked = Object.entries(claimDecisions)
      .filter(([, decision]) => decision === 'candidate_review')
      .map(([key]) => {
        const [entryId, rawClaimIndex] = key.split(':')
        return {
          key,
          entryId,
          claimIndex: Number(rawClaimIndex),
        }
      })
      .filter((item) => item.entryId && Number.isInteger(item.claimIndex))

    const entryById = new Map(splitEntries.map((entry) => [entry.id, entry]))
    const missingEntryIds = [...new Set(marked.map((item) => item.entryId).filter((entryId) => !entryById.has(entryId)))]

    if (missingEntryIds.length > 0) {
      const { data, error: fetchError } = await supabase
        .from('entries')
        .select('id, headline, content, entry_type, life_domains, created_at')
        .in('id', missingEntryIds)

      if (fetchError) {
        setReviewError(fetchError.message)
      } else {
        for (const row of ((data as EntryRow[] | null) ?? [])) {
          const entry = mapSplitReviewEntry(row)
          if (entry.split.claims.length > 0) {
            entryById.set(entry.id, entry)
          }
        }
      }
    }

    return marked.flatMap((item) => {
      const entry = entryById.get(item.entryId)
      const claim = entry?.split.claims[item.claimIndex]
      if (!entry || !claim) return []
      return [{
        sourceEntryId: entry.id,
        claimText: claimTexts[item.key] ?? claim.claimText,
        suggestedDomains: claim.suggestedDomains,
      }]
    })
  }

  function startNextBatch() {
    setTodayBatch(null)
    setBatchVersion((v) => v + 1)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        padding: '2rem',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '1.5rem',
          }}
        >
          ← Back
        </button>

        {loading && <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>}

        {error && (
          <p style={{ color: '#f87171', marginBottom: '1.5rem' }}>
            {error}
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              First-time setup needs <code style={{ color: 'rgba(255,255,255,0.6)' }}>database-migrations-ontology.sql</code> in Supabase.
            </span>
          </p>
        )}

        {reviewError && (
          <p style={{ color: '#f87171', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{reviewError}</p>
        )}

        {!loading && batchSize > 0 && (
          <ProgressStrip
            answered={answeredInBatch}
            batchSize={batchSize}
            lifetimeAnswered={lifetimeAnswered}
            remainingAfterBatch={remainingAfterBatch}
          />
        )}

        {!loading && savedMessage && <SavedToast text={savedMessage} />}

        {!loading && markedDraftCount > 0 && (
          <div
            style={{
              border: '1px solid rgba(134,239,172,0.24)',
              background: 'rgba(34,197,94,0.08)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <p style={{ margin: '0 0 0.35rem', color: '#bbf7d0', fontSize: '1rem', fontWeight: 700 }}>
              {markedDraftCount} marked for rule creation
            </p>
            <p style={{ margin: '0 0 0.85rem', color: 'rgba(255,255,255,0.58)', fontSize: '0.84rem', lineHeight: 1.45 }}>
              This turns your “Make it a rule” answers into candidate rules. They still need review before they can govern AI answers.
            </p>
            <button
              type="button"
              onClick={handleCreateRuleCandidates}
              disabled={isCreatingRuleCandidates}
              style={{
                border: '1px solid rgba(134,239,172,0.5)',
                background: isCreatingRuleCandidates ? 'rgba(255,255,255,0.05)' : 'rgba(134,239,172,0.16)',
                color: isCreatingRuleCandidates ? 'rgba(255,255,255,0.45)' : '#bbf7d0',
                borderRadius: '999px',
                padding: '0.55rem 0.85rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: isCreatingRuleCandidates ? 'not-allowed' : 'pointer',
              }}
            >
              {isCreatingRuleCandidates ? 'Creating...' : 'Create rule candidates'}
            </button>
          </div>
        )}

        {!loading && totalPendingAll === 0 && lifetimeAnswered === 0 && (
          <CaughtUpPanel headline="Nothing to answer yet." sub="Write a few entries first, then come back." />
        )}

        {!loading && totalPendingAll === 0 && lifetimeAnswered > 0 && (
          <CaughtUpPanel
            headline={`You've answered ${lifetimeAnswered}. The AI knows you better.`}
            sub="No questions left right now."
          />
        )}

        {!loading && !batchDone && visibleRules.map((axiom, i) => (
          <RuleGuessCard
            key={axiom.id}
            axiom={axiom}
            step={answeredInBatch + i + 1}
            total={batchSize}
            disabled={isReviewing}
            onAnswer={(answer) => handleRuleAnswer(axiom, answer)}
          />
        ))}

        {!loading && !batchDone && visibleSplits.map(({ entry, claimIndex }, i) => {
          const claim = entry.split.claims[claimIndex]
          return (
            <SplitPieceCard
              key={`${entry.id}-${claimIndex}`}
              entry={entry}
              claim={claim}
              step={answeredInBatch + visibleRules.length + i + 1}
              total={batchSize}
              onAnswer={(answer) => handleSplitAnswer(entry, claimIndex, answer)}
            />
          )
        })}

        {!loading && batchDone && (
          <BatchDonePanel
            batchSize={batchSize}
            lifetimeAnswered={lifetimeAnswered}
            remaining={remainingAfterBatch}
            onNext={startNextBatch}
          />
        )}

      </div>
    </div>
  )
}


function mapSplitReviewEntry(row: EntryRow): SplitReviewEntry {
  const rawText = stripHtml(row.content)
  const domains = parseLifeDomains(row.life_domains)

  return {
    id: row.id,
    headline: row.headline,
    entryType: row.entry_type ?? 'story',
    createdAt: new Date(row.created_at),
    rawText,
    domains,
    split: splitEntryIntoClaims({
      sourceEntryId: row.id,
      rawText,
      suggestedDomains: domains,
    }),
  }
}

function buildOntologyStatusCopy({
  trustedAxiomCount,
  pendingCandidateCount,
  draftClaimCount,
  markedDraftCount,
  semanticValid,
  provisionalRuleCount,
}: {
  trustedAxiomCount: number
  pendingCandidateCount: number
  draftClaimCount: number
  markedDraftCount: number
  semanticValid: boolean
  provisionalRuleCount: number
}) {
  if (!semanticValid) {
    return {
      label: 'Needs attention',
      headline: 'The ontology data needs a semantic check before you trust it.',
      meaning: 'The page loaded, but the export/validation layer found something that should be reviewed.',
      nextStep: 'Fix the semantic check before relying on ontology-guided answers.',
      color: '#fde68a',
      border: 'rgba(253,230,138,0.38)',
      background: 'rgba(253,230,138,0.07)',
    }
  }

  if (trustedAxiomCount > 0) {
    return {
      label: 'Working',
      headline: 'Confirmed rules are available to guide AI answers.',
      meaning: `${trustedAxiomCount} trusted ${trustedAxiomCount === 1 ? 'rule is' : 'rules are'} eligible for prompts, graph export, and semantic checks.`,
      nextStep: pendingCandidateCount > 0
        ? 'Review the candidate rules below.'
        : 'Ask the app a question, then check whether the answer cites the right memory.',
      color: '#86efac',
      border: 'rgba(134,239,172,0.38)',
      background: 'rgba(34,197,94,0.08)',
    }
  }

  if (provisionalRuleCount > 0) {
    return {
      label: 'Testable',
      headline: 'A complete provisional ontology is active for testing.',
      meaning: `${provisionalRuleCount} guessed rules can shape answers as hypotheses. They are not final truth, and confirmed rules will override them.`,
      nextStep: pendingCandidateCount > 0
        ? 'Test the answers, then confirm only the rules that actually hold up.'
        : draftClaimCount > 0
          ? 'Use the draft claims below to find rules worth promoting after testing.'
          : 'Ask the app real questions and look for useful, wrong, or missing assumptions.',
      color: '#93c5fd',
      border: 'rgba(147,197,253,0.38)',
      background: 'rgba(59,130,246,0.08)',
    }
  }

  if (pendingCandidateCount > 0) {
    return {
      label: 'Not governing yet',
      headline: 'Candidate rules exist, but none are trusted yet.',
      meaning: 'AI can show these as review material, but they cannot control answers until you confirm them.',
      nextStep: 'Confirm useful candidates or reject weak ones.',
      color: '#fde68a',
      border: 'rgba(253,230,138,0.38)',
      background: 'rgba(253,230,138,0.07)',
    }
  }

  if (draftClaimCount > 0) {
    return {
      label: 'Draft only',
      headline: 'The ontology has draft claims, but no trusted rules yet.',
      meaning: `${draftClaimCount} draft ${draftClaimCount === 1 ? 'claim has' : 'claims have'} been found. ${markedDraftCount} ${markedDraftCount === 1 ? 'is' : 'are'} marked for candidate review. Drafts are not allowed to govern AI answers.`,
      nextStep: 'Turn one useful draft claim into a candidate rule, then confirm it only if you trust it.',
      color: '#fbbf24',
      border: 'rgba(251,191,36,0.38)',
      background: 'rgba(251,191,36,0.07)',
    }
  }

  return {
    label: 'Empty',
    headline: 'No trusted ontology rules exist yet.',
    meaning: 'Nothing is broken. The app needs reviewed patterns before the ontology can guide answers.',
    nextStep: 'Capture more entries or Connections, then create one candidate rule from a real pattern.',
    color: 'rgba(255,255,255,0.62)',
    border: 'rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.04)',
  }
}

function OntologyStatusStat({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: number | string
  helper: string
  tone: 'good' | 'warn' | 'muted'
}) {
  const color = tone === 'good' ? '#86efac' : tone === 'warn' ? '#fde68a' : 'rgba(255,255,255,0.5)'

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        background: 'rgba(0,0,0,0.16)',
        padding: '0.75rem',
        minHeight: '92px',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ color, margin: '0.35rem 0 0', fontSize: '1.45rem', lineHeight: 1, fontWeight: 700 }}>
        {value}
      </p>
      <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0.45rem 0 0', fontSize: '0.78rem', lineHeight: 1.3 }}>
        {helper}
      </p>
    </div>
  )
}

function ProvisionalRuleRow({ rule }: { rule: ProvisionalOntologyRule }) {
  return (
    <div
      style={{
        border: '1px solid rgba(147,197,253,0.16)',
        borderRadius: '8px',
        background: 'rgba(0,0,0,0.18)',
        padding: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>{rule.name}</h3>
        <span style={{ color: '#93c5fd', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
          {(rule.confidence * 100).toFixed(0)}% provisional
        </span>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.78rem', lineHeight: 1.45, margin: '0.45rem 0 0' }}>
        <strong style={{ color: 'rgba(255,255,255,0.78)' }}>If</strong> {rule.antecedent}. <strong style={{ color: 'rgba(255,255,255,0.78)' }}>Then</strong> {rule.consequent}.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.34)', fontSize: '0.7rem', lineHeight: 1.35, margin: '0.45rem 0 0' }}>
        {rule.domains.join(', ')} · {rule.relationshipType.replace(/_/g, ' ')} · {rule.source.replace(/_/g, ' ')}
      </p>
    </div>
  )
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function claimDecisionKey(entryId: string, claimIndex: number): string {
  return `${entryId}:${claimIndex}`
}

function formatClaimDecision(decision: ClaimDecision, lowSignalDecision: LowSignalDecision): string {
  const base =
    decision === 'unreviewed'
      ? 'Unreviewed'
      : decision === 'keep_note'
        ? 'Keep claim as note'
        : decision === 'candidate_review'
          ? 'Marked for candidate review'
          : 'Ignored claim'

  return lowSignalDecision === 'low_signal' ? `${base} · low-signal` : base
}

function ClaimDecisionButton({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: active ? '1px solid rgba(134,239,172,0.55)' : '1px solid rgba(255,255,255,0.15)',
        background: active ? 'rgba(134,239,172,0.12)' : disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
        color: active ? '#bbf7d0' : disabled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.65)',
        borderRadius: '999px',
        padding: '0.3rem 0.6rem',
        fontSize: '0.72rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function RetirementReadinessNotice({ readiness }: { readiness: AxiomRetirementReadiness }) {
  if (!readiness.shouldReviewForRetirement) return null

  return (
    <div
      style={{
        flexBasis: '100%',
        border: '1px solid rgba(253,230,138,0.35)',
        background: 'rgba(253,230,138,0.08)',
        color: '#fde68a',
        borderRadius: '10px',
        padding: '0.65rem 0.75rem',
        fontSize: '0.76rem',
        lineHeight: 1.45,
      }}
    >
      <strong>Review for retirement:</strong> {readiness.reason}
      <span style={{ display: 'block', color: 'rgba(255,255,255,0.45)', marginTop: '0.25rem' }}>
        Signals: {readiness.signals.map((signal) => signal.replace(/_/g, ' ')).join(', ')}. Status stays confirmed until you retire it.
      </span>
    </div>
  )
}

function EvidenceDirectionSummary({ summary }: { summary: AxiomEvidenceSummary }) {
  if (summary.totalDirectionalEvidence === 0) return null

  return (
    <div
      style={{
        marginTop: '0.85rem',
        display: 'flex',
        gap: '0.45rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <EvidenceBadge label="Supports" count={summary.supports} color="#86efac" />
      <EvidenceBadge label="Weakens" count={summary.weakens} color="#fde68a" />
      <EvidenceBadge label="Contradicts" count={summary.contradicts} color="#fca5a5" />
      {summary.hasContradictions && summary.latestContradiction && (
        <span style={{ color: '#fca5a5', fontSize: '0.74rem', lineHeight: 1.4 }}>
          Latest contradiction: {summary.latestContradiction}
        </span>
      )}
    </div>
  )
}

function ProvenanceSourceBadge({ descriptor }: { descriptor: ProvenanceSourceDescriptor }) {
  const color = provenanceRoleColor(descriptor.reviewRole)

  return (
    <div
      style={{
        marginTop: '0.65rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span
        title={descriptor.description}
        style={{
          border: `1px solid ${color}55`,
          background: `${color}18`,
          color,
          borderRadius: '999px',
          padding: '0.25rem 0.55rem',
          fontSize: '0.72rem',
          whiteSpace: 'nowrap',
        }}
      >
        {descriptor.label}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', lineHeight: 1.35 }}>
        {descriptor.description}
      </span>
    </div>
  )
}

function provenanceRoleColor(role: ProvenanceSourceDescriptor['reviewRole']): string {
  if (role === 'reviewed') return '#86efac'
  if (role === 'ai_generated') return '#fde68a'
  if (role === 'external_data') return '#93c5fd'
  if (role === 'reference_only') return 'rgba(255,255,255,0.5)'
  if (role === 'user_originated') return '#f0abfc'
  if (role === 'derived_from_record') return '#c4b5fd'
  return 'rgba(255,255,255,0.45)'
}

function SemanticStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  tone?: 'neutral' | 'good' | 'warn'
}) {
  const color = tone === 'good' ? '#86efac' : tone === 'warn' ? '#fbbf24' : 'rgba(255,255,255,0.78)'
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '0.8rem',
        background: 'rgba(0,0,0,0.16)',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ color, fontSize: '1.2rem', margin: '0.25rem 0 0', fontWeight: 600 }}>
        {value}
      </p>
    </div>
  )
}

function EvidenceBadge({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <span
      style={{
        border: `1px solid ${color}55`,
        background: `${color}18`,
        color,
        borderRadius: '999px',
        padding: '0.25rem 0.55rem',
        fontSize: '0.72rem',
        whiteSpace: 'nowrap',
      }}
    >
      {label}: {count}
    </span>
  )
}

type RuleAnswer = 'yes' | 'no' | 'skip'
type SplitAnswer = 'rule' | 'note' | 'drop' | 'short' | 'skip'

function pickRuleGuessDefault(axiom: OntologyAxiom): RuleAnswer {
  if (axiom.confidence >= 0.7) return 'yes'
  if (axiom.confidence < 0.4) return 'no'
  return 'skip'
}

function pickSplitPieceDefault(claim: ClaimSplitResult['claims'][number]): SplitAnswer {
  const text = claim.claimText.trim()
  if (text.length < 25) return 'short'
  if (/\b(always|never|usually|tend to|every time|whenever|i always|i never)\b/i.test(text)) return 'rule'
  return 'note'
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  padding: '1.25rem',
  marginBottom: '1.25rem',
}

const stepStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.4)',
  margin: 0,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700,
}

const leadStyle: React.CSSProperties = {
  margin: '0.55rem 0 0.5rem',
  fontSize: '0.92rem',
  color: 'rgba(255,255,255,0.6)',
}

const quoteStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.85rem 1rem',
  background: 'rgba(0,0,0,0.3)',
  borderLeft: '3px solid rgba(147,197,253,0.5)',
  borderRadius: '0 8px 8px 0',
  fontSize: '1rem',
  lineHeight: 1.5,
  color: 'rgba(255,255,255,0.92)',
  fontStyle: 'italic',
}

const ruleBoxStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.85rem 1rem',
  background: 'rgba(0,0,0,0.3)',
  borderLeft: '3px solid rgba(134,239,172,0.5)',
  borderRadius: '0 8px 8px 0',
  fontSize: '0.95rem',
  lineHeight: 1.55,
  color: 'rgba(255,255,255,0.9)',
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  margin: '1rem 0 0.4rem',
  fontSize: '0.78rem',
  color: 'rgba(255,255,255,0.55)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 700,
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '8px',
  padding: '0.7rem 0.8rem',
  fontSize: '0.95rem',
  font: 'inherit',
  cursor: 'pointer',
  outline: 'none',
}

const helpStyle: React.CSSProperties = {
  margin: '0.6rem 0 0',
  fontSize: '0.82rem',
  color: 'rgba(255,255,255,0.55)',
}

const exampleListStyle: React.CSSProperties = {
  margin: '0.8rem 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.8rem',
  color: 'rgba(255,255,255,0.5)',
}

function RuleGuessCard({
  axiom,
  step,
  total,
  disabled,
  onAnswer,
}: {
  axiom: OntologyAxiom
  step: number
  total: number
  disabled: boolean
  onAnswer: (answer: RuleAnswer) => void
}) {
  const [choice, setChoice] = useState<RuleAnswer>(pickRuleGuessDefault(axiom))

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as RuleAnswer
    setChoice(next)
    onAnswer(next)
  }

  return (
    <div style={cardStyle}>
      <p style={stepStyle}>{step} of {total}</p>
      <p style={leadStyle}>We think this rule fits you:</p>
      <div style={ruleBoxStyle}>
        <p style={{ margin: 0 }}>
          <strong style={{ color: '#bbf7d0' }}>When:</strong> {axiom.antecedent}
        </p>
        <p style={{ margin: '0.4rem 0 0' }}>
          <strong style={{ color: '#bbf7d0' }}>Then:</strong> {axiom.consequent}
        </p>
      </div>
      <label style={fieldLabelStyle}>Your answer</label>
      <select value={choice} onChange={handleChange} disabled={disabled} style={selectStyle}>
        <option value="yes">Yes — keep this rule</option>
        <option value="no">No — drop this rule</option>
        <option value="skip">Skip — not sure yet</option>
      </select>
      <p style={helpStyle}>Pick yes if this sounds like you.</p>
      <ul style={exampleListStyle}>
        <li>✓ Yes — sounds like what you do</li>
        <li>✗ No — sounds like the opposite</li>
        <li>○ Skip — you&apos;re not sure</li>
      </ul>
    </div>
  )
}

function SplitPieceCard({
  entry,
  claim,
  step,
  total,
  onAnswer,
}: {
  entry: SplitReviewEntry
  claim: ClaimSplitResult['claims'][number]
  step: number
  total: number
  onAnswer: (answer: SplitAnswer) => void | Promise<void>
}) {
  const [choice, setChoice] = useState<SplitAnswer>(pickSplitPieceDefault(claim))
  const [saving, setSaving] = useState(false)

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as SplitAnswer
    setChoice(next)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onAnswer(choice)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={cardStyle}>
      <p style={stepStyle}>{step} of {total}</p>
      <p style={leadStyle}>We pulled this idea out of something you wrote:</p>
      <p style={quoteStyle}>&ldquo;{claim.claimText}&rdquo;</p>
      <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
        From: {entry.headline}
      </p>
      <label style={fieldLabelStyle}>Your answer</label>
      <select value={choice} onChange={handleChange} style={selectStyle}>
        <option value="rule">Make it a rule</option>
        <option value="note">Keep as a note</option>
        <option value="drop">Drop it</option>
        <option value="short">Too short to use</option>
        <option value="skip">Skip — not sure yet</option>
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: '0.75rem',
          border: '1px solid rgba(134,239,172,0.45)',
          background: saving ? 'rgba(255,255,255,0.05)' : 'rgba(134,239,172,0.14)',
          color: saving ? 'rgba(255,255,255,0.45)' : '#bbf7d0',
          borderRadius: '999px',
          padding: '0.55rem 0.85rem',
          fontSize: '0.82rem',
          fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving...' : 'Save choice'}
      </button>
      <p style={helpStyle}>Pick what fits the idea best.</p>
      <ul style={exampleListStyle}>
        <li>✓ Rule — says what you usually do</li>
        <li>✓ Note — a one-time fact</li>
        <li>✗ Drop — wrong or useless</li>
        <li>○ Short — only a few words</li>
        <li>○ Skip — you&apos;re not sure</li>
      </ul>
    </div>
  )
}

function ProgressStrip({
  answered,
  batchSize,
  lifetimeAnswered,
  remainingAfterBatch,
}: {
  answered: number
  batchSize: number
  lifetimeAnswered: number
  remainingAfterBatch: number
}) {
  const slots = Array.from({ length: batchSize }, (_, i) => i < answered)
  const justFilled = answered > 0 ? answered - 1 : -1

  return (
    <div
      style={{
        background: 'rgba(134,239,172,0.06)',
        border: '1px solid rgba(134,239,172,0.25)',
        borderRadius: '12px',
        padding: '1.1rem 1.25rem',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#bbf7d0' }}>
          {answered} of {batchSize} this round
        </p>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
          {lifetimeAnswered} answered total
        </p>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginTop: '0.85rem', height: '14px' }}>
        {slots.map((filled, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: '4px',
              background: filled ? '#4ade80' : 'rgba(255,255,255,0.08)',
              border: filled ? '1px solid rgba(134,239,172,0.5)' : '1px solid rgba(255,255,255,0.1)',
              transform: i === justFilled ? 'scaleY(1.25)' : 'scaleY(1)',
              transition: 'background 0.3s, transform 0.3s, border-color 0.3s',
            }}
          />
        ))}
      </div>

      <p style={{ margin: '0.85rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)' }}>
        Each answer helps your AI know you better.
      </p>
      {remainingAfterBatch > 0 && (
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
          {remainingAfterBatch} more after this round — no rush.
        </p>
      )}
    </div>
  )
}

function SavedToast({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: '0.5rem',
        zIndex: 50,
        background: 'rgba(34,197,94,0.18)',
        border: '1px solid rgba(134,239,172,0.55)',
        color: '#bbf7d0',
        borderRadius: '999px',
        padding: '0.6rem 1rem',
        fontSize: '0.88rem',
        fontWeight: 600,
        marginBottom: '1rem',
        textAlign: 'center',
        animation: 'savedToastIn 0.25s ease-out',
        boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
      }}
    >
      <style>{`
        @keyframes savedToastIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {text}
    </div>
  )
}

function CaughtUpPanel({ headline, sub }: { headline: string; sub: string }) {
  return (
    <div
      style={{
        border: '1px solid rgba(134,239,172,0.3)',
        background: 'rgba(34,197,94,0.08)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        color: '#86efac',
      }}
    >
      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{headline}</p>
      <p style={{ margin: '0.45rem 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)' }}>{sub}</p>
    </div>
  )
}

function BatchDonePanel({
  batchSize,
  lifetimeAnswered,
  remaining,
  onNext,
}: {
  batchSize: number
  lifetimeAnswered: number
  remaining: number
  onNext: () => void
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(134,239,172,0.18), rgba(59,130,246,0.12))',
        border: '1px solid rgba(134,239,172,0.5)',
        borderRadius: '14px',
        padding: '1.75rem',
        marginBottom: '1.5rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#bbf7d0' }}>
        🎉 {batchSize} done.
      </p>
      <p style={{ margin: '0.75rem 0 0', fontSize: '1rem', color: 'rgba(255,255,255,0.85)' }}>
        Congratulations on taking another step toward an AI that knows you.
      </p>
      <p style={{ margin: '0.85rem 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)' }}>
        Total answered: {lifetimeAnswered}
      </p>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={onNext}
          style={{
            marginTop: '1.25rem',
            background: '#22c55e',
            color: '#052e16',
            border: 'none',
            borderRadius: '999px',
            padding: '0.75rem 1.5rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Show next 10
        </button>
      ) : (
        <p style={{ margin: '1.1rem 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
          You&apos;re completely caught up. Nothing left to answer.
        </p>
      )}
    </div>
  )
}
