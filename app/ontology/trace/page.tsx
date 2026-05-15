'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Network, Zap } from 'lucide-react'

type TraceStep = {
  label: string
  detail: string
}

type TraceColumn = {
  response: string
  trace: TraceStep[]
  verdict: string
}

type PromptCase = {
  id: number
  label: string
  short: string
  llm: TraceColumn
  ontology: TraceColumn
}

const PROMPTS: PromptCase[] = [
  {
    id: 0,
    label: 'Who should I prioritize for outreach this week?',
    short: 'Outreach priority',
    llm: {
      response:
        'Prioritize these groups:\n\n- people who already understand the problem\n- people with budget or decision authority\n- people who recently showed interest\n- people in industries where AI reliability matters\n\nStart with the warmest contacts and avoid cold outreach until the offer is clearer.',
      trace: [
        { label: 'Match phrase', detail: '"prioritize outreach" maps to common sales and relationship advice.' },
        { label: 'Retrieve patterns', detail: 'Uses broad public patterns: warm leads, decision makers, buyer personas.' },
        { label: 'Generate', detail: 'Creates plausible advice for an abstract person.' },
        { label: 'Output', detail: 'Useful, but not anchored to your actual contacts or signals.' },
      ],
      verdict: 'Good general advice. No memory of your graph.',
    },
    ontology: {
      response:
        'Prioritize contacts with three graph signals:\n\n- showed recent engagement\n- used your language without prompting\n- connects to a current project or trusted relationship\n\nDeprioritize contacts marked as low-context, low-follow-through, or conceptually uninterested.',
      trace: [
        { label: 'Parse intent', detail: '"prioritize outreach" becomes a ranking task, not a brainstorming task.' },
        { label: 'Query graph', detail: 'Looks for people connected to recent engagement, shared language, and project relevance.' },
        { label: 'Traverse links', detail: 'Moves from contact to signal to project to follow-up status.' },
        { label: 'Filter', detail: 'Drops contacts with negative signals or weak relevance.' },
        { label: 'Output', detail: 'Ranks based on your stored evidence, not a generic persona list.' },
      ],
      verdict: 'Same question. Different source of authority.',
    },
  },
  {
    id: 1,
    label: "What's an operator?",
    short: 'Define operator',
    llm: {
      response:
        'An operator can mean several things:\n\n- a person who runs or manages a system\n- a business leader focused on execution\n- a technical role that maintains infrastructure\n- a math symbol or function\n\nThe exact meaning depends on context.',
      trace: [
        { label: 'Tokenize', detail: '"operator" has many common meanings.' },
        { label: 'Weight context', detail: 'Business and technical meanings score highly.' },
        { label: 'Synthesize', detail: 'Combines common dictionary-style meanings.' },
        { label: 'Output', detail: 'Explains the public word, not your private concept.' },
      ],
      verdict: 'Accurate enough. Not personal enough.',
    },
    ontology: {
      response:
        'In your ontology, an operator is not just a competent person.\n\n- builds or commands tools instead of passively consuming them\n- accepts responsibility for outcomes\n- wants leverage, not reassurance\n- responds to constraints by creating systems\n\nOpposite pattern: someone who wants the system to remove agency.',
      trace: [
        { label: 'Lookup concept', detail: 'Finds the local :Operator concept instead of public dictionary senses.' },
        { label: 'Fetch properties', detail: 'Retrieves attached traits: tool use, ownership, leverage, agency.' },
        { label: 'Find contrast', detail: 'Checks the opposite pattern because contrast makes the concept visible.' },
        { label: 'Apply boundary', detail: 'Keeps the answer inside your intended meaning.' },
      ],
      verdict: 'The answer is constrained by your concept system.',
    },
  },
  {
    id: 2,
    label: 'How should I spend my time today?',
    short: 'Time allocation',
    llm: {
      response:
        'A reasonable plan:\n\n- do important work during your highest-energy window\n- group similar tasks together\n- handle urgent obligations early\n- take breaks before fatigue compounds\n- end by reviewing tomorrow\n\nAdjust based on your deadlines and energy.',
      trace: [
        { label: 'Match phrase', detail: '"spend my time" maps to productivity advice.' },
        { label: 'Retrieve frameworks', detail: 'Pulls common patterns: time blocking, deep work, priority matrices.' },
        { label: 'Generate', detail: 'Builds a broadly reasonable schedule.' },
        { label: 'Output', detail: 'Helpful, but it does not know your projects, body state, or constraints.' },
      ],
      verdict: 'Generic optimization for a generic person.',
    },
    ontology: {
      response:
        'Use today to test the ontology, not perfect it.\n\n- highest value: compare normal LLM answers against ontology-grounded answers\n- avoid: polishing trivial triples that do not change decisions\n- watch for: contradictions, missing links, and surprising adjacencies\n- done: you can see whether the system gives better judgment, not just better labels',
      trace: [
        { label: 'Fetch current project', detail: 'Ontology build is the active bottleneck.' },
        { label: 'Read frustration signal', detail: 'Repeated confusion means the next task must create contrast.' },
        { label: 'Apply rule', detail: 'If abstract definitions fail, show side-by-side mechanism traces.' },
        { label: 'Rank work', detail: 'Testing the contrast beats adding more unexplained ontology material.' },
      ],
      verdict: 'Anchored to the actual work and failure mode.',
    },
  },
]

export default function OntologyTracePage() {
  const router = useRouter()
  const [activePrompt, setActivePrompt] = useState(0)
  const [llmTraceOpen, setLlmTraceOpen] = useState(false)
  const [ontologyTraceOpen, setOntologyTraceOpen] = useState(false)
  const prompt = PROMPTS[activePrompt]

  function switchPrompt(id: number) {
    setActivePrompt(id)
    setLlmTraceOpen(false)
    setOntologyTraceOpen(false)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8f7f2',
        color: '#1c1917',
        padding: '2rem',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => router.push('/ontology')}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#57534e',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: 0,
            marginBottom: '1.5rem',
          }}
        >
          ← Back to ontology
        </button>

        <header style={{ borderBottom: '2px solid #1c1917', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)', lineHeight: 1.02, margin: '0 0 1rem', fontWeight: 800, letterSpacing: 0 }}>
            Same prompt. <span style={{ color: '#78716c', fontStyle: 'italic', fontWeight: 400 }}>Different paths.</span>
          </h1>
          <p style={{ color: '#44403c', fontSize: '1.35rem', lineHeight: 1.45, margin: 0, maxWidth: '820px' }}>
            The outputs can look similar. The difference is what the model was allowed to use before answering.
          </p>
        </header>

        <section style={{ background: '#fff', border: '2px solid #78716c', padding: '1.25rem', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#57534e', margin: '0 0 0.75rem' }}>
            Why this finally clicks
          </p>
          <p style={{ color: '#292524', fontSize: '1.25rem', lineHeight: 1.45, margin: '0 0 1rem' }}>
            Your issue was not the concept. It was the presentation. Tiny triples are too low-signal until they are contrasted against something.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <AptitudeCard title="Inductive reasoning" text="Needs repeated cases. One definition is weak; three side-by-side examples reveal the pattern." />
            <AptitudeCard title="Numerical reasoning" text="Needs ranked, checkable signals. Counts, filters, thresholds, and evidence make the mechanism inspectable." />
            <AptitudeCard title="Ideaphoria" text="Generates many possible meanings. The graph constrains which meaning is allowed to drive the answer." />
            <AptitudeCard title="Objective mode" text="Needs an external trace. Seeing the path lets you judge the system instead of trusting the output." />
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#57534e', margin: '0 0 0.75rem' }}>
            Choose a prompt
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {PROMPTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchPrompt(item.id)}
                style={{
                  textAlign: 'left',
                  border: activePrompt === item.id ? '2px solid #1c1917' : '2px solid #a8a29e',
                  background: activePrompt === item.id ? '#1c1917' : '#fff',
                  color: activePrompt === item.id ? '#fafaf9' : '#1c1917',
                  padding: '1rem',
                  cursor: 'pointer',
                  minHeight: '96px',
                }}
              >
                <span style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, fontWeight: 800, marginBottom: '0.45rem' }}>
                  Prompt {item.id + 1}
                </span>
                <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 800 }}>{item.short}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ background: '#fff', border: '2px solid #1c1917', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#57534e', margin: '0 0 0.75rem' }}>
            User asks
          </p>
          <p style={{ fontSize: 'clamp(1.55rem, 3vw, 2.25rem)', lineHeight: 1.25, fontStyle: 'italic', margin: 0 }}>
            “{prompt.label}”
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <TraceCard
            title="LLM only"
            subtitle="no ontology"
            icon={<Zap size={26} />}
            data={prompt.llm}
            open={llmTraceOpen}
            onToggle={() => setLlmTraceOpen((value) => !value)}
            strong={false}
          />
          <TraceCard
            title="LLM + Ontology / KG"
            subtitle="grounded"
            icon={<Network size={26} />}
            data={prompt.ontology}
            open={ontologyTraceOpen}
            onToggle={() => setOntologyTraceOpen((value) => !value)}
            strong
          />
        </section>

        <section style={{ borderTop: '2px solid #1c1917', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#57534e', margin: '0 0 1rem' }}>
            Pattern check
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <PatternCard title="Source" llm="Averaged public patterns." ontology="Your stored concepts and evidence." />
            <PatternCard title="Method" llm="Predict the next useful answer." ontology="Query, traverse, filter, then answer." />
            <PatternCard title="Value" llm="Often smooth and plausible." ontology="Can show missing links, conflicts, and non-obvious fit." />
            <PatternCard title="Aptitude fit" llm="Asks you to trust fluent prose." ontology="Lets you pattern-match the process." />
          </div>
        </section>
      </div>
    </main>
  )
}

function AptitudeCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: '#fafaf9', border: '1px solid #d6d3d1', padding: '0.9rem' }}>
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.45rem', fontWeight: 800 }}>{title}</h2>
      <p style={{ color: '#44403c', fontSize: '1rem', lineHeight: 1.4, margin: 0 }}>{text}</p>
    </div>
  )
}

function TraceCard({
  title,
  subtitle,
  icon,
  data,
  open,
  onToggle,
  strong,
}: {
  title: string
  subtitle: string
  icon: ReactNode
  data: TraceColumn
  open: boolean
  onToggle: () => void
  strong: boolean
}) {
  return (
    <article
      style={{
        background: '#fff',
        border: strong ? '2px solid #1c1917' : '2px solid #a8a29e',
        boxShadow: strong ? '6px 6px 0 #1c1917' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          borderBottom: strong ? '2px solid #1c1917' : '2px solid #a8a29e',
          background: strong ? '#1c1917' : '#e7e5e4',
          color: strong ? '#fafaf9' : '#292524',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {icon}
        <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>{title}</h2>
        <span style={{ marginLeft: 'auto', fontSize: '0.95rem', opacity: 0.72, fontStyle: 'italic' }}>{subtitle}</span>
      </div>

      <div style={{ padding: '1.25rem', flex: 1 }}>
        <p style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#57534e', margin: '0 0 0.75rem' }}>
          Response
        </p>
        <p style={{ whiteSpace: 'pre-line', color: '#1c1917', fontSize: '1.2rem', lineHeight: 1.55, margin: 0 }}>
          {data.response}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        style={{
          border: 'none',
          borderTop: strong ? '2px solid #1c1917' : '2px solid #a8a29e',
          background: strong ? '#fafaf9' : '#fff',
          color: '#1c1917',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '1rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {open ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
        {open ? 'Hide the path' : 'Show the path'}
      </button>

      {open && (
        <div
          style={{
            borderTop: strong ? '2px solid #44403c' : '2px solid #d6d3d1',
            background: strong ? '#1c1917' : '#f5f5f4',
            color: strong ? '#fafaf9' : '#1c1917',
            padding: '1.25rem',
          }}
        >
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
            {data.trace.map((step, index) => (
              <li key={step.label} style={{ display: 'grid', gridTemplateColumns: '2.25rem 1fr', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: strong ? '#fbbf24' : '#78716c' }}>{index + 1}</span>
                <span>
                  <strong style={{ display: 'block', fontSize: '1.12rem', color: strong ? '#fcd34d' : '#1c1917', marginBottom: '0.25rem' }}>
                    {step.label}
                  </strong>
                  <span style={{ display: 'block', fontSize: '1rem', lineHeight: 1.45, color: strong ? '#e7e5e4' : '#44403c' }}>
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div style={{ borderTop: strong ? '2px solid #44403c' : '2px solid #d6d3d1', marginTop: '1.25rem', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: strong ? '#fbbf24' : '#57534e', margin: '0 0 0.4rem' }}>
              Verdict
            </p>
            <p style={{ fontSize: '1.18rem', lineHeight: 1.45, margin: 0, fontStyle: 'italic' }}>{data.verdict}</p>
          </div>
        </div>
      )}
    </article>
  )
}

function PatternCard({ title, llm, ontology }: { title: string; llm: string; ontology: string }) {
  return (
    <div style={{ background: '#fff', border: '2px solid #a8a29e', padding: '1.15rem' }}>
      <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.85rem', fontWeight: 800 }}>{title}</h3>
      <p style={{ fontSize: '1.1rem', lineHeight: 1.45, margin: 0, color: '#292524' }}>
        <strong>LLM:</strong> {llm}
        <br />
        <br />
        <strong>Ontology:</strong> {ontology}
      </p>
    </div>
  )
}
