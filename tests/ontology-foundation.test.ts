import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LIFE_DOMAINS,
  STANDARD_AXIOM_REVIEW_POLICY,
  STANDARD_ONTOLOGY_VOCABULARY,
  STANDARD_AXIOM_STATUSES,
  STANDARD_RELATIONSHIP_TYPES,
  parseLifeDomains,
} from '../types/ontology'
import { buildOntologyPromptSection } from '../lib/ontology/build-prompt-section'
import { suggestCandidateAxiomFromEntry } from '../lib/ontology/candidate-axioms'
import { classifyOntologyBoundary } from '../lib/ontology/boundary'
import { splitEntryIntoClaims } from '../lib/ontology/claim-splitting'
import {
  buildAxiomReviewUpdate,
  canReviewAxiomScope,
  evaluateAxiomRetirementReadiness,
  evaluateAxiomReviewReadiness,
} from '../lib/ontology/axiom-review'
import { buildAxiomEvidenceUpdate, summarizeAxiomEvidence } from '../lib/ontology/evidence'
import { projectAxiomsToKnowledgeGraph } from '../lib/ontology/knowledge-graph'
import { exportAxiomsToTurtle } from '../lib/ontology/rdf-export'
import { buildOntologyShaclShapes } from '../lib/ontology/shacl-shapes'
import { buildOntologySemanticReport } from '../lib/ontology/semantic-report'
import { validateOntologyAxiomTurtle } from '../lib/ontology/semantic-validation'
import {
  buildCandidateAxiomFromConnection,
  buildConnectionIntakeItemsFromEntries,
  buildConnectionPrinciplesPromptSection,
  CONNECTION_ONTOLOGY_INTAKE_ITEMS,
  findConnectionEvidenceCandidates,
  getConnectionPromptPrinciples,
} from '../lib/ontology/connections-intake'
import {
  buildContradictionEvidenceQuery,
  buildGraphProjectionQuery,
  buildPromptEligibleAxiomsQuery,
  buildProvenanceSourceQuery,
} from '../lib/ontology/sparql-queries'
import { buildOntologyReviewQueue, getAxiomProvenanceLabel } from '../lib/ontology/review-queue'
import { getProvenanceSourceDescriptor, normalizeProvenanceSource } from '../lib/ontology/provenance'
import {
  buildPublicOntologyGuardrailSection,
  getPersonalPublicBridgeSummary,
  getPublicReferencesByDomain,
  getPublicReferenceById,
  PERSONAL_PUBLIC_BRIDGES,
  PUBLIC_ONTOLOGY_REFERENCES,
} from '../lib/ontology/public-reference'
import { buildProductOntologyPromptSection, extractProductOntologyPrinciples } from '../lib/ontology/product-ontology'

describe('standard ontology vocabulary', () => {
  it('keeps neutral product vocabulary separate from Adam example axioms', () => {
    assert.deepEqual(
      STANDARD_ONTOLOGY_VOCABULARY.parentDomains.map((domain) => domain.name),
      [...LIFE_DOMAINS]
    )

    assert.equal(STANDARD_ONTOLOGY_VOCABULARY.exampleAxioms.length, 0)
    assert.ok(STANDARD_ONTOLOGY_VOCABULARY.parentDomains.every((domain) => domain.childLabels.length > 0))
    assert.ok(STANDARD_RELATIONSHIP_TYPES.includes('predicts'))
    assert.ok(STANDARD_AXIOM_STATUSES.includes('candidate'))
  })

  it('classifies entries only into the closed life domain vocabulary', () => {
    assert.deepEqual(
      parseLifeDomains(['Sleep', 'Affect', 'Work', 'Sleep', 'Vibes', null]),
      ['Sleep', 'Affect', 'Work']
    )
  })
})

describe('ontology prompt section', () => {
  it('only injects confirmed non-demo axioms into model prompts', () => {
    const section = buildOntologyPromptSection([
      {
        antecedent: 'High Learning',
        consequent: 'Higher Affect',
        confidence: 0.67,
        status: 'confirmed',
        scope: 'personal',
      },
      {
        antecedent: 'Adam Exercise + Sleep',
        consequent: 'Adam stress recovery',
        confidence: 0.57,
        status: 'confirmed',
        scope: 'demo',
      },
      {
        antecedent: 'Unreviewed Sleep Pattern',
        consequent: 'Possible work change',
        confidence: 0.5,
        status: 'candidate',
        scope: 'personal',
      },
      {
        antecedent: 'Missing Metadata Pattern',
        consequent: 'Should not govern prompts',
        confidence: 0.9,
      },
      {
        antecedent: 'Starter Hypothesis Pattern',
        consequent: 'Should be tested before governing prompts',
        confidence: 0.8,
        status: 'confirmed',
        scope: 'starter_hypothesis',
      },
      {
        antecedent: 'Low Confidence Pattern',
        consequent: 'Should not govern prompts',
        confidence: 0.49,
        status: 'confirmed',
        scope: 'personal',
      },
      {
        antecedent: '',
        consequent: 'Malformed rows should not govern prompts',
        confidence: 0.9,
        status: 'confirmed',
        scope: 'personal',
      },
    ])

    assert.match(section, /High Learning/)
    assert.doesNotMatch(section, /Adam Exercise/)
    assert.doesNotMatch(section, /Unreviewed Sleep Pattern/)
    assert.doesNotMatch(section, /Missing Metadata Pattern/)
    assert.doesNotMatch(section, /Starter Hypothesis Pattern/)
    assert.doesNotMatch(section, /Low Confidence Pattern/)
    assert.doesNotMatch(section, /Malformed rows/)
  })
})

describe('axiom evidence matching', () => {
  it('attaches supporting and contradictory evidence without duplicating entries', () => {
    const support = buildAxiomEvidenceUpdate(
      {
        evidenceEntryIds: ['entry-1'],
        evidenceCount: 1,
        provenance: {},
      },
      {
        entryId: 'entry-2',
        direction: 'supports',
        rationale: 'Entry describes low sleep followed by lower patience',
        source: 'test',
        recordedAt: '2026-05-10T12:00:00.000Z',
      }
    )

    if ('ignored' in support) {
      assert.fail('Supporting evidence should not be ignored')
    }

    assert.deepEqual(support.evidenceEntryIds, ['entry-1', 'entry-2'])
    assert.equal(support.evidenceCount, 2)
    assert.deepEqual(support.provenance.evidenceLedger, [
      {
        entryId: 'entry-2',
        direction: 'supports',
        rationale: 'Entry describes low sleep followed by lower patience',
        source: 'test',
        recordedAt: '2026-05-10T12:00:00.000Z',
      },
    ])

    const contradiction = buildAxiomEvidenceUpdate(
      support,
      {
        entryId: 'entry-2',
        direction: 'contradicts',
        rationale: 'Duplicate entry should not increment evidence count',
        source: 'test',
        recordedAt: '2026-05-10T12:05:00.000Z',
      }
    )

    if ('ignored' in contradiction) {
      assert.fail('Contradictory evidence should not be ignored')
    }

    assert.deepEqual(contradiction.evidenceEntryIds, ['entry-1', 'entry-2'])
    assert.equal(contradiction.evidenceCount, 2)
    assert.equal(contradiction.provenance.evidenceLedger.length, 2)
  })

  it('ignores unrelated entries as axiom evidence', () => {
    const update = buildAxiomEvidenceUpdate(
      {
        evidenceEntryIds: [],
        evidenceCount: 0,
        provenance: {},
      },
      {
        entryId: 'entry-1',
        direction: 'unrelated',
        rationale: 'Same domain but no if-then match',
        source: 'test',
        recordedAt: '2026-05-10T12:00:00.000Z',
      }
    )

    assert.deepEqual(update, { ignored: true })
  })

  it('summarizes visible evidence directions without mutating confidence', () => {
    const axiom = {
      confidence: 0.64,
      evidenceEntryIds: ['entry-1', 'entry-2', 'entry-3'],
      evidenceCount: 3,
      provenance: {
        evidenceLedger: [
          {
            entryId: 'entry-1',
            direction: 'supports',
            rationale: 'Morning exercise preceded better focus',
            source: 'test',
            recordedAt: '2026-05-10T12:00:00.000Z',
          },
          {
            entryId: 'entry-2',
            direction: 'weakens',
            rationale: 'Exercise helped less when sleep was low',
            source: 'test',
            recordedAt: '2026-05-10T12:05:00.000Z',
          },
          {
            entryId: 'entry-3',
            direction: 'contradicts',
            rationale: 'Exercise did not improve affect that day',
            source: 'test',
            recordedAt: '2026-05-10T12:10:00.000Z',
          },
        ],
      },
    }

    assert.deepEqual(summarizeAxiomEvidence(axiom), {
      supports: 1,
      weakens: 1,
      contradicts: 1,
      totalDirectionalEvidence: 3,
      hasContradictions: true,
      latestContradiction: 'Exercise did not improve affect that day',
      confidence: 0.64,
    })
    assert.equal(axiom.confidence, 0.64)
  })
})

describe('candidate axiom discovery', () => {
  it('creates a candidate axiom from a reusable pattern with AI provenance', () => {
    const candidate = suggestCandidateAxiomFromEntry({
      entryId: 'entry-1',
      content: 'When sleep is under 6 hours, my patience in work meetings drops hard.',
      lifeDomains: ['Sleep', 'Work', 'Affect'],
      proposedAntecedent: 'Sleep under 6 hours',
      proposedConsequent: 'Lower patience in work meetings',
      relationshipType: 'predicts',
      confidence: 0.52,
      existingAxioms: [],
      proposedAt: '2026-05-10T12:00:00.000Z',
    })

    assert.deepEqual(candidate, {
      name: 'Sleep under 6 hours predicts lower patience in work meetings',
      description: 'AI-proposed candidate from entry entry-1. Requires human review before it can govern reasoning.',
      antecedent: 'Sleep under 6 hours',
      consequent: 'Lower patience in work meetings',
      confidence: 0.52,
      status: 'candidate',
      scope: 'personal',
      relationshipType: 'predicts',
      evidenceEntryIds: ['entry-1'],
      evidenceCount: 1,
      sources: ['ai_proposed'],
      provenance: {
        source: 'ai_proposed',
        entryId: 'entry-1',
        proposedAt: '2026-05-10T12:00:00.000Z',
        lifeDomains: ['Sleep', 'Work', 'Affect'],
        competencyQuestion: 'CQ-002',
        requiresHumanReview: true,
      },
    })
  })

  it('does not create a candidate from a one-off event', () => {
    const candidate = suggestCandidateAxiomFromEntry({
      entryId: 'entry-2',
      content: 'I liked this one movie because it reminded me of college.',
      lifeDomains: ['Entertainment', 'Affect'],
      proposedAntecedent: 'This one movie reminded me of college',
      proposedConsequent: 'I liked it',
      relationshipType: 'correlates_with',
      confidence: 0.8,
      existingAxioms: [],
      proposedAt: '2026-05-10T12:00:00.000Z',
    })

    assert.deepEqual(candidate, {
      ignored: true,
      reason: 'Entry does not express a reusable pattern',
    })
  })

  it('does not duplicate an existing axiom', () => {
    const candidate = suggestCandidateAxiomFromEntry({
      entryId: 'entry-3',
      content: 'Low sleep made work patience worse again.',
      lifeDomains: ['Sleep', 'Work', 'Affect'],
      proposedAntecedent: 'low sleep',
      proposedConsequent: 'lower work patience',
      relationshipType: 'predicts',
      confidence: 0.6,
      existingAxioms: [
        {
          antecedent: 'Low Sleep',
          consequent: 'Lower Work Patience',
        },
      ],
      proposedAt: '2026-05-10T12:00:00.000Z',
    })

    assert.deepEqual(candidate, {
      ignored: true,
      reason: 'Pattern is already represented by an existing axiom',
    })
  })

  it('rejects vague antecedents or consequents as untestable', () => {
    const candidate = suggestCandidateAxiomFromEntry({
      entryId: 'entry-4',
      content: 'When something happens, things change.',
      lifeDomains: ['Insight'],
      proposedAntecedent: 'Something',
      proposedConsequent: 'Things change',
      relationshipType: 'predicts',
      confidence: 0.7,
      existingAxioms: [],
      proposedAt: '2026-05-10T12:00:00.000Z',
    })

    assert.deepEqual(candidate, {
      ignored: true,
      reason: 'Pattern is too vague to test',
    })
  })
})

describe('product vs personal ontology boundary', () => {
  it('routes personal patterns to personal candidate eligibility', () => {
    assert.deepEqual(
      classifyOntologyBoundary(
        'When I use ranked priorities, my productivity and satisfaction improve.'
      ),
      {
        boundary: 'personal_pattern',
        recommendedMove: 'eligible_for_personal_candidate',
        shouldSplitClaims: false,
        reason: 'Item describes Adam, life, behavior, preferences, relationships, attention, energy, or judgment.',
      }
    )
  })

  it('routes product/system material away from personal axioms', () => {
    assert.deepEqual(
      classifyOntologyBoundary(
        'Test the save function and fix the Understood app autosave bug.'
      ),
      {
        boundary: 'product_system',
        recommendedMove: 'remain_note_or_product_candidate',
        shouldSplitClaims: false,
        reason: 'Item describes Understood, app architecture, users, workflows, bugs, features, or strategy.',
      }
    )
  })

  it('splits mixed personal and product material into separate claims', () => {
    assert.deepEqual(
      classifyOntologyBoundary(
        'When Understood captures context at night, I feel more confident reviewing my patterns later.'
      ),
      {
        boundary: 'both',
        recommendedMove: 'split_into_personal_and_product_claims',
        shouldSplitClaims: true,
        reason: 'Item contains both personal-pattern and product/system material.',
      }
    )
  })
})

describe('claim splitting before axiom review', () => {
  it('keeps a single focused personal pattern as one claim', () => {
    assert.deepEqual(
      splitEntryIntoClaims({
        sourceEntryId: 'entry-1',
        rawText: 'When I use ranked priorities, my productivity and satisfaction improve.',
        suggestedDomains: ['Ambition', 'Work', 'Affect'],
      }),
      {
        classification: 'single_claim',
        recommendedMove: 'continue_normal_review',
        claims: [
          {
            sourceEntryId: 'entry-1',
            originalRawText: 'When I use ranked priorities, my productivity and satisfaction improve.',
            claimText: 'When I use ranked priorities, my productivity and satisfaction improve.',
            suggestedDomains: ['Ambition', 'Work', 'Affect'],
            provenance: 'entry_extracted',
            requiresHumanReview: true,
            status: 'candidate',
          },
        ],
        reason: 'Entry appears to contain one focused claim.',
      }
    )
  })

  it('splits bundled business and product notes before review', () => {
    const result = splitEntryIntoClaims({
      sourceEntryId: 'entry-2',
      rawText: 'Pricing should focus on value created. Patent the Understood process before outside testers. Debugging with AI agents is coding and needs its own workflow.',
      suggestedDomains: ['Work', 'Ambition', 'Learning'],
    })

    assert.equal(result.classification, 'multiple_claims')
    assert.equal(result.recommendedMove, 'split_before_review')
    assert.deepEqual(
      result.claims.map((claim) => claim.claimText),
      [
        'Pricing should focus on value created.',
        'Patent the Understood process before outside testers.',
        'Debugging with AI agents is coding and needs its own workflow.',
      ]
    )
    assert.ok(result.claims.every((claim) => claim.status === 'candidate'))
    assert.ok(result.claims.every((claim) => claim.provenance === 'entry_extracted'))
    assert.ok(result.claims.every((claim) => claim.requiresHumanReview))
  })

  it('splits mixed personal and product notes into separate claims', () => {
    const result = splitEntryIntoClaims({
      sourceEntryId: 'entry-3',
      rawText: 'Understood captures context at night. I feel more confident reviewing my patterns later.',
      suggestedDomains: ['Work', 'Insight', 'Affect'],
    })

    assert.equal(result.classification, 'multiple_claims')
    assert.equal(result.recommendedMove, 'split_before_review')
    assert.deepEqual(
      result.claims.map((claim) => claim.claimText),
      [
        'Understood captures context at night.',
        'I feel more confident reviewing my patterns later.',
      ]
    )
  })

  it('keeps vague reflective notes unclear until human review', () => {
    assert.deepEqual(
      splitEntryIntoClaims({
        sourceEntryId: 'entry-4',
        rawText: 'Something about today felt important.',
        suggestedDomains: ['Insight'],
      }),
      {
        classification: 'unclear',
        recommendedMove: 'keep_as_note_until_human_review',
        claims: [],
        reason: 'Entry is too vague to split into testable claims.',
      }
    )
  })

  it('does not turn split claims into confirmed axioms automatically', () => {
    const result = splitEntryIntoClaims({
      sourceEntryId: 'entry-5',
      rawText: 'Testing should focus on critical paths. Visual regression is probably overkill right now.',
      suggestedDomains: ['Work', 'Learning'],
    })

    assert.ok(result.claims.length > 0)
    assert.ok(result.claims.every((claim) => claim.status === 'candidate'))
  })
})

describe('axiom review transitions', () => {
  it('identifies candidate axioms ready for human confirmation', () => {
    const readiness = evaluateAxiomReviewReadiness({
      status: 'candidate',
      confidence: 0.5,
      evidenceCount: STANDARD_AXIOM_REVIEW_POLICY.minimumEvidenceCount,
      evidenceDirection: 'aligned',
      provenance: { source: 'test' },
    })

    assert.deepEqual(readiness, {
      recommendation: 'confirm',
      isReviewReady: true,
      reason: 'Candidate has enough aligned evidence and confidence for human confirmation',
    })
  })

  it('keeps mixed or under-evidenced candidate axioms out of confirmation', () => {
    assert.deepEqual(
      evaluateAxiomReviewReadiness({
        status: 'candidate',
        confidence: 0.8,
        evidenceCount: 1,
        evidenceDirection: 'aligned',
        provenance: {},
      }),
      {
        recommendation: 'keep_candidate',
        isReviewReady: false,
        reason: 'Candidate needs more aligned evidence before review',
      }
    )

    assert.deepEqual(
      evaluateAxiomReviewReadiness({
        status: 'candidate',
        confidence: 0.2,
        evidenceCount: 3,
        evidenceDirection: 'contradictory',
        provenance: {},
      }),
      {
        recommendation: 'reject',
        isReviewReady: true,
        reason: 'Candidate has contradictory evidence or confidence below rejection threshold',
      }
    )
  })

  it('preserves confirmation timestamp when retiring a confirmed axiom', () => {
    const update = buildAxiomReviewUpdate(
      {
        status: 'confirmed',
        confirmed_at: '2026-05-01T12:00:00.000Z',
        rejected_at: null,
        retired_at: null,
      },
      'retired',
      '2026-05-02T12:00:00.000Z'
    )

    assert.deepEqual(update, {
      status: 'retired',
      confirmed_at: '2026-05-01T12:00:00.000Z',
      rejected_at: null,
      retired_at: '2026-05-02T12:00:00.000Z',
    })
  })

  it('rejects invalid direct transitions', () => {
    const update = buildAxiomReviewUpdate(
      {
        status: 'rejected',
        confirmed_at: null,
        rejected_at: '2026-05-01T12:00:00.000Z',
        retired_at: null,
      },
      'confirmed',
      '2026-05-02T12:00:00.000Z'
    )

    assert.deepEqual(update, { error: 'Cannot move axiom from rejected to confirmed' })
  })

  it('only permits human review transitions for personal axioms', () => {
    assert.equal(canReviewAxiomScope('personal'), true)
    assert.equal(canReviewAxiomScope('starter_hypothesis'), false)
    assert.equal(canReviewAxiomScope('demo'), false)
  })

  it('surfaces stale confirmed axioms for retirement review without auto-retiring', () => {
    const readiness = evaluateAxiomRetirementReadiness(
      {
        status: 'confirmed',
        confidence: 0.6,
        confirmedAt: '2026-01-01T12:00:00.000Z',
        retiredAt: null,
        evidenceEntryIds: ['entry-1'],
        evidenceCount: 1,
        provenance: {
          evidenceLedger: [
            {
              entryId: 'entry-1',
              direction: 'supports',
              rationale: 'Old supporting evidence',
              source: 'test',
              recordedAt: '2026-01-05T12:00:00.000Z',
            },
          ],
        },
      },
      '2026-05-10T12:00:00.000Z'
    )

    assert.deepEqual(readiness, {
      shouldReviewForRetirement: true,
      signals: ['stale_confirmed_axiom', 'stale_evidence'],
      daysSinceConfirmation: 129,
      daysSinceLatestEvidence: 125,
      recommendation: 'review_for_retirement',
      reason: 'Confirmed axiom is stale or lacks recent supporting evidence',
      nextStatus: 'confirmed',
      confidence: 0.6,
    })
  })

  it('does not suggest retirement review for fresh confirmed axioms', () => {
    const readiness = evaluateAxiomRetirementReadiness(
      {
        status: 'confirmed',
        confidence: 0.7,
        confirmedAt: '2026-05-01T12:00:00.000Z',
        retiredAt: null,
        evidenceEntryIds: ['entry-1'],
        evidenceCount: 1,
        provenance: {
          evidenceLedger: [
            {
              entryId: 'entry-1',
              direction: 'supports',
              rationale: 'Recent supporting evidence',
              source: 'test',
              recordedAt: '2026-05-09T12:00:00.000Z',
            },
          ],
        },
      },
      '2026-05-10T12:00:00.000Z'
    )

    assert.deepEqual(readiness, {
      shouldReviewForRetirement: false,
      signals: [],
      daysSinceConfirmation: 9,
      daysSinceLatestEvidence: 1,
      recommendation: 'keep_confirmed',
      reason: 'Confirmed axiom has no retirement review signals',
      nextStatus: 'confirmed',
      confidence: 0.7,
    })
  })
})

describe('ontology review queue', () => {
  it('separates personal candidates for review and orders them by evidence then confidence', () => {
    const queue = buildOntologyReviewQueue([
      {
        id: 'candidate-low',
        status: 'candidate',
        scope: 'personal',
        confidence: 0.9,
        evidenceCount: 1,
        evidenceEntryIds: ['entry-1'],
        provenance: { source: 'ai_proposed' },
      },
      {
        id: 'confirmed',
        status: 'confirmed',
        scope: 'personal',
        confidence: 0.8,
        evidenceCount: 3,
        evidenceEntryIds: ['entry-1', 'entry-2', 'entry-3'],
        provenance: { source: 'human_reviewed' },
      },
      {
        id: 'candidate-high',
        status: 'candidate',
        scope: 'personal',
        confidence: 0.7,
        evidenceCount: 4,
        evidenceEntryIds: ['entry-1', 'entry-2', 'entry-3', 'entry-4'],
        provenance: { source: 'ai_proposed' },
      },
      {
        id: 'demo-candidate',
        status: 'candidate',
        scope: 'demo',
        confidence: 0.99,
        evidenceCount: 99,
        evidenceEntryIds: [],
        provenance: {},
      },
    ])

    assert.deepEqual(
      queue.pendingCandidates.map((axiom) => axiom.id),
      ['candidate-high', 'candidate-low']
    )
    assert.deepEqual(
      queue.reviewedAxioms.map((axiom) => axiom.id),
      ['confirmed', 'demo-candidate']
    )
    assert.equal(queue.pendingCount, 2)
  })

  it('turns provenance into a readable review label', () => {
    assert.equal(
      getAxiomProvenanceLabel({
        source: 'ai_proposed',
        entryId: 'entry-1',
        competencyQuestion: 'CQ-002',
        requiresHumanReview: true,
      }),
      'AI proposed from entry entry-1 · CQ-002 · human review required'
    )

    assert.equal(getAxiomProvenanceLabel({ source: 'self_declared' }), 'Self declared')
    assert.equal(getAxiomProvenanceLabel({}), 'No provenance recorded')
  })
})

describe('ontology provenance normalization', () => {
  it('normalizes source trust labels for the review surface', () => {
    assert.deepEqual(
      [
        'self_declared',
        'ai_proposed',
        'entry_extracted',
        'human_confirmed',
        'imported_metric',
        'observed_other',
        'demo_seed',
        'starter_hypothesis',
      ].map((source) => getProvenanceSourceDescriptor(source)),
      [
        {
          source: 'self_declared',
          label: 'Self declared',
          description: 'The user explicitly entered this belief or rule.',
          reviewRole: 'user_originated',
        },
        {
          source: 'ai_proposed',
          label: 'AI proposed',
          description: 'AI suggested this candidate; human review is required before it can govern reasoning.',
          reviewRole: 'ai_generated',
        },
        {
          source: 'entry_extracted',
          label: 'Entry extracted',
          description: 'This came from one or more captured entries.',
          reviewRole: 'derived_from_record',
        },
        {
          source: 'human_confirmed',
          label: 'Human confirmed',
          description: 'The user reviewed and confirmed this ontology material.',
          reviewRole: 'reviewed',
        },
        {
          source: 'imported_metric',
          label: 'Imported metric',
          description: 'This came from an external measurement source.',
          reviewRole: 'external_data',
        },
        {
          source: 'observed_other',
          label: 'Observed other',
          description: 'A pattern, behavior, decision, or claim observed in another person, team, customer, product, or external actor.',
          reviewRole: 'observed_external',
        },
        {
          source: 'demo_seed',
          label: 'Demo seed',
          description: 'Demo or benchmark material; not inherited as a personal belief.',
          reviewRole: 'reference_only',
        },
        {
          source: 'starter_hypothesis',
          label: 'Starter hypothesis',
          description: 'Global starter material that must be tested before governing personal reasoning.',
          reviewRole: 'reference_only',
        },
      ]
    )
  })

  it('keeps provenance descriptive without changing confidence', () => {
    const axiom = {
      confidence: 0.42,
      status: 'candidate',
      scope: 'personal',
      provenance: { source: 'imported_metric' },
    }

    assert.equal(normalizeProvenanceSource(axiom.provenance).source, 'imported_metric')
    assert.equal(axiom.confidence, 0.42)
    assert.equal(axiom.status, 'candidate')
    assert.equal(axiom.scope, 'personal')
  })

  it('normalizes observed_other without making the claim personal or confirmed', () => {
    const axiom = {
      confidence: 0.51,
      status: 'candidate',
      scope: 'personal',
      provenance: { source: 'observed_other' },
    }

    assert.deepEqual(normalizeProvenanceSource(axiom.provenance), {
      source: 'observed_other',
      label: 'Observed other',
      description: 'A pattern, behavior, decision, or claim observed in another person, team, customer, product, or external actor.',
      reviewRole: 'observed_external',
    })
    assert.equal(axiom.confidence, 0.51)
    assert.equal(axiom.status, 'candidate')
    assert.equal(axiom.scope, 'personal')
  })
})

describe('knowledge graph projection', () => {
  it('projects confirmed personal axioms into deterministic nodes and edges', () => {
    const graph = projectAxiomsToKnowledgeGraph([
      {
        id: 'axiom-1',
        antecedent: 'High Learning',
        consequent: 'Higher Affect',
        confidence: 0.67,
        status: 'confirmed',
        scope: 'personal',
        relationshipType: 'predicts',
        evidenceEntryIds: ['entry-1', 'entry-2'],
        evidenceCount: 2,
        provenance: { source: 'test' },
      },
      {
        id: 'axiom-2',
        antecedent: 'Adam Exercise + Sleep',
        consequent: 'Adam stress recovery',
        confidence: 0.57,
        status: 'confirmed',
        scope: 'demo',
        relationshipType: 'predicts',
        evidenceEntryIds: [],
        evidenceCount: 8069,
        provenance: { corpus: 'adam_example' },
      },
      {
        id: 'axiom-3',
        antecedent: 'Low Sleep',
        consequent: 'Lower Work',
        confidence: 0.4,
        status: 'candidate',
        scope: 'personal',
        relationshipType: 'predicts',
        evidenceEntryIds: [],
        evidenceCount: 0,
        provenance: {},
      },
    ])

    assert.deepEqual(
      graph.nodes.map((node) => node.id),
      ['concept:high-learning', 'concept:higher-affect']
    )
    assert.deepEqual(graph.edges, [
      {
        id: 'axiom:axiom-1',
        sourceId: 'concept:high-learning',
        targetId: 'concept:higher-affect',
        relationshipType: 'predicts',
        confidence: 0.67,
        axiomId: 'axiom-1',
        evidenceEntryIds: ['entry-1', 'entry-2'],
        evidenceCount: 2,
        provenance: { source: 'test' },
      },
    ])
  })
})

describe('RDF export', () => {
  it('exports only confirmed personal axioms to Turtle triples', () => {
    const turtle = exportAxiomsToTurtle([
      {
        id: 'axiom-1',
        antecedent: 'High Learning',
        consequent: 'Higher Affect',
        confidence: 0.67,
        status: 'confirmed',
        scope: 'personal',
        relationshipType: 'predicts',
        evidenceEntryIds: ['entry-1', 'entry-2'],
        evidenceCount: 2,
        provenance: { source: 'human_confirmed' },
      },
      {
        id: 'axiom-2',
        antecedent: 'Demo Pattern',
        consequent: 'Should not export',
        confidence: 0.99,
        status: 'confirmed',
        scope: 'demo',
        relationshipType: 'predicts',
        evidenceEntryIds: [],
        evidenceCount: 0,
        provenance: {},
      },
      {
        id: 'axiom-3',
        antecedent: 'Candidate Pattern',
        consequent: 'Should not export',
        confidence: 0.5,
        status: 'candidate',
        scope: 'personal',
        relationshipType: 'predicts',
        evidenceEntryIds: [],
        evidenceCount: 0,
        provenance: {},
      },
    ])

    assert.match(turtle, /# vocabularyVersion: understood-ontology-v1/)
    assert.match(turtle, /# appVersion: unknown/)
    assert.match(turtle, /@prefix understood: <https:\/\/understood\.app\/ontology#> \./)
    assert.match(turtle, /<https:\/\/understood\.app\/ontology\/axiom\/axiom-1> a understood:Axiom ;/)
    assert.match(turtle, /understood:antecedent <https:\/\/understood\.app\/ontology\/concept\/high-learning> ;/)
    assert.match(turtle, /understood:consequent <https:\/\/understood\.app\/ontology\/concept\/higher-affect> ;/)
    assert.match(turtle, /understood:relationshipType "predicts" ;/)
    assert.match(turtle, /understood:confidence "0.67"\^\^xsd:decimal ;/)
    assert.match(turtle, /understood:evidenceCount 2 ;/)
    assert.match(turtle, /understood:provenanceSource "human_confirmed" \./)
    assert.doesNotMatch(turtle, /Demo Pattern/)
    assert.doesNotMatch(turtle, /Candidate Pattern/)
  })

  it('escapes Turtle string literals', () => {
    const turtle = exportAxiomsToTurtle([
      {
        id: 'axiom-quotes',
        antecedent: 'Learning "flow"',
        consequent: 'Higher affect\\energy',
        confidence: 0.75,
        status: 'confirmed',
        scope: 'personal',
        relationshipType: 'supports',
        evidenceEntryIds: [],
        evidenceCount: 0,
        provenance: {},
      },
    ])

    assert.match(turtle, /understood:antecedentLabel "Learning \\"flow\\"" ;/)
    assert.match(turtle, /understood:consequentLabel "Higher affect\\\\energy" ;/)
  })
})

describe('SHACL shapes', () => {
  it('defines required fields for exported ontology axioms', () => {
    const shapes = buildOntologyShaclShapes()

    assert.match(shapes, /@prefix sh: <http:\/\/www\.w3\.org\/ns\/shacl#> \./)
    assert.match(shapes, /understood:AxiomShape a sh:NodeShape ;/)
    assert.match(shapes, /sh:targetClass understood:Axiom ;/)
    assert.match(shapes, /sh:path understood:axiomId ;\n\s+sh:minCount 1 ;/)
    assert.match(shapes, /sh:path understood:antecedent ;\n\s+sh:minCount 1 ;/)
    assert.match(shapes, /sh:path understood:consequent ;\n\s+sh:minCount 1 ;/)
    assert.match(shapes, /sh:path understood:relationshipType ;\n\s+sh:minCount 1 ;/)
    assert.match(shapes, /sh:path understood:confidence ;\n\s+sh:minCount 1 ;\n\s+sh:datatype xsd:decimal ;/)
    assert.match(shapes, /sh:path understood:evidenceCount ;\n\s+sh:minCount 1 ;\n\s+sh:datatype xsd:integer ;/)
    assert.match(shapes, /sh:path understood:provenanceSource ;\n\s+sh:minCount 1 ;/)
  })
})

describe('semantic validation', () => {
  it('validates exported Turtle against required axiom predicates', () => {
    const turtle = exportAxiomsToTurtle([
      {
        id: 'axiom-1',
        antecedent: 'High Learning',
        consequent: 'Higher Affect',
        confidence: 0.67,
        status: 'confirmed',
        scope: 'personal',
        relationshipType: 'predicts',
        evidenceEntryIds: ['entry-1'],
        evidenceCount: 1,
        provenance: { source: 'self_declared' },
      },
    ])

    assert.deepEqual(validateOntologyAxiomTurtle(turtle), {
      valid: true,
      checkedSubjects: 1,
      issues: [],
    })
  })

  it('reports missing required predicates in Turtle exports', () => {
    const result = validateOntologyAxiomTurtle(`
@prefix understood: <https://understood.app/ontology#> .

understood:axiom_axiom_1
  a understood:Axiom ;
  understood:axiomId "axiom-1" ;
  understood:antecedent "High Learning" .
`)

    assert.equal(result.valid, false)
    assert.equal(result.checkedSubjects, 1)
    assert.deepEqual(result.issues[0].missingPredicates, [
      'understood:consequent',
      'understood:relationshipType',
      'understood:confidence',
      'understood:evidenceCount',
      'understood:provenanceSource',
    ])
  })
})

describe('semantic report', () => {
  it('summarizes RDF export, SHACL, validation, and SPARQL templates together', () => {
    const report = buildOntologySemanticReport(
      [
        {
          id: 'a1',
          antecedent: 'Low sleep',
          consequent: 'Lower patience',
          confidence: 0.7,
          status: 'confirmed',
          scope: 'personal',
          relationshipType: 'predicts',
          evidenceEntryIds: ['e1'],
          evidenceCount: 1,
          provenance: { source: 'self_declared' },
        },
        {
          id: 'a2',
          antecedent: 'Candidate only',
          consequent: 'Not exported',
          confidence: 0.4,
          status: 'candidate',
          scope: 'personal',
          relationshipType: 'predicts',
          evidenceEntryIds: [],
          evidenceCount: 0,
          provenance: { source: 'ai_proposed' },
        },
      ],
      { appVersion: 'test-sha', exportedAt: '2026-05-12T00:00:00.000Z' }
    )

    assert.equal(report.exportedAxiomCount, 1)
    assert.equal(report.vocabularyVersion, 'understood-ontology-v1')
    assert.equal(report.appVersion, 'test-sha')
    assert.equal(report.validation.valid, true)
    assert.equal(report.validation.checkedSubjects, 1)
    assert.equal(report.queryTemplateCount, 4)
    assert.match(report.turtle, /understood:Axiom/)
    assert.match(report.turtle, /# appVersion: test-sha/)
    assert.match(report.turtle, /# exportedAt: 2026-05-12T00:00:00.000Z/)
    assert.match(report.shacl, /sh:NodeShape/)
    assert.ok(report.queryNames.includes('CQ-005 prompt eligibility'))
  })
})

describe('SPARQL query templates', () => {
  it('maps CQ-005 to prompt-eligible confirmed personal axioms', () => {
    const query = buildPromptEligibleAxiomsQuery()

    assert.match(query, /# CQ-005: Assistant Prompt Eligibility/)
    assert.match(query, /SELECT \?axiom \?antecedent \?consequent \?confidence/)
    assert.match(query, /understood:status "confirmed"/)
    assert.match(query, /understood:scope "personal"/)
    assert.match(query, /FILTER\(\?confidence >= 0.5\)/)
  })

  it('maps CQ-006 to graph projection edges', () => {
    const query = buildGraphProjectionQuery()

    assert.match(query, /# CQ-006: Knowledge Graph Projection/)
    assert.match(query, /SELECT \?axiom \?antecedent \?relationshipType \?consequent \?confidence/)
    assert.match(query, /understood:antecedent \?antecedent/)
    assert.match(query, /understood:consequent \?consequent/)
  })

  it('maps CQ-009 to contradiction evidence checks', () => {
    const query = buildContradictionEvidenceQuery()

    assert.match(query, /# CQ-009: Contradiction Detection/)
    assert.match(query, /SELECT \?axiom \?contradiction/)
    assert.match(query, /understood:contradiction \?contradiction/)
  })

  it('maps CQ-010 to provenance source inspection', () => {
    const query = buildProvenanceSourceQuery()

    assert.match(query, /# CQ-010: Provenance and Source Trust/)
    assert.match(query, /SELECT \?axiom \?provenanceSource/)
    assert.match(query, /understood:provenanceSource \?provenanceSource/)
  })
})

describe('connections ontology intake seed', () => {
  it('provides 18 calibration-backed items with unique ids', () => {
    assert.equal(CONNECTION_ONTOLOGY_INTAKE_ITEMS.length, 18)
    const ids = new Set(CONNECTION_ONTOLOGY_INTAKE_ITEMS.map((item) => item.id))
    assert.equal(ids.size, 18)
  })

  it('exposes strong personal connections as read-only prompt principles', () => {
    const principles = getConnectionPromptPrinciples()

    assert.ok(principles.length > 0)
    assert.ok(principles.every((item) => item.bucket === 'strong_candidate_personal'))
    assert.ok(principles.every((item) => item.boundary === 'personal_pattern'))
    assert.ok(principles.some((item) => item.headline === 'Delegation is three sentences'))

    const section = buildConnectionPrinciplesPromptSection()
    assert.match(section, /User-authored Connections/)
    assert.match(section, /helpful context, not confirmed ontology axioms/)
    assert.match(section, /Delegation is three sentences/)
    assert.doesNotMatch(section, /Products fight potential slipping away/)
    assert.doesNotMatch(section, /My assignment is to create desire/)
  })

  it('labels connection prompt principles separately from confirmed axioms', () => {
    const section = [
      buildOntologyPromptSection([
        {
          antecedent: 'Low sleep',
          consequent: 'Lower patience',
          confidence: 0.72,
          status: 'confirmed',
          scope: 'personal',
        },
      ]),
      buildConnectionPrinciplesPromptSection(),
    ].join('')

    assert.match(section, /Personal ontology rules/)
    assert.match(section, /User-authored Connections/)
    assert.match(section, /Low sleep → Lower patience/)
    assert.match(section, /not confirmed ontology axioms/)
  })

  it('maps live connection rows into intake items with seed fallback', () => {
    assert.equal(buildConnectionIntakeItemsFromEntries([]), CONNECTION_ONTOLOGY_INTAKE_ITEMS)

    const items = buildConnectionIntakeItemsFromEntries([
      {
        id: 'live-1',
        headline: 'Delegation is three sentences',
        content: 'Delegation is three sentences',
        connection_type: 'process_anchor',
      },
      {
        id: 'live-2',
        headline: 'A product must reduce user friction',
        content: 'The app workflow should reduce user friction.',
        connection_type: 'validated_principle',
      },
      {
        id: 'live-3',
        headline: 'Momentum beats polish',
        content: 'If I have momentum, I should preserve it before polishing.',
        connection_type: 'validated_principle',
      },
    ])

    assert.equal(items.length, 3)
    assert.equal(items[0].id, 'live-1')
    assert.equal(items[0].suggestedBucket, 'strong_candidate_personal')
    assert.equal(items[1].suggestedBucket, 'product_system_principle')
    assert.equal(items[2].suggestedBucket, 'strong_candidate_personal')
  })

  it('finds read-only evidence candidates for connection principles', () => {
    const connection = CONNECTION_ONTOLOGY_INTAKE_ITEMS.find((item) => item.headline === 'Delegation is three sentences')
    assert.ok(connection)

    const candidates = findConnectionEvidenceCandidates(connection, [
      {
        id: 'entry-1',
        headline: 'Delegation handoff worked',
        content: 'The delegation handoff improved when I named what done looks like.',
        entry_type: 'story',
      },
      {
        id: 'entry-2',
        headline: 'Connection itself excluded',
        content: 'Delegation is three sentences.',
        entry_type: 'connection',
      },
      {
        id: 'entry-3',
        headline: 'Unrelated',
        content: 'I went for a run and slept well.',
        entry_type: 'story',
      },
    ])

    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].entryId, 'entry-1')
    assert.ok(candidates[0].matchedTerms.includes('delegation'))
  })

  it('turns eligible personal connections into candidate axioms only', () => {
    const connection = CONNECTION_ONTOLOGY_INTAKE_ITEMS.find((item) => item.headline === 'Delegation is three sentences')
    assert.ok(connection)

    const candidate = buildCandidateAxiomFromConnection(connection)

    assert.deepEqual(candidate, {
      name: 'Delegation is three sentences',
      description: 'Candidate axiom created from Connection "Delegation is three sentences". Requires human review before it can govern reasoning.',
      antecedent: 'delegation includes what I want, how I think about it, and what done looks like',
      consequent: 'handoff quality improves',
      confidence: 0.5,
      status: 'candidate',
      scope: 'personal',
      relationshipType: 'predicts',
      evidenceEntryIds: ['conn-004'],
      evidenceCount: 1,
      sources: ['self_declared'],
      provenance: {
        source: 'self_declared',
        connectionId: 'conn-004',
        connectionHeadline: 'Delegation is three sentences',
        connectionType: 'process_anchor',
        suggestedBucket: 'strong_candidate_personal',
        competencyQuestion: 'connections-calibration',
        requiresHumanReview: true,
      },
    })
  })

  it('blocks product and mixed connections from direct personal candidate creation', () => {
    const product = CONNECTION_ONTOLOGY_INTAKE_ITEMS.find((item) => item.headline === 'Products fight potential slipping away')
    const mixed = CONNECTION_ONTOLOGY_INTAKE_ITEMS.find((item) => item.headline === 'My assignment is to create desire')
    assert.ok(product)
    assert.ok(mixed)

    assert.deepEqual(buildCandidateAxiomFromConnection(product), {
      ignored: true,
      reason: 'Connection is not a personal ontology claim',
    })
    assert.deepEqual(buildCandidateAxiomFromConnection(mixed), {
      ignored: true,
      reason: 'Connection needs splitting before candidate review',
    })
  })
})

describe('public ontology reference scaffold', () => {
  it('keeps BFO and domain references separate from personal axioms', () => {
    assert.ok(PUBLIC_ONTOLOGY_REFERENCES.some((reference) => reference.id === 'bfo:continuant'))
    assert.ok(PUBLIC_ONTOLOGY_REFERENCES.some((reference) => reference.id === 'domain:sleep'))
    assert.ok(PUBLIC_ONTOLOGY_REFERENCES.every((reference) => reference.scope !== 'personal' as never))
  })

  it('maps personal concepts to public references without merging authority', () => {
    assert.ok(PERSONAL_PUBLIC_BRIDGES.some((bridge) => bridge.personalLabel === "Adam's Sleep"))
    assert.equal(getPublicReferenceById('domain:caffeine')?.label, 'Caffeine')

    const summary = getPersonalPublicBridgeSummary()
    assert.match(summary, /Adam's Sleep mapsTo Sleep/)
    assert.match(summary, /Adam's EveningCaffeineRule constrainedBy Caffeine/)
    assert.match(summary, /Understood app architecture mapsTo Software system/)
  })

  it('builds a public ontology guardrail section without personal-rule authority', () => {
    const nutritionReferences = getPublicReferencesByDomain('nutrition')
    assert.ok(nutritionReferences.some((reference) => reference.sourceUrl.includes('purl.obolibrary.org')))

    const section = buildPublicOntologyGuardrailSection()
    assert.match(section, /Public ontology guardrails/)
    assert.match(section, /Basic Formal Ontology/)
    assert.match(section, /FoodOn/)
    assert.match(section, /do not override the user's confirmed personal axioms/)
    assert.match(section, /not medical, dietary, legal, or financial advice/)
  })
})

describe('product ontology lane', () => {
  it('extracts product and mixed connection principles away from personal axioms', () => {
    const principles = extractProductOntologyPrinciples()

    assert.ok(principles.length > 0)
    assert.ok(principles.some((principle) => principle.kind === 'product_system_principle'))
    assert.ok(principles.some((principle) => principle.kind === 'mixed_product_claim'))
    assert.ok(principles.every((principle) => principle.id.startsWith('product:')))
    assert.ok(principles.some((principle) => principle.headline === 'Products fight potential slipping away'))
  })

  it('builds product-only prompt context without personal-rule authority', () => {
    const section = buildProductOntologyPromptSection()

    assert.match(section, /Product\/system principles/)
    assert.match(section, /product reasoning only/)
    assert.match(section, /Products fight potential slipping away/)
    assert.doesNotMatch(section, /Delegation is three sentences/)
  })
})
