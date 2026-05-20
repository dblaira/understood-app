'use client'

import { NotificationSettings } from '@/components/notification-settings'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      padding: '2rem',
      fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '2rem',
          }}
        >
          ← Back
        </button>

        <h1 style={{
          fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
          fontSize: '2.25rem',
          fontWeight: 700,
          marginBottom: '2.5rem',
        }}>
          Settings
        </h1>

        <NotificationSettings />

        <section style={{ marginTop: '2.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>AI presentation</h2>
          <button
            type="button"
            onClick={() => router.push('/settings/presentation')}
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(220,20,60,0.15)',
              border: '1px solid #DC143C',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Open guardrail graph →
          </button>
        </section>
      </div>
    </div>
  )
}
