'use client'

import { useState, useRef, useEffect } from 'react'
import { Entry } from '@/types'
import { formatEntryDateShort } from '@/lib/utils'
import { AiSearchIcon } from './ai-search-icon'
import { PresentationTraceBadge } from './presentation-trace-badge'
import { AssistantStructuredMessage } from './assistant-structured-message'
import type { SearchChatDisplay } from '@/types/search-chat-display'
import type { PresentationTrace } from '@/types/presentation'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  entries?: EntryReference[]
  memoryContext?: MemoryContext
  presentation?: PresentationTrace
  display?: SearchChatDisplay | null
  isLoading?: boolean
}

interface MemoryContext {
  confirmed_axioms: number
  connection_principles: number
  public_guardrails?: number
  note: string
}

interface EntryReference {
  id: string
  headline: string
  category: string
  entry_type: string
  created_at: string
  relevance_note: string
}

interface SearchChatProps {
  userId: string
  entries: Entry[]
  onClose: () => void
  onViewEntry: (id: string) => void
}

export function SearchChat({ userId, entries, onClose, onViewEntry }: SearchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `I can search through your ${entries.length} entries. Ask me anything — try "What did I write about last week?" or "Find my finance notes."`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '', isLoading: true },
    ]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      // Build conversation history (skip the initial greeting and loading messages)
      const conversationHistory = messages
        .filter((m) => !m.isLoading && messages.indexOf(m) > 0)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      const response = await fetch('/api/search-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          conversationHistory,
        }),
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()

      // Replace loading message with actual response
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: data.response,
          display: data.display,
          entries: data.entries,
          memoryContext: data.memory_context,
          presentation: data.presentation,
        },
      ])
    } catch (error: any) {
      console.error('Chat search error:', error)
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: 'Sorry, I had trouble processing that. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const suggestedQueries = [
    'What did I write about this week?',
    'Find my incomplete actions',
    'Show my health entries',
    'What were my recent notes about?',
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'grid',
        gridTemplateRows: '1fr',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Chat Panel */}
      <div
        style={{
          position: 'relative',
          width: '100vw',
          height: '100dvh',
          maxWidth: 'none',
          maxHeight: 'none',
          background: '#FFFFFF',
          borderRadius: 0,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #E5E7EB',
            background: '#FAFAFA',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AiSearchIcon size={20} glassColor="#DC143C" sparkleColor="#111827" />
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>
              Search with AI
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1rem 1.25rem',
            display: 'grid',
            gridAutoRows: 'max-content',
            gap: '1rem',
            minWidth: 0,
          }}
        >
          {messages.map((message, i) => {
            const isStructuredAssistant =
              message.role === 'assistant' && Boolean(message.display)

            return (
            <div key={i} style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
              <div
                style={{
                  display: 'grid',
                  justifyItems:
                    message.role === 'user' ? 'end' : 'stretch',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    maxWidth: isStructuredAssistant ? '100%' : '85%',
                    width: isStructuredAssistant ? '100%' : 'auto',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    padding: '0.75rem 1rem',
                    borderRadius: message.role === 'user'
                      ? '12px 12px 4px 12px'
                      : '12px 12px 12px 4px',
                    background: message.role === 'user' ? '#111827' : '#F3F4F6',
                    color: message.role === 'user' ? '#FFFFFF' : '#111827',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  {message.isLoading ? (
                    <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem 0' }}>
                      <span style={{ animation: 'pulse 1.5s infinite', opacity: 0.4 }}>●</span>
                      <span style={{ animation: 'pulse 1.5s infinite 0.3s', opacity: 0.4 }}>●</span>
                      <span style={{ animation: 'pulse 1.5s infinite 0.6s', opacity: 0.4 }}>●</span>
                    </div>
                  ) : message.role === 'assistant' && message.display ? (
                    <AssistantStructuredMessage display={message.display} />
                  ) : message.role === 'assistant' ? (
                    <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>
                      {message.content || 'No structured display returned.'}
                    </span>
                  ) : (
                    message.content
                  )}
                </div>
              </div>

              {message.presentation && (
                <PresentationTraceBadge presentation={message.presentation} />
              )}

              {/* Memory context */}
              {message.memoryContext && (
                <details
                  style={{
                    marginTop: '0.5rem',
                    marginLeft: '0.5rem',
                    maxWidth: '85%',
                    fontSize: '0.68rem',
                    color: '#6B7280',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    Memory: {message.memoryContext.confirmed_axioms} axioms ·{' '}
                    {message.memoryContext.connection_principles} connections
                  </summary>
                  <p style={{ margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                    {message.memoryContext.note}
                  </p>
                </details>
              )}

              {/* Entry cards */}
              {message.entries && message.entries.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    marginTop: '0.75rem',
                    paddingLeft: '0.5rem',
                  }}
                >
                  {message.entries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => onViewEntry(entry.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: '#FAFAFA',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#F3F4F6'
                        e.currentTarget.style.borderColor = '#D1D5DB'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#FAFAFA'
                        e.currentTarget.style.borderColor = '#E5E7EB'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: '#DC143C',
                            }}
                          >
                            {entry.category}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#D1D5DB' }}>|</span>
                          <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>
                            {formatEntryDateShort(entry.created_at)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#111827',
                            lineHeight: 1.35,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {entry.headline}
                        </div>
                        {entry.relevance_note && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#6B7280',
                              marginTop: '0.25rem',
                              lineHeight: 1.4,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {entry.relevance_note}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )})}

          {/* Suggested queries (show only at start) */}
          {messages.length === 1 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.5rem',
              }}
            >
              {suggestedQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q)
                    inputRef.current?.focus()
                  }}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid #E5E7EB',
                    borderRadius: '20px',
                    color: '#6B7280',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#DC143C'
                    e.currentTarget.style.color = '#DC143C'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.color = '#6B7280'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #E5E7EB',
            background: '#FAFAFA',
            minWidth: 0,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your entries..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.65rem 0.75rem',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              color: '#111827',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#DC143C'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '0.65rem 1rem',
              background: isLoading || !input.trim() ? '#D1D5DB' : '#111827',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              flexShrink: 0,
            }}
          >
            {isLoading ? '...' : 'Ask'}
          </button>
        </form>
      </div>

      {/* Loading dot animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
