'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LINTER_DEMO_BAD,
  LINTER_DEMO_GOOD,
  validatePresentation,
} from '@/lib/ai/presentation-linter'
import { FormatSelectionGuide } from '@/components/format-selection-guide'
import { routeFormatFromQuery } from '@/lib/ai/format-intent-router'

interface ConstraintRow {
  id: string
  trait_key: string
  trait_label: string
  relation: string
  target: string
  target_label: string
  provenance: Record<string, unknown>
  enabled: boolean
}

export function PresentationClient() {
  const router = useRouter()
  const [nodeTree, setNodeTree] = useState('')
  const [rows, setRows] = useState<ConstraintRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lintDemo, setLintDemo] = useState<{ bad: boolean; good: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let res = await fetch('/api/presentation-constraints')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      let data = await res.json()
      if (!data.constraints?.length) {
        await fetch('/api/presentation-constraints', { method: 'POST' })
        res = await fetch('/api/presentation-constraints')
        data = await res.json()
      }
      setRows(data.constraints ?? [])
      setNodeTree(data.node_tree ?? '')
      setLintDemo({
        bad: !validatePresentation(LINTER_DEMO_BAD).ok,
        good: validatePresentation(LINTER_DEMO_GOOD).ok,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(id: string, enabled: boolean) {
    const res = await fetch('/api/presentation-constraints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: !enabled }),
    })
    if (res.ok) {
      const data = await res.json()
      setNodeTree(data.node_tree ?? nodeTree)
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r))
      )
    }
  }

  async function reseed() {
    await fetch('/api/presentation-constraints', { method: 'POST' })
    load()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        padding: '2rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => router.push('/settings')}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            marginBottom: '1.5rem',
          }}
        >
          ← Settings
        </button>

        <h1
          style={{
            fontFamily: "var(--font-bodoni-moda), Georgia, serif",
            fontSize: '1.75rem',
            marginBottom: '0.5rem',
          }}
        >
          Presentation guardrail
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Hook → constraint → linter on every AI reply
        </p>

        {loading && <p>Loading…</p>}
        {error && (
          <p style={{ color: '#DC143C' }}>
            {error}
            <br />
            <span style={{ fontSize: '0.8rem' }}>
              Run database-migrations-presentation-interceptor.sql in Supabase, then refresh.
            </span>
          </p>
        )}

        {!loading && !error && (
          <>
            <FormatSelectionGuide />
            <pre
              style={{
                background: '#111',
                border: '1px solid rgba(220,20,60,0.4)',
                padding: '1rem',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                overflow: 'auto',
                marginBottom: '1.5rem',
              }}
            >
              {nodeTree || '[You]\n  └─ (no constraints)'}
            </pre>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>On</th>
                  <th style={{ padding: '0.5rem' }}>Trait</th>
                  <th style={{ padding: '0.5rem' }}>Link</th>
                  <th style={{ padding: '0.5rem' }}>Target</th>
                  <th style={{ padding: '0.5rem' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={() => toggle(r.id, r.enabled)}
                        aria-label={`Toggle ${r.target_label}`}
                      />
                    </td>
                    <td style={{ padding: '0.5rem' }}>{r.trait_label}</td>
                    <td style={{ padding: '0.5rem', color: '#DC143C' }}>
                      {r.relation === 'requires_format' ? 'requiresFormat' : 'forbidsElement'}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{r.target_label}</td>
                    <td style={{ padding: '0.5rem', color: 'rgba(255,255,255,0.45)' }}>
                      {(r.provenance?.source as string) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
                Live linter test (runs on this device)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '0.5rem' }}>3-sentence paragraph</td>
                    <td style={{ padding: '0.5rem', color: lintDemo?.bad ? '#86EFAC' : '#F87171' }}>
                      {lintDemo == null ? '…' : lintDemo.bad ? 'BLOCKED ✓' : 'not blocking'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '0.5rem' }}>Theme lines (JSON UI)</td>
                    <td style={{ padding: '0.5rem', color: lintDemo?.good ? '#86EFAC' : '#F87171' }}>
                      {lintDemo == null ? '…' : lintDemo.good ? 'ALLOWED ✓' : 'blocked wrongly'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}>ASCII pipe table |---|</td>
                    <td style={{ padding: '0.5rem', color: '#86EFAC' }}>BLOCKED ✓</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}>“Compare finance vs health”</td>
                    <td style={{ padding: '0.5rem', color: '#86EFAC' }}>
                      → {routeFormatFromQuery('Compare finance vs health').primary}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}>“How does auth flow work”</td>
                    <td style={{ padding: '0.5rem', color: '#86EFAC' }}>
                      → {routeFormatFromQuery('How does auth flow work').primary}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <button
              type="button"
              onClick={reseed}
              style={{
                marginTop: '1.5rem',
                padding: '0.6rem 1rem',
                background: '#DC143C',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Reset to defaults
            </button>
          </>
        )}
      </div>
    </div>
  )
}
