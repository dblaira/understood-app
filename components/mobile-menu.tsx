'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LIFE_DOMAINS } from '@/types/ontology'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  currentFilter: string
  onFilterChange: (category: string) => void
  currentEntryType: string | null
  onEntryTypeChange: (type: string | null) => void
  onLogout?: () => void
  onCompose?: () => void
  showTimeline?: boolean
  onToggleTimeline?: () => void
}

const categories = ['all', ...LIFE_DOMAINS]

const entryTypes = [
  { value: 'story', label: 'Stories', icon: '📰' },
  { value: 'note', label: 'Notes', icon: '📝' },
  { value: 'action', label: 'Actions', icon: '☑' },
  { value: 'connection', label: 'Connections', icon: '🔗' },
]

export function MobileMenu({
  isOpen,
  onClose,
  currentFilter,
  onFilterChange,
  currentEntryType,
  onEntryTypeChange,
  onLogout,
  onCompose,
  showTimeline = false,
  onToggleTimeline,
}: MobileMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCategoryClick = (category: string) => {
    onFilterChange(category)
    onClose()
  }

  const handleEntryTypeClick = (type: string | null) => {
    onEntryTypeChange(type === currentEntryType ? null : type)
    onClose()
  }

  const handleRouteClick = (href: string) => {
    router.push(href)
    onClose()
  }

  return (
    <div 
      className="mobile-menu-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000000',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Close button - positioned with safe area */}
      <button
        onClick={onClose}
        aria-label="Close menu"
        style={{
          position: 'absolute',
          top: 'calc(1rem + env(safe-area-inset-top, 0px))',
          right: '1rem',
          background: 'transparent',
          border: 'none',
          color: '#FFFFFF',
          fontSize: '1rem',
          fontWeight: 600,
          letterSpacing: '0.1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          zIndex: 10,
        }}
      >
        CLOSE
        <span style={{ fontSize: '1.25rem' }}>✕</span>
      </button>

      {/* Menu content - scrollable with padding for fixed bottom */}
      <nav
        style={{
          padding: '4rem 1.5rem 0',
          paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))',
          paddingBottom: '12rem', // Space for fixed bottom section
          height: '100%',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* ── ENTRIES SECTION (primary) ─────────────────────── */}

        {/* All Entries */}
        {onToggleTimeline && (
          <button
            onClick={() => {
              onToggleTimeline()
              onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '1rem 0',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              color: showTimeline ? '#DC143C' : '#FFFFFF',
              fontSize: '1rem',
              fontWeight: 600,
              letterSpacing: '0.15rem',
              textTransform: 'uppercase',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
          >
            <span>📅 All Entries</span>
            {showTimeline && (
              <span style={{ marginLeft: 'auto', color: '#DC143C' }}>●</span>
            )}
          </button>
        )}

        {/* Entry Types */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {entryTypes.map((type) => (
            <li key={type.value}>
              <button
                onClick={() => handleEntryTypeClick(type.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '1rem 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  color: currentEntryType === type.value && !showTimeline ? '#DC143C' : '#FFFFFF',
                  fontSize: '1rem',
                  fontWeight: 600,
                  letterSpacing: '0.15rem',
                  textTransform: 'uppercase',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                }}
              >
                <span>{type.icon} {type.label}</span>
                {currentEntryType === type.value && !showTimeline && (
                  <span style={{ float: 'right', color: '#DC143C' }}>●</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Workspace */}
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.15rem',
            textTransform: 'uppercase',
            margin: '1.5rem 0 0.75rem',
          }}
        >
          Workspace
        </div>
        <button
          onClick={() => handleRouteClick('/ontology')}
          style={{
            display: 'block',
            width: '100%',
            padding: '1rem 0',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: pathname === '/ontology' ? '#DC143C' : '#FFFFFF',
            fontSize: '1rem',
            fontWeight: 600,
            letterSpacing: '0.15rem',
            textTransform: 'uppercase',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
        >
          <span>◇ Ontology</span>
          {pathname === '/ontology' && (
            <span style={{ float: 'right', color: '#DC143C' }}>●</span>
          )}
        </button>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            background: 'rgba(255, 255, 255, 0.2)',
            margin: '1.5rem 0',
          }}
        />

        {/* ── LIFE AREAS / THEMES SECTION (secondary) ──────── */}
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.15rem',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          Life domains
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {categories.map((category) => (
            <li key={category}>
              <button
                onClick={() => handleCategoryClick(category)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.875rem 0 0.875rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  color: currentFilter === category ? '#DC143C' : 'rgba(255, 255, 255, 0.8)',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  letterSpacing: '0.1rem',
                  textTransform: 'uppercase',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                }}
              >
                {category === 'all' ? 'All' : category}
                {currentFilter === category && (
                  <span style={{ float: 'right', color: '#DC143C' }}>●</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Compose button - for detailed, thoughtful entries */}
        {onCompose && (
          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={() => {
                onCompose()
                onClose()
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '1rem 1.5rem',
                background: '#DC143C',
                border: 'none',
                borderRadius: '4px',
                color: '#FFFFFF',
                fontSize: '1rem',
                fontWeight: 600,
                letterSpacing: '0.1rem',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              + Compose
            </button>
          </div>
        )}

        {/* Bottom section - fixed at bottom */}
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1.5rem',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: '#000000',
          }}
        >
          {/* Ontology */}
          <button
            onClick={() => handleRouteClick('/ontology')}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.875rem 1.5rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.1rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            Ontology
          </button>
          {/* Settings button */}
          <button
            onClick={() => {
              router.push('/settings')
              onClose()
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.875rem 1.5rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.1rem',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            Settings
          </button>
          {/* Logout button */}
          {onLogout && (
            <button
              onClick={() => {
                onLogout()
                onClose()
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.1rem',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
