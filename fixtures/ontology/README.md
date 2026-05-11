# Ontology RDF Fixtures

These Turtle files are canonical semantic-layer examples for the deterministic ontology loop. They are not random sample data.

Use them for:

- tests
- documentation
- NotebookLM sources
- future SHACL validation
- future SPARQL execution
- agent prompts
- manual inspection

## Fixtures

### `confirmed-personal.ttl`

Shows the smallest trusted semantic export:

```text
confirmed + personal -> exportable as trusted ontology fact
```

Use this fixture when testing RDF export, prompt eligibility, graph projection, and SHACL requirements for a single clean axiom.

### `mixed-trust-boundaries.ttl`

Shows multiple trust states side by side:

```text
confirmed personal -> governing material
confirmed demo -> reference material
candidate personal -> visible but not governing
```

Use this fixture to test that semantic queries and future tooling do not accidentally treat demo rows or candidates as personal truth.

### `contradiction-evidence.ttl`

Shows a confirmed axiom with both supporting and contradictory evidence.

```text
contradiction -> preserved
confidence -> not silently mutated
```

Use this fixture when testing CQ-009, evidence-direction display, contradiction queries, and future validation around disconfirming evidence.

### `provenance-sources.ttl`

Shows every normalized provenance source:

- `self_declared`
- `ai_proposed`
- `entry_extracted`
- `human_confirmed`
- `imported_metric`
- `demo_seed`
- `starter_hypothesis`

Use this fixture when testing CQ-010, source trust labels, and future provenance SPARQL queries.

## Trust Boundary Rules

These fixtures demonstrate the core deterministic boundary:

```text
AI may propose.
Evidence may disagree.
Provenance informs judgment.
Only humans confirm, reject, or retire.
Only confirmed personal axioms govern prompts, graph projection, and RDF truth.
```

Do not use these fixtures to justify automatic confidence or status mutation. They are examples for inspection and validation, not policy engines.
