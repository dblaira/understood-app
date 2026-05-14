'use client'

import { useState, useRef, useEffect } from 'react'
import { Entry } from '@/types'
import { formatEntryDateShort } from '@/lib/utils'
import { AiSearchIcon } from './ai-search-icon'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  entries?: EntryReference[]
  memoryContext?: MemoryContext
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

function getEntryTypeIcon(entryType: string): string {
  switch (entryType) {
    case 'action': return '☑'
    case 'note': return '📝'
    case 'story':
    default: return '📰'
  }
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
          entries: data.entries,
          memoryContext: data.memory_context,
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          width: '100%',
          maxWidth: '640px',
          maxHeight: '80vh',
          margin: '1rem',
          background: '#FFFFFF',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((message, i) => (
            <div key={i}>
              {/* Message bubble */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
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
                  ) : (
                    message.content
                  )}
                </div>
              </div>

              {/* Memory context */}
              {message.memoryContext && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    marginLeft: '0.5rem',
                    maxWidth: '85%',
                    padding: '0.55rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    background: '#FFFBEB',
                    color: '#92400E',
                    fontSize: '0.72rem',
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>
                    Memory context
                  </div>
                  <div>
                    {message.memoryContext.confirmed_axioms} confirmed axioms ·{' '}
                    {message.memoryContext.connection_principles} Connection principles
                    {typeof message.memoryContext.public_guardrails === 'number'
                      ? ` · ${message.memoryContext.public_guardrails} public guardrails`
                      : ''}
                  </div>
                  <div style={{ color: '#B45309', marginTop: '0.15rem' }}>
                    {message.memoryContext.note}
                  </div>
                </div>
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
                      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.1rem' }}>
                        {getEntryTypeIcon(entry.entry_type)}
                      </span>
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
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
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
                              fontStyle: 'italic',
                            }}
                          >
                            {entry.relevance_note}
                          </div>
                        )}
                      </div>
                      <span style={{ color: '#D1D5DB', fontSize: '0.85rem', flexShrink: 0, marginTop: '0.25rem' }}>
                        ›
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Suggested queries (show only at start) */}
          {messages.length === 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
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
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid #E5E7EB',
            background: '#FAFAFA',
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
