#!/usr/bin/env node
/**
 * Regenerates .cursor/rules/presentation-guardrail.mdc from default constraints.
 * Run: node scripts/generate-presentation-cursor-rule.mjs
 */
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Inline mirror of DEFAULT_PRESENTATION_CONSTRAINTS (keep in sync manually or import via ts-node later)
const traits = [
  { trait: 'Low analytical reasoning', requires: 'Pre-structured outlines', forbids: 'Unstructured paragraphs' },
  { trait: 'High graphoria', requires: 'Tables / matrices / node trees', forbids: 'Raw paragraph blocks' },
  { trait: 'Communication rules', requires: 'Max 10 one-line bullets', forbids: 'Chains over 4 steps' },
]

const tree = traits
  .map((t, i) => {
    const branch = i === traits.length - 1 ? '└─' : '├─'
    return `${branch} hasTrait → ${t.trait}\n   ├─ requiresFormat → ${t.requires}\n   └─ forbidsElement → ${t.forbids}`
  })
  .join('\n')

const mdc = `---
description: Mandatory output format — synced with presentation_constraints graph
alwaysApply: true
---

# Presentation guardrail (interceptor)

Source of truth: Supabase \`presentation_constraints\` · UI: \`/settings/presentation\` · Server: \`lib/ai/presentation-interceptor.ts\`

## FORBIDDEN

- Raw paragraph blocks (more than 2 sentences without structure)
- Sequential narrative prose / walls of text
- Instruction chains longer than 4 steps without a table or outline
- Assuming Adam remembers numbers from earlier in the thread

## REQUIRED

- Tables, matrices, or ASCII node trees for logical sequences
- Big-picture direction before tactical detail
- Examples before definitions
- Max 10 one-line bullets for strategic answers
- Restate every number you use

## Node tree

\`\`\`
[Adam]
${tree}
\`\`\`

## Self-check before sending

If the reply is mostly prose paragraphs → stop → convert to matrix or node tree → then send.
`

writeFileSync(join(root, '.cursor/rules/presentation-guardrail.mdc'), mdc)
console.log('Wrote .cursor/rules/presentation-guardrail.mdc')
