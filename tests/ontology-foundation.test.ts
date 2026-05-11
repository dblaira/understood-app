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
import { buildOntologyReviewQueue, getAxiomProvenanceLabel } from '../lib/ontology/review-queue'
import { getProvenanceSourceDescriptor, normalizeProvenanceSource } from '../lib/ontology/provenance'

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
      provenance: { source: 'imported_metric' },
    }

    assert.equal(normalizeProvenanceSource(axiom.provenance).source, 'imported_metric')
    assert.equal(axiom.confidence, 0.42)
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
