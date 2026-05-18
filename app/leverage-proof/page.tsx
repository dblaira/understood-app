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
        height: '100vh',
        overflow: 'hidden',
        background: '#E8E2D8',
        color: '#1A1A1A',
        padding: 0,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            background: '#E8E2D8',
            padding: '1.25rem 2rem 1.15rem',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8B8178',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '0.35rem',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          Back
        </button>

          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: '2rem' }}>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                  fontSize: 'clamp(3rem, 5.2vw, 5.35rem)',
                  fontWeight: 400,
                  color: '#DC143C',
                  lineHeight: 0.88,
                  letterSpacing: '-0.02em',
                }}
              >
                Leverage proof
              </h1>
              <p style={{ margin: '0.55rem 0 0 3.95rem', color: '#8B8178', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1rem', textTransform: 'uppercase' }}>
                Working prototype
              </p>
            </div>
            <p style={{ maxWidth: '560px', margin: 0, color: '#6B7280', lineHeight: 1.45, fontSize: '0.92rem', fontWeight: 500 }}>
            Paste notes, create one possible leverage rule, trust it, then compare a generic answer with a rule-constrained answer.
          </p>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: '1.25rem 2rem 1.5rem' }}>
          <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'minmax(0, 1.45fr) minmax(0, 0.75fr)', gap: '1rem' }}>
        <section
          style={{
            display: 'grid',
                gridTemplateColumns: 'minmax(460px, 1.12fr) minmax(560px, 1fr)',
            gap: '1rem',
                minHeight: 0,
            alignItems: 'stretch',
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
                  rows={10}
              style={largeTextareaStyle}
            />
            <button type="button" onClick={handleGenerateRule} disabled={!canGenerate} style={buttonStyle(!canGenerate)}>
              Generate leverage rule
            </button>
          </StepPanel>

          <div style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: '1rem', minHeight: 0 }}>
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
                    rows={3}
                style={textareaStyle}
              />
              <button type="button" onClick={handleCompare} disabled={!canCompare} style={buttonStyle(!canCompare)}>
                Compare answers
              </button>
            </StepPanel>
          </div>
        </section>

          <section
            style={{
              display: 'grid',
                gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.32fr) minmax(320px, 1fr)',
              gap: '1rem',
                minHeight: 0,
            }}
          >
            <AnswerPanel title="Generic answer" tone="plain">
                {compared ? buildGenericAnswer(question) : 'Run the comparison to see the baseline answer.'}
            </AnswerPanel>
            <AnswerPanel title="Constrained answer" tone="trusted">
                {compared && rule ? buildConstrainedAnswer(question, rule) : 'Trust a rule, then compare to see the constrained answer.'}
            </AnswerPanel>
              {compared && rule ? (
                <TracePanel rule={rule} />
              ) : (
                <EmptyTracePanel />
              )}
          </section>
          </div>
        </div>
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
        height: '100%',
        minHeight: 0,
        border: active ? '1px solid #f0f0f0' : '1px solid #e5e7eb',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '1rem',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <p style={{ margin: 0, color: active ? '#DC143C' : '#9CA3AF', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Step {step}
      </p>
      <h2 style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#1A1A1A' }}>{title}</h2>
      {children}
    </div>
  )
}

function RulePreview({ rule, trusted }: { rule: LeverageRule; trusted: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.75rem', flex: 1, minHeight: 0 }}>
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
      <p style={{ gridColumn: '1 / -1', margin: 0, color: trusted ? '#059669' : '#D97706', fontSize: '0.82rem', fontWeight: 700 }}>
        {trusted ? 'Trusted: this rule can constrain the answer.' : 'Not trusted yet: this cannot constrain the answer.'}
      </p>
    </div>
  )
}

function AnswerPanel({ title, tone, children }: { title: string; tone: 'plain' | 'trusted'; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: tone === 'trusted' ? '1px solid rgba(74,222,128,0.35)' : '1px solid rgba(255,255,255,0.12)',
        borderColor: tone === 'trusted' ? '#bbf7d0' : '#f0f0f0',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '1.05rem',
        minHeight: 0,
        overflow: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1A1A1A' }}>{title}</h2>
      <p style={{ whiteSpace: 'pre-line', margin: 0, color: '#1A1A1A', lineHeight: 1.5, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '1rem' }}>{children}</p>
    </div>
  )
}

function TracePanel({ rule }: { rule: LeverageRule }) {
  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '1.05rem',
        minHeight: 0,
        overflow: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1A1A1A' }}>Trace</h2>
      <p style={labelStyle}>Used trusted rule</p>
      <p style={{ margin: '0 0 0.9rem', color: '#1A1A1A', lineHeight: 1.45 }}>{rule.rule}</p>
      <p style={labelStyle}>Evidence</p>
      <ul style={{ margin: 0, paddingLeft: '1rem', color: '#4B5563', lineHeight: 1.4, fontSize: '0.88rem' }}>
        {rule.evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function EmptyTracePanel() {
  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        background: '#FFFFFF',
        padding: '1.05rem',
        minHeight: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1A1A1A' }}>Trace</h2>
      <p style={{ margin: 0, color: '#6B7280', lineHeight: 1.5 }}>
        The trace will show which trusted rule changed the answer.
      </p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: '140px',
        display: 'grid',
        placeItems: 'center',
        border: '1px dashed #d1d5db',
        borderRadius: '8px',
        color: '#6B7280',
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
  color: '#6B7280',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  flex: 1,
  minHeight: 0,
  background: '#FDFCFA',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  color: '#1A1A1A',
  font: 'inherit',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: '1.02rem',
  lineHeight: 1.5,
  padding: '0.85rem',
  resize: 'vertical',
  outline: 'none',
}

const largeTextareaStyle: React.CSSProperties = {
  ...textareaStyle,
  minHeight: 0,
}

const ruleBoxStyle: React.CSSProperties = {
  border: '1px solid #f0f0f0',
  borderRadius: '8px',
  background: '#FDFCFA',
  padding: '0.75rem',
  minHeight: 0,
  overflow: 'auto',
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: '0.75rem',
    width: '100%',
    border: disabled ? '1px solid #d1d5db' : '1px solid #DC143C',
    background: disabled ? '#F5F0E8' : '#DC143C',
    color: disabled ? '#9CA3AF' : '#FFFFFF',
    borderRadius: '8px',
    padding: '0.62rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
