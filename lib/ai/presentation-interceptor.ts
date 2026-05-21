import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_PRESENTATION_CONSTRAINTS } from '@/lib/ai/default-presentation-constraints'
import { validatePresentation } from '@/lib/ai/presentation-linter'
import type {
  PresentationConstraint,
  PresentationTrace,
  PresentationValidation,
} from '@/types/presentation'

export { validatePresentation } from '@/lib/ai/presentation-linter'

export async function fetchPresentationConstraints(
  supabase: SupabaseClient,
  userId: string
): Promise<PresentationConstraint[]> {
  const { data, error } = await supabase
    .from('presentation_constraints')
    .select(
      'id, user_id, trait_key, trait_label, relation, target, target_label, provenance, enabled, sort_order'
    )
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.warn('[presentation] table query failed, using defaults:', error.message)
    return DEFAULT_PRESENTATION_CONSTRAINTS.map((row) => ({ ...row }))
  }

  if (!data?.length) {
    await seedPresentationConstraints(supabase, userId)
    return DEFAULT_PRESENTATION_CONSTRAINTS.map((row) => ({ ...row }))
  }

  return data as PresentationConstraint[]
}

export async function seedPresentationConstraints(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const rows = DEFAULT_PRESENTATION_CONSTRAINTS.map((row) => ({
    ...row,
    user_id: userId,
  }))
  const { error } = await supabase.from('presentation_constraints').upsert(rows, {
    onConflict: 'user_id,trait_key,relation,target',
    ignoreDuplicates: true,
  })
  if (error) {
    console.warn('[presentation] seed failed:', error.message)
  }
}

/** Graph hook → system append */
export function buildPresentationSystemConstraint(
  constraints: PresentationConstraint[]
): string {
  const requires = constraints.filter((c) => c.relation === 'requires_format')
  const forbids = constraints.filter((c) => c.relation === 'forbids_element')

  const requireLines = requires.map((c) => `- ${c.target_label}`)
  const forbidLines = forbids.map((c) => `- ${c.target_label}`)

  return `

SYSTEM CONSTRAINT (presentation interceptor — mandatory):
Parse personal-data pattern discovery into visible relationship maps via JSON display fields the app renders. Users never see markdown, prose essays, outline-shaped answers, or raw metric dumps.

FORBIDDEN: markdown, paragraph essays, sequential "quick takeaways", visible text outside the JSON block.
REQUIRED: use display.tree as a visual mind map for relationships, comparisons, correlations, and pattern recognition. Use display.table only for exact lookup. Percentages are useful only when they show hierarchy, rank, share, or strength of pattern; raw counts are not an insight by themselves.

Requires format:
${requireLines.join('\n')}

Forbids element:
${forbidLines.join('\n')}
`
}

export function wrapSystemPromptWithPresentation(
  baseSystem: string,
  constraints: PresentationConstraint[]
): string {
  if (!constraints.length) return baseSystem
  return `${baseSystem}${buildPresentationSystemConstraint(constraints)}`
}

export function buildPresentationTrace(
  constraints: PresentationConstraint[],
  validation: PresentationValidation,
  retryCount: number
): PresentationTrace {
  return {
    constraints_applied: constraints.length,
    lint_passed: validation.ok,
    retry_count: retryCount,
    violations: validation.violations,
    formats_required: constraints
      .filter((c) => c.relation === 'requires_format')
      .map((c) => c.target_label),
    elements_forbidden: constraints
      .filter((c) => c.relation === 'forbids_element')
      .map((c) => c.target_label),
  }
}

export function buildLintCorrectionUserMessage(violations: string[]): string {
  return violations.join('\n')
}

/** Build ASCII node tree for UI */
export function buildConstraintNodeTree(
  constraints: PresentationConstraint[],
  profileLabel = 'You'
): string {
  const byTrait = new Map<string, PresentationConstraint[]>()
  for (const c of constraints) {
    const list = byTrait.get(c.trait_key) ?? []
    list.push(c)
    byTrait.set(c.trait_key, list)
  }

  const lines: string[] = [`[${profileLabel}]`]
  const traits = [...byTrait.entries()]
  traits.forEach(([key, rows], traitIndex) => {
    const label = rows[0]?.trait_label ?? key
    const isLastTrait = traitIndex === traits.length - 1
    const traitBranch = isLastTrait ? '└─' : '├─'
    lines.push(`${traitBranch} hasTrait → [${label}]`)
    rows.forEach((row, rowIndex) => {
      const isLastRow = rowIndex === rows.length - 1
      const prefix = isLastTrait ? '   ' : '│  '
      const branch = isLastRow ? '└─' : '├─'
      const rel = row.relation === 'requires_format' ? 'requiresFormat' : 'forbidsElement'
      lines.push(`${prefix}${branch} ${rel} → [${row.target_label}]`)
    })
  })
  return lines.join('\n')
}
