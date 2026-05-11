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
| Semantic export | RDF/Turtle projection for future SHACL/SPARQL checks | `lib/ontology/rdf-export.ts` |

## Prompt And Graph Gates

An axiom can constrain the assistant or enter graph projection only when it is:

```text
status = confirmed
scope = personal
confidence >= configured confidence gate
antecedent and consequent are present
```

Everything else is review material, history, reference material, or training data.

## Semantic Export Layer

The RDF layer is a downstream export/check layer, not a replacement for the product database.

```text
confirmed personal axioms
-> RDF/Turtle triples
-> future SHACL validation
-> future SPARQL competency checks
```

The export must use the same governance boundary as prompt and graph projection. Candidate, rejected, retired, demo, and starter material should not become RDF truth.

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
- `demo_seed`
- `starter_hypothesis`

These labels help the user judge trust. They do not automatically change confidence.

## Current Deterministic Loop

```text
entry
-> life domains
-> evidence match or candidate axiom
-> visible evidence direction
-> visible provenance
-> candidate review queue
-> human confirm/reject/leave candidate
-> prompt eligibility gate
-> graph projection gate
-> RDF/Turtle export gate
-> retirement readiness signal
-> human retire/keep confirmed
```

This is the stable boundary for future ontology work.
