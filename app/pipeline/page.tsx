'use client'

import { useRouter } from 'next/navigation'

type Stage = {
  step: number
  name: string
  example: string
  whatHappens: string
  accent: string
}

const SAMPLE_BELIEF = '"Capture first, structure later."'

const STAGES: Stage[] = [
  {
    step: 1,
    name: 'WRITE',
    example: 'I write "Capture first, structure later" in the app.',
    whatHappens: 'The text gets saved.',
    accent: '#fbbf24',
  },
  {
    step: 2,
    name: 'TAG',
    example: 'The app tags it: Process Anchor.',
    whatHappens: 'Every belief gets a kind (anchor, principle, pattern interrupt, etc).',
    accent: '#fbbf24',
  },
  {
    step: 3,
    name: 'TRANSLATE',
    example: 'Text becomes a triple:\n\nI  →  prefer  →  CaptureFirst',
    whatHappens: 'The belief is broken into Subject → Verb → Object. That’s what makes it machine-readable.',
    accent: '#fbbf24',
  },
  {
    step: 4,
    name: 'STAMP',
    example: 'source = Connections Journal\nconfidence = 95%\ndate = Apr 4',
    whatHappens: 'Every fact gets a label saying where it came from and how sure we are. This is what makes the AI trustworthy later.',
    accent: '#fbbf24',
  },
  {
    step: 5,
    name: 'APPROVE',
    example: 'I open /beliefs, see this rule, click Yes.',
    whatHappens: 'Only approved rules go in the graph. Nothing the AI hasn’t cleared with me.',
    accent: '#4ade80',
  },
  {
    step: 6,
    name: 'STORE',
    example: 'Row written to the graph.',
    whatHappens: 'The graph grows by one trusted fact.',
    accent: '#4ade80',
  },
  {
    step: 7,
    name: 'QUERY',
    example:
      'Later I write: "overwhelmed by new project."\n\nThe AI asks the graph: what does Adam do when stuck?',
    whatHappens: 'The graph returns matching rules.',
    accent: '#60a5fa',
  },
  {
    step: 8,
    name: 'ANSWER',
    example:
      'AI replies: "Capture what you have. Structure later. (Your rule from Apr 4.)"',
    whatHappens: 'The AI uses the rule AND cites where it came from. Auditable.',
    accent: '#60a5fa',
  },
  {
    step: 9,
    name: 'FEEDBACK',
    example:
      'I say "yes, that helped." Confidence rises to 97%.\n\nOr: "no, drop it." The rule retires.',
    whatHappens: 'Every answer teaches the graph. Bad rules get pruned. Good rules get stronger.',
    accent: '#c084fc',
  },
]

export default function PipelinePage() {
  const router = useRouter()

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
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
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
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '2rem',
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: '2.4rem',
            lineHeight: 1.15,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          How a belief becomes something the AI follows.
        </h1>
        <p
          style={{
            margin: '0.85rem 0 0',
            fontSize: '1.1rem',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          Nine stages. One sample belief — {SAMPLE_BELIEF} — walks through each.
        </p>

        <div style={{ marginTop: '2.5rem' }}>
          {STAGES.map((stage, i) => (
            <StageCard key={stage.step} stage={stage} isLast={i === STAGES.length - 1} />
          ))}
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'linear-gradient(135deg, rgba(134,239,172,0.14), rgba(96,165,250,0.1))',
            border: '1px solid rgba(134,239,172,0.4)',
            borderRadius: '14px',
            padding: '1.5rem 1.75rem',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#bbf7d0',
            }}
          >
            The trust loop
          </p>
          <p
            style={{
              margin: '0.6rem 0 0',
              fontSize: '1.15rem',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            Every fact knows where it came from, who approved it, how confident, and when. So every AI answer can be audited back to its source.
          </p>
          <p
            style={{
              margin: '0.75rem 0 0',
              fontSize: '0.95rem',
              lineHeight: 1.55,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            Disagree with a rule it cited? Retire the rule. That breaks the bad memory at the root.
          </p>
        </div>
      </div>
    </div>
  )
}

function StageCard({ stage, isLast }: { stage: Stage; isLast: boolean }) {
  return (
    <div style={{ position: 'relative', marginBottom: isLast ? 0 : '1.25rem' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px',
          padding: '1.5rem 1.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '1.1rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              lineHeight: 1,
              color: stage.accent,
              letterSpacing: '-0.02em',
            }}
          >
            {stage.step}
          </span>
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.05em',
            }}
          >
            {stage.name}
          </span>
        </div>

        <div
          style={{
            marginTop: '1.1rem',
            padding: '1rem 1.15rem',
            background: 'rgba(0,0,0,0.35)',
            borderLeft: `4px solid ${stage.accent}`,
            borderRadius: '0 10px 10px 0',
            fontSize: '1.1rem',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.95)',
            whiteSpace: 'pre-line',
            fontFamily: 'inherit',
          }}
        >
          {stage.example}
        </div>

        <p
          style={{
            margin: '1rem 0 0',
            fontSize: '1rem',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          {stage.whatHappens}
        </p>
      </div>

      {!isLast && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            margin: '0.65rem 0 -0.4rem',
            color: 'rgba(255,255,255,0.35)',
            fontSize: '1.6rem',
            lineHeight: 1,
          }}
        >
          ↓
        </div>
      )}
    </div>
  )
}
