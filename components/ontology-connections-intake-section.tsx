'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProvenanceSourceDescriptor } from '@/lib/ontology/provenance'
import {
  CONNECTION_INTAKE_ACTION_LABELS,
  CONNECTION_ONTOLOGY_BUCKET_LABELS,
  CONNECTION_ONTOLOGY_INTAKE_ITEMS,
  type ConnectionIntakeLocalAction,
  type ConnectionOntologyBucket,
  type ConnectionOntologyIntakeItem,
  loadConnectionIntakeLocalState,
  saveConnectionIntakeLocalState,
} from '@/lib/ontology/connections-intake'

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

  useEffect(() => {
    setLocalActions(loadConnectionIntakeLocalState())
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

  const filteredItems = useMemo(() => {
    return CONNECTION_ONTOLOGY_INTAKE_ITEMS.filter(
      (item) => bucketFilter === 'all' || item.suggestedBucket === bucketFilter
    )
  }, [bucketFilter])

  const reviewedCount = useMemo(
    () => CONNECTION_ONTOLOGY_INTAKE_ITEMS.filter((item) => localActions[item.id] != null).length,
    [localActions]
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
        Local review only. Seeded from calibration docs: suggested buckets, drafts, boundaries. Nothing is written to the
        database. Triages stay in this browser via <code style={{ color: 'rgba(255,255,255,0.55)' }}>localStorage</code>
        .
      </p>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.45 }}>
        Reviewed locally: {reviewedCount} / {CONNECTION_ONTOLOGY_INTAKE_ITEMS.length}
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
            selectedAction={localActions[item.id] ?? null}
            onSelectAction={(action) => setAction(item.id, action)}
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
  selectedAction,
  onSelectAction,
}: {
  item: ConnectionOntologyIntakeItem
  selectedAction: ConnectionIntakeLocalAction | null
  onSelectAction: (action: ConnectionIntakeLocalAction | null) => void
}) {
  const prov = getProvenanceSourceDescriptor(item.provenanceSource)

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
      </div>
    </li>
  )
}
