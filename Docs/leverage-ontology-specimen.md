# Leverage Ontology Specimen

## Purpose

This is a first-pass ontology specimen for testing whether Understood can find personal leverage points.

It is not the correct ontology. It is the smallest useful structure that can be tested in the app.

## Domain

Personal improvement through leverage awareness.

In plain terms:

```text
Find the small personal actions, conditions, beliefs, or decisions that create outsized improvement in Adam's life.
```

## Proof Target

Given a small set of personal notes or data, the system should identify one plausible leverage point, explain why it may matter, and produce a rule Adam can approve, reject, or rewrite.

The proof is successful only if the system can show:

- what pattern it noticed;
- what small input may create outsized results;
- what evidence supports the claim;
- what rule would constrain future AI answers;
- whether Adam has approved the rule.

## Core Definition

```text
Leverage = a small, repeatable input that produces a disproportionately large improvement in outcomes Adam cares about.
```

## Important Terms

| Term | Meaning |
| --- | --- |
| Leverage | Outsized improvement from a small input. |
| Leverage point | The specific input that appears to create outsized change. |
| Input | An action, condition, belief, environment, timing choice, or relationship pattern. |
| Outcome | A result Adam cares about. |
| Disproportionate effect | The outcome is much larger than the effort or change required. |
| Evidence | Personal data or notes that support a possible leverage point. |
| Possible rule | A draft claim that may guide future AI answers, but is not trusted yet. |
| Trusted rule | A human-approved rule the assistant may use. |
| Low-leverage action | An action that consumes effort without meaningfully improving outcomes. |
| False leverage | Something that feels important but does not produce useful change. |
| Compounding action | A small repeated input whose effect grows over time. |
| Bottleneck | A constraint that prevents many other improvements. |
| Keystone behavior | A behavior that improves multiple life areas at once. |

## Taxonomy

```text
Leverage
  Leverage Point
    Behavior
      Habit
      Routine
      Recovery action
      Work action
      Communication action
    Condition
      Sleep condition
      Environment condition
      Schedule condition
      Energy condition
      Social condition
    Belief
      Self-belief
      Work belief
      Relationship belief
      Capability belief
      Constraint belief
    Decision Rule
      Priority rule
      Boundary rule
      Timing rule
      Escalation rule
      Simplification rule
    Bottleneck
      Cognitive bottleneck
      Emotional bottleneck
      Environmental bottleneck
      Process bottleneck
      Health bottleneck

  Leverage Quality
    High leverage
    Medium leverage
    Low leverage
    False leverage
    Unknown leverage

  Evidence Type
    Repeated pattern
    Cross-domain effect
    Before-after change
    Absence effect
    User-declared importance
    Contradictory evidence

  Outcome
    Focus
    Energy
    Mood
    Follow-through
    Work quality
    Decision quality
    Relationship quality
    Health
    Self-trust
```

## Relationships

| Relationship | Meaning | Example |
| --- | --- | --- |
| `may_create_leverage_for` | A possible input may improve an outcome. | Sleep consistency may_create_leverage_for focus. |
| `supported_by` | A claim has evidence. | Sleep consistency supported_by three notes. |
| `contradicted_by` | Evidence weakens the claim. | Morning workouts contradicted_by repeated injury notes. |
| `affects_multiple_outcomes` | One input touches several outcomes. | Sleep affects energy, mood, and work quality. |
| `requires_condition` | A leverage point only works under certain conditions. | Deep work requires phone away. |
| `has_review_state` | A rule is unreviewed, trusted, rejected, or needs rewrite. | Sleep rule has_review_state trusted. |
| `derived_from` | A possible rule came from a source note or data item. | Rule derived_from belief dump line. |
| `constrains_answer` | A trusted rule may shape future assistant answers. | Checklist rule constrains_answer planning advice. |
| `is_bottleneck_for` | One constraint blocks multiple improvements. | Undefined process is_bottleneck_for building. |
| `is_low_leverage_when` | An action becomes low leverage in a condition. | Research is_low_leverage_when no test is defined. |

## Constraints

These rules protect the system from pretending it knows more than it knows.

1. A possible leverage point cannot constrain assistant answers.
2. A trusted rule must be explicitly approved by Adam.
3. Every trusted rule must have provenance.
4. A leverage point must name both the small input and the larger outcome.
5. A claim cannot be called high leverage unless it affects at least one outcome Adam cares about.
6. Cross-domain effects increase confidence, but do not create trust by themselves.
7. Repetition increases confidence, but does not create trust by itself.
8. User-declared importance counts as evidence, but does not prove leverage.
9. The system must show contradictory evidence when it exists.
10. The assistant must distinguish "this may be leverage" from "Adam has approved this as leverage."
11. A vague statement such as "be better" or "optimize life" is not a valid leverage rule.
12. A rule must be rewritten before approval if it lacks a clear input, outcome, or condition.

## Competency Questions

The ontology must be able to answer these questions.

1. What possible leverage points have been found?
2. Which possible leverage points are trusted?
3. What evidence supports each leverage point?
4. What evidence contradicts each leverage point?
5. Which small inputs affect the most outcomes?
6. Which outcomes are most often affected by leverage points?
7. Which actions look busy but low leverage?
8. Which bottleneck blocks the most improvement?
9. Which trusted rules may the assistant use right now?
10. Which rules need Adam's review before use?
11. Which rule influenced a specific assistant answer?
12. What is the smallest test that could confirm or weaken this leverage claim?

## Minimal Example Data

```text
Note 1:
When I do not know the steps, I keep researching and asking AI instead of building.

Note 2:
Once there is a full draft in front of me, I can spot what is wrong quickly.

Note 3:
I get frustrated when Codex or Claude skips the formal process and starts implementing.

Note 4:
I want the assistant to fill in the whole chain so I can analyze the result.
```

## Candidate Leverage Point

```text
Visible process draft
```

## Candidate Rule

```text
When Adam is building a complex system, produce the full ordered draft before asking him to analyze or decide.
```

## Why This May Be Leverage

Small input:

```text
The assistant produces a complete ordered draft.
```

Large outcome:

```text
Adam can use pattern recognition after the draft exists, instead of getting stuck trying to generate the process before analysis.
```

Evidence:

- Adam says his pattern recognition works after the process is done, not before.
- Adam says he can analyze and break down the process once there is something to inspect.
- Adam reports repeated failure when AI assistants skip formal steps.

Review state:

```text
possible rule
```

This rule cannot constrain assistant answers until Adam approves it.

## Expected App Behavior

Input:

```text
I want to build a trustworthy AI agent, but I get stuck because the assistant skips steps. My pattern recognition works after the process is done, not before.
```

System output:

```text
Possible leverage point:
Visible process draft

Possible rule:
When Adam is building a complex system, produce the full ordered draft before asking him to analyze or decide.

Why it may matter:
This is a small change in assistant behavior that may unlock Adam's strongest analysis mode.

Evidence:
- Adam says he recognizes problems after a process exists.
- Adam says AI assistants fail by skipping steps.
- Adam asks the assistant to fill in the rest so he can test the result.

Review:
[Trust this rule] [Needs rewrite] [Reject]
```

## Generic LLM Answer vs Ontology-Constrained Answer

User question:

```text
Help me figure out how to build this ontology.
```

Generic answer:

```text
Sure. Ontology building usually involves defining your domain, creating a taxonomy, adding relationships, and testing it.
```

Ontology-constrained answer after the rule is trusted:

```text
I will produce the full ordered draft first, because your trusted rule says that when you are building a complex system, I should give you the complete process before asking you to analyze it.

Draft:
1. Scope
2. Terms
3. Taxonomy
4. Relationships
5. Constraints
6. Competency questions
7. Example data
8. Expected answers
9. Test
10. Failure report
```

Trace:

```text
Used trusted rule:
When Adam is building a complex system, produce the full ordered draft before asking him to analyze or decide.
```

## Smallest Proof Test

Build one screen or route that compares two answers:

1. A generic LLM answer.
2. An answer constrained by one trusted leverage rule.

The screen must show:

- the user question;
- the trusted rule used;
- the generic answer;
- the constrained answer;
- the difference;
- whether the constrained answer was more useful.

## Test Dataset

```json
{
  "notes": [
    {
      "id": "note-1",
      "text": "When I do not know the steps, I keep researching and asking AI instead of building."
    },
    {
      "id": "note-2",
      "text": "Once there is a full draft in front of me, I can spot what is wrong quickly."
    },
    {
      "id": "note-3",
      "text": "I get frustrated when Codex or Claude skips the formal process and starts implementing."
    }
  ],
  "expectedPossibleLeveragePoint": {
    "name": "Visible process draft",
    "input": "Produce the full ordered draft first.",
    "outcome": "Adam can analyze the process and find problems faster.",
    "reviewState": "possible_rule"
  }
}
```

## Failure Modes

| Failure | Meaning |
| --- | --- |
| The system suggests a vague rule. | The taxonomy is not forcing clear input and outcome. |
| The system calls the rule trusted before approval. | Review-state constraints failed. |
| The system cannot show evidence. | Provenance failed. |
| The system produces generic advice anyway. | The trusted rule did not constrain output. |
| The constrained answer is not better. | The leverage point may be false or weak. |
| The test cannot explain the difference. | The proof screen is not doing its job. |

## Implementation Plan

1. Add a leverage-specific rule type or metadata flag.
2. Add a function that turns notes into possible leverage points.
3. Require each possible leverage point to include input, outcome, evidence, and review state.
4. Add tests that reject vague leverage rules.
5. Add a proof screen comparing generic and trusted-rule answers.
6. Log which trusted rule affected the constrained answer.
7. Let Adam mark the constrained answer as more useful, less useful, or unclear.

## Done Definition

This specimen is useful only when the app can run the smallest proof test.

Done means:

- at least one possible leverage point can be generated from notes;
- Adam can approve it as trusted;
- the trusted rule changes a later answer;
- the app shows which rule was used;
- Adam can judge whether the answer improved.

