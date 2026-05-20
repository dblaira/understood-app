import {
  validatePresentation,
  type PresentationValidation,
} from '@/lib/ai/presentation-linter'
import {
  buildLintCorrectionUserMessage,
  buildPresentationTrace,
  wrapSystemPromptWithPresentation,
} from '@/lib/ai/presentation-interceptor'
import type { PresentationConstraint, PresentationTrace } from '@/types/presentation'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeWithPresentationResult {
  text: string
  presentation: PresentationTrace
}

const MAX_RETRIES = 3

export async function claudeMessagesWithPresentation(options: {
  apiKey: string
  model?: string
  maxTokens?: number
  system: string
  messages: ClaudeMessage[]
  constraints: PresentationConstraint[]
  validate?: (text: string) => PresentationValidation
}): Promise<ClaudeWithPresentationResult> {
  const {
    apiKey,
    model = 'claude-sonnet-4-6',
    maxTokens = 1024,
    system,
    messages,
    constraints,
    validate = validatePresentation,
  } = options

  const systemWithPresentation = wrapSystemPromptWithPresentation(system, constraints)
  let retryCount = 0
  let lastViolations: string[] = []
  const conversation: ClaudeMessage[] = [...messages]

  while (retryCount <= MAX_RETRIES) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemWithPresentation,
        messages: conversation,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`)
    }

    const aiResponse = await response.json()
    const text = aiResponse.content?.[0]?.text ?? ''
    const validation = validate(text)

    if (validation.ok) {
      return {
        text,
        presentation: buildPresentationTrace(constraints, validation, retryCount),
      }
    }

    lastViolations = validation.violations
    retryCount += 1

    if (retryCount > MAX_RETRIES) {
      return {
        text,
        presentation: buildPresentationTrace(
          constraints,
          { ok: false, violations: lastViolations },
          retryCount - 1
        ),
      }
    }

    conversation.push({ role: 'assistant', content: text })
    conversation.push({
      role: 'user',
      content: buildLintCorrectionUserMessage(lastViolations),
    })
  }

  return {
    text: '',
    presentation: buildPresentationTrace(
      constraints,
      { ok: false, violations: lastViolations },
      retryCount
    ),
  }
}
