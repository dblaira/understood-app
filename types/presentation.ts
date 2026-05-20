export type PresentationRelation = 'requires_format' | 'forbids_element'

export interface PresentationConstraint {
  id?: string
  user_id?: string
  trait_key: string
  trait_label: string
  relation: PresentationRelation
  target: string
  target_label: string
  provenance: Record<string, unknown>
  enabled: boolean
  sort_order: number
}

export interface PresentationValidation {
  ok: boolean
  violations: string[]
}

export interface PresentationTrace {
  constraints_applied: number
  lint_passed: boolean
  retry_count: number
  violations: string[]
  formats_required: string[]
  elements_forbidden: string[]
}
