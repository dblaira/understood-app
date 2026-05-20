'use client'

/** Cognitive fit cheat sheet — when to use each display component */
export function FormatSelectionGuide() {
  const rows = [
    ['What / list / find', 'Table', 'Categories, exact lookup'],
    ['Compare / vs / intersect', 'Matrix', 'Two axes crossing'],
    ['How / flow / architecture', 'Node tree', 'Parent → child logic'],
    ['Why / so what', 'Lead + small table', 'Punchline then data'],
    ['Trends over time', 'Chart (future)', 'Pattern — not exact digits'],
  ]

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#DC143C',
          marginBottom: '0.5rem',
        }}
      >
        Cognitive fit — format vs question
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.72rem',
          border: '1px solid #333',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #DC143C' }}>
            {['Question type', 'Use', 'Why'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '0.4rem',
                  color: '#DC143C',
                  fontWeight: 700,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} style={{ borderBottom: '1px solid #222' }}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  style={{
                    padding: '0.4rem',
                    color: i === 0 ? '#E5E5E5' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.5rem' }}>
        A = prompt rules (Cursor + API). B = auto-router on each search query. Both active.
      </p>
    </div>
  )
}
