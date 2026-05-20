'use client'

/** Renders AI answers as scannable theme lines — not raw markdown. */
export function AssistantScanMessage({ content }: { content: string }) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (!lines.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {lines.map((line, i) => {
        const bulletMatch = line.match(/^[\u2022\-*]\s*(.+)$/)
        if (bulletMatch) {
          const body = bulletMatch[1]
          const colon = body.indexOf(':')
          const label = colon >= 0 ? body.slice(0, colon).trim() : body
          const detail = colon >= 0 ? body.slice(colon + 1).trim() : ''

          return (
            <div
              key={i}
              style={{
                padding: '0.55rem 0.65rem',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderLeft: '3px solid #DC143C',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#DC143C',
                  marginBottom: detail ? '0.25rem' : 0,
                }}
              >
                {label}
              </div>
              {detail ? (
                <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.45 }}>
                  {detail}
                </div>
              ) : null}
            </div>
          )
        }

        const isLead = i === 0
        return (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: isLead ? '1rem' : '0.85rem',
              fontWeight: isLead ? 600 : 400,
              color: isLead ? '#111827' : '#4B5563',
              lineHeight: 1.4,
              fontFamily: isLead
                ? "var(--font-bodoni-moda), Georgia, serif"
                : 'var(--font-inter), system-ui, sans-serif',
            }}
          >
            {stripMarkdownNoise(line)}
          </p>
        )
      })}
    </div>
  )
}

function stripMarkdownNoise(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^\|.*\|$/g, '')
    .trim()
}
