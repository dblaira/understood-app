import { readFileSync } from 'fs'
import path from 'path'
import { BeliefsClient } from './beliefs-client'

export const dynamic = 'force-dynamic'

type ParsedRule = {
  id: string
  number: number
  section: string
  text: string
}

function parseRules(md: string): ParsedRule[] {
  const lines = md.split('\n')
  const rules: ParsedRule[] = []
  let section = 'General'
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)/)
    if (sectionMatch) {
      section = sectionMatch[1].trim()
      continue
    }
    const ruleMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (ruleMatch) {
      const num = parseInt(ruleMatch[1], 10)
      rules.push({
        id: `rule-${num}`,
        number: num,
        section,
        text: ruleMatch[2].trim(),
      })
    }
  }
  return rules
}

export default function BeliefsPage() {
  const md = readFileSync(
    path.join(process.cwd(), 'knowledge', 'adam-agent-rules.md'),
    'utf-8'
  )
  const rules = parseRules(md)
  return <BeliefsClient rules={rules} />
}
