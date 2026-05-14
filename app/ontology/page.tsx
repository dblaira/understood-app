'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { updateOntologyAxiomStatus } from '@/app/actions/ontology'
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
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
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
            marginBottom: '2rem',
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
            fontSize: '2.25rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          Ontology status
        </h1>

        <div
          style={{
            marginBottom: '1.75rem',
            border: `1px solid ${ontologyStatus.border}`,
            borderRadius: '12px',
            background: ontologyStatus.background,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: ontologyStatus.color, margin: '0 0 0.4rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {ontologyStatus.label}
              </p>
              <h2 style={{ margin: 0, fontSize: '1.45rem', lineHeight: 1.2, fontWeight: 700 }}>
                {ontologyStatus.headline}
              </h2>
            </div>
            <div
              style={{
                border: `1px solid ${ontologyStatus.border}`,
                borderRadius: '999px',
                color: ontologyStatus.color,
                padding: '0.4rem 0.7rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              AI use: {trustedAxiomCount > 0 ? 'governed' : 'provisional'}
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.95rem', lineHeight: 1.5, margin: '0.85rem 0 0' }}>
            {ontologyStatus.meaning}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: '0.75rem',
              marginTop: '1rem',
            }}
          >
            <OntologyStatusStat label="Trusted rules" value={trustedAxiomCount} helper="Can guide AI" tone={trustedAxiomCount > 0 ? 'good' : 'muted'} />
            <OntologyStatusStat label="Provisional rules" value={PROVISIONAL_ONTOLOGY_RULES.length} helper="Active scaffold" tone="good" />
            <OntologyStatusStat label="Needs review" value={reviewQueue.pendingCount} helper="Candidate rules" tone={reviewQueue.pendingCount > 0 ? 'warn' : 'muted'} />
            <OntologyStatusStat label="Draft claims" value={draftClaimCount} helper="Not trusted yet" tone={draftClaimCount > 0 ? 'warn' : 'muted'} />
            <OntologyStatusStat label="Semantic check" value={semanticReport.validation.valid ? 'Pass' : 'Review'} helper="Export health" tone={semanticReport.validation.valid ? 'good' : 'warn'} />
          </div>

          <div
            style={{
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '0.9rem',
              display: 'grid',
              gap: '0.45rem',
              color: 'rgba(255,255,255,0.62)',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'rgba(255,255,255,0.86)' }}>Next:</strong> {ontologyStatus.nextStep}
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'rgba(255,255,255,0.86)' }}>Rule:</strong> confirmed rules override provisional rules. Draft claims and candidates cannot control answers until you confirm them.
            </p>
          </div>
        </div>

        <section
          style={{
            background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(147,197,253,0.2)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: '#93c5fd', margin: '0 0 0.35rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Complete test scaffold
              </p>
              <h2 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.25, fontWeight: 700 }}>
                The guessed ontology is active now.
              </h2>
            </div>
            <span style={{ color: '#bfdbfe', border: '1px solid rgba(147,197,253,0.3)', borderRadius: '999px', padding: '0.35rem 0.65rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
              {provisionalCoverage.coveredDomains.length}/{LIFE_DOMAINS.length} domains covered
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.68)', margin: '0.75rem 0 0', fontSize: '0.92rem', lineHeight: 1.45 }}>
            This is not the final truth. It is a working set of hypotheses so journal notes, Connections, purchases, health records, and fitness records can shape answers now.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            <OntologyStatusStat label="Prompt status" value="Active" helper="Used as provisional" tone="good" />
            <OntologyStatusStat label="Version" value="v0" helper={PROVISIONAL_ONTOLOGY_VERSION} tone="muted" />
            <OntologyStatusStat label="Missing domains" value={provisionalCoverage.missingDomains.length} helper={provisionalCoverage.missingDomains.length ? provisionalCoverage.missingDomains.join(', ') : 'None'} tone={provisionalCoverage.missingDomains.length ? 'warn' : 'good'} />
          </div>
          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.65rem' }}>
            {PROVISIONAL_ONTOLOGY_RULES.slice(0, 8).map((rule) => (
              <ProvisionalRuleRow key={rule.id} rule={rule} />
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.36)', fontSize: '0.74rem', margin: '0.85rem 0 0', lineHeight: 1.4 }}>
            Done means: this page loads, the scaffold reaches prompts, confirmed rules override it, and weak guesses can be replaced after testing.
          </p>
        </section>

        {loading && <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>}
        {error && (
          <p style={{ color: '#f87171', marginBottom: '1.5rem' }}>
            {error}
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              If this is the first setup, run <code style={{ color: 'rgba(255,255,255,0.6)' }}>database-migrations-ontology.sql</code> in the Supabase SQL editor.
            </span>
          </p>
        )}
        {reviewError && (
          <p style={{ color: '#f87171', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {reviewError}
          </p>
        )}

        {!loading && (
          <>
            <section
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>Candidate review queue</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: 1.45 }}>
                AI can propose growth, but only your confirmed personal axioms govern prompts and the graph.
              </p>
              {reviewQueue.pendingCount === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0 }}>No candidate axioms waiting for review.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {reviewQueue.pendingCandidates.map((axiom) => (
                    <li
                      key={axiom.id}
                      style={{
                        border: '1px solid rgba(134,239,172,0.22)',
                        borderRadius: '10px',
                        padding: '1rem',
                        background: 'rgba(134,239,172,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{axiom.name}</h3>
                        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ color: '#fde68a', fontSize: '0.72rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            review
                          </span>
                          <span style={{ color: '#4ade80', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {(axiom.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <ProvenanceSourceBadge descriptor={normalizeProvenanceSource(axiom.provenance)} />
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
                        {axiom.description}
                      </p>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 0.25rem' }}>
                          <strong style={{ color: 'rgba(255,255,255,0.65)' }}>If</strong> {axiom.antecedent}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                          <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Then</strong> {axiom.consequent}
                        </p>
                      </div>
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.74rem', lineHeight: 1.45 }}>
                          Scope: {axiom.scope.replace('_', ' ')} · Relation: {axiom.relationshipType.replace(/_/g, ' ')} · Evidence:{' '}
                          {axiom.evidenceCount || axiom.evidenceEntryIds.length || 'not counted yet'}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.74rem', lineHeight: 1.45 }}>
                          Provenance: {getAxiomProvenanceLabel(axiom.provenance)}
                        </p>
                      </div>
                      <EvidenceDirectionSummary summary={summarizeAxiomEvidence(axiom)} />
                      <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => handleReviewAxiom(axiom.id, 'confirmed')}
                          style={{
                            border: '1px solid rgba(74,222,128,0.45)',
                            background: 'rgba(74,222,128,0.12)',
                            color: '#86efac',
                            borderRadius: '999px',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.75rem',
                            cursor: isReviewing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => handleReviewAxiom(axiom.id, 'rejected')}
                          style={{
                            border: '1px solid rgba(248,113,113,0.45)',
                            background: 'rgba(248,113,113,0.1)',
                            color: '#fca5a5',
                            borderRadius: '999px',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.75rem',
                            cursor: isReviewing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Reject
                        </button>
                        <span style={{ alignSelf: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>
                          Leave candidate by taking no action.
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>Split-claim review</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: 1.45 }}>
                Recent bundled entries are split into proposed claims before ontology review. Triage is saved in this browser only: no axiom is created, confirmed, or given confidence here.
              </p>
              {splitEntries.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0 }}>No recent multi-claim entries found.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {splitEntries.slice(0, 5).map((entry) => (
                    <li
                      key={entry.id}
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{entry.headline}</h3>
                          <p style={{ color: 'rgba(255,255,255,0.35)', margin: '0.35rem 0 0', fontSize: '0.74rem' }}>
                            {entry.entryType} · {entry.domains.length ? entry.domains.join(', ') : 'No domains detected yet'} · {entry.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                        <span style={{ color: '#fde68a', fontSize: '0.72rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {entry.split.claims.length} claims
                        </span>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', lineHeight: 1.45, marginTop: '0.75rem' }}>
                        {entry.rawText.slice(0, 220)}{entry.rawText.length > 220 ? '...' : ''}
                      </p>
                      <ol style={{ margin: '0.9rem 0 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {entry.split.claims.map((claim, index) => {
                          const key = claimDecisionKey(entry.id, index)
                          const decision = claimDecisions[key] ?? 'unreviewed'
                          const lowSignalDecision = lowSignalClaims[key] ?? 'normal'
                          const editableClaimText = claimTexts[key] ?? claim.claimText
                          const provenanceDescriptor = getProvenanceSourceDescriptor(claim.provenance)
                          return (
                            <li
                              key={`${entry.id}-${index}`}
                              style={{
                                color: 'rgba(255,255,255,0.72)',
                                paddingLeft: '0.25rem',
                                opacity: lowSignalDecision === 'low_signal' ? 0.72 : 1,
                              }}
                            >
                              <label style={{ display: 'block', color: 'rgba(255,255,255,0.38)', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
                                Editable claim text
                              </label>
                              <textarea
                                value={editableClaimText}
                                onChange={(event) => handleClaimTextChange(entry.id, index, event.target.value)}
                                rows={2}
                                style={{
                                  width: '100%',
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: '8px',
                                  color: 'rgba(255,255,255,0.82)',
                                  font: 'inherit',
                                  fontSize: '0.86rem',
                                  lineHeight: 1.45,
                                  padding: '0.55rem 0.65rem',
                                  resize: 'vertical',
                                  outline: 'none',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.45rem 0' }}>
                                <span
                                  title={provenanceDescriptor.description}
                                  style={{
                                    border: '1px solid rgba(147,197,253,0.28)',
                                    background: 'rgba(147,197,253,0.08)',
                                    color: '#bfdbfe',
                                    borderRadius: '999px',
                                    padding: '0.22rem 0.5rem',
                                    fontSize: '0.68rem',
                                  }}
                                >
                                  {provenanceDescriptor.label}
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>
                                  {claim.suggestedDomains.length ? claim.suggestedDomains.join(', ') : 'No claim domains detected yet'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <ClaimDecisionButton
                                  active={decision === 'keep_note'}
                                  label="Keep claim as note"
                                  onClick={() => handleClaimDecision(entry.id, index, 'keep_note')}
                                />
                                <ClaimDecisionButton
                                  active={decision === 'candidate_review'}
                                  label="Mark for candidate review"
                                  onClick={() => handleClaimDecision(entry.id, index, 'candidate_review')}
                                  disabled={lowSignalDecision === 'low_signal'}
                                />
                                <ClaimDecisionButton
                                  active={decision === 'ignore'}
                                  label="Ignore claim"
                                  onClick={() => handleClaimDecision(entry.id, index, 'ignore')}
                                />
                                <ClaimDecisionButton
                                  active={lowSignalDecision === 'low_signal'}
                                  label="Low-signal fragment"
                                  onClick={() => handleLowSignalToggle(entry.id, index)}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
                                  {formatClaimDecision(decision, lowSignalDecision)}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <OntologyConnectionsIntakeSection />

            <section
              style={{
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.18)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>Semantic check</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.45 }}>
                Confirmed personal axioms are exported to Turtle, checked against required semantic predicates, and mapped to competency-query templates.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <SemanticStat label="Exported axioms" value={semanticReport.exportedAxiomCount} />
                <SemanticStat label="Validated subjects" value={semanticReport.validation.checkedSubjects} />
                <SemanticStat label="Validation" value={semanticReport.validation.valid ? 'Pass' : 'Review'} tone={semanticReport.validation.valid ? 'good' : 'warn'} />
                <SemanticStat label="SPARQL templates" value={semanticReport.queryTemplateCount} />
              </div>
              {semanticReport.validation.issues.length > 0 && (
                <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', color: 'rgba(248,113,113,0.85)', fontSize: '0.78rem' }}>
                  {semanticReport.validation.issues.map((issue) => (
                    <li key={issue.subject}>
                      {issue.subject}: missing {issue.missingPredicates.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', margin: '0.85rem 0 0', lineHeight: 1.45 }}>
                Query layer: {semanticReport.queryNames.join(' · ')}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: '0.7rem', margin: '0.45rem 0 0', lineHeight: 1.45 }}>
                Version: {semanticReport.vocabularyVersion} · {semanticReport.appVersion}
              </p>
            </section>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '2rem',
              }}
              className="ontology-grid"
            >
              <style jsx>{`
                @media (min-width: 900px) {
                  .ontology-grid {
                    grid-template-columns: 1fr 1fr !important;
                  }
                }
              `}</style>

              <section
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>Other ontology material</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: 1.45 }}>
                  Confirmed rules can govern prompts and graphs. Rejected, retired, demo, and starter rows remain visible history.
                </p>
                {reviewQueue.reviewedAxioms.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.45)' }}>No other ontology material in the database yet.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {reviewQueue.reviewedAxioms.map((axiom) => (
                      <li
                        key={axiom.id}
                        style={{
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{axiom.name}</h3>
                          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ color: axiom.status === 'confirmed' ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: '0.72rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {axiom.status}
                            </span>
                            <span style={{ color: '#4ade80', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {(axiom.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <ProvenanceSourceBadge descriptor={normalizeProvenanceSource(axiom.provenance)} />
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
                          {axiom.description}
                        </p>
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 0.25rem' }}>
                            <strong style={{ color: 'rgba(255,255,255,0.65)' }}>If</strong> {axiom.antecedent}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                            <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Then</strong> {axiom.consequent}
                          </p>
                        </div>
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.74rem', lineHeight: 1.45 }}>
                            Scope: {axiom.scope.replace('_', ' ')} · Relation: {axiom.relationshipType.replace(/_/g, ' ')} · Evidence:{' '}
                            {axiom.evidenceCount || axiom.evidenceEntryIds.length || 'not counted yet'}
                          </p>
                          {Object.keys(axiom.provenance).length > 0 && (
                            <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '0.74rem', lineHeight: 1.45 }}>
                              Provenance: {getAxiomProvenanceLabel(axiom.provenance)}
                            </p>
                          )}
                        </div>
                        <EvidenceDirectionSummary summary={summarizeAxiomEvidence(axiom)} />
                        {axiom.status === 'confirmed' && axiom.scope === 'personal' && (
                          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <RetirementReadinessNotice
                              readiness={evaluateAxiomRetirementReadiness(
                                {
                                  status: axiom.status,
                                  confidence: axiom.confidence,
                                  confirmedAt: axiom.confirmedAt?.toISOString() ?? null,
                                  retiredAt: axiom.retiredAt?.toISOString() ?? null,
                                  evidenceEntryIds: axiom.evidenceEntryIds,
                                  evidenceCount: axiom.evidenceCount,
                                  provenance: axiom.provenance,
                                },
                                new Date().toISOString()
                              )}
                            />
                            <button
                              type="button"
                              disabled={isReviewing}
                              onClick={() => handleReviewAxiom(axiom.id, 'retired')}
                              style={{
                                border: '1px solid rgba(255,255,255,0.18)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.65)',
                                borderRadius: '999px',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                cursor: isReviewing ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Retire axiom
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

            <section
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '1.5rem',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>Stored summaries</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: 1.45 }}>
                Longer “so what” blurbs saved to the DB—not the same as the quick tags on each capture.
              </p>
              {insights.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Nothing here yet. That is expected until a job or API writes rows into{' '}
                  <code style={{ color: 'rgba(255,255,255,0.6)' }}>inferred_insights</code>.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {insights.map((insight) => (
                    <li
                      key={insight.id}
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '1rem',
                      }}
                    >
                      <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: '0.95rem' }}>{insight.insightText}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: '0.75rem', marginBottom: 0 }}>
                        Confidence: {(insight.confidence * 100).toFixed(0)}%
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          </>
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
