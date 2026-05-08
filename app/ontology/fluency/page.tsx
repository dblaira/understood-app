'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FLUENCY_SESSION_TARGET,
  buildFluencyStats,
  canCountFluencySession,
  type FluencyMove,
  type FluencySession,
  type FluencySessionInput,
} from '@/lib/ontology/fluency'
import { LIFE_DOMAINS, type LifeDomain } from '@/types/ontology'

const STORAGE_KEY = 'understood:ontology-fluency-sessions'

const MOVE_OPTIONS: { value: FluencyMove; label: string; helper: string }[] = [
  {
    value: 'capture',
    label: 'Capture',
    helper: 'Save information before interpreting it',
  },
  {
    value: 'classify',
    label: 'Classify',
    helper: 'Assign clear life domains',
  },
  {
    value: 'attach_evidence',
    label: 'Attach evidence',
    helper: 'Support or contradict an existing axiom',
  },
  {
    value: 'create_candidate',
    label: 'Create candidate',
    helper: 'Write a new testable if-then rule',
  },
  {
    value: 'confirm_or_reject',
    label: 'Confirm or reject',
    helper: 'Decide if a candidate should govern reasoning',
  },
  {
    value: 'retire',
    label: 'Retire',
    helper: 'Remove an old truth from active reasoning',
  },
  {
    value: 'training_only',
    label: 'Training only',
    helper: 'Use when live explanation was needed',
  },
]

const emptyInput: FluencySessionInput = {
  reviewedItems: '',
  primaryMove: 'classify',
  domainsUsed: [],
  statusChanges: '',
  neededExplanation: false,
  updatedOntologyState: true,
}

export default function OntologyFluencyPage() {
  const [sessions, setSessions] = useState<FluencySession[]>([])
  const [input, setInput] = useState<FluencySessionInput>(emptyInput)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setSessions(JSON.parse(raw) as FluencySession[])
      }
    } catch (error) {
      console.error('Failed to load ontology fluency sessions', error)
    } finally {
      setHasLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!hasLoaded) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }, [hasLoaded, sessions])

  const stats = useMemo(() => buildFluencyStats(sessions), [sessions])
  const currentSessionCounts = canCountFluencySession(input)
  const recentSessions = sessions.slice(0, 8)

  function toggleDomain(domain: LifeDomain) {
    setInput((current) => {
      const exists = current.domainsUsed.includes(domain)
      return {
        ...current,
        domainsUsed: exists
          ? current.domainsUsed.filter((item) => item !== domain)
          : [...current.domainsUsed, domain],
      }
    })
  }

  function logSession() {
    if (!input.reviewedItems.trim()) return

    const nextSession: FluencySession = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      statusChanges: input.statusChanges.trim() || 'none',
    }

    setSessions((current) => [nextSession, ...current])
    setInput(emptyInput)
  }

  function deleteSession(sessionId: string) {
    setSessions((current) => current.filter((session) => session.id !== sessionId))
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#090909',
        color: '#fff',
        padding: '1rem',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '5rem' }}>
        <Link
          href="/ontology"
          style={{
            display: 'inline-flex',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            margin: '0.75rem 0 1.25rem',
          }}
        >
          ← Back to ontology
        </Link>

        <section
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '24px',
            padding: '1.25rem',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
          }}
        >
          <p style={{ margin: '0 0 0.65rem', color: '#86efac', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            50 session proof
          </p>
          <h1 style={{ margin: 0, fontSize: '2.1rem', lineHeight: 1.05 }}>
            Ontology Fluency
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: '0.85rem 0 0' }}>
            Use this on your phone. A session counts only when you choose the domain, the move, and the update without live explanation.
          </p>

          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.45rem' }}>
              <span>{stats.countedSessions} / {FLUENCY_SESSION_TARGET} counted</span>
              <span>{stats.percentComplete}%</span>
            </div>
            <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats.percentComplete}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: '#86efac',
                }}
              />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', margin: '0.6rem 0 0' }}>
              {stats.remainingSessions} counted sessions remaining. {stats.trainingSessions} training sessions logged.
            </p>
          </div>
        </section>

        <section style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          <details open style={cardStyle}>
            <summary style={summaryStyle}>Before you count a session</summary>
            <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              <p style={plainParagraphStyle}>A counted session must include the full loop:</p>
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>Access the ontology.</li>
                <li>Review one or more information items.</li>
                <li>Choose domains.</li>
                <li>Choose the ontology move.</li>
                <li>Update or review ontology state.</li>
                <li>Record the result here.</li>
              </ol>
              <p style={plainParagraphStyle}>
                If you need AI to explain the term, metric, status, or next move, log it as training only.
              </p>
            </div>
          </details>

          <details style={cardStyle}>
            <summary style={summaryStyle}>Vocabulary you must know</summary>
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.9rem' }}>
              <VocabularyTerm title="Axiom" text="A personal if-then rule that can collect evidence over time." />
              <VocabularyTerm title="Candidate" text="Plausible, but not trusted yet." />
              <VocabularyTerm title="Confirmed" text="Trusted enough to guide future reasoning." />
              <VocabularyTerm title="Rejected" text="Reviewed and judged false, misleading, or not useful." />
              <VocabularyTerm title="Retired" text="Useful before, but no longer active for current reasoning." />
              <VocabularyTerm title="Evidence count" text="How many information items support the axiom. It is a maturity signal, not proof by itself." />
            </div>
          </details>
        </section>

        <section style={{ ...cardStyle, marginTop: '1rem' }}>
          <h2 style={sectionTitleStyle}>Log this session</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0.35rem 0 1rem', lineHeight: 1.45 }}>
            Decide first. Then record. The app will tell you whether this counts or becomes training.
          </p>

          <label style={labelStyle}>
            Items reviewed
            <textarea
              value={input.reviewedItems}
              onChange={(event) => setInput((current) => ({ ...current, reviewedItems: event.target.value }))}
              placeholder="Example: morning note + energy metric"
              rows={3}
              style={textareaStyle}
            />
          </label>

          <div style={{ marginTop: '1rem' }}>
            <p style={labelTextStyle}>Domains used</p>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {LIFE_DOMAINS.map((domain) => {
                const selected = input.domainsUsed.includes(domain)
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleDomain(domain)}
                    style={{
                      ...chipStyle,
                      borderColor: selected ? '#86efac' : 'rgba(255,255,255,0.16)',
                      background: selected ? 'rgba(134,239,172,0.14)' : 'rgba(255,255,255,0.04)',
                      color: selected ? '#bbf7d0' : 'rgba(255,255,255,0.68)',
                    }}
                  >
                    {domain}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <p style={labelTextStyle}>Primary move</p>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {MOVE_OPTIONS.map((move) => {
                const selected = input.primaryMove === move.value
                return (
                  <button
                    key={move.value}
                    type="button"
                    onClick={() => setInput((current) => ({ ...current, primaryMove: move.value }))}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.8rem',
                      borderRadius: '14px',
                      border: selected ? '1px solid #86efac' : '1px solid rgba(255,255,255,0.12)',
                      background: selected ? 'rgba(134,239,172,0.12)' : 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700 }}>{move.label}</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.48)', marginTop: '0.25rem' }}>
                      {move.helper}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <label style={{ ...labelStyle, marginTop: '1rem' }}>
            Axiom status changes
            <input
              value={input.statusChanges}
              onChange={(event) => setInput((current) => ({ ...current, statusChanges: event.target.value }))}
              placeholder="Example: confirmed sleep → patience rule"
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
            <ToggleRow
              title="I updated or reviewed ontology state"
              description="The session included a real ontology move, not just reading."
              checked={input.updatedOntologyState}
              onChange={(checked) => setInput((current) => ({ ...current, updatedOntologyState: checked }))}
            />
            <ToggleRow
              title="I needed live explanation"
              description="Turn this on if AI or a hidden definition told you what a term, metric, or move meant."
              checked={input.neededExplanation}
              onChange={(checked) => setInput((current) => ({ ...current, neededExplanation: checked }))}
            />
          </div>

          <div
            style={{
              marginTop: '1rem',
              border: `1px solid ${currentSessionCounts ? 'rgba(134,239,172,0.45)' : 'rgba(251,191,36,0.45)'}`,
              background: currentSessionCounts ? 'rgba(134,239,172,0.1)' : 'rgba(251,191,36,0.1)',
              borderRadius: '16px',
              padding: '0.85rem',
              color: currentSessionCounts ? '#bbf7d0' : '#fde68a',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            {currentSessionCounts
              ? 'This will count toward the 50-session proof.'
              : 'This will log as training only until it has items, domains, a real move, reviewed state, and no live explanation.'}
          </div>

          <button
            type="button"
            onClick={logSession}
            disabled={!input.reviewedItems.trim()}
            style={{
              width: '100%',
              marginTop: '1rem',
              border: 'none',
              borderRadius: '999px',
              padding: '0.95rem 1rem',
              background: input.reviewedItems.trim() ? '#f5f5f5' : 'rgba(255,255,255,0.18)',
              color: input.reviewedItems.trim() ? '#111' : 'rgba(255,255,255,0.45)',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: input.reviewedItems.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Log session
          </button>
        </section>

        <section style={{ ...cardStyle, marginTop: '1rem' }}>
          <h2 style={sectionTitleStyle}>Recent sessions</h2>
          {recentSessions.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 0 }}>
              No sessions logged on this device yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: '0.75rem' }}>
              {recentSessions.map((session) => {
                const counted = canCountFluencySession(session)
                return (
                  <li
                    key={session.id}
                    style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      padding: '0.85rem',
                      background: counted ? 'rgba(134,239,172,0.07)' : 'rgba(251,191,36,0.07)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, color: counted ? '#bbf7d0' : '#fde68a', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {counted ? 'Counted' : 'Training only'}
                        </p>
                        <p style={{ margin: '0.35rem 0 0', color: '#fff', lineHeight: 1.4 }}>{session.reviewedItems}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSession(session.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'rgba(255,255,255,0.35)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <p style={{ margin: '0.55rem 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                      {formatMove(session.primaryMove)} · {session.domainsUsed.join(', ')} · {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function VocabularyTerm({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
      <p style={{ margin: 0, color: '#fff', fontWeight: 700 }}>{title}</p>
      <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.58)', lineHeight: 1.45 }}>{text}</p>
    </div>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        width: '100%',
        textAlign: 'left',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        padding: '0.85rem',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      <span>
        <span style={{ display: 'block', fontWeight: 700 }}>{title}</span>
        <span style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', lineHeight: 1.4, marginTop: '0.2rem' }}>
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: '44px',
          height: '26px',
          borderRadius: '999px',
          padding: '3px',
          background: checked ? '#86efac' : 'rgba(255,255,255,0.16)',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: checked ? '#0f172a' : 'rgba(255,255,255,0.7)',
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
            transition: 'transform 120ms ease',
          }}
        />
      </span>
    </button>
  )
}

function formatMove(move: FluencyMove): string {
  return MOVE_OPTIONS.find((option) => option.value === move)?.label ?? move
}

const cardStyle = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.045)',
  padding: '1rem',
}

const summaryStyle = {
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '1rem',
}

const sectionTitleStyle = {
  margin: 0,
  fontSize: '1.35rem',
  lineHeight: 1.15,
}

const plainParagraphStyle = {
  margin: 0,
}

const labelStyle = {
  display: 'block',
  color: 'rgba(255,255,255,0.72)',
  fontSize: '0.88rem',
  fontWeight: 700,
}

const labelTextStyle = {
  margin: '0 0 0.5rem',
  color: 'rgba(255,255,255,0.72)',
  fontSize: '0.88rem',
  fontWeight: 700,
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  marginTop: '0.45rem',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '14px',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  padding: '0.85rem',
  fontSize: '1rem',
}

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
}

const chipStyle = {
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '999px',
  padding: '0.45rem 0.7rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
}
