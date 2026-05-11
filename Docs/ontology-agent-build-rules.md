# Ontology Agent Build Rules

Use these rules before changing ontology code, ontology docs, RDF fixtures, SHACL shapes, or SPARQL queries.

## Required Build Protocol

1. **Identify the competency question**
   - Every ontology change must support at least one competency question.
   - If no competency question applies, update `Docs/competency-questions.md` before changing behavior.

2. **Update or add tests first**
   - Tests must describe the ontology behavior or boundary being changed.
   - Prefer focused tests in `tests/ontology-foundation.test.ts`.

3. **Preserve human review boundaries**
   - AI may propose candidates, evidence, contradictions, provenance labels, and retirement signals.
   - Humans decide confirmation, rejection, retirement, deletion, and governance.

4. **Never auto-confirm, auto-reject, or auto-retire**
   - Candidate axioms stay `candidate` until a human review action changes them.
   - Confirmed axioms stay `confirmed` until a human retires them.
   - Rejected and retired material remains visible history.

5. **Never mutate confidence from source labels alone**
   - Provenance informs judgment.
   - Provenance must not secretly change confidence.
   - Confidence changes require explicit review policy or human action.

6. **Keep semantic layers aligned**
   - If RDF terms change, update SHACL shapes and SPARQL query templates.
   - If app helper behavior changes, update fixtures and docs when the semantic contract changes.
   - Do not let RDF, SHACL, or SPARQL become a second source of truth.

## Non-Negotiable Boundary

```text
AI proposes.
Evidence accumulates.
Signals become visible.
Humans decide.
Only confirmed personal axioms govern prompts, graph projection, and RDF truth.
```

## Files To Check

- `Docs/competency-questions.md`
- `Docs/deterministic-ontology-loop.md`
- `fixtures/ontology/`
- `lib/ontology/`
- `tests/ontology-foundation.test.ts`

## Commit Hygiene

Keep commits aligned with one ontology step:

- one competency question,
- one semantic layer,
- one review boundary,
- or one documentation/fixture checkpoint.

Do not bundle unrelated UI, schema, semantic export, and docs changes unless the user explicitly asks for a larger checkpoint.
