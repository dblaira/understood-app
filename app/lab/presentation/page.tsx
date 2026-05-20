import { notFound } from 'next/navigation'
import { buildConstraintNodeTree } from '@/lib/ai/presentation-interceptor'
import { DEFAULT_PRESENTATION_CONSTRAINTS } from '@/lib/ai/default-presentation-constraints'
import { validateSearchChatDisplay } from '@/lib/ai/search-chat-display'
import type { SearchChatDisplay } from '@/types/search-chat-display'
import { AssistantStructuredMessage } from '@/components/assistant-structured-message'

const DEMO_DISPLAY: SearchChatDisplay = {
  lead: 'Notes cluster on app, finance, and health.',
  table: {
    columns: ['Theme', 'Signals', 'Entry'],
    rows: [
      ['App', 'vibe coder · notifications', '[12]'],
      ['Finance', 'CEO moment · Rivian', '[4]'],
      ['Health', 'running · creatine', '[8]'],
    ],
  },
}
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function PresentationLabPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  const constraints = DEFAULT_PRESENTATION_CONSTRAINTS.map((c) => ({ ...c }))
  const tree = buildConstraintNodeTree(constraints, 'You')
  const good = validateSearchChatDisplay(DEMO_DISPLAY)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        padding: '2rem',
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <p style={{ color: '#DC143C', fontSize: '0.75rem', marginBottom: '1rem' }}>
          DEV LAB — no login required
        </p>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '1.5rem', marginBottom: '1rem' }}>
          Presentation guardrail
        </h1>

        <pre
          style={{
            background: '#111',
            border: '1px solid #DC143C',
            padding: '1rem',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            overflow: 'auto',
          }}
        >
          {tree}
        </pre>

        <p style={{ color: good.ok ? '#86EFAC' : '#F87171', fontSize: '0.8rem' }}>
          Structured display: {good.ok ? 'VALID ✓' : good.violations.join(', ')}
        </p>

        <div style={{ marginTop: '1.5rem', background: '#fff', color: '#111', padding: '1rem', borderRadius: '8px' }}>
          <AssistantStructuredMessage display={DEMO_DISPLAY} />
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#999' }}>
          <Link href="/settings/presentation" style={{ color: '#DC143C' }}>
            Signed-in settings →
          </Link>
          {' · '}
          <Link href="/login" style={{ color: '#DC143C' }}>
            Log in to use AI search →
          </Link>
        </p>
      </div>
    </div>
  )
}
