'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileMenu } from './mobile-menu'
import { AiSearchIcon } from './ai-search-icon'

interface HeaderProps {
  issueTagline: string
  onNewEntry: () => void
  currentFilter?: string
  onFilterChange?: (category: string) => void
  currentEntryType?: string | null
  onEntryTypeChange?: (type: string | null) => void
  onLogout?: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onOpenChat?: () => void
  showTimeline?: boolean
  onToggleTimeline?: () => void
}

export function Header({ 
  issueTagline, 
  onNewEntry,
  currentFilter = 'all',
  onFilterChange,
  currentEntryType = null,
  onEntryTypeChange,
  onLogout,
  searchQuery: externalSearchQuery = '',
  onSearchChange,
  onOpenChat,
  showTimeline = false,
  onToggleTimeline,
}: HeaderProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (onSearchChange) {
      onSearchChange(localSearchQuery)
    } else {
      router.push(`/?search=${encodeURIComponent(localSearchQuery)}`)
    }
    setIsSearchOpen(false)
  }

  // Focus search input when opened on mobile
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  const handleFilterChange = (category: string) => {
    onFilterChange?.(category)
  }

  const handleEntryTypeChange = (type: string | null) => {
    onEntryTypeChange?.(type)
  }

  // Mobile header
  if (isMobile) {
    return (
      <>
        {/* Extend black background to status bar */}
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 'env(safe-area-inset-top, 0px)',
            background: '#000000',
            zIndex: 100,
          }}
        />
        <header 
          className="site-header mobile-header"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            background: '#000000',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Top row: Logo, Search, Menu */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Logo */}
            <div className="brand-block" style={{ flex: 'none' }}>
              <span 
                className="brand-title" 
                style={{ 
                  fontSize: '1.15rem',
                  fontWeight: 400,
                  fontFamily: "var(--font-bodoni-moda), Georgia, 'Times New Roman', serif",
                  letterSpacing: '0.02rem',
                }}
              >
                Understood.
              </span>
            </div>

            {/* Right buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {/* AI Search */}
              <button
                onClick={() => onOpenChat?.()}
                aria-label="AI Search"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  borderRadius: '6px',
                }}
              >
                <AiSearchIcon size={22} glassColor="#FFFFFF" sparkleColor="#DC143C" />
              </button>

              {/* Menu button — far right */}
              <button
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open menu"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-hero)',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expandable search bar with inline AI trigger */}
          {isSearchOpen && (
            <div
              style={{
                padding: '0 1rem 0.75rem',
              }}
            >
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    placeholder="Search entries..."
                    style={{
                      width: '100%',
                      padding: '0.6rem 4rem 0.6rem 0.75rem',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(220, 20, 60, 0.5)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      onOpenChat?.()
                    }}
                    aria-label="AI Search"
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AiSearchIcon size={20} glassColor="#FFFFFF" sparkleColor="#DC143C" />
                  </button>
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1rem',
                    background: '#DC143C',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Search
                </button>
              </form>
            </div>
          )}
        </header>

        {/* Mobile Menu Overlay */}
        <MobileMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          currentFilter={currentFilter}
          onFilterChange={handleFilterChange}
          currentEntryType={currentEntryType}
          onEntryTypeChange={handleEntryTypeChange}
          onLogout={onLogout}
          onCompose={onNewEntry}
          showTimeline={showTimeline}
          onToggleTimeline={onToggleTimeline}
        />
      </>
    )
  }

  // Tablet / non-sidebar header
  return (
    <header className="site-header">
      <div className="brand-block">
        <span className="brand-title">Understood.</span>
        <span className="brand-edition" id="issueTagline">
          {issueTagline}
        </span>
      </div>
      <div className="header-controls">
        <form id="searchForm" className="search-bar" onSubmit={handleSearch} style={{ position: 'relative' }}>
          <input
            id="searchInput"
            type="search"
            placeholder="Search your headlines…"
            aria-label="Search your headlines"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            style={{ paddingRight: '5rem' }}
          />
          <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                onOpenChat?.()
              }}
              aria-label="AI Search"
              title="AI Search"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                borderRadius: '4px',
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
              <AiSearchIcon size={24} />
            </button>
            <button type="submit" aria-label="Submit search">
              <span>Search</span>
            </button>
          </div>
        </form>
        <button 
          id="newEntryBtn" 
          className="btn-primary" 
          onClick={(e) => {
            e.preventDefault()
            onNewEntry()
          }}
          type="button"
        >
          + New Entry
        </button>
      </div>
    </header>
  )
}
