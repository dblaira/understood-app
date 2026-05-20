'use client'

import type { SearchChatDisplay } from '@/types/search-chat-display'
import { Fragment } from 'react'
import { VisualNodeTree } from './visual-node-tree'

export function AssistantStructuredMessage({ display }: { display: SearchChatDisplay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-bodoni-moda), Georgia, serif",
          fontSize: '1.05rem',
          fontWeight: 400,
          color: '#111827',
          lineHeight: 1.3,
        }}
      >
        {display.lead}
      </p>

      {display.table && display.table.columns.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
            }}
          >
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '2px solid #DC143C' }}>
                {display.table.columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.65rem',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#DC143C',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.table.rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    borderBottom: '1px solid #F3F4F6',
                    background: ri % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                  }}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: '0.55rem 0.65rem',
                        color: ci === 0 ? '#111827' : '#4B5563',
                        fontWeight: ci === 0 ? 600 : 400,
                        verticalAlign: 'top',
                        lineHeight: 1.4,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {display.matrix &&
        display.matrix.row_labels.length > 0 &&
        display.matrix.col_labels.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${display.matrix.col_labels.length + 1}, minmax(72px, 1fr))`,
              gap: '1px',
              background: '#E5E7EB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              overflow: 'hidden',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ background: '#FAFAFA', padding: '0.4rem' }} />
            {display.matrix.col_labels.map((label) => (
              <div
                key={label}
                style={{
                  background: '#FAFAFA',
                  padding: '0.4rem',
                  fontWeight: 700,
                  color: '#DC143C',
                  textTransform: 'uppercase',
                  fontSize: '0.6rem',
                  letterSpacing: '0.05em',
                }}
              >
                {label}
              </div>
            ))}
            {display.matrix.row_labels.map((rowLabel, ri) => (
              <Fragment key={rowLabel}>
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '0.4rem',
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  {rowLabel}
                </div>
                {(display.matrix!.cells[ri] || []).map((cell, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    style={{ background: '#FFFFFF', padding: '0.4rem', color: '#4B5563' }}
                  >
                    {cell}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        )}

      {display.tree && display.tree.nodes.length > 0 && (
        <VisualNodeTree tree={display.tree} />
      )}

      {display.follow_up ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280', fontStyle: 'italic' }}>
          {display.follow_up}
        </p>
      ) : null}
    </div>
  )
}
