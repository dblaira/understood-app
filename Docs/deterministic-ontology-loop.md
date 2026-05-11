# Deterministic Ontology Loop

This document defines the build boundary for the Understood ontology. The ontology is allowed to grow, but it must not quietly rewrite the user's beliefs.

## Core Principle

```text
AI proposes.
Evidence accumulates.
Signals become visible.
Humans decide.
Only confirmed personal axioms govern prompts and graph projection.
```

The ontology can surface candidates, contradictions, provenance, and staleness. It cannot silently confirm, reject, retire, delete, or change confidence.

## Axiom Lifecycle

1. **Entry captured**
   - A user records what happened.
   - The entry is classified into the closed `LifeDomain` vocabulary.

2. **Evidence matched**
   - If the entry clearly relates to an existing axiom, it can be attached as directional evidence.
   - Evidence direction can be `supports`, `weakens`, or `contradicts`.
   - Unrelated entries are ignored.

3. **Candidate proposed**
   - If the entry suggests a reusable, testable if-then pattern that is not already represented, AI may propose a candidate axiom.
   - New AI-proposed axioms always start as `candidate`.
   - Candidate provenance must identify the source and require human review.

4. **Human review**
   - Candidate axioms enter the review queue.
   - The user may confirm, reject, or leave the axiom as a candidate.
   - Only `personal` axioms can be reviewed through the user review surface.

5. **Governance**
   - Confirmed personal axioms above the confidence gate can enter assistant prompts.
   - Confirmed personal axioms can project into the deterministic knowledge graph.
   - Candidate, rejected, retired, demo, and starter rows remain visible but non-governing.

6. **Retirement**
   - Confirmed axioms can receive stale or evidence-recency signals.
   - The system may suggest review for retirement.
   - The user must explicitly retire the axiom.
   - Retiring preserves `confirmed_at`.

## What AI May Do

- Propose candidate axioms.
- Attach directional evidence.
- Surface contradictions.
- Surface provenance labels.
- Surface stale/evidence-recency signals.
- Prepare review queues.
- Suggest that a human review something.

## What Only Humans May Decide

- Confirm an axiom.
- Reject an axiom.
- Retire an axiom.
- Delete trusted ontology material.
- Decide that a candidate should govern future reasoning.

## What Must Never Auto-Mutate

- `status`
- `confidence`
- `confirmed_at`
- `rejected_at`
- `retired_at`
- prompt eligibility
- graph eligibility

Any change to these must pass through explicit review policy or human action.

## Competency Question Map

| Competency question | Purpose | Implementation |
| --- | --- | --- |
| CQ-001 | Entry domain classification | `types/ontology.ts`, `app/api/infer-entry/route.ts` |
| CQ-002 | Candidate axiom discovery | `lib/ontology/candidate-axioms.ts` |
| CQ-003 | Existing axiom evidence match | `lib/ontology/evidence.ts` |
| CQ-004 | Axiom review readiness | `lib/ontology/axiom-review.ts` |
| CQ-005 | Assistant prompt eligibility | `lib/ontology/build-prompt-section.ts` |
| CQ-006 | Knowledge graph projection | `lib/ontology/knowledge-graph.ts` |
| CQ-009 | Contradiction detection | `lib/ontology/evidence.ts`, `app/ontology/page.tsx` |
| CQ-010 | Provenance and source trust | `lib/ontology/provenance.ts`, `lib/ontology/review-queue.ts` |
| CQ-011 | Axiom retirement | `lib/ontology/axiom-review.ts`, `app/ontology/page.tsx` |
| CQ-016 | Product vs personal ontology boundary | `lib/ontology/boundary.ts` |
| CQ-017 | Claim splitting before axiom review | `lib/ontology/claim-splitting.ts` |
| Semantic export | RDF/Turtle projection for future semantic-web checks | `lib/ontology/rdf-export.ts` |
| Semantic validation | SHACL shape requirements for exported axioms | `lib/ontology/shacl-shapes.ts` |
| Semantic questions | SPARQL templates for competency checks | `lib/ontology/sparql-queries.ts` |

## Prompt And Graph Gates

An axiom can constrain the assistant or enter graph projection only when it is:

```text
status = confirmed
scope = personal
confidence >= configured confidence gate
antecedent and consequent are present
```

Everything else is review material, history, reference material, or training data.

## Product vs Personal Boundary

Before candidate axiom creation, classify what kind of world the record is about:

```text
personal_pattern -> eligible for personal candidate axiom
product_system -> remain note or product ontology candidate
both -> split into separate personal and product claims
unclear -> keep as note until clear
```

Use this boundary to avoid converting product/project notes into personal axioms.

```text
personal ontology = Adam, life, behavior, preferences, relationships, attention, energy, judgment
product ontology = Understood, app architecture, users, workflows, bugs, features, strategy
```

## Claim Splitting Boundary

Before candidate axiom creation, ask whether the entry contains one claim or many:

```text
single_claim -> continue normal review
multiple_claims -> split before evidence or axiom review
unclear -> keep as note until human review
```

Split claims must preserve source entry id, original raw text, claim text, suggested domains, `entry_extracted` provenance, `requiresHumanReview = true`, and `status = candidate`.

Use this boundary to avoid turning bundled entries into muddy axioms.

## Semantic Export Layer

The RDF layer is a downstream export/check layer, not a replacement for the product database.

```text
confirmed personal axioms
-> RDF/Turtle triples
-> SHACL validation
-> future SPARQL competency checks
```

The export must use the same governance boundary as prompt and graph projection. Candidate, rejected, retired, demo, and starter material should not become RDF truth.

The first SHACL shape requires exported `understood:Axiom` nodes to include:

- `understood:axiomId`
- `understood:antecedent`
- `understood:consequent`
- `understood:relationshipType`
- `understood:confidence`
- `understood:evidenceCount`
- `understood:provenanceSource`

The first SPARQL templates are question checks, not a runtime query engine:

- CQ-005: prompt-eligible axioms
- CQ-006: graph projection edges
- CQ-009: contradiction evidence
- CQ-010: provenance source per axiom

## Semantic Blueprint

This table ties product behavior, RDF vocabulary, SHACL validation, and SPARQL competency checks into one contract.

| CQ | App helper | RDF term | SHACL requirement | SPARQL query |
| --- | --- | --- | --- | --- |
| CQ-005 prompt eligibility | `buildOntologyPromptSection()` | `understood:status`, `understood:scope`, `understood:confidence` | `understood:confidence` is required and typed as `xsd:decimal` | `buildPromptEligibleAxiomsQuery()` |
| CQ-006 graph projection | `projectAxiomsToKnowledgeGraph()` | `understood:antecedent`, `understood:relationshipType`, `understood:consequent` | `understood:antecedent`, `understood:relationshipType`, and `understood:consequent` are required | `buildGraphProjectionQuery()` |
| CQ-009 contradiction detection | `summarizeAxiomEvidence()` | `understood:contradiction` | future contradiction shape; currently represented in provenance/evidence UI | `buildContradictionEvidenceQuery()` |
| CQ-010 provenance and source trust | `normalizeProvenanceSource()` | `understood:provenanceSource` | `understood:provenanceSource` is required | `buildProvenanceSourceQuery()` |

The semantic layer should stay downstream of the app helpers. RDF terms, SHACL requirements, and SPARQL templates check the deterministic loop; they do not replace it as the source of truth.

## Review Queue Boundary

The review queue is a human judgment surface. It may show:

- candidate axioms
- confidence
- evidence count
- support/weakening/contradiction badges
- latest contradiction rationale
- provenance source labels
- stale confirmed axiom signals

It must not mutate status or confidence without the user clicking an explicit review action.

## Source Trust Labels

The normalized provenance sources are:

- `self_declared`
- `ai_proposed`
- `entry_extracted`
- `human_confirmed`
- `imported_metric`
- `observed_other`
- `demo_seed`
- `starter_hypothesis`

These labels help the user judge trust. They do not automatically change confidence.

`observed_other` means a pattern, behavior, decision, or claim observed in another person, team, customer, product, or external actor. It is descriptive only: it does not change status, confidence, scope, prompt eligibility, or graph eligibility.

## Current Deterministic Loop

```text
entry
-> life domains
-> product/personal boundary
-> claim splitting boundary
-> evidence match or candidate axiom
-> visible evidence direction
-> visible provenance
-> candidate review queue
-> human confirm/reject/leave candidate
-> prompt eligibility gate
-> graph projection gate
-> RDF/Turtle export gate
-> SHACL shape check
-> SPARQL competency query templates
-> retirement readiness signal
-> human retire/keep confirmed
```

This is the stable boundary for future ontology work.
