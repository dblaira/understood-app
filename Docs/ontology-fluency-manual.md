# Ontology Fluency Manual

## Goal

Build behavioral proof that you can access, analyze, and update your personal ontology without needing live explanation. The proof standard is 50 counted ontology sessions.

Training sessions teach the skill. Counted sessions prove the skill.

## What Counts As One Session

One ontology session is a focused review loop:

1. Access the ontology.
2. Choose one or more information items.
3. Decide where the information belongs.
4. Decide the ontology move.
5. Update or review the ontology state.
6. Record whether the session counted.

A session can process one item or many items. It still counts once.

## Counted Session Standard

A session counts only if you finish without live explanation.

Allowed:

- Using the ontology page.
- Reading your own fixed checklist before the session starts.
- Delegating repetitive maintenance, extraction, summarization, or batch update work.
- Asking AI after the session to review what made the session difficult.

Not allowed during a counted session:

- Asking AI what a term means.
- Asking AI why a measurement matters.
- Asking AI which status or move applies.
- Clicking hidden definitions to understand the workflow.
- Searching files for instructions on how to access, analyze, or update the ontology.

If any not-allowed behavior happens, mark the session as training only. It is useful practice, but it does not count toward 50.

## Core Vocabulary

### Life Domain

A life domain is the main bucket for an information item. Use the closed set already defined in the app:

- Exercise: movement, training, effort, recovery.
- Sleep: sleep timing, sleep quality, rest, fatigue.
- Nutrition: food, hydration, supplements, cravings.
- Ambition: goals, standards, future orientation, striving.
- Health: symptoms, care, injury, illness, body constraints.
- Work: output, obligations, decisions, collaboration.
- Social: relationships, conversations, belonging, conflict.
- Learning: study, research, practice, synthesis.
- Purchase: spending, tools, subscriptions, buying decisions.
- Belief: principles, identity claims, worldview, meaning.
- Affect: mood, emotion, stress, energy, motivation.
- Insight: realizations, patterns, conclusions, mental updates.
- Entertainment: play, leisure, media, novelty, fun.

Rule: choose the domain clearly supported by the information. If no domain is clearly supported, do not force one.

### Axiom

An axiom is a personal if-then rule.

Format:

```text
If [antecedent], then [consequent].
```

Examples:

```text
If sleep quality is low, then work patience is lower.
If learning feels self-directed, then motivation increases.
If exercise happens before a difficult work block, then affect improves.
```

An axiom is not a mood, note, or one-off event. It is a pattern claim that can collect evidence over time.

### Status

Use four statuses:

- Candidate: plausible, but not trusted yet.
- Confirmed: trusted enough to guide future reasoning.
- Rejected: reviewed and judged false, misleading, or not useful.
- Retired: was useful before, but should no longer govern current reasoning.

Default rule: new pattern claims start as candidate.

### Relationship Type

Use relationship types to describe how the antecedent and consequent connect:

- supports: makes the consequent more likely or stronger.
- predicts: gives advance signal about the consequent.
- conflicts_with: contradicts or weakens the consequent.
- follows: naturally comes after in sequence.
- amplifies: makes an existing effect stronger.
- inhibits: makes an existing effect weaker or harder.
- correlates_with: appears together without a clear causal claim.

When unsure, choose predicts for if-then rules and correlates_with for loose associations.

### Evidence Count

Evidence count means how many information items support the axiom.

Use evidence count as a maturity signal, not as proof by itself. Three aligned examples may justify confirmation when the pattern is clear and useful. Many weak examples should still stay candidate if the meaning is muddy.

### Confidence

Confidence means how strongly the system should treat the axiom as useful.

Use simple bands:

- 0.00 to 0.24: weak or likely wrong.
- 0.25 to 0.49: possible but not reliable.
- 0.50 to 0.74: useful working hypothesis.
- 0.75 to 1.00: strong personal rule.

The app review policy currently treats 0.50 as the confirmation threshold and 0.25 as the retirement threshold.

## The Six Ontology Moves

### 1. Capture

Use capture when the information is new and should be saved before interpretation.

Question:

```text
Is this information worth preserving?
```

If yes, capture it. If no, ignore it.

### 2. Classify

Use classify when the item needs life domains.

Question:

```text
Which life domain or domains are clearly present?
```

Choose only domains supported by the content.

### 3. Attach Evidence

Use attach evidence when the item supports or contradicts an existing axiom.

Question:

```text
Does this item make an existing if-then rule more or less believable?
```

If yes, attach it as evidence. If it contradicts the rule, mark the contradiction clearly instead of forcing support.

### 4. Create Candidate Axiom

Use create candidate axiom when the item suggests a repeatable pattern that is not already represented.

Question:

```text
Is there a reusable if-then rule here?
```

If yes, create a candidate axiom. Keep it plain English and specific enough to test.

### 5. Confirm Or Reject

Use confirm when a candidate axiom has enough evidence and feels useful enough to govern future reasoning.

Use reject when the pattern is false, vague, misleading, or not useful.

Question:

```text
Would I want future analysis to use this as a working rule?
```

If yes, confirm. If no, reject.

### 6. Retire

Use retire when a confirmed axiom used to be helpful but no longer fits.

Question:

```text
Was this once useful, but no longer describes current reality?
```

If yes, retire. Do not reject old truths just because they expired.

## Session Checklist

Use this checklist before starting. Do not use it as a hidden explanation during the session.

```text
1. I know where to access the ontology.
2. I know the closed life domain set.
3. I know the four statuses: candidate, confirmed, rejected, retired.
4. I know the six moves: capture, classify, attach evidence, create candidate, confirm/reject, retire.
5. I will not ask AI for live explanation during this counted attempt.
6. I will mark the session as training only if I need live explanation.
```

During the session, use this shorter flow:

```text
Item -> domain -> existing axiom or new candidate -> status move -> record outcome.
```

## Decision Rules

### If You Are Looking At A New Entry

1. Classify domains.
2. Ask whether it supports an existing axiom.
3. If yes, attach evidence.
4. If no, ask whether it suggests a new reusable if-then rule.
5. If yes, create candidate axiom.
6. If no, leave it as classified information only.

### If You Are Looking At A Candidate Axiom

1. Check whether the language is clear.
2. Check evidence count.
3. Check whether the evidence points in the same direction.
4. Confirm if it should govern future reasoning.
5. Reject if it is false, vague, or not useful.
6. Leave candidate if more evidence is needed.

### If You Are Looking At A Confirmed Axiom

1. Ask whether it still describes current reality.
2. Keep it confirmed if it still helps.
3. Retire it if it is stale, no longer useful, or belongs to an old phase.
4. Do not reject it unless it was always wrong.

### If You Are Looking At A Measurement

1. Name the measured thing in plain English.
2. Connect it to a life domain.
3. Decide whether it is evidence for an axiom.
4. Decide whether any action follows.
5. If you cannot do those steps without explanation, the session is training only.

## Scenario Drills

Use these before starting the 50 counted sessions.

### Drill 1: Low Sleep And Irritability

Information:

```text
I slept badly and noticed I was short with people during work calls.
```

Expected move:

- Domain: Sleep, Work, Social, Affect.
- If a sleep-affect or sleep-work axiom exists, attach evidence.
- If not, create candidate axiom: If sleep quality is low, then work patience decreases.

### Drill 2: Strong Workout Before Focus

Information:

```text
A morning workout made the first two hours of work feel easier.
```

Expected move:

- Domain: Exercise, Work, Affect.
- Create or support an exercise-work axiom.
- Relationship type: supports or predicts.

### Drill 3: Expired Work Pattern

Information:

```text
An old rule says evening work always reduces sleep, but current evidence shows evening work is fine when the task is creative.
```

Expected move:

- Do not reject the old rule if it used to be true.
- Retire or narrow the confirmed axiom.
- Consider a new candidate axiom about creative evening work.

### Drill 4: Interesting But Not Reusable

Information:

```text
I enjoyed one specific movie because the soundtrack reminded me of college.
```

Expected move:

- Domain: Entertainment, Affect.
- Capture or classify if meaningful.
- Do not create an axiom unless a repeatable pattern is visible.

### Drill 5: Ambiguous Metric

Information:

```text
Energy was 6 out of 10 after lunch.
```

Expected move:

- Domain: Nutrition, Affect, possibly Health.
- Attach evidence only if there is context linking lunch to energy.
- Do not invent significance from the number alone.

## Training Path

### Stage 1: Vocabulary Reps

Do 10 quick examples. For each, name:

- Domain.
- Possible axiom.
- Status.
- Relationship type.
- Whether it should count as evidence.

Goal: no hesitation on terms.

### Stage 2: Move Reps

Do 10 examples. For each, choose exactly one primary move:

- Capture.
- Classify.
- Attach evidence.
- Create candidate axiom.
- Confirm or reject.
- Retire.

Goal: no hesitation on the next action.

### Stage 3: Assisted Shadow Sessions

Run 5 to 10 real sessions. During the session, make your own decisions. After the session, ask AI:

```text
Review this ontology session. Where did I hesitate? Which rule should I memorize before certification?
```

These do not count toward 50.

### Stage 4: Certification Attempt

Start the 50-session scorecard only when a full session can be completed without live explanation.

## Done State

You are done when you have 50 counted sessions and the process feels like no big deal.

The felt state matters because the goal is not performance theater. The goal is that ontology use becomes a normal personal operating skill.

Objective proof:

```text
Given new information, I consistently know the next ontology move without external explanation.
```
