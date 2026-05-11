'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { updateOntologyAxiomStatus } from '@/app/actions/ontology'
import { evaluateAxiomRetirementReadiness, type AxiomRetirementReadiness } from '@/lib/ontology/axiom-review'
import { summarizeAxiomEvidence, type AxiomEvidenceSummary } from '@/lib/ontology/evidence'
import { normalizeProvenanceSource, type ProvenanceSourceDescriptor } from '@/lib/ontology/provenance'
import { buildOntologyReviewQueue, getAxiomProvenanceLabel } from '@/lib/ontology/review-queue'
import {
  parseOntologyAxiomScope,
  parseOntologyAxiomStatus,
  type InferredInsight,
  type OntologyAxiom,
  type OntologyAxiomStatus,
  type OntologyRelationshipType,
} from '@/types/ontology'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(true)
  const [isReviewing, startReviewTransition] = useTransition()
  const reviewQueue = buildOntologyReviewQueue(axioms)

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
          Personal ontology
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: '1rem', fontSize: '1rem', lineHeight: 1.5 }}>
          In one line: when you capture a note, the app picks <strong style={{ color: 'rgba(255,255,255,0.85)' }}>life domains</strong> (same
          labels as the sidebar) and feeds your <strong style={{ color: 'rgba(255,255,255,0.85)' }}>if→then rules</strong> into the model so
          answers stay on your worldview—not a generic chatbot.
        </p>
        <Link
          href="/ontology/fluency"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(134,239,172,0.45)',
            borderRadius: '999px',
            background: 'rgba(134,239,172,0.12)',
            color: '#bbf7d0',
            padding: '0.65rem 0.95rem',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 700,
            marginBottom: '1.25rem',
          }}
        >
          Open fluency tracker
        </Link>

        <div
          style={{
            marginBottom: '1.75rem',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setShowHowItWorks((v) => !v)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '0.85rem 1rem',
              background: 'rgba(255,255,255,0.04)',
              border: 'none',
              color: 'rgba(255,255,255,0.75)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span>{showHowItWorks ? '▼' : '▶'} How this page maps to the app</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>{showHowItWorks ? 'Hide' : 'Show'}</span>
          </button>
          {showHowItWorks && (
            <ul
              style={{
                margin: 0,
                padding: '1rem 1.25rem 1.15rem',
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.88rem',
                lineHeight: 1.55,
              }}
            >
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Life domain</strong> — a bucket like Exercise or Learning. Stored on
                entries and used in the sidebar; the infer API returns these after you save.
              </li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Rule (we still call it an axiom in the DB)</strong> — plain English “if
                this, then that” plus a confidence. Rows in <code style={{ color: 'rgba(255,255,255,0.55)' }}>ontology_axioms</code> get
                stitched into the prompt in <code style={{ color: 'rgba(255,255,255,0.55)' }}>build-prompt-section</code>.
              </li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Inference here</strong> — the LLM reading your text + rules, not an OWL
                reasoner. There is no separate logic engine to learn.
              </li>
              <li>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Insights below</strong> — optional weekly summaries once something writes to{' '}
                <code style={{ color: 'rgba(255,255,255,0.55)' }}>inferred_insights</code>; empty is normal today.
              </li>
            </ul>
          )}
        </div>

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
