# Competency Questions for the Understood Ontology

## Purpose

Competency questions are the plain-English questions the ontology must be able to answer. They act as requirements for the ontology, knowledge graph, assistant context, and validation tests.

For Understood, competency questions protect the product from becoming a loose note-taking system. They define what the personal ontology is actually for:

- Classifying lived experience into life domains.
- Turning repeated patterns into candidate axioms.
- Attaching evidence to those axioms.
- Reviewing axioms into confirmed, rejected, or retired states.
- Projecting trusted axioms into a deterministic knowledge graph.
- Giving the assistant only reviewed personal rules that should govern reasoning.

## Current Ontology Boundary

The current V1 ontology works with these primary objects:

- `Entry`: a user-captured record of what happened.
- `LifeDomain`: one of the 13 closed domains.
- `OntologyAxiom`: a personal or global if-then rule.
- `AxiomStatus`: `candidate`, `confirmed`, `rejected`, or `retired`.
- `AxiomScope`: `personal`, `starter_hypothesis`, or `demo`.
- `RelationshipType`: `supports`, `predicts`, `conflicts_with`, `follows`, `amplifies`, `inhibits`, or `correlates_with`.
- `Evidence`: entries attached to an axiom as support or contradiction.
- `Confidence`: numeric strength from `0` to `1`.
- `Provenance`: source and review metadata about where a claim came from.
- `KnowledgeGraphProjection`: deterministic nodes and edges derived from confirmed personal axioms.

Anything beyond this boundary is future work unless a competency question makes it necessary.

## CQ-001: Entry Domain Classification

**Question:** Which life domains are clearly present in this entry?

**Why it matters:** Every downstream ontology move depends on correctly identifying the domains present in a record.

**Required data:**

- `entries.content`
- `entries.life_domains`
- Closed `LifeDomain` vocabulary

**Expected behavior:**

- Return 1-3 domains when the entry clearly supports them.
- Do not force a domain when the entry is ambiguous.
- Use only the closed 13-domain vocabulary.

**Acceptance check:**

Given an entry about poor sleep causing irritability at work, the ontology can return `Sleep`, `Affect`, and `Work`.

## CQ-002: Candidate Axiom Discovery

**Question:** Does this entry suggest a reusable if-then pattern that is not already represented?

**Why it matters:** This is how raw records become ontology candidates instead of staying isolated notes.

**Required data:**

- Entry content
- Existing ontology axioms
- Life domains
- Relationship types

**Expected behavior:**

- Identify plausible repeatable patterns.
- Prefer specific, testable language.
- Create new pattern claims as `candidate`, not `confirmed`.

**Acceptance check:**

Given several entries where low sleep precedes low patience, the ontology can propose: `If sleep quality is low, then work patience is lower.`

## CQ-003: Existing Axiom Evidence Match

**Question:** Does this entry support, weaken, or contradict an existing axiom?

**Why it matters:** Axioms mature by collecting evidence, not by sounding plausible once.

**Required data:**

- Entry content
- Existing axiom antecedent and consequent
- `evidence_entry_ids`
- `evidence_count`
- `relationship_type`
- `provenance`

**Expected behavior:**

- Attach supporting evidence when the entry matches the pattern.
- Flag contradiction when the entry weakens the pattern.
- Avoid counting unrelated entries as evidence.

**Acceptance check:**

Given an axiom `If exercise happens before a difficult work block, then affect improves`, an entry describing exactly that sequence can be attached as evidence.

## CQ-004: Axiom Review Readiness

**Question:** Is this candidate axiom ready to be confirmed, rejected, or left as a candidate?

**Why it matters:** The assistant should not use unreviewed claims as governing rules.

**Required data:**

- `status`
- `confidence`
- `evidence_count`
- Review policy
- Evidence direction
- Provenance

**Expected behavior:**

- Confirm only when evidence and confidence are sufficient.
- Reject when the pattern is false, vague, misleading, or not useful.
- Leave as candidate when evidence is insufficient or mixed.

**Acceptance check:**

An axiom with three aligned evidence entries and confidence >= `0.50` can be considered review-ready for confirmation, subject to human approval.

## CQ-005: Assistant Prompt Eligibility

**Question:** Which axioms should be injected into the assistant's system prompt?

**Why it matters:** This is the boundary between raw ontology material and active agent guidance.

**Required data:**

- `status`
- `scope`
- `confidence`
- `antecedent`
- `consequent`

**Expected behavior:**

- Include confirmed personal axioms above the configured confidence gate.
- Exclude demo axioms.
- Exclude starter hypotheses.
- Exclude candidates, rejected axioms, and retired axioms.
- Exclude incomplete or malformed metadata.

**Acceptance check:**

A confirmed personal axiom at confidence `0.67` is injected. A confirmed demo axiom at confidence `0.95` is not injected.

## CQ-006: Knowledge Graph Projection

**Question:** Which ontology axioms become deterministic graph nodes and edges?

**Why it matters:** The knowledge graph should represent trusted reviewed knowledge, not every possible model-generated claim.

**Required data:**

- Confirmed personal ontology axioms
- `antecedent`
- `consequent`
- `relationship_type`
- `confidence`
- `evidence_entry_ids`
- `evidence_count`
- `provenance`

**Expected behavior:**

- Project only confirmed personal axioms.
- Convert antecedents and consequents into concept nodes.
- Convert the axiom into a typed edge.
- Preserve confidence, evidence, and provenance on the edge.

**Acceptance check:**

`If High Learning, then Higher Affect` becomes a `concept:high-learning -> predicts -> concept:higher-affect` edge only if the axiom is confirmed and personal.

## CQ-007: Weekly Ontology Summary

**Question:** Which life domains were active for the user this week?

**Why it matters:** The Weekly debrief needs a reliable summary of where the user's attention and experience concentrated.

**Required data:**

- Entries
- Entry timestamps
- `life_domains`
- `weekly_ontology_summary`

**Expected behavior:**

- Count entries per week.
- Return distinct active life domains.
- Respect user row-level security.

**Acceptance check:**

If a user has five entries this week across `Learning`, `Work`, and `Sleep`, the summary returns those three active domains and the correct entry count.

## CQ-008: Selected Domain Focus

**Question:** Which ontology material belongs to the user's selected focus domains?

**Why it matters:** The ontology view should help the user see what matters this season without hiding the whole ontology permanently.

**Required data:**

- `profiles.selected_domains`
- Entries
- Axioms
- Life domains

**Expected behavior:**

- Filter default ontology view to selected domains.
- Allow toggling to all domains.
- Never delete or mutate data simply because it is outside the current focus.

**Acceptance check:**

If the user's selected domains are `Learning`, `Work`, `Sleep`, and `Affect`, the default ontology view prioritizes those domains.

## CQ-009: Contradiction Detection

**Question:** Which entries or axioms contradict an existing personal rule?

**Why it matters:** A deterministic ontology must preserve disconfirming evidence instead of smoothing it away.

**Required data:**

- Existing axioms
- Evidence entries
- Relationship types
- Provenance
- Confidence

**Expected behavior:**

- Mark contradiction as contradiction, not support.
- Lower confidence only through explicit review policy.
- Preserve the contradicting source.

**Acceptance check:**

If an axiom says `If evening caffeine, then sleep quality decreases`, but an entry says evening caffeine had no effect, the entry can be flagged as contradictory evidence.

## CQ-010: Provenance and Source Trust

**Question:** Where did this axiom or fact come from, and how should that source affect trust?

**Why it matters:** The user must be able to distinguish self-declared beliefs, AI inferences, imported measurements, and reviewed conclusions.

**Required data:**

- `sources`
- `provenance`
- `created_at`
- Review timestamps
- Scope
- Status

**Expected behavior:**

- Store source metadata for claims.
- Distinguish self-declared facts from AI-generated candidates.
- Preserve timestamps for review transitions.

**Acceptance check:**

An onboarding axiom can show `sources = ['self_declared']`, while a model-generated candidate can show provenance identifying the extraction process. A pattern observed in another person, team, customer, product, or external actor can use `observed_other` without changing confidence, status, or scope.

## CQ-011: Axiom Retirement

**Question:** Which confirmed axioms used to be useful but no longer describe current reality?

**Why it matters:** Personal ontology needs change over time without treating every expired truth as a mistake.

**Required data:**

- Axiom status
- Confidence
- Evidence recency
- `retired_at`
- `confirmed_at`
- Review policy

**Expected behavior:**

- Retire outdated confirmed axioms.
- Preserve confirmation history.
- Do not move rejected axioms directly into confirmed state.

**Acceptance check:**

A confirmed axiom can move to `retired` while preserving its original `confirmed_at` timestamp.

## CQ-012: Safe AI Ontology Editing

**Question:** What ontology changes may an AI agent propose, and what must remain human-reviewed?

**Why it matters:** The AI agent is a proposer, not the authority.

**Required data:**

- Proposed change
- Affected competency question
- Example pass cases
- Example fail cases
- Provenance
- Human review status

**Expected behavior:**

- AI may propose candidate classes, relationships, axioms, queries, and validation rules.
- AI may not silently confirm, reject, retire, or delete trusted ontology material.
- Every proposed ontology change should state which competency question it supports.

**Acceptance check:**

An AI-generated axiom is stored as `candidate` with provenance and is not injected into assistant prompts until human-reviewed and confirmed.

## CQ-013: User Export and Explanation

**Question:** Can the user export and understand their ontology state?

**Why it matters:** The ontology belongs to the user. It should not become opaque platform memory.

**Required data:**

- Entries
- Axioms
- Inferred insights
- Evidence links
- Provenance
- Review state

**Expected behavior:**

- Export all user-owned ontology data.
- Preserve enough context to understand why an axiom exists.
- Include statuses, confidence, sources, and evidence counts.

**Acceptance check:**

An exported ontology axiom includes antecedent, consequent, status, confidence, relationship type, evidence count, evidence ids, sources, and provenance.

## CQ-014: Mind Map Intake

**Question:** Can a visual mind map or outline be converted into ontology candidates without losing the user's structure?

**Why it matters:** Mind mapping is a preferred interface for expressing complex ideas and should be treated as a draft knowledge graph.

**Required data:**

- Mind map image or outline
- Central thesis
- Branch labels
- Relationships between branches
- User confirmation

**Expected behavior:**

- Parse the central thesis and major branches.
- Identify implied entities, relationships, open questions, and dependencies.
- Ask for confirmation before creating ontology candidates.
- Preserve uncertainty.

**Acceptance check:**

Given a mind map about AI agents and deterministic ontology, the system can produce candidate competency questions, entities, relationships, and RDF-style triples before making any durable changes.

## CQ-015: Deterministic Layer Boundary

**Question:** Which claims are trusted enough to constrain future AI behavior?

**Why it matters:** The system must separate notes, candidates, inferences, and governing rules.

**Required data:**

- Status
- Scope
- Confidence
- Evidence
- Provenance
- Review timestamps

**Expected behavior:**

- Only confirmed personal axioms above the confidence gate constrain the assistant.
- Candidate and inferred claims remain visible but non-governing.
- Rejected and retired claims are preserved for history but do not govern behavior.

**Acceptance check:**

When the assistant answers a user, it is constrained by confirmed personal axioms but not by demo axioms, candidate axioms, or unsupported inferred insights.

## CQ-016: Product vs Personal Ontology Boundary

**Question:** Is this item about the user's personal patterns, the product/system, or both?

**Why it matters:** Calibration showed that product notes and project work can be over-converted into personal axioms. The ontology needs to know what kind of world a record is about before it creates candidate axioms.

**Required data:**

- Entry content
- Entry type
- Life domains
- Candidate axiom proposal
- Existing ontology scope

**Expected behavior:**

- `personal_pattern` -> eligible for personal candidate axiom.
- `product_system` -> remain note or become product ontology candidate.
- `both` -> split into separate personal and product claims.
- `unclear` -> keep as note until the boundary is clear.

**Acceptance check:**

An item about Adam's priorities improving productivity can become a personal candidate. An item about fixing the Understood autosave bug remains a note or product candidate. An item about Understood capturing context and Adam feeling more confident should be split into separate claims.

## CQ-017: Claim Splitting Before Axiom Review

**Question:** Does this item contain multiple distinct claims that should be split before ontology review?

**Why it matters:** Bundled entries can poison the ontology if they are turned into one muddy axiom. Before asking "what axiom is this?", the system should ask whether the record is even one claim.

**Required data:**

- Source entry id
- Original raw text
- Candidate claim text
- Suggested domains
- Provenance

**Expected behavior:**

- `single_claim` -> continue normal review.
- `multiple_claims` -> split into separate candidate claims before evidence or axiom review.
- `unclear` -> keep as note until human review.

Each split candidate should preserve:

- source entry id
- original raw text
- claim text
- suggested domains
- `provenance = entry_extracted`
- `requiresHumanReview = true`
- `status = candidate`

**Acceptance check:**

A focused entry about priorities improving productivity remains one claim. A bundled business note about pricing, patenting, and debugging splits into separate candidate claims. A vague reflective note stays a note until human review.

## CQ-018: Relation Semantics for Guardrails

**Question:** What kind of relationship connects an antecedent and consequent before that relationship is allowed to constrain assistant behavior?

**Why it matters:** The assistant must not treat correlation as causation, intention as achieved outcome, support as proof, or prevention as a universal guarantee. Mid-level relation semantics make personal axioms actionable guardrails instead of loose edge labels.

**Required data:**

- Axiom relationship type
- Mid-level relation policy
- Evidence direction and count
- Provenance
- Human review status
- Source ontology reference

**Expected behavior:**

- `correlates_with` means co-occurrence only and must not be narrated as causal.
- `causes` requires stronger evidence than `supports` or `predicts`.
- `prevents` requires evidence about the outcome being avoided, not merely disliked.
- `intended_to_achieve` records purpose or aim and must not imply the intended outcome happened.
- Unknown relationship types are visible as semantic validation issues before they govern prompts, graph projection, or RDF truth.

**Acceptance check:**

An axiom saying cold exposure `correlates_with` sharper writing can be summarized as an observed association. It cannot be rewritten as cold exposure `causes` sharper writing unless the relationship is explicitly reviewed and represented as causal.

## First Build Priority

Start with these five competency questions because they map directly to the current V1 product and existing tests:

1. CQ-001: Entry Domain Classification
2. CQ-003: Existing Axiom Evidence Match
3. CQ-004: Axiom Review Readiness
4. CQ-005: Assistant Prompt Eligibility
5. CQ-006: Knowledge Graph Projection

These define the minimum viable deterministic loop:

```text
entry -> domains -> evidence/candidate axiom -> review -> prompt/graph projection
```

## Agent Instruction

When an AI agent proposes an ontology change, require this response shape:

```text
Proposed change:

Competency question supported:

Reason:

New or affected entities:

New or affected relationships:

Example that should pass:

Example that should fail:

Provenance:

Human review needed:
```

No ontology change is complete unless it supports at least one competency question.
