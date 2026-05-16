import type { OntologyRelationshipType } from '@/types/ontology'
import { isUnsafePlaceholderRule } from '@/lib/ontology/rule-quality'

export interface BeliefDumpRuleDraft {
  id: string
  sourceText: string
  name: string
  antecedent: string
  consequent: string
  relationshipType: OntologyRelationshipType
  confidence: number
  rationale: string
}

export interface BeliefDumpRuleValidation {
  valid: boolean
  reason?: string
}

const MAX_RULES = 8

export function buildBeliefDumpPrompt(beliefDump: string): string {
  return `Turn this belief dump into clean personal rules for a trustworthy AI agent.

The user should only have to correct your list. Do not ask them to classify ontology concepts.

Each rule must be readable as one of these shapes:
- When X happens, Y usually follows.
- When the user asks for X, answer in style Y.
- Do not do X unless Y is true.

Rules must constrain how an assistant answers. Avoid fake placeholders. If a line is too vague, skip it instead of inventing meaning.

Return only JSON in this shape:
{
  "rules": [
    {
      "sourceText": "original user line",
      "name": "short label",
      "antecedent": "plain condition",
      "consequent": "plain response or expected outcome",
      "rationale": "brief why this follows from the source"
    }
  ]
}

Belief dump:
${beliefDump}`
}

export function parseBeliefDumpRulesFromJson(raw: unknown): BeliefDumpRuleDraft[] {
  const payload = typeof raw === 'string' ? safeJsonParse(raw) : raw
  if (!payload || typeof payload !== 'object' || !('rules' in payload) || !Array.isArray(payload.rules)) {
    return []
  }

  return payload.rules
    .map((rule, index) => normalizeRuleDraft(rule, index))
    .filter((rule): rule is BeliefDumpRuleDraft => rule != null)
    .slice(0, MAX_RULES)
}

export function buildFallbackBeliefDumpRules(beliefDump: string): BeliefDumpRuleDraft[] {
  return splitBeliefDumpLines(beliefDump)
    .map((line, index) => draftRuleFromLine(line, index))
    .filter((rule): rule is BeliefDumpRuleDraft => rule != null)
    .slice(0, MAX_RULES)
}

export function validateBeliefDumpRuleDraft(rule: BeliefDumpRuleDraft): BeliefDumpRuleValidation {
  if (rule.antecedent.trim().length < 4 || rule.consequent.trim().length < 4) {
    return { valid: false, reason: 'Rule needs both a clear When and Then.' }
  }

  if (rule.antecedent.length > 240 || rule.consequent.length > 280) {
    return { valid: false, reason: 'Rule is too long to be a clean constraint.' }
  }

  if (isUnsafePlaceholderRule({ antecedent: rule.antecedent, consequent: rule.consequent })) {
    return { valid: false, reason: 'This is still a placeholder, not a rule.' }
  }

  return { valid: true }
}

export function sanitizeBeliefDumpRuleDrafts(rawRules: BeliefDumpRuleDraft[]): BeliefDumpRuleDraft[] {
  const seen = new Set<string>()
  const cleaned: BeliefDumpRuleDraft[] = []

  for (const rawRule of rawRules) {
    const rule = normalizeRuleDraft(rawRule, cleaned.length)
    if (!rule) continue
    if (!validateBeliefDumpRuleDraft(rule).valid) continue

    const key = ruleFingerprint(rule.antecedent, rule.consequent)
    if (seen.has(key)) continue
    seen.add(key)
    cleaned.push(rule)
  }

  return cleaned.slice(0, MAX_RULES)
}

export function ruleFingerprint(antecedent: string, consequent: string): string {
  return `${normalizeText(antecedent)}=>${normalizeText(consequent)}`
}

function normalizeRuleDraft(rawRule: unknown, index: number): BeliefDumpRuleDraft | null {
  if (!rawRule || typeof rawRule !== 'object') return null
  const candidate = rawRule as Partial<BeliefDumpRuleDraft>
  const sourceText = cleanText(candidate.sourceText ?? '')
  const antecedent = trimRulePrefix(cleanText(candidate.antecedent ?? ''))
  const consequent = trimRulePrefix(cleanText(candidate.consequent ?? ''))
  if (!antecedent || !consequent) return null

  const rule: BeliefDumpRuleDraft = {
    id: cleanText(candidate.id ?? '') || `belief-rule-${index + 1}`,
    sourceText: sourceText || `${antecedent} -> ${consequent}`,
    name: cleanText(candidate.name ?? '') || buildRuleName(antecedent),
    antecedent,
    consequent,
    relationshipType: 'predicts',
    confidence: normalizeConfidence(candidate.confidence),
    rationale: cleanText(candidate.rationale ?? '') || 'Drafted from the belief dump.',
  }

  return validateBeliefDumpRuleDraft(rule).valid ? rule : null
}

function draftRuleFromLine(line: string, index: number): BeliefDumpRuleDraft | null {
  const normalized = cleanText(line)
  if (normalized.length < 8) return null

  const existingIfThen = normalized.match(/^(?:if|when)\s+(.+?)(?:,\s*)?(?:then\s+)?(.+)$/i)
  if (existingIfThen) {
    return makeRule(index, normalized, existingIfThen[1], existingIfThen[2], 'Kept the existing rule shape.')
  }

  const doNotUnless = normalized.match(/^do not\s+(.+?)\s+unless\s+(.+)$/i)
  if (doNotUnless) {
    return makeRule(index, normalized, `${doNotUnless[2]} is not true`, `do not ${doNotUnless[1]}`, 'Converted a boundary into a rule.')
  }

  const needTo = normalized.match(/^i need\s+(.+?)\s+to\s+(.+)$/i)
  if (needTo) {
    return makeRule(index, normalized, `the user is trying to ${needTo[2]}`, `provide ${needTo[1]}`, 'Converted a stated need into response guidance.')
  }

  const workBetterWhen = normalized.match(/^i work better when\s+(.+)$/i)
  if (workBetterWhen) {
    return makeRule(index, normalized, workBetterWhen[1], 'protect that condition when giving advice', 'Converted a work preference into a constraint.')
  }

  const trustMoreThan = normalized.match(/^i trust\s+(.+?)\s+more than\s+(.+)$/i)
  if (trustMoreThan) {
    return makeRule(index, normalized, 'the assistant introduces a concept', `show ${trustMoreThan[1]} before ${trustMoreThan[2]}`, 'Converted a trust preference into answer style.')
  }

  const hate = normalized.match(/^i hate\s+(.+)$/i)
  if (hate) {
    return makeRule(index, normalized, 'the assistant gives advice', `avoid ${hate[1]}`, 'Converted a disliked answer pattern into a constraint.')
  }

  const overthink = normalized.match(/^i overthink\s+(.+?)\s+when\s+(.+)$/i)
  if (overthink) {
    return makeRule(index, normalized, overthink[2], `show the end state before optimizing ${overthink[1]}`, 'Converted an obstacle into response guidance.')
  }

  return makeRule(index, normalized, `the user says "${normalized}"`, 'ask for correction before treating it as a reusable rule', 'This line needs human correction before it becomes strong.')
}

function makeRule(index: number, sourceText: string, antecedent: string, consequent: string, rationale: string): BeliefDumpRuleDraft | null {
  const rule: BeliefDumpRuleDraft = {
    id: `belief-rule-${index + 1}`,
    sourceText,
    name: buildRuleName(sourceText),
    antecedent: trimRulePrefix(cleanText(antecedent)),
    consequent: trimRulePrefix(cleanText(consequent)),
    relationshipType: 'predicts',
    confidence: 0.66,
    rationale,
  }

  return validateBeliefDumpRuleDraft(rule).valid ? rule : null
}

function splitBeliefDumpLines(value: string): string[] {
  return value
    .split(/\r?\n|[•]+/g)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
}

function safeJsonParse(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonText = fenced?.[1] ?? value
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/[.;]\s*$/g, '')
}

function trimRulePrefix(value: string): string {
  return value
    .replace(/^(?:if|when)\s+/i, '')
    .replace(/^then\s+/i, '')
    .trim()
}

function normalizeConfidence(raw: unknown): number {
  const confidence = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0.66
}

function buildRuleName(value: string): string {
  const firstWords = value.split(/\s+/).slice(0, 6).join(' ')
  return firstWords.length > 52 ? `${firstWords.slice(0, 49)}...` : firstWords || 'Belief rule'
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
