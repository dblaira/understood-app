# Content Prompts — Turn Any Record Entry into a Pillar Post

*Paste one of these prompts into Claude or ChatGPT with a raw record entry (from Understood.app) and the target format. The spine and brand voice are already loaded — the prompt enforces them.*

*Same pattern as [ideas/PROMPTS.md](../../ideas/PROMPTS.md). Mirrors existing workflow.*

---

## Shared Context Block

*Paste this at the top of every prompt.*

```
You are writing for Understood.app, a tool that turns a user's record of their life into a personal ontology — a causal knowledge graph of axioms and life domains.

Brand voice:
- Specific, not mystical. Electric feeling earned by real numbers, never adjectives.
- Past-tense ambition: "done waiting," "lights on," "by the time you finish."
- Recommendations, not advice.
- Record (verb + noun). The word "journal" is banned.
- Axiom = "if → then" statement with confidence score.
- Life domains = 13-item fixed vocabulary: Exercise, Sleep, Nutrition, Ambition, Health, Work, Social, Learning, Purchase, Belief, Affect, Insight, Entertainment.
- Target persona: ambitious person who feels one step below where they should be, done waiting.

Proof anchors (use at least one specific number in any post):
- 19 months MyFitnessPal data
- 4 years Apple Watch sleep data
- 4 seed axioms: Learning Master Key (0.67), Exercise-Sleep Synergy (0.57), Belief→Entertainment Lag (0.60), Zero Negative Impact (0.95)
- 13 life domains
- $100/month or $999/year

Anti-patterns (do not write):
- Therapy/mood language ("process feelings," "self-care," "mindfulness").
- Habit-tracker language ("streak," "build the habit," "stack habits").
- Hustle-culture ("grind," "10x," "crush it").
- Vague proof ("many users," "research shows," "significant improvement"). If no specific number, cut the claim.
```

---

## Prompt 1 — X Thread (8–12 tweets)

```
[Paste shared context block above.]

INPUT:
- A raw record entry from Understood.app: {paste entry text}
- One axiom that entry touches: {paste axiom name + confidence}

TASK:
Write an 8–12 tweet thread. Structure:

Tweet 1: A one-line hook that names the specific number or pattern.
Tweet 2: The axiom, written in plain language as "if X → then Y (confidence: Z)."
Tweets 3–6: The story — what happened in the entry, what the data showed, how the axiom surfaced.
Tweets 7–9: The method — how the reader could discover their own version of this axiom.
Tweet 10: The recommendation (not advice) that follows from the axiom.
Tweet 11 (final): A one-line invitation. End with "Start your 1-week preview → understood.app"

Rules:
- Max 270 chars per tweet.
- No emojis. No hashtags except "#ontology" on the last tweet only.
- No thread emojis ("🧵") — the numbers speak for themselves.
```

---

## Prompt 2 — LinkedIn Essay (700–900 words)

```
[Paste shared context block above.]

INPUT:
- Same record entry + axiom as above.

TASK:
Write a 700–900 word LinkedIn essay. Structure:

- Opening hook (1 paragraph): the specific number or moment. No setup. Start mid-scene.
- The problem (2 paragraphs): what you thought was true, what the data showed instead.
- The axiom (1 paragraph, set off visually if possible): stated as "if X → then Y (confidence: Z)" with a one-sentence interpretation.
- The mechanism (2–3 paragraphs): why this works, grounded in how personal ontologies make this kind of signal findable for the first time. Use the term "causal knowledge graph" exactly once.
- The reader's move (1–2 paragraphs): what to do differently starting this week. Named as a recommendation, not advice.
- Close (1 paragraph): one line of invitation to record your own. Include "understood.app" once.

Rules:
- No bullet lists unless the content demands one (the 13 life domains).
- No LinkedIn-isms ("I've been thinking," "Here's what I learned," "Let me explain why").
- One number per paragraph, minimum.
```

---

## Prompt 3 — Short Video Script (60–90 seconds)

```
[Paste shared context block above.]

INPUT:
- Same record entry + axiom as above.

TASK:
Write a 60–90 second video script for camera (no voiceover). Format as [0:00–0:05] timestamps with spoken lines. Assume direct address, no B-roll cues needed.

Beats:
[0:00–0:08] Open with the specific number. Say it before you say anything else.
[0:08–0:25] Frame the common assumption this number breaks.
[0:25–0:55] Tell the story: what you recorded, what the ontology surfaced, the axiom.
[0:55–1:15] The move the viewer can make this week.
[1:15–1:30] Direct CTA: "If you are done waiting, start your one-week preview at understood.app."

Rules:
- Short sentences. Five to twelve words each.
- One number every 15 seconds minimum.
- No "hey guys" or channel-intro language. First word is the number.
```

---

## Prompt 4 — Email (400–550 words)

```
[Paste shared context block above.]

INPUT:
- Same record entry + axiom as above.

TASK:
Write a 400–550 word email for the Understood.app list. Plain text voice, no HTML tricks.

Structure:
- Subject line (≤60 chars): lead with the number or the axiom name.
- Preheader (≤90 chars): a concrete claim that extends the subject.
- Opening (2 sentences): drop the reader mid-scene.
- Middle (3–4 short paragraphs): the story + the axiom + the mechanism, tighter than LinkedIn but same spine.
- Close (1 paragraph + single link): one recommendation + "Open your ontology →" (link to the app) or "Start your 1-week preview →" (for non-users; condition on list segment).
- Sign-off: "— Adam" on its own line.

Rules:
- No pre-header teaser tricks. Say what the email says.
- One link. Not two.
- P.S. allowed only if it adds a second specific number.
```

---

## The Meta-Prompt (turn any entry into all 4 formats at once)

```
[Paste shared context block above.]

You will output four artifacts in sequence, separated by "---":
1. X THREAD (use Prompt 1)
2. LINKEDIN ESSAY (use Prompt 2)
3. VIDEO SCRIPT (use Prompt 3)
4. EMAIL (use Prompt 4)

INPUT:
- Record entry: {paste}
- Axiom: {paste name + confidence}
- Personal context (optional): {1–2 lines about what was going on that week}

Write all four. Use the same core number and the same axiom across all four. Do not paraphrase the axiom between formats — use identical language each time. Channel-specific shaping is format only (length, rhythm), never message.
```

---

## Discovery Prompt — Find the Next Post From This Week's Record

*Runs once a week, before drafting. Turns the week's record into a shortlist of post candidates.*

```
[Paste shared context block above.]

INPUT:
- The last 7 days of record entries (paste as a single block, one entry per line).
- The user's current personal ontology (paste as "if → then (confidence)" lines).

TASK:
Return a ranked list of the top 3 post candidates for the week. For each:
1. One sentence describing the post's central claim.
2. Which axiom it rests on (name + confidence).
3. Which specific entry (quoted verbatim) anchors the claim.
4. A recommended format (X thread / LinkedIn / video / email) and a one-line justification.
5. A confidence score (0.0–1.0) that this is a strong post.

Reject candidates that:
- Do not carry a specific number.
- Rest on an axiom below 0.50 confidence.
- Would require the reader to know anything about Adam personally.

Output top 3 only. If fewer than 3 qualify, say so.
```
