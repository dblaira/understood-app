'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type LeverageRule = {
  name: string
  input: string
  outcome: string
  rule: string
  evidence: string[]
}

const DEFAULT_NOTES = `When I do not know the steps, I keep researching and asking AI instead of building.
Once there is a full draft in front of me, I can spot what is wrong quickly.
I get frustrated when Codex or Claude skips the formal process and starts implementing.
I want the assistant to fill in the whole chain so I can analyze the result.`

const DEFAULT_QUESTION = 'Help me build an ontology for personal leverage.'

export default function LeverageProofPage() {
  const router = useRouter()
  const [notes, setNotes] = useState(DEFAULT_NOTES)
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [rule, setRule] = useState<LeverageRule | null>(null)
  const [trusted, setTrusted] = useState(false)
  const [compared, setCompared] = useState(false)

  const noteLines = useMemo(() => splitNotes(notes), [notes])
  const canGenerate = noteLines.length > 0
  const canCompare = trusted && rule && question.trim().length > 0

  function handleGenerateRule() {
    const nextRule = buildLeverageRule(noteLines)
    setRule(nextRule)
    setTrusted(false)
    setCompared(false)
  }

  function handleTrustRule() {
    setTrusted(true)
    setCompared(false)
  }

  function handleCompare() {
    if (!canCompare) return
    setCompared(true)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        padding: '2rem',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          Back
        </button>

        <header style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.45rem', color: '#93c5fd', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Working prototype
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
              fontSize: 'clamp(2rem, 4vw, 4.25rem)',
              fontWeight: 700,
              lineHeight: 0.95,
            }}
          >
            Leverage proof
          </h1>
          <p style={{ maxWidth: '720px', margin: '0.85rem 0 0', color: 'rgba(255,255,255,0.68)', lineHeight: 1.55 }}>
            Paste notes, create one possible leverage rule, trust it, then compare a generic answer with a rule-constrained answer.
          </p>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <StepPanel step="1" title="Paste notes" active>
            <textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                setRule(null)
                setTrusted(false)
                setCompared(false)
              }}
              rows={12}
              style={textareaStyle}
            />
            <button type="button" onClick={handleGenerateRule} disabled={!canGenerate} style={buttonStyle(!canGenerate)}>
              Generate leverage rule
            </button>
          </StepPanel>

          <StepPanel step="2" title="Trust rule" active={Boolean(rule)}>
            {rule ? (
              <>
                <RulePreview rule={rule} trusted={trusted} />
                <button type="button" onClick={handleTrustRule} disabled={trusted} style={buttonStyle(trusted)}>
                  {trusted ? 'Rule trusted' : 'Trust this rule'}
                </button>
              </>
            ) : (
              <EmptyState text="Generate a leverage rule first." />
            )}
          </StepPanel>

          <StepPanel step="3" title="Compare answers" active={Boolean(rule && trusted)}>
            <label style={labelStyle}>Question</label>
            <textarea
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value)
                setCompared(false)
              }}
              rows={4}
              style={textareaStyle}
            />
            <button type="button" onClick={handleCompare} disabled={!canCompare} style={buttonStyle(!canCompare)}>
              Compare answers
            </button>
          </StepPanel>
        </section>

        {compared && rule && (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <AnswerPanel title="Generic answer" tone="plain">
              {buildGenericAnswer(question)}
            </AnswerPanel>
            <AnswerPanel title="Constrained answer" tone="trusted">
              {buildConstrainedAnswer(question, rule)}
            </AnswerPanel>
            <TracePanel rule={rule} />
          </section>
        )}
      </div>
    </main>
  )
}

function splitNotes(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
}

function buildLeverageRule(notes: string[]): LeverageRule {
  const joined = notes.join(' ').toLowerCase()
  const processSignals = ['step', 'draft', 'process', 'analyze', 'stuck', 'research', 'implementing']
  const hasProcessPattern = processSignals.some((signal) => joined.includes(signal))

  if (hasProcessPattern) {
    return {
      name: 'Visible process draft',
      input: 'The assistant produces the full ordered draft first.',
      outcome: 'Adam can analyze the draft and spot what is wrong faster.',
      rule: 'When Adam is building a complex system, produce the full ordered draft before asking him to analyze or decide.',
      evidence: notes.slice(0, 4),
    }
  }

  return {
    name: 'Small input with outsized effect',
    input: 'Find the smallest repeatable action named in the notes.',
    outcome: 'Improve the outcome Adam cares about without adding extra complexity.',
    rule: 'When Adam shares personal notes, identify the smallest repeatable action that may create the largest useful improvement.',
    evidence: notes.slice(0, 4),
  }
}

function buildGenericAnswer(prompt: string): string {
  return `For "${prompt}", start by defining the goal, listing terms, organizing them into a taxonomy, adding relationships, and testing the result.`
}

function buildConstrainedAnswer(prompt: string, rule: LeverageRule): string {
  return `I will answer "${prompt}" by applying your trusted rule first: ${rule.rule}

Ordered draft:
1. Define the goal.
2. List the important terms.
3. Build the taxonomy.
4. Add relationships.
5. Add constraints.
6. Create test questions.
7. Run one proof test.

Now you have a complete draft to inspect instead of a blank process to invent.`
}

function StepPanel({
  step,
  title,
  active,
  children,
}: {
  step: string
  title: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: active ? '1px solid rgba(147,197,253,0.38)' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        background: active ? 'rgba(147,197,253,0.07)' : 'rgba(255,255,255,0.03)',
        padding: '1rem',
        minHeight: '320px',
      }}
    >
      <p style={{ margin: 0, color: active ? '#bfdbfe' : 'rgba(255,255,255,0.35)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Step {step}
      </p>
      <h2 style={{ margin: '0.35rem 0 0.8rem', fontSize: '1.15rem' }}>{title}</h2>
      {children}
    </div>
  )
}

function RulePreview({ rule, trusted }: { rule: LeverageRule; trusted: boolean }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.9rem' }}>
      <div style={ruleBoxStyle}>
        <p style={labelStyle}>Possible leverage point</p>
        <p style={{ margin: 0, fontWeight: 800 }}>{rule.name}</p>
      </div>
      <div style={ruleBoxStyle}>
        <p style={labelStyle}>Small input</p>
        <p style={{ margin: 0 }}>{rule.input}</p>
      </div>
      <div style={ruleBoxStyle}>
        <p style={labelStyle}>Outsized result</p>
        <p style={{ margin: 0 }}>{rule.outcome}</p>
      </div>
      <div style={ruleBoxStyle}>
        <p style={labelStyle}>Rule</p>
        <p style={{ margin: 0 }}>{rule.rule}</p>
      </div>
      <p style={{ margin: 0, color: trusted ? '#86efac' : '#facc15', fontSize: '0.84rem', fontWeight: 700 }}>
        {trusted ? 'Trusted: this rule can constrain the answer.' : 'Not trusted yet: this cannot constrain the answer.'}
      </p>
    </div>
  )
}

function AnswerPanel({ title, tone, children }: { title: string; tone: 'plain' | 'trusted'; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: tone === 'trusted' ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        background: tone === 'trusted' ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.04)',
        padding: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{title}</h2>
      <p style={{ whiteSpace: 'pre-line', margin: 0, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>{children}</p>
    </div>
  )
}

function TracePanel({ rule }: { rule: LeverageRule }) {
  return (
    <div
      style={{
        border: '1px solid rgba(250,204,21,0.35)',
        borderRadius: '10px',
        background: 'rgba(250,204,21,0.06)',
        padding: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Trace</h2>
      <p style={labelStyle}>Used trusted rule</p>
      <p style={{ margin: '0 0 0.9rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.5 }}>{rule.rule}</p>
      <p style={labelStyle}>Evidence</p>
      <ul style={{ margin: 0, paddingLeft: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
        {rule.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: '180px',
        display: 'grid',
        placeItems: 'center',
        border: '1px dashed rgba(255,255,255,0.18)',
        borderRadius: '8px',
        color: 'rgba(255,255,255,0.42)',
        textAlign: 'center',
        padding: '1rem',
      }}
    >
      {text}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  margin: '0 0 0.25rem',
  color: 'rgba(255,255,255,0.46)',
  fontSize: '0.72rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,0.28)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '8px',
  color: 'rgba(255,255,255,0.9)',
  font: 'inherit',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  padding: '0.75rem',
  resize: 'vertical',
  outline: 'none',
}

const ruleBoxStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  background: 'rgba(0,0,0,0.2)',
  padding: '0.75rem',
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: '0.85rem',
    width: '100%',
    border: disabled ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(147,197,253,0.55)',
    background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(147,197,253,0.16)',
    color: disabled ? 'rgba(255,255,255,0.35)' : '#bfdbfe',
    borderRadius: '999px',
    padding: '0.7rem 0.9rem',
    fontSize: '0.86rem',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

