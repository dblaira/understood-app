# Ontology Build Map

## Purpose

This is the standing orientation document for the ontology build.

Its job is to answer:

- Where are we?
- What has been built?
- What is only a prototype?
- What is not built yet?
- What must not happen accidentally?
- What is the next decision, not just the next task?

No new ontology work should begin unless this map is current enough to explain the work.

## One-Sentence Build Goal

Build a trusted memory system for AI assistance that can use Adam's personal meaning while staying disciplined by public/domain ontology standards.

## Core Architecture

```text
Personal memory
  -> entries
  -> connections
  -> candidate axioms
  -> human review
  -> confirmed personal rules

Public discipline
  -> BFO
  -> domain ontologies
  -> public/reference concepts
  -> safety and meaning constraints

AI assistant
  -> reads trusted context
  -> uses Connections as helpful principles
  -> uses confirmed axioms as stronger rules
  -> owns neither layer
```

## Current Build Stage

| Layer | Status | Meaning |
| --- | --- | --- |
| Personal ontology foundation | Built | Entries, axioms, evidence, provenance, review gates exist. |
| Calibration workflow | Built | Real entries and Connections have been reviewed in docs. |
| Split-claim review UI | Built as local triage | Useful, but not durable. |
| Connections ontology intake | Built as live local triage + read-only context | Live Connections load into review with calibration fallback; strong personal Connections can guide AI as principles without becoming confirmed axioms. |
| Semantic web layer | Scaffolded | RDF, SHACL, SPARQL exist as export/check/template layer. |
| Public ontology/BFO integration | Not built | Conceptual direction exists, but no domain ontology import/mapping yet. |
| Durable ontology pipeline | Partly built | Axioms can be reviewed, but split-claim and Connection intake decisions are not persisted. |

## What Is Built

### 1. Competency Questions

Source:

```text
Docs/competency-questions.md
```

Role:

```text
Defines what the ontology must be able to answer.
```

Important CQs already implemented:

| CQ | Meaning | Status |
| --- | --- | --- |
| CQ-005 | Which axioms enter assistant prompts? | Built |
| CQ-006 | Which axioms become graph edges? | Built |
| CQ-009 | Which axioms have contradiction evidence? | Built |
| CQ-010 | What source/provenance does a claim carry? | Built |
| CQ-016 | Is this personal, product/system, both, or unclear? | Built |
| CQ-017 | Does this item contain multiple claims that need splitting? | Built |

### 2. Deterministic Ontology Loop

Source:

```text
Docs/deterministic-ontology-loop.md
```

Current loop:

```text
entry
-> product/personal boundary
-> claim splitting
-> domain classification
-> evidence match or candidate axiom
-> provenance / contradiction / retirement signals
-> human review
-> confirmed personal only
-> prompt / graph / RDF gates
```

### 3. Review Safety Rules

Source:

```text
Docs/ontology-agent-build-rules.md
```

Non-negotiables:

```text
No auto-confirm.
No auto-reject.
No auto-retire.
No confidence mutation from source labels alone.
No candidate or demo material entering prompt/graph/RDF gates as trusted truth.
```

### 4. Calibration Docs

Sources:

```text
Docs/ontology-calibration-session-001.md
Docs/ontology-calibration-session-001-followup.md
Docs/ontology-connections-calibration-001.md
Docs/ontology-connections-calibration-001-summary.md
```

What they proved:

| Finding | Consequence |
| --- | --- |
| Product/system notes can pollute personal ontology. | Add product-vs-personal boundary. |
| Long entries contain multiple claims. | Add claim splitting. |
| Tiny fragments create noise. | Add low-signal triage. |
| Connections are compressed beliefs/principles. | Treat Connections as first-class ontology intake candidates. |
| Connections should not all become axioms. | Use them as read-only principles first. |

### 5. Product UI Built

| UI Surface | Status | Writes to DB? |
| --- | --- | --- |
| Candidate review queue | Built | Yes, for axiom status review |
| Split-claim review | Built as local triage | No |
| Connections ontology intake | Built as live local triage with seed fallback | No |
| Connections as read-only AI context | Built | No new DB write |

### 6. Semantic Web Scaffold

| File | Role | Status |
| --- | --- | --- |
| `lib/ontology/rdf-export.ts` | Exports trusted axioms to Turtle | Built |
| `lib/ontology/shacl-shapes.ts` | Defines validation shapes | Built |
| `lib/ontology/sparql-queries.ts` | Defines competency query templates | Built |
| `fixtures/ontology/` | Canonical Turtle examples | Built |

## What Is Not Built Yet

| Missing Piece | Why It Matters | Current Decision |
| --- | --- | --- |
| Durable split-claim decisions | Local triage disappears or stays browser-local. | Wait until workflow is understood. |
| Durable Connections ontology decisions | Connection review is local/browser-only. | Wait until intake surface proves useful. |
| Durable evidence links for Connections | Possible evidence is shown read-only, but not linked. | Not built. |
| Product ontology lane | Product/system principles need somewhere to live. | Not built. |
| Public ontology/BFO mapping | Needed for larger trusted architecture. | Conceptual only. |
| Live SHACL/SPARQL execution | Semantic files exist, but are not running as checks. | Not built. |
| Assistant explanation UX | Search assistant receives confirmed axioms and read-only Connections with separate labels, but does not yet show users which ones it used. | Partly built. |

## Current Source of Truth

| Thing | Current Authority |
| --- | --- |
| Confirmed personal axioms | `ontology_axioms` rows with `status=confirmed`, `scope=personal` |
| Candidate axioms | `ontology_axioms` rows with `status=candidate`, `scope=personal` |
| Connections principles | Live `entry_type=connection` rows in `/ontology`, with calibration-backed seed fallback and read-only evidence suggestions in `lib/ontology/connections-intake.ts` |
| Product/system principles | Calibration docs only; no product ontology lane yet |
| Public/domain ontology concepts | Not yet implemented |
| BFO alignment | Conceptual architecture only |

## Trust Boundaries

### Strong Trust

```text
confirmed personal axiom
```

Can enter:

```text
assistant prompt
knowledge graph projection
RDF export
SPARQL competency query layer
```

### Medium Context

```text
user-authored Connection
```

Can enter:

```text
AI prompt as helpful operating principle
```

Cannot enter:

```text
confirmed axiom set
graph projection
RDF trusted export
confidence mutation
automatic status changes
```

### Weak / Review Needed

```text
candidate axiom
split claim
AI-proposed pattern
product/system principle
```

Needs human review or a separate lane.

## Mental Model

```text
Connections = compressed meaning
Ontology axioms = reviewed trusted rules
Public ontologies = external discipline
BFO = upper skeleton
AI = constrained interpreter
```

## Build Cycle

The build cycle should now be:

```text
1. Understand current map.
2. Use real data.
3. Observe friction.
4. Name the decision.
5. Build the smallest affordance.
6. Verify guardrails.
7. Update this map.
```

Not:

```text
1. Add next feature.
2. Add next feature.
3. Add next feature.
```

## Current Branch State

As of this map:

```text
branch: fab-connections-selector
latest committed ontology work: Add connections as read-only ontology context
known untracked file: Docs/personal-public-ontology-architecture.html
```

## Immediate Decision Point

The next decision is not "what feature next?"

The next decision is:

```text
Do Connections now work well enough as read-only AI memory principles,
or do they need evidence links before they should influence AI behavior?
```

Possible answers:

| Answer | Next Move |
| --- | --- |
| They work well enough as principles. | Test AI outputs with Connections context. |
| They need evidence first. | Build evidence search/linking for Connections. |
| They mix personal/product too much. | Build a product ontology lane. |
| The whole picture is still unclear. | Stop building and update this map. |
