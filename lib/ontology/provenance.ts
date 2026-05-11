export const STANDARD_PROVENANCE_SOURCES = [
  'self_declared',
  'ai_proposed',
  'entry_extracted',
  'human_confirmed',
  'imported_metric',
  'demo_seed',
  'starter_hypothesis',
] as const

export type ProvenanceSource = (typeof STANDARD_PROVENANCE_SOURCES)[number]

export type ProvenanceReviewRole =
  | 'user_originated'
  | 'ai_generated'
  | 'derived_from_record'
  | 'reviewed'
  | 'external_data'
  | 'reference_only'
  | 'unknown'

export interface ProvenanceSourceDescriptor {
  source: ProvenanceSource | 'unknown'
  label: string
  description: string
  reviewRole: ProvenanceReviewRole
}

const SOURCE_DESCRIPTORS: Record<ProvenanceSource, ProvenanceSourceDescriptor> = {
  self_declared: {
    source: 'self_declared',
    label: 'Self declared',
    description: 'The user explicitly entered this belief or rule.',
    reviewRole: 'user_originated',
  },
  ai_proposed: {
    source: 'ai_proposed',
    label: 'AI proposed',
    description: 'AI suggested this candidate; human review is required before it can govern reasoning.',
    reviewRole: 'ai_generated',
  },
  entry_extracted: {
    source: 'entry_extracted',
    label: 'Entry extracted',
    description: 'This came from one or more captured entries.',
    reviewRole: 'derived_from_record',
  },
  human_confirmed: {
    source: 'human_confirmed',
    label: 'Human confirmed',
    description: 'The user reviewed and confirmed this ontology material.',
    reviewRole: 'reviewed',
  },
  imported_metric: {
    source: 'imported_metric',
    label: 'Imported metric',
    description: 'This came from an external measurement source.',
    reviewRole: 'external_data',
  },
  demo_seed: {
    source: 'demo_seed',
    label: 'Demo seed',
    description: 'Demo or benchmark material; not inherited as a personal belief.',
    reviewRole: 'reference_only',
  },
  starter_hypothesis: {
    source: 'starter_hypothesis',
    label: 'Starter hypothesis',
    description: 'Global starter material that must be tested before governing personal reasoning.',
    reviewRole: 'reference_only',
  },
}

export function normalizeProvenanceSource(provenance: Record<string, unknown>): ProvenanceSourceDescriptor {
  const rawSource = typeof provenance.source === 'string' ? provenance.source : null
  if (isProvenanceSource(rawSource)) {
    return SOURCE_DESCRIPTORS[rawSource]
  }

  return {
    source: 'unknown',
    label: 'Unknown source',
    description: 'No recognized provenance source has been recorded.',
    reviewRole: 'unknown',
  }
}

export function getProvenanceSourceDescriptor(source: unknown): ProvenanceSourceDescriptor {
  if (isProvenanceSource(source)) {
    return SOURCE_DESCRIPTORS[source]
  }

  return {
    source: 'unknown',
    label: 'Unknown source',
    description: 'No recognized provenance source has been recorded.',
    reviewRole: 'unknown',
  }
}

function isProvenanceSource(source: unknown): source is ProvenanceSource {
  return typeof source === 'string' && STANDARD_PROVENANCE_SOURCES.includes(source as ProvenanceSource)
}
