'use client'

import Link from 'next/link'
import type { PresentationTrace } from '@/types/presentation'

interface PresentationTraceBadgeProps {
  presentation?: PresentationTrace | null
  variant?: 'light' | 'dark'
}

export function PresentationTraceBadge({
  presentation,
  variant = 'light',
}: PresentationTraceBadgeProps) {
  if (!presentation) return null

  const passed = presentation.lint_passed
  const retries = presentation.retry_count
  const isDark = variant === 'dark'

  return (
    <div
      style={{
        marginTop: variant === 'light' ? '0.5rem' : 0,
        marginLeft: variant === 'light' ? '0.5rem' : 0,
        maxWidth: variant === 'light' ? '85%' : '100%',
        padding: '0.5rem 0.65rem',
        borderRadius: '8px',
        border: `1px solid ${passed ? (isDark ? '#4ADE80' : '#86EFAC') : isDark ? '#F87171' : '#FCA5A5'}`,
        background: passed
          ? isDark
            ? 'rgba(74, 222, 128, 0.12)'
            : '#F0FDF4'
          : isDark
            ? 'rgba(248, 113, 113, 0.12)'
            : '#FEF2F2',
        fontSize: '0.7rem',
        lineHeight: 1.4,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: passed ? (isDark ? '#86EFAC' : '#166534') : isDark ? '#FCA5A5' : '#991B1B',
        }}
      >
        {passed ? '✓ Format guardrail passed' : '⚠ Format guardrail incomplete'}
        {retries > 0 ? ` · ${retries} retr${retries === 1 ? 'y' : 'ies'}` : ''}
      </div>
      <div
        style={{
          color: passed ? (isDark ? '#BBF7D0' : '#15803D') : isDark ? '#FECACA' : '#B91C1C',
          marginTop: '0.2rem',
        }}
      >
        {presentation.constraints_applied} rules applied
      </div>
      {!passed && presentation.violations.length > 0 && (
        <div
          style={{
            color: isDark ? '#FECACA' : '#B91C1C',
            marginTop: '0.25rem',
          }}
        >
          {presentation.violations[0]}
        </div>
      )}
      <Link
        href="/settings/presentation"
        style={{ display: 'inline-block', marginTop: '0.35rem', color: '#DC143C', fontWeight: 600 }}
      >
        Edit graph →
      </Link>
    </div>
  )
}
