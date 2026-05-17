'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type ParsedRule = {
  id: string
  number: number
  section: string
  text: string
}

type Answer = 'yes' | 'no' | 'edit' | 'skip'

type DecisionRecord = {
  status: Answer | 'unreviewed'
  editedText?: string
}

type DecisionState = Record<string, DecisionRecord>

const STORAGE_KEY = 'understood.beliefs.decisions.v1'
const BATCH_SIZE = 10

function loadDecisions(): DecisionState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DecisionState
  } catch {
    return {}
  }
}

function saveDecisions(state: DecisionState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function BeliefsClient({ rules }: { rules: ParsedRule[] }) {
  const router = useRouter()
  const [decisions, setDecisions] = useState<DecisionState>({})
  const [loaded, setLoaded] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [todayBatch, setTodayBatch] = useState<string[] | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [batchVersion, setBatchVersion] = useState(0)

  useEffect(() => {
    setDecisions(loadDecisions())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    saveDecisions(decisions)
  }, [decisions, loaded])

  const pending = useMemo(() => {
    return rules.filter((r) => {
      const status = decisions[r.id]?.status
      const isAnswered = status === 'yes' || status === 'no' || status === 'edit'
      return !isAnswered && !skipped.has(r.id)
    })
  }, [rules, decisions, skipped])

  useEffect(() => {
    if (!loaded) return
    if (todayBatch !== null) return
    if (pending.length === 0) return
    setTodayBatch(pending.slice(0, BATCH_SIZE).map((r) => r.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, batchVersion])

  const batchSet = useMemo(() => new Set(todayBatch ?? []), [todayBatch])
  const visible = pending.filter((r) => batchSet.has(r.id))
  const batchSize = todayBatch?.length ?? 0
  const answeredInBatch = Math.max(0, batchSize - visible.length)
  const batchDone = todayBatch !== null && batchSize > 0 && visible.length === 0
  const remainingAfterBatch = Math.max(0, pending.length - visible.length)
  const lifetimeAnswered = Object.values(decisions).filter(
    (d) => d.status === 'yes' || d.status === 'no' || d.status === 'edit'
  ).length

  function showSaved(text: string) {
    setSavedMessage(text)
    window.setTimeout(() => {
      setSavedMessage((current) => (current === text ? null : current))
    }, 2200)
  }

  function handleAnswer(rule: ParsedRule, answer: Answer, editedText?: string) {
    if (answer === 'skip') {
      setSkipped((curr) => {
        const next = new Set(curr)
        next.add(rule.id)
        return next
      })
      showSaved('Saved ✓ Set aside for now.')
      return
    }
    setDecisions((curr) => ({
      ...curr,
      [rule.id]: { status: answer, editedText },
    }))
    if (answer === 'yes') showSaved(`Saved ✓ Kept rule ${rule.number}.`)
    else if (answer === 'no') showSaved(`Saved ✓ Dropped rule ${rule.number}.`)
    else if (answer === 'edit') showSaved(`Saved ✓ Edited rule ${rule.number}.`)
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

        {!loaded && <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>}

        {loaded && batchSize > 0 && (
          <ProgressStrip
            answered={answeredInBatch}
            batchSize={batchSize}
            lifetimeAnswered={lifetimeAnswered}
            totalRules={rules.length}
            remainingAfterBatch={remainingAfterBatch}
          />
        )}

        {loaded && savedMessage && <SavedToast text={savedMessage} />}

        {loaded && pending.length === 0 && lifetimeAnswered === 0 && (
          <Panel
            headline="Nothing to review yet."
            sub="The rules file is empty. Add some rules first."
          />
        )}

        {loaded && pending.length === 0 && lifetimeAnswered > 0 && (
          <Panel
            headline={`All done. ${lifetimeAnswered} of ${rules.length} rules answered.`}
            sub="Your AI knows you better."
          />
        )}

        {loaded && !batchDone &&
          visible.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              step={answeredInBatch + i + 1}
              total={batchSize}
              onAnswer={(answer, edited) => handleAnswer(rule, answer, edited)}
            />
          ))}

        {loaded && batchDone && (
          <BatchDonePanel
            batchSize={batchSize}
            lifetimeAnswered={lifetimeAnswered}
            totalRules={rules.length}
            remaining={remainingAfterBatch}
            onNext={startNextBatch}
          />
        )}
      </div>
    </div>
  )
}

function RuleCard({
  rule,
  step,
  total,
  onAnswer,
}: {
  rule: ParsedRule
  step: number
  total: number
  onAnswer: (answer: Answer, editedText?: string) => void
}) {
  const [choice, setChoice] = useState<Answer>('yes')
  const [editText, setEditText] = useState(rule.text)
  const [editing, setEditing] = useState(false)

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Answer
    setChoice(next)
    if (next === 'edit') {
      setEditing(true)
      return
    }
    setEditing(false)
    onAnswer(next)
  }

  function handleSaveEdit() {
    onAnswer('edit', editText)
    setEditing(false)
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
      }}
    >
      <p
        style={{
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
        }}
      >
        {step} of {total} · Rule #{rule.number}
      </p>
      <p
        style={{
          color: 'rgba(255,255,255,0.45)',
          margin: '0.45rem 0 0.5rem',
          fontSize: '0.78rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {rule.section}
      </p>
      <div
        style={{
          margin: 0,
          padding: '0.95rem 1.1rem',
          background: 'rgba(0,0,0,0.3)',
          borderLeft: '3px solid rgba(147,197,253,0.5)',
          borderRadius: '0 8px 8px 0',
          fontSize: '0.97rem',
          lineHeight: 1.55,
          color: 'rgba(255,255,255,0.92)',
        }}
      >
        {rule.text}
      </div>

      <label
        style={{
          display: 'block',
          margin: '1rem 0 0.4rem',
          fontSize: '0.78rem',
          color: 'rgba(255,255,255,0.55)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 700,
        }}
      >
        Your answer
      </label>
      <select
        value={choice}
        onChange={handleChange}
        style={{
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
        }}
      >
        <option value="yes">Yes — keep this rule</option>
        <option value="no">No — drop this rule</option>
        <option value="edit">Edit — change the wording</option>
        <option value="skip">Skip — not sure yet</option>
      </select>

      {editing && (
        <div style={{ marginTop: '0.85rem' }}>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '0.7rem 0.8rem',
              fontSize: '0.95rem',
              font: 'inherit',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleSaveEdit}
            style={{
              marginTop: '0.6rem',
              background: '#22c55e',
              color: '#052e16',
              border: 'none',
              borderRadius: '999px',
              padding: '0.55rem 1.15rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Save edit
          </button>
        </div>
      )}

      <p style={{ margin: '0.65rem 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>
        Pick yes if it sounds like you.
      </p>
      <ul
        style={{
          margin: '0.8rem 0 0',
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <li>✓ Yes — sounds like what you do</li>
        <li>✗ No — sounds like the opposite</li>
        <li>✎ Edit — close, but reword it</li>
        <li>○ Skip — you&apos;re not sure</li>
      </ul>
    </div>
  )
}

function ProgressStrip({
  answered,
  batchSize,
  lifetimeAnswered,
  totalRules,
  remainingAfterBatch,
}: {
  answered: number
  batchSize: number
  lifetimeAnswered: number
  totalRules: number
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
          {lifetimeAnswered} of {totalRules} rules answered total
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
        Each yes locks in a rule the AI will follow when it talks to you.
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
        boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
      }}
    >
      {text}
    </div>
  )
}

function Panel({ headline, sub }: { headline: string; sub: string }) {
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
  totalRules,
  remaining,
  onNext,
}: {
  batchSize: number
  lifetimeAnswered: number
  totalRules: number
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
        {lifetimeAnswered} of {totalRules} rules answered total
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
          Every rule has been answered. The AI is ready to load them.
        </p>
      )}
    </div>
  )
}
