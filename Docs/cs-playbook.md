# Customer Service Playbook

*Adam's admitted gap from the Launch doc, replaced with an opinionated stack. This file is the system-level answer so the same correction doesn't happen 100 times.*

*Two modes: a permanent **BETA policy** (what the user sees), and an operational **ritual** (what Adam does daily/weekly).*

---

## 1. BETA Policy — What the User Sees

Every feature ships in exactly one of three states:

| State | Badge | Meaning | Commitment |
|---|---|---|---|
| **Stable** | none | Works. Adam uses it daily. | Any bug is a P1. Fix within 48h. |
| **BETA** | `BETA` badge in UI, footnote on pricing | Works but not yet proven to Adam's "it just works" bar | Bug acknowledged in 24h. Fixed when it surfaces in Adam's own use. |
| **Internal** | not shipped | Admin-only, flag-gated | Never shown to paying users without explicit opt-in. |

**Rule:** if Adam has not personally used a feature for 7 consecutive days without a single friction-log entry, it is BETA. A feature leaves BETA *only* after a clean 7-day streak in the [friction log](#4-friction-log).

The pricing page footer reads: *"Features currently marked BETA: {dynamic list}. These work, but they have not yet earned the Stable badge. You can use them; we are watching them."*

---

## 2. Support Channels

One inbox. One SLA. Every channel routes here.

| Channel | Target response | Owner |
|---|---|---|
| `help@understood.app` (Help Scout or Front) | ≤24h acknowledgment · ≤72h resolution for non-P1 | Adam, until volume > 20/day |
| In-app feedback widget ("What's working? What's not?") | Routes to `help@` | Same |
| First-100 cohort channel (Slack or Loops) | ≤6h during weekdays | Adam directly |
| Office hours (weekly, paid users only) | Fridays 12pm PT, 30 min | Adam |
| Status page `status.understood.app` | Auto-updated by Better Stack | Automated |

**P1 definition** (drop everything): data loss, billing charge error, auth failure for multiple users, production down.

---

## 3. Canned Responses — Starter Set

*Edit to voice before sending. Never auto-reply. These are starting shapes, not final words.*

### 3.1 — Acknowledgment (sent within 4h of any inbound)

> Got it. I'm reading this now. Expect a real reply within 24 hours; if it's a billing or access issue, sooner. — Adam

### 3.2 — Bug report received

> Thanks for flagging this. I've reproduced it on my end / I'm trying to reproduce it. Either way, you'll hear back with a fix or a real update by {date}. If anything changes in the meantime, I'll tell you here first. — Adam

### 3.3 — Feature request

> This is a real request. I'm not building it this week because {specific reason: V1 scope / already in backlog / conflicts with {axiom}}, but I'm logging it and will check back when the next version window opens. If this blocks you enough to leave, tell me — that changes the math. — Adam

### 3.4 — Refund / cancellation

> Done. Your subscription is cancelled and the last charge has been refunded in full. Your record is yours — you can export everything from Settings → Export, and your data will be deleted from our side within 30 days unless you come back. If something specific pushed you out, I want to know. — Adam

### 3.5 — Access / auth issue

> Try {specific fix}. If that doesn't work, here's a 24-hour magic link so you're not locked out while I dig: {link}. Tell me what happened on your end so I can fix it upstream. — Adam

### 3.6 — First-100 welcome

> You're in. Three months on me. Your coupon is already applied — your next charge will be $0 for the next three cycles, then $100/month unless you change it. The room for first-100 users is here: {invite link}. I read every message. If you hit friction, that's what I need to know about most. — Adam

### 3.7 — BETA feature surfaced a bug

> Yes — that feature is BETA for exactly this reason. You found the bug that keeps it from graduating. Fixing it this week; I'll update you here when it's Stable. Thank you for catching it. — Adam

---

## 4. Friction Log (daily ritual)

**Location:** `docs/friction-log.md` in the public repo (never public).
**Cadence:** one entry per day Adam uses the app. Zero entries allowed only on days Adam does not use the app.

### Entry format

```
## {YYYY-MM-DD}

- **Feature:** {name}
- **Friction:** {one sentence, specific}
- **Severity:** P1 / P2 / P3
- **Fix plan:** {sentence or "backlog"}
```

### Why daily, not weekly
A friction item caught within 24h is a 15-minute fix. A friction item caught after a week is a feature rebuild. The whole point is to intercept the problem before it compounds.

### Graduation rule
When a feature has 7 consecutive days with zero entries in the log, it graduates from BETA to Stable. This is the one condition.

---

## 5. First-100 Cohort

The leverage move. The first 100 users are not support tickets — they are co-builders.

### Channel
Slack workspace `understood-first-100`. Loops if Slack feels heavy. Never email-only.

### Cadence
- **Week 1 (launch):** daily post from Adam. "What's working today, what's surfacing."
- **Weeks 2–4:** 3 posts per week + 1 open office-hours call (30 min, Fridays).
- **Weeks 5+:** 1 post per week + weekly office hours.

### The kickoff message

Pinned to the channel.

> Welcome. You're one of the first 100 people inside Understood.app.
>
> Three things about this room:
>
> 1. **You are not a customer.** You are a co-builder. I read every message. I respond within hours during weekdays. If I don't, tell me and I will.
> 2. **Friction is the product.** If something is broken, slow, confusing, or off — tell me here first. The friction log in my head is the roadmap. You are writing it.
> 3. **Three months on the house.** Your card is on file, your coupon is applied, you will not be charged until {date}. If at any point before then this isn't earning the feeling, tell me and I'll cancel before you have to.
>
> Office hours: Fridays 12pm PT, 30 minutes, link in channel topic.
>
> — Adam

---

## 6. Monitoring Stack

| Tool | Purpose | Alerts to Adam's phone? |
|---|---|---|
| Sentry | Application errors | Yes — any new error signature |
| Better Stack | Uptime + status page | Yes — any endpoint down ≥60s |
| Vercel Analytics | Performance + traffic | No — reviewed weekly |
| Stripe dashboard | Billing anomalies | Yes — failed payment, chargeback |
| Supabase logs | Database errors | Yes — RLS policy violations, connection exhaustion |

**Rule:** every alert that rings Adam's phone must be actionable within 5 minutes. Alerts that are noise get tuned or removed within 24h. Alert fatigue is a P1 in itself.

---

## 7. What Never to Do

- Never auto-reply. The inbox is Adam until volume forces change.
- Never delete a user's record. "Deleted" users have their data held for 30 days, then hard-deleted. This is in the T&Cs.
- Never charge a card while any P1 incident is open. Pause billing until resolved.
- Never make a promise in support that isn't in the product within 30 days. If you make the promise, put it in the friction log the same hour.
- Never respond from a handle other than Adam's until there is a second full-time human.

---

## 8. Graduation Trigger For This Playbook

This playbook is itself BETA. It graduates when:

- 30 days pass with no repeated issue unresolved past SLA.
- One month where the friction log has ≥20 entries AND ≥80% are fixed within the week.
- A second person (contractor or hire) has shadowed Adam on the inbox for one full week.

At that point, this playbook becomes the basis for training a part-time CS contractor.
