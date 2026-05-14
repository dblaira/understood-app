'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { EntryType } from '@/types'
import { LIFE_DOMAINS } from '@/types/ontology'
import { AiSearchIcon } from './ai-search-icon'

interface DesktopSidebarProps {
  currentLifeArea: string
  onLifeAreaChange: (area: string) => void
  currentEntryType: EntryType | null
  onEntryTypeChange: (type: EntryType | null) => void
  onCompose: () => void
  onLogout: () => void
  actionCount?: number
  isExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  showTimeline?: boolean
  onToggleTimeline?: () => void
  onOpenChat?: () => void
  onGenerateWeeklyTheme?: () => void
  isGeneratingTheme?: boolean
  hasWeeklyTheme?: boolean
}

const lifeAreas = [
  { value: 'all', label: 'All' },
  ...LIFE_DOMAINS.map((d) => ({ value: d, label: d })),
]

const entryTypes: { value: EntryType; label: string; icon: string }[] = [
  { value: 'story', label: 'Stories', icon: '📰' },
  { value: 'note', label: 'Notes', icon: '📝' },
  { value: 'action', label: 'Actions', icon: '☑' },
  { value: 'connection', label: 'Connections', icon: '🔗' },
]

export function DesktopSidebar({
  currentLifeArea,
  onLifeAreaChange,
  currentEntryType,
  onEntryTypeChange,
  onCompose,
  onLogout,
  actionCount = 0,
  isExpanded,
  onExpandedChange,
  searchQuery = '',
  onSearchChange,
  showTimeline = false,
  onToggleTimeline,
  onOpenChat,
  onGenerateWeeklyTheme,
  isGeneratingTheme = false,
  hasWeeklyTheme = false,
}: DesktopSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync local search with parent
  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  const handleSearchInput = (value: string) => {
    setLocalSearch(value)
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    searchDebounceRef.current = setTimeout(() => {
      onSearchChange?.(value)
    }, 300)
  }

  const handleClearSearch = () => {
    setLocalSearch('')
    onSearchChange?.('')
    searchInputRef.current?.focus()
  }

  const handleEntryTypeClick = (type: EntryType) => {
    // If clicking the same type, don't deselect - keep the selection
    if (showTimeline) {
      onToggleTimeline?.() // Exit timeline when switching entry types
    }
    onEntryTypeChange(type)
  }

  const isRouteActive = (href: string) => {
    if (href === '/ontology') return pathname === '/ontology'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const workspaceNavItems = [
    { href: '/ontology', label: 'Ontology', icon: '◇' },
  ] as const

  const collapsedWidth = '64px'
  const expandedWidth = '260px'

  return (
    <aside
      className="hidden lg:flex"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: isExpanded ? expandedWidth : collapsedWidth,
        background: '#0A0A0A',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Header with logo and toggle */}
      <div
        style={{
          padding: isExpanded ? '1.25rem 1.5rem' : '1.25rem 0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          minHeight: '72px',
        }}
      >
        {isExpanded ? (
          <>
            <span
              style={{
                color: '#FFFFFF',
                fontSize: '1.35rem',
                fontWeight: 400,
                fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                letterSpacing: '0.02rem',
                whiteSpace: 'nowrap',
              }}
            >
              Understood.
            </span>
            <button
              onClick={() => onExpandedChange(false)}
              aria-label="Collapse sidebar"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '0.5rem',
                fontSize: '1rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ‹
            </button>
          </>
        ) : (
          <button
            onClick={() => onExpandedChange(true)}
            aria-label="Expand sidebar"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '0.5rem',
              position: 'relative',
            }}
          >
            <span
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                fontFamily: 'var(--font-bodoni-moda)',
              }}
            >
              U
            </span>
            {/* Badge for action count */}
            {actionCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '-2px',
                  background: '#DC143C',
                  color: '#FFFFFF',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.3rem',
                  borderRadius: '8px',
                  minWidth: '16px',
                  textAlign: 'center',
                }}
              >
                {actionCount > 99 ? '99+' : actionCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isExpanded ? '1rem 0' : '1rem 0.5rem',
        }}
      >
        {isExpanded ? (
          <>
            {/* Search Input with inline AI trigger */}
            <div style={{ padding: '0 1rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.4)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={localSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Search entries..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 4.5rem 0.6rem 2rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '0.8rem',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(220, 20, 60, 0.5)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  }}
                />
                {/* Right side: clear button + AI trigger */}
                <div style={{ position: 'absolute', right: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                  {localSearch && (
                    <button
                      onClick={handleClearSearch}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <button
                    onClick={onOpenChat}
                    title="AI Search"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      padding: '0.3rem',
                      lineHeight: 1,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    <AiSearchIcon size={20} glassColor="#FFFFFF" sparkleColor="#DC143C" />
                  </button>
                </div>
              </div>
            </div>

            {/* Workspace navigation */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  padding: '0 1.5rem',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.1rem',
                  textTransform: 'uppercase',
                  fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                }}
              >
                Workspace
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <li>
                  <button
                    onClick={onToggleTimeline}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      padding: '0.65rem 1.5rem',
                      background: showTimeline ? 'rgba(220, 20, 60, 0.15)' : 'transparent',
                      border: 'none',
                      borderLeft: showTimeline ? '3px solid #DC143C' : '3px solid transparent',
                      color: showTimeline ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                      fontSize: '1.05rem',
                      fontWeight: 500,
                      fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>📅</span>
                    <span>All Entries</span>
                  </button>
                </li>
                {workspaceNavItems.map((item) => {
                  const isActive = isRouteActive(item.href)

                  return (
                    <li key={item.href}>
                      <button
                        type="button"
                        onClick={() => router.push(item.href)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          width: '100%',
                          padding: '0.65rem 1.5rem',
                          background: isActive ? 'rgba(220, 20, 60, 0.15)' : 'transparent',
                          border: 'none',
                          borderLeft: isActive ? '3px solid #DC143C' : '3px solid transparent',
                          color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                          fontSize: '1.05rem',
                          fontWeight: 500,
                          fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Entries Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  padding: '0 1.5rem',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.1rem',
                  textTransform: 'uppercase',
                  fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                }}
              >
                Entries
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {entryTypes.map((type) => (
                  <li key={type.value}>
                    <button
                      onClick={() => handleEntryTypeClick(type.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '0.65rem 1.5rem',
                        background: currentEntryType === type.value ? 'rgba(220, 20, 60, 0.15)' : 'transparent',
                        border: 'none',
                        borderLeft: currentEntryType === type.value ? '3px solid #DC143C' : '3px solid transparent',
                        color: currentEntryType === type.value ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)',
                        fontSize: '1.05rem',
                        fontWeight: 500,
                        fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{type.icon}</span>
                      <span>{type.label}</span>
                      {type.value === 'action' && actionCount > 0 && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            background: 'rgba(220, 20, 60, 0.9)',
                            color: '#FFFFFF',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                          }}
                        >
                          {actionCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Generate Weekly Theme button — only when on Stories and no theme yet */}
              {currentEntryType === 'story' && !hasWeeklyTheme && onGenerateWeeklyTheme && (
                <button
                  onClick={onGenerateWeeklyTheme}
                  disabled={isGeneratingTheme}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: 'calc(100% - 3rem)',
                    margin: '0.75rem 1.5rem 0',
                    padding: '0.55rem 0.75rem',
                    background: isGeneratingTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid #DC143C',
                    borderRadius: '6px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                    cursor: isGeneratingTheme ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: isGeneratingTheme ? 0.7 : 1,
                  }}
                >
                  <span style={{ fontSize: '0.9rem' }}>✨</span>
                  <span>{isGeneratingTheme ? 'Generating...' : 'Weekly Theme'}</span>
                </button>
              )}
            </div>

            {/* Life Areas Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  padding: '0 1.5rem',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.1rem',
                  textTransform: 'uppercase',
                  fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                }}
              >
                Life domains
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {lifeAreas.map((area) => (
                  <li key={area.value}>
                    <button
                      onClick={() => onLifeAreaChange(area.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '0.5rem 1.5rem 0.5rem 2rem',
                        background: currentLifeArea === area.value ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                        border: 'none',
                        color: currentLifeArea === area.value ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                        fontSize: '1rem',
                        fontWeight: currentLifeArea === area.value ? 600 : 400,
                        fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {area.label}
                      {currentLifeArea === area.value && (
                        <span style={{ marginLeft: 'auto', color: '#DC143C', fontSize: '0.6rem' }}>●</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Compose Button */}
            <div style={{ padding: '0 1rem', marginTop: 'auto' }}>
              <button
                onClick={onCompose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.85rem 1rem',
                  background: '#DC143C',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.05rem',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>+</span>
                Compose
              </button>
            </div>
          </>
        ) : (
          /* Collapsed state - icon buttons only */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {/* Collapsed AI Search button */}
            {/* Collapsed AI Search button */}
            <button
              onClick={onOpenChat}
              title="AI Search"
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <AiSearchIcon size={24} />
            </button>

            {/* Collapsed All Entries button */}
            <button
              onClick={onToggleTimeline}
              title="All Entries"
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: showTimeline ? 'rgba(220, 20, 60, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: showTimeline ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📅
            </button>

            {workspaceNavItems.map((item) => {
              const isActive = isRouteActive(item.href)

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  title={item.label}
                  style={{
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'rgba(220, 20, 60, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.icon}
                </button>
              )
            })}

            {/* Collapsed entry type buttons: Stories, Notes, Actions */}
            {entryTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleEntryTypeClick(type.value)}
                title={type.label}
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: currentEntryType === type.value ? 'rgba(220, 20, 60, 0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: currentEntryType === type.value ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {type.icon}
                {type.value === 'action' && actionCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: '#DC143C',
                      color: '#FFFFFF',
                      fontSize: '0.55rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.25rem',
                      borderRadius: '6px',
                      minWidth: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {actionCount > 9 ? '9+' : actionCount}
                  </span>
                )}
              </button>
            ))}

            {/* Collapsed compose button */}
            <button
              onClick={onCompose}
              title="Compose"
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#DC143C',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '1.5rem',
                cursor: 'pointer',
                marginTop: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* Footer with settings + logout */}
      <div
        style={{
          padding: isExpanded ? '1rem 1.5rem' : '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <button
          onClick={() => router.push('/settings')}
          title="Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: '0.75rem',
            width: '100%',
            padding: isExpanded ? '0.65rem 0' : '0.5rem',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.85rem',
            fontWeight: 500,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>N</span>
          {isExpanded && <span>Settings</span>}
        </button>
        <button
          onClick={onLogout}
          title="Logout"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: '0.75rem',
            width: '100%',
            padding: isExpanded ? '0.65rem 0' : '0.5rem',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.85rem',
            fontWeight: 500,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>⎋</span>
          {isExpanded && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
