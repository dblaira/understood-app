'use client'

import type { SearchChatDisplay } from '@/types/search-chat-display'
import { Fragment } from 'react'
import { VisualNodeTree } from './visual-node-tree'

function DisplayGridTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: string[][]
}) {
  const colTemplate = `repeat(${columns.length}, minmax(0, 1fr))`

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        width: '100%',
        minWidth: 0,
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        overflow: 'hidden',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      {columns.map((col) => (
        <div
          key={col}
          style={{
            gridColumn: 'span 1',
            padding: '0.5rem 0.65rem',
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#DC143C',
            background: '#FAFAFA',
            borderBottom: '2px solid #DC143C',
          }}
        >
          {col}
        </div>
      ))}
      {rows.map((row, ri) =>
        row.map((cell, ci) => (
          <div
            key={`${ri}-${ci}`}
            style={{
              padding: '0.55rem 0.65rem',
              color: ci === 0 ? '#111827' : '#4B5563',
              fontWeight: ci === 0 ? 600 : 400,
              lineHeight: 1.4,
              background: ri % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
              borderBottom: '1px solid #F3F4F6',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {cell}
          </div>
        ))
      )}
    </div>
  )
}

export function AssistantStructuredMessage({ display }: { display: SearchChatDisplay }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
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
        <DisplayGridTable
          columns={display.table.columns}
          rows={display.table.rows}
        />
      )}

      {display.matrix &&
        display.matrix.row_labels.length > 0 &&
        display.matrix.col_labels.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${display.matrix.col_labels.length + 1}, minmax(0, 1fr))`,
              gap: '1px',
              width: '100%',
              minWidth: 0,
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
                  minWidth: 0,
                  overflowWrap: 'anywhere',
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
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {rowLabel}
                </div>
                {(display.matrix!.cells[ri] || []).map((cell, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    style={{
                      background: '#FFFFFF',
                      padding: '0.4rem',
                      color: '#4B5563',
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                    }}
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
