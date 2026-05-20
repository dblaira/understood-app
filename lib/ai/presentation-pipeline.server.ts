import type { SupabaseClient } from '@supabase/supabase-js'
import {
  claudeMessagesWithPresentation,
  type ClaudeMessage,
} from '@/lib/ai/claude-with-presentation.server'
import {
  buildPresentationTrace,
  fetchPresentationConstraints,
  wrapSystemPromptWithPresentation,
} from '@/lib/ai/presentation-interceptor'
import type { PresentationTrace } from '@/types/presentation'

export interface PresentationClaudeOptions {
  supabase: SupabaseClient
  userId: string
  apiKey: string
  messages: ClaudeMessage[]
  system?: string
  model?: string
  maxTokens?: number
  /** Creative routes (poetic rewrites) — constraint only, no post-lint */
  skipLint?: boolean
  validate?: (text: string) => import('@/lib/ai/presentation-linter').PresentationValidation
}

export interface PresentationClaudeResult {
  text: string
  presentation: PresentationTrace
}

export async function runClaudeWithPresentationGuardrail(
  options: PresentationClaudeOptions
): Promise<PresentationClaudeResult> {
  const constraints = await fetchPresentationConstraints(
    options.supabase,
    options.userId
  )

  if (options.skipLint) {
    const system = wrapSystemPromptWithPresentation(options.system ?? '', constraints)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model ?? 'claude-sonnet-4-6',
        max_tokens: options.maxTokens ?? 1024,
        system,
        messages: options.messages,
      }),
    })
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }
    const aiResponse = await response.json()
    const text = aiResponse.content?.[0]?.text ?? ''
    return {
      text,
      presentation: buildPresentationTrace(
        constraints,
        { ok: true, violations: [] },
        0
      ),
    }
  }

  return claudeMessagesWithPresentation({
    apiKey: options.apiKey,
    model: options.model,
    maxTokens: options.maxTokens,
    system: options.system ?? '',
    messages: options.messages,
    constraints,
    validate: options.validate,
  })
}
