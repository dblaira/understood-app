# Trustworthy Agent Process Log

## Purpose

This log captures process lessons while building the Understood ontology.

The strategic thesis is bigger than Adam's personal app:

```text
A trustworthy AI agent can be built through a repeatable process that a non-technical person can follow.
```

The process should let a person:

- upload digital life data they already own or can export from companies like Amazon, Apple, Google, health apps, and social platforms;
- let AI parse that data into small candidate ideas;
- answer fast plain-language questions;
- turn only reviewed answers into personal rules;
- require the agent to use those rules when interacting with the person;
- show why an answer used a rule, memory, or link.

This log exists to track whether the process is becoming marketable for other people, not only useful for Adam.

## Process Hypothesis

The product is not simply a journal or chatbot.

The product is a guided trust-building loop:

```text
personal data
  -> parsed observations
  -> plain-language review
  -> trusted personal rules
  -> AI answers constrained by those rules
  -> visible reasons
  -> user correction
```

The key market question:

```text
Can a non-technical person build a useful personal AI agent by reviewing small, understandable choices instead of designing an ontology manually?
```

## Standing Rule

Whenever ontology work reveals a step that may matter to this repeatable process, log it here.

Examples worth logging:

- a user confusion point;
- a safety failure;
- a wording change that makes the process clearer;
- a review step that should become part of onboarding;
- a rule for what AI may propose but not decide;
- a visual or contrast pattern that helps the user understand what changed;
- a failure that would break trust for a non-technical user.

## Logged Process Elements

### 2026-05-15 — Contrast Makes The Mechanism Visible

Problem:

LLM-only answers and ontology-guided answers can look similar. The user may not understand why the ontology matters if the final answer is the only thing shown.

Process lesson:

Show the same prompt in two lanes:

- LLM-only answer;
- LLM plus ontology/knowledge-graph answer;
- expandable trace showing what each system used.

Why it matters:

The user needs to pattern-match the process, not just read a definition.

Product implication:

The repeatable process needs a "same question, different path" view for onboarding and trust calibration.

### 2026-05-15 — Basic Triples Are Too Boring To Feel Valuable

Problem:

Simple ontology claims can feel obvious or uninteresting, even when they are structurally useful.

Process lesson:

Do not ask the user to admire basic triples. Use them as infrastructure, then surface:

- contradictions;
- missing links;
- surprising adjacencies;
- non-obvious relationships;
- places where a generic AI answer differs from a constrained answer.

Product implication:

The app should not market the ontology as "look at your triples." It should show what the structure helps the agent do differently.

### 2026-05-15 — Plain Language Is A Safety Feature

Problem:

Words like ontology, axiom, candidate, provenance, graph, semantic, confirmed, and govern confused the review flow.

Process lesson:

The user-facing process should use 5th-grade language:

- possible rule;
- saved rule;
- idea;
- keep;
- drop;
- skip;
- the app can use this;
- the app cannot use this yet.

Product implication:

Technical terms may exist internally, but review screens for non-technical users need plain-language labels and dropdowns.

### 2026-05-15 — "Idea" Is Not The Same As "Rule"

Problem:

The app converted "Create a template for the Adam Pattern" into a fake rule:

```text
When: Adam treats this as a reusable pattern: Create a template for the Adam Pattern
Then: future reasoning should consider this pattern only after human confirmation
```

This looked like a valid rule but was only a placeholder.

Process lesson:

The system must not let placeholder conversions look like trusted rules.

Rule:

If the app cannot rewrite an idea into a clean "When X happens, then Y usually follows" statement, it must label it:

```text
This is not a rule yet.
```

Product implication:

The process needs a separate state for "needs rewrite" before user approval. The user should never be asked to approve a placeholder as if it were a rule.

Build response:

- placeholder rules are now flagged;
- placeholder rules cannot be approved as trusted;
- already-approved placeholders are excluded from chat/search/export;
- cleanup action removes unsafe placeholder rules from use.

### 2026-05-15 — Trust Requires A Cleanup Path

Problem:

After discovering one bad approval, the user reasonably questioned whether previous answers were valid.

Process lesson:

Every review system needs a recovery path. The user must be able to say:

```text
I approved something by mistake. Undo or quarantine the unsafe class.
```

Product implication:

The app needs visible cleanup tools:

- remove unsafe rules;
- review saved rules;
- explain why a rule is unsafe;
- show what the agent is currently allowed to use.

### 2026-05-15 — Browser-Local Review State Can Confuse Deployment Testing

Problem:

The user answered review questions on one domain, then checked a Vercel preview URL and saw a different state.

Process lesson:

Browser-local review state is domain-specific. For a non-technical user, preview URLs can make the process appear broken.

Product implication:

Durable review state should move to the database before this process is market-ready. Until then, the UI must clearly say which domain stores the review choices.

## Open Process Questions

- What is the minimum review flow a non-technical user can complete without losing trust?
- How many possible rules should be shown per sitting before fatigue harms answer quality?
- What is the right threshold for "needs rewrite" versus "keep as note"?
- Should the app auto-suggest a better When/Then rewrite, or should that wait until the user asks?
- What proof screen shows that the agent is actually constrained by saved rules?
- What export format makes the user's owned self-model portable and understandable?

## Current Done Definition For The Process

The process is viable when a new user can:

- upload or connect real personal data;
- see simple ideas extracted from it;
- answer plain-language review questions;
- understand the difference between a note, an idea, and a rule;
- clean up mistakes;
- ask the agent real questions;
- see which saved rules shaped the answer;
- correct the system without needing technical knowledge.
