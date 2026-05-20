/** Pure format linter — safe for client and server */

export interface PresentationValidation {
  ok: boolean
  violations: string[]
}

function stripValidatedRegions(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*"entry_ids"[\s\S]*\}/g, '')
    .trim()
}

function isStructuredBlock(block: string): boolean {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return true
  if (lines.some((l) => l.includes('|') && l.split('|').length >= 3)) return true
  if (lines.some((l) => /^[\u2022\-*]/.test(l) || /^\d+\./.test(l))) return true
  if (lines.some((l) => /^[├└│─\[\(]/.test(l) || l.includes('──') || l.includes('→'))) return true
  if (lines.every((l) => l.length < 120) && lines.length >= 2) return true
  return false
}

export function validatePresentation(text: string): PresentationValidation {
  const violations: string[] = []
  const body = stripValidatedRegions(text)

  if (/\*\*/.test(body) || /^#{1,6}\s/m.test(body) || /^\|.+\|/m.test(body) || /\|[\-:]+\|/.test(body)) {
    violations.push(
      'Violated Presentation Rule: Markdown detected. Use • Theme: phrase · phrase lines only.'
    )
  }
  if (/quick takeaway|in summary|first,|second,|third,/i.test(body)) {
    violations.push('Violated Presentation Rule: Sequential essay detected. Use theme lines.')
  }

  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const themeLines = lines.filter((l) => /^[\u2022\-*]\s/.test(l))
  if (lines.length > 1 && themeLines.length < 1) {
    violations.push(
      'Violated Presentation Rule: Missing theme lines. Format: • Theme: item · item'
    )
  }
  if (themeLines.length > 6) {
    violations.push('Violated Presentation Rule: Too many theme lines (max 6).')
  }

  const blocks = body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  for (const block of blocks) {
    if (isStructuredBlock(block)) continue
    if (/^[\u2022\-*]\s/.test(block)) continue

    const sentences = block
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)

    if (sentences.length > 2) {
      violations.push('Violated Presentation Rule: Paragraph detected. Use • Theme: lines.')
    } else if (block.length > 220) {
      violations.push('Violated Presentation Rule: Block too long. Split into theme lines.')
    }
  }

  const instructionSteps = body.match(/^\s*\d+\./gm)
  if (instructionSteps && instructionSteps.length > 4) {
    violations.push(
      'Violated Presentation Rule: Instruction chain over 4 steps.'
    )
  }

  return { ok: violations.length === 0, violations: [...new Set(violations)] }
}

export const LINTER_DEMO_BAD =
  'First idea here. Second idea here. Third idea here. Fourth idea breaks your rule.'
export const LINTER_DEMO_GOOD = `Your notes cluster on three themes.
• App: vibe coder intent · notifications · fonts
• Finance: CEO moment · Rivian signal`
