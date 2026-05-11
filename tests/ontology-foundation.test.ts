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
import { buildAxiomReviewUpdate, evaluateAxiomReviewReadiness } from '../lib/ontology/axiom-review'
import { buildAxiomEvidenceUpdate } from '../lib/ontology/evidence'
import { projectAxiomsToKnowledgeGraph } from '../lib/ontology/knowledge-graph'

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
