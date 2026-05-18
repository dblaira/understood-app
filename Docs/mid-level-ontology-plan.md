# Mid-Level Ontology Plan

## Purpose

Understood has a working personal ontology loop, a BFO upper scaffold, public/domain references, RDF export, SHACL shape text, SPARQL templates, and assistant guardrails. The missing layer is a small mid-level ontology profile that names reusable cross-domain categories without importing a full external ontology suite.

The rule for this layer is strict:

```text
No mid-level category ships unless it prevents a named AI failure mode.
```

## Source Strategy

Use Common Core Ontologies as the primary BFO-aligned mid-level backbone. Use OBO Relation Ontology only where relation semantics are clearer than CCO alone. Keep Information Artifact Ontology as a future supplement if the Connections layer needs sharper distinctions between claims, documents, annotations, and evidence artifacts.

Do not bulk-import external ontologies into the product graph. The implementation pattern is curated alignment:

- selected source IRIs,
- small local profiles,
- relation allowlists,
- SHACL and semantic validation,
- prompt guardrail text,
- human review gates.

## Ship-Now Profiles

| Profile | Source anchor | AI failure mode prevented | Minimum local terms | Enforcement |
| --- | --- | --- | --- | --- |
| Agent | CCO Agent Ontology | Assistant conflates Adam, mentioned people, organizations, and the AI/system. | Agent, Person, Organization, Role, agent in | Prompt guardrails and future review labels |
| Process/Event | BFO Process + CCO Event Ontology | One-time milestone becomes recurring pattern, or recurring pattern becomes isolated event. | Process, Act, Planned Act, Process Boundary | CQ-018 plus future recurrence CQ |
| Information Entity | CCO Information Entity Ontology | Claim, evidence, and storage artifact collapse into one thing. | Information Content Entity, Descriptive ICE, is about, describes | Provenance and Connections review boundaries |
| Time | CCO Time Ontology | "Lately," "before," "after," or "every morning" cannot be anchored or falsified. | Temporal Instant, Temporal Interval, interval before, interval during, interval overlaps, interval contains | Evidence matching and future temporal validation |
| Guardrail Relations | CCO Extended Relation Ontology + RO causal relations | Assistant confuses intention, outcome, causation, prevention, support, prediction, and correlation. | supports, predicts, correlates with, causes, prevents, intended to achieve, has outcome | Relation policy allowlist, SHACL, semantic validation, prompt contract |

## Deferred Profiles

| Deferred profile | Add only when this failure appears |
| --- | --- |
| Quality | Assistant asserts skill, mood, intensity, or quality levels without source evidence. |
| Units of Measure | Assistant compares incompatible quantities or drops units. |
| Artifact | Tool, device, or storage-medium context changes the recommendation. |
| Facility | Place type matters, such as gym, office, home, clinic, or venue. |
| Social/Organization | Network reasoning exceeds the small Agent profile. |
| Geospatial | Location reasoning creates wrong or unsafe recommendations. |
| Currency | Monetary values and price comparisons need formal unit handling. |

## First Implementation Slice

Start with Guardrail Relations because existing personal axioms already become graph edges, RDF facts, prompt context, and semantic exports. Without relation semantics, the graph can pass syntax checks while still saying the wrong kind of thing.

The first slice must:

1. Add CQ-018 for relation semantics.
2. Add curated mid-level public references.
3. Add a relation policy allowlist.
4. Export relation policy metadata in RDF.
5. Add SHACL `sh:in` constraints for allowed relationship types.
6. Add semantic validation for unknown relationship strings.
7. Preserve existing human review boundaries.

## Non-Goals

- No bulk CCO import.
- No automatic confirmation, rejection, or retirement.
- No automatic confidence mutation from relation type alone.
- No claim that CCO or RO overrides confirmed personal axioms.
- No inference that `intended_to_achieve` means the outcome happened.
