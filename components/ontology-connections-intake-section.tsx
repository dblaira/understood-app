'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { createCandidateAxiomFromConnection } from '@/app/actions/ontology'
import { getProvenanceSourceDescriptor } from '@/lib/ontology/provenance'
import { supabase } from '@/lib/supabase/client'
import {
  buildConnectionIntakeItemsFromEntries,
  CONNECTION_INTAKE_ACTION_LABELS,
  CONNECTION_ONTOLOGY_BUCKET_LABELS,
  CONNECTION_ONTOLOGY_INTAKE_ITEMS,
  findConnectionEvidenceCandidates,
  type ConnectionEvidenceCandidate,
  type ConnectionEvidenceEntryLike,
  type ConnectionIntakeLocalAction,
  type ConnectionOntologyBucket,
  type ConnectionOntologyIntakeItem,
  loadConnectionIntakeLocalState,
  saveConnectionIntakeLocalState,
} from '@/lib/ontology/connections-intake'

type ConnectionEntryRow = {
  id: string
  headline: string | null
  content: string
  connection_type: string | null
  created_at: string
}

type EvidenceEntryRow = {
  id: string
  headline: string | null
  content: string
  entry_type: string | null
}

const BUCKET_ORDER: ConnectionOntologyBucket[] = [
  'strong_candidate_personal',
  'product_system_principle',
  'mixed_personal_product',
  'remain_connection_only',
  'needs_evidence_before_candidate',
]

const ACTIONS: ConnectionIntakeLocalAction[] = [
  'keep_as_connection',
  'mark_for_evidence_search',
  'mark_for_candidate_review',
  'split_personal_product_claim',
  'ignore_for_ontology',
]

function formatBoundary(b: ConnectionOntologyIntakeItem['boundary']): string {
  if (b === 'personal_pattern') return 'Personal pattern'
  if (b === 'product_system') return 'Product/system'
  if (b === 'both') return 'Both (personal + product)'
  return 'Unclear'
}

export function OntologyConnectionsIntakeSection() {
  const [bucketFilter, setBucketFilter] = useState<ConnectionOntologyBucket | 'all'>('all')
  const [localActions, setLocalActions] = useState<Record<string, ConnectionIntakeLocalAction | null>>({})
  const [items, setItems] = useState<ConnectionOntologyIntakeItem[]>(CONNECTION_ONTOLOGY_INTAKE_ITEMS)
  const [evidenceEntries, setEvidenceEntries] = useState<ConnectionEvidenceEntryLike[]>([])
  const [sourceLabel, setSourceLabel] = useState('calibration seeds')
  const [createdCandidates, setCreatedCandidates] = useState<Record<string, string>>({})
  const [candidateErrors, setCandidateErrors] = useState<Record<string, string>>({})
  const [isCreatingCandidate, startCreateCandidateTransition] = useTransition()

  useEffect(() => {
    setLocalActions(loadConnectionIntakeLocalState())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadConnections() {
      const { data, error } = await supabase
        .from('entries')
        .select('id, headline, content, connection_type, created_at')
        .eq('entry_type', 'connection')
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled) return
      if (error || !data?.length) {
        setItems(CONNECTION_ONTOLOGY_INTAKE_ITEMS)
        setSourceLabel('calibration seeds')
        return
      }

      setItems(buildConnectionIntakeItemsFromEntries(data as ConnectionEntryRow[]))
      setSourceLabel('live Connections')
    }

    void loadConnections()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadEvidenceEntries() {
      const { data, error } = await supabase
        .from('entries')
        .select('id, headline, content, entry_type')
        .neq('entry_type', 'connection')
        .order('created_at', { ascending: false })
        .limit(80)

      if (cancelled) return
      if (error || !data?.length) {
        setEvidenceEntries([])
        return
      }

      setEvidenceEntries((data as EvidenceEntryRow[]).map((entry) => ({
        id: entry.id,
        headline: entry.headline,
        content: entry.content,
        entry_type: entry.entry_type,
      })))
    }

    void loadEvidenceEntries()
    return () => {
      cancelled = true
    }
  }, [])

  const setAction = useCallback((id: string, action: ConnectionIntakeLocalAction | null) => {
    setLocalActions((current) => {
      const next = { ...current, [id]: action }
      saveConnectionIntakeLocalState(next)
      return next
    })
  }, [])

  const clearAllLocal = useCallback(() => {
    setLocalActions({})
    saveConnectionIntakeLocalState({})
  }, [])

  const createCandidate = useCallback((item: ConnectionOntologyIntakeItem) => {
    setCandidateErrors((current) => ({ ...current, [item.id]: '' }))
    startCreateCandidateTransition(async () => {
      const result = await createCandidateAxiomFromConnection(item)
      if (result.error) {
        setCandidateErrors((current) => ({ ...current, [item.id]: result.error ?? 'Failed to create candidate' }))
        return
      }

      setCreatedCandidates((current) => ({ ...current, [item.id]: result.data?.id ?? 'created' }))
      setAction(item.id, 'mark_for_candidate_review')
    })
  }, [setAction])

  const filteredItems = useMemo(() => {
    return items.filter(
      (item) => bucketFilter === 'all' || item.suggestedBucket === bucketFilter
    )
  }, [bucketFilter, items])

  const reviewedCount = useMemo(
    () => items.filter((item) => localActions[item.id] != null).length,
    [items, localActions]
  )

  return (
    <section
      style={{
        background: 'rgba(147,197,253,0.06)',
        border: '1px solid rgba(147,197,253,0.2)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem', fontWeight: 600 }}>Connections ontology intake</h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: '0.75rem', lineHeight: 1.45 }}>
        Local review only. Source: {sourceLabel}. Nothing is written to the
        database. Triages stay in this browser via <code style={{ color: 'rgba(255,255,255,0.55)' }}>localStorage</code>
        .
      </p>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.45 }}>
        Reviewed locally: {reviewedCount} / {items.length}
        <button
          type="button"
          onClick={clearAllLocal}
          style={{
            marginLeft: '0.75rem',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.5)',
            borderRadius: '999px',
            padding: '0.2rem 0.55rem',
            fontSize: '0.7rem',
            cursor: 'pointer',
          }}
        >
          Clear local triage
        </button>
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <FilterChip active={bucketFilter === 'all'} label="All" onClick={() => setBucketFilter('all')} />
        {BUCKET_ORDER.map((bucket) => (
          <FilterChip
            key={bucket}
            active={bucketFilter === bucket}
            label={CONNECTION_ONTOLOGY_BUCKET_LABELS[bucket]}
            onClick={() => setBucketFilter(bucket)}
          />
        ))}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredItems.map((item) => (
          <ConnectionIntakeCard
            key={item.id}
            item={item}
            evidenceCandidates={findConnectionEvidenceCandidates(item, evidenceEntries)}
            selectedAction={localActions[item.id] ?? null}
            onSelectAction={(action) => setAction(item.id, action)}
            onCreateCandidate={() => createCandidate(item)}
            candidateCreated={createdCandidates[item.id] != null}
            candidateError={candidateErrors[item.id] || null}
            isCreatingCandidate={isCreatingCandidate}
          />
        ))}
      </ul>
    </section>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? '1px solid rgba(147,197,253,0.55)' : '1px solid rgba(255,255,255,0.12)',
        background: active ? 'rgba(147,197,253,0.14)' : 'rgba(255,255,255,0.04)',
        color: active ? '#bfdbfe' : 'rgba(255,255,255,0.55)',
        borderRadius: '999px',
        padding: '0.35rem 0.65rem',
        fontSize: '0.72rem',
        cursor: 'pointer',
        lineHeight: 1.2,
      }}
    >
      {label}
    </button>
  )
}

function ConnectionIntakeCard({
  item,
  evidenceCandidates,
  selectedAction,
  onSelectAction,
  onCreateCandidate,
  candidateCreated,
  candidateError,
  isCreatingCandidate,
}: {
  item: ConnectionOntologyIntakeItem
  evidenceCandidates: ConnectionEvidenceCandidate[]
  selectedAction: ConnectionIntakeLocalAction | null
  onSelectAction: (action: ConnectionIntakeLocalAction | null) => void
  onCreateCandidate: () => void
  candidateCreated: boolean
  candidateError: string | null
  isCreatingCandidate: boolean
}) {
  const prov = getProvenanceSourceDescriptor(item.provenanceSource)
  const canCreateCandidate =
    item.boundary === 'personal_pattern' &&
    item.suggestedBucket !== 'product_system_principle' &&
    item.suggestedBucket !== 'mixed_personal_product' &&
    item.candidateAxiomDraft != null

  return (
    <li
      style={{
        border: '1px solid rgba(147,197,253,0.18)',
        borderRadius: '10px',
        padding: '1rem',
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, lineHeight: 1.35 }}>{item.headline}</h3>
        <span
          style={{
            color: '#93c5fd',
            fontSize: '0.68rem',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          {String(item.connectionType).replace(/_/g, ' ')}
        </span>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.74rem', margin: '0.65rem 0 0', lineHeight: 1.45 }}>
        <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Suggested bucket</strong>{' '}
        {CONNECTION_ONTOLOGY_BUCKET_LABELS[item.suggestedBucket]}
      </p>
      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.74rem', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
        <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Boundary</strong> {formatBoundary(item.boundary)}
      </p>
      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.74rem', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
        <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Provenance</strong> {prov.label} — {prov.description}
      </p>
      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.74rem', margin: '0.35rem 0 0', lineHeight: 1.45 }}>
        <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Calibration move</strong> {item.calibrationRecommendedMove}
      </p>

      {item.candidateAxiomDraft ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.65rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Candidate axiom draft
          </p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
            {item.candidateAxiomDraft}
          </p>
        </div>
      ) : (
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginTop: '0.75rem' }}>No draft yet.</p>
      )}

      <div
        style={{
          marginTop: '0.75rem',
          padding: '0.65rem 0.75rem',
          borderRadius: '8px',
          background: 'rgba(134,239,172,0.05)',
          border: '1px solid rgba(134,239,172,0.12)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(187,247,208,0.72)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Possible evidence in entries
        </p>
        {evidenceCandidates.length ? (
          <ul style={{ listStyle: 'none', margin: '0.45rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {evidenceCandidates.map((candidate) => (
              <li key={candidate.entryId}>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  {candidate.headline}
                </p>
                <p style={{ margin: '0.18rem 0 0', color: 'rgba(255,255,255,0.38)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                  {candidate.snippet}{candidate.snippet.length >= 180 ? '...' : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: '0.4rem 0 0', color: 'rgba(255,255,255,0.35)', fontSize: '0.74rem' }}>
            No obvious recent entry matches yet.
          </p>
        )}
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Local action (not saved to server)
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          {ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onSelectAction(selectedAction === action ? null : action)}
              style={{
                border:
                  selectedAction === action
                    ? '1px solid rgba(147,197,253,0.6)'
                    : '1px solid rgba(255,255,255,0.14)',
                background: selectedAction === action ? 'rgba(147,197,253,0.12)' : 'rgba(255,255,255,0.04)',
                color: selectedAction === action ? '#bfdbfe' : 'rgba(255,255,255,0.65)',
                borderRadius: '999px',
                padding: '0.3rem 0.55rem',
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
            >
              {CONNECTION_INTAKE_ACTION_LABELS[action]}
            </button>
          ))}
        </div>
        {selectedAction && (
          <p style={{ color: 'rgba(147,197,253,0.85)', fontSize: '0.72rem', margin: '0.5rem 0 0' }}>
            Selected: {CONNECTION_INTAKE_ACTION_LABELS[selectedAction]}
          </p>
        )}
        {selectedAction === 'mark_for_candidate_review' && (
          <div style={{ marginTop: '0.6rem' }}>
            <button
              type="button"
              onClick={onCreateCandidate}
              disabled={!canCreateCandidate || candidateCreated || isCreatingCandidate}
              style={{
                border: '1px solid rgba(251,191,36,0.35)',
                background: canCreateCandidate && !candidateCreated ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                color: canCreateCandidate && !candidateCreated ? '#fde68a' : 'rgba(255,255,255,0.35)',
                borderRadius: '8px',
                padding: '0.45rem 0.7rem',
                fontSize: '0.72rem',
                cursor: canCreateCandidate && !candidateCreated && !isCreatingCandidate ? 'pointer' : 'not-allowed',
              }}
            >
              {candidateCreated ? 'Candidate created' : isCreatingCandidate ? 'Creating...' : 'Create candidate axiom'}
            </button>
            <p style={{ color: 'rgba(255,255,255,0.36)', fontSize: '0.7rem', margin: '0.4rem 0 0', lineHeight: 1.4 }}>
              Creates a candidate only. Human review is still required before it can govern prompts, graph, or RDF.
            </p>
            {!canCreateCandidate && (
              <p style={{ color: 'rgba(248,113,113,0.82)', fontSize: '0.7rem', margin: '0.35rem 0 0' }}>
                Not eligible until it is a personal-only claim.
              </p>
            )}
            {candidateError && (
              <p style={{ color: 'rgba(248,113,113,0.82)', fontSize: '0.7rem', margin: '0.35rem 0 0' }}>
                {candidateError}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
