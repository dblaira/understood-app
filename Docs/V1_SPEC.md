# Understood.app — V1 Specification

*Source document. Will be copied into the new public repo as `docs/V1_SPEC.md` when that repo is scaffolded. V1 is the feature set that ships on paywall-live day; anything not in this doc is in the "Next Version" section at the bottom.*

*Vocabulary note:* the verb is **Record**; the noun is **your record**. "Journal" is not used. The weekly summary is the **Weekly debrief**.

---

## 1. Product Surface (the nine things a user can do)

1. **Sign up** — email + OAuth (Google, Apple).
2. **Onboard** — three screens, under three minutes.
3. **Record** — single-field capture of what just happened.
4. **See tags** — life domains appear on every entry the moment after it is saved.
5. **See the ontology** — personal axioms + rules the AI uses, with confidence scores.
6. **Read the Weekly debrief** — Sunday-morning email summarizing the week's active domains.
7. **Ask the assistant** — AI chat that reads axioms into its system prompt. *(V1 reads-only: assistant answers, does not take actions yet.)*
8. **Manage billing** — Stripe customer portal.
9. **Export and delete** — full JSON export; full account delete.

That is the entire V1 surface. Anything else is out of scope.

---

## 2. Routes (Next.js 15 App Router)

```
app/
  layout.tsx
  page.tsx                       # marketing home (/)
  story/
    page.tsx                     # long-form spine (/story)
    deck/page.tsx                # keynote deck (/story/deck)
  pricing/page.tsx               # pricing (/pricing)
  demo/page.tsx                  # live anonymized ontology demo (/demo)

  (auth)/
    login/page.tsx
    signup/page.tsx
    callback/route.ts            # Supabase OAuth callback

  (app)/                         # authed shell
    layout.tsx                   # checks subscription; redirects to /pricing if needed
    onboarding/page.tsx          # 3-screen wizard
    record/page.tsx              # main capture surface
    ontology/page.tsx            # port of existing /ontology view
    assistant/page.tsx           # chat (reads axioms into prompt)
    settings/
      page.tsx                   # profile + export + delete
      billing/page.tsx           # Stripe portal redirect

  api/
    record/route.ts              # POST new entry, tag life domains
    axioms/route.ts              # GET personal + global axioms
    assistant/route.ts           # POST chat messages
    stripe/
      checkout/route.ts          # create checkout session
      portal/route.ts            # create portal session
      webhook/route.ts           # Stripe webhook handler
    admin/
      first-100/route.ts         # hand-issue 3-month coupon
    cron/
      weekly-debrief/route.ts    # Sunday 8am email cron

middleware.ts                    # auth + subscription paywall
```

Public routes: `/`, `/story`, `/story/deck`, `/pricing`, `/demo`, `/login`, `/signup`.
Paywalled routes: everything under `(app)/`.

---

## 3. Data Model

Derives from [database-migrations-ontology.sql](../database-migrations-ontology.sql). Starts fresh — no migration from the private lab.

Ontology requirements are grounded in [competency questions](competency-questions.md). These questions define what the ontology must be able to answer before new schema, graph, or agent behavior is added.

### 3.1 Tables

```
profiles
  id UUID PK (references auth.users)
  display_name TEXT
  onboarded_at TIMESTAMPTZ
  first_100 BOOLEAN DEFAULT false
  selected_domains life_domain[] NOT NULL DEFAULT '{}'
  created_at TIMESTAMPTZ

entries
  id UUID PK
  user_id UUID (RLS: own only)
  content TEXT NOT NULL
  life_domains life_domain[] NOT NULL DEFAULT '{}'
  created_at TIMESTAMPTZ

ontology_axioms                  -- inherits schema from existing migration
  id UUID PK
  user_id UUID NULL               -- NULL row = global seed; user_id set = personal
  name TEXT
  description TEXT
  antecedent TEXT
  consequent TEXT
  confidence NUMERIC(4,3)
  sources TEXT[]
  created_at TIMESTAMPTZ

inferred_insights                 -- weekly derived axioms
  id UUID PK
  entry_id UUID FK
  week_start DATE
  insight_text TEXT
  related_axioms UUID[]
  confidence NUMERIC(4,3)
  created_at TIMESTAMPTZ

subscriptions                    -- NEW; Stripe-backed
  user_id UUID PK FK profiles.id
  stripe_customer_id TEXT
  stripe_subscription_id TEXT
  plan TEXT CHECK (plan IN ('preview','monthly','annual'))
  status TEXT CHECK (status IN ('trialing','active','past_due','canceled','incomplete'))
  trial_ends_at TIMESTAMPTZ
  current_period_end TIMESTAMPTZ
  coupon_code TEXT
  updated_at TIMESTAMPTZ

assistant_messages               -- chat history
  id UUID PK
  user_id UUID (RLS: own only)
  role TEXT CHECK (role IN ('user','assistant'))
  content TEXT
  created_at TIMESTAMPTZ
```

### 3.2 Views (unchanged from private lab)

- `weekly_ontology_summary` — already defined in the ontology migration; use as-is.

### 3.3 RLS

- Every user-scoped table: `user_id = auth.uid()` on SELECT/INSERT/UPDATE/DELETE.
- `ontology_axioms`: SELECT allows `user_id IS NULL OR user_id = auth.uid()`. INSERT/UPDATE/DELETE require `user_id = auth.uid()`.
- `subscriptions`: SELECT own only. INSERT/UPDATE via service-role only (from webhook).
- `profiles.first_100`: user can read own; service-role sets via admin route.

---

## 4. Onboarding (3 screens, under 3 minutes)

### Screen 1 — "Why are you here?"
- Single text field: "What's the one thing you want to move?"
- Answer is saved to `profiles.intent` (TEXT). Not used by logic in V1; used in the V1.1 assistant prompt.

### Screen 2 — "Which four life domains matter most to you this season?"
- Multi-select of the 13-enum `life_domain` values.
- User picks up to four. Stored in `profiles.selected_domains`.
- Used to filter the ontology view and the Weekly debrief to the user's chosen focus.

### Screen 3 — "What do you already believe is true about yourself?"
- Three fields: `antecedent` ("if…"), `consequent` ("then…"), confidence slider (default 0.50).
- Submit writes one personal `ontology_axioms` row, `sources = ['self_declared']`.
- This is the seed. The user has an ontology before they have recorded anything.

On submit → redirect to `/record` with empty field, cursor focused.

---

## 5. The Record Surface (`/record`)

- One large textarea. Placeholder: *"What just happened?"*
- Below: a faint row of the user's four selected domains, clickable to pre-tag.
- Submit (Cmd/Ctrl+Enter or button) → POST `/api/record`.
- API does two things: INSERT entry, then call Anthropic to classify `life_domains` from content. Returns the entry row with tags populated.
- UI shows the newly-tagged entry in the recent-list pane on the right, tags visible as chips.
- No edit UI in V1. Delete-only via a small "×" on each entry. (Editing is backlog.)
- Entries list on the page shows the last 14 days. Older entries are in `/ontology` (date-grouped).

### Tagging model
- Model: Claude Sonnet 4.
- Prompt: *"Given this entry and this fixed list of 13 domains, return the 1–3 domains most present. Return JSON only."*
- Latency target: < 2s p50. If > 4s, return the entry untagged and retry in background.
- Cost ceiling: $0.003 per entry.

---

## 6. The Ontology View (`/ontology`)

Port of [app/ontology/page.tsx](../app/ontology/page.tsx) as-is, with three changes:
1. Filter the Rules pane to the user's `selected_domains` by default; toggle to show all.
2. Replace the "How this page maps to the app" accordion text with a one-paragraph version aligned with the brand voice (no "journal" references).
3. Add a **Confidence gate** control: a slider that hides axioms below X confidence. Default 0.50.

Data fetched on mount via server component where possible; keep the client hydration for the filter controls.

---

## 7. The Assistant (`/assistant`)

V1 chat. Read-only: the assistant answers; it does not execute tasks in V1.

- Every message sent to Claude includes the user's personal + global axioms at confidence ≥ 0.50 in the system prompt, rendered as numbered "if → then" lines with confidence.
- Streaming response.
- `assistant_messages` stores the full history for the user.
- No agent/tool-calling in V1. No memory beyond the axiom injection. The backlog adds tool use later.

**Rate limit** — 50 messages / user / day during V1. Prevents cost blowouts pre-revenue stabilization.

---

## 8. Weekly Debrief (Sunday 8am local time)

- Vercel Cron hits `/api/cron/weekly-debrief` hourly.
- Handler: find all users whose local Sunday 8am is in the current UTC hour. For each, read `weekly_ontology_summary` for the past week, render markdown summary, send via Resend.
- Email structure:
  - Subject: *"Your record this week: {count} entries across {domain_count} domains"*
  - Body: three sections — *This week's active domains* / *What moved* / *What to watch next week*.
  - Footer: a single primary CTA ("Open your ontology").
- Unsubscribe link; honored via `profiles.debrief_opt_in`.

---

## 9. Billing (Stripe)

### Products
- `preview` — price $0, 1 free 7-day trial, converts to `monthly` unless cancelled.
- `monthly` — price $100 USD / month.
- `annual` — price $999 USD / year.

### Checkout flow
1. New user finishes onboarding → hits paywall at first authed route if not trialing.
2. `/pricing` → picks plan → POST `/api/stripe/checkout` → redirect to Stripe-hosted checkout.
3. Webhook `checkout.session.completed` → upsert `subscriptions` row.

### First-100 coupon
- Admin route `/api/admin/first-100` (service-role auth via `ADMIN_TOKEN` header) accepts `{ email }`. Creates or locates the Stripe customer, applies a 3-month 100%-off coupon (`FIRST100`, pre-created in Stripe), sets `profiles.first_100 = true`.
- User still enters card; charge is $0 for 3 billing cycles.

### Portal
- `/settings/billing` → POST `/api/stripe/portal` → redirect to Stripe portal.

### Webhooks handled
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

---

## 10. Paywall Middleware

Pattern: copy [middleware.ts](../middleware.ts) structure from the private lab, add subscription check.

```ts
// Pseudocode
export async function middleware(req) {
  const user = await getUser(req)
  const path = req.nextUrl.pathname

  if (isPublic(path)) return NextResponse.next()
  if (!user) return redirect('/login')

  if (isAppRoute(path)) {
    const sub = await getSubscription(user.id)
    const active = sub?.status === 'active' || sub?.status === 'trialing'
    if (!active) return redirect('/pricing')
  }

  return NextResponse.next()
}
```

Public paths: `/`, `/story*`, `/pricing`, `/demo`, `/login`, `/signup`, `/auth/callback`, `/api/stripe/webhook`.

---

## 11. Settings

- Profile: display name, email (read-only), selected domains (editable).
- Billing: status row + "Open billing portal" button.
- Export: button → `/api/export` → returns JSON of all user-scoped rows (entries, axioms, insights, messages).
- Delete: confirm dialog → `/api/delete` → cascades through Supabase FKs, cancels Stripe subscription, logs out.

---

## 12. Non-Functional Requirements

- **Mobile Safari first.** Every flow is tested on iPhone SE viewport (375px) before shipping.
- **Keyboard first.** Cmd+Enter submits. Cmd+K opens a quick-record overlay from anywhere in the app.
- **Offline: not yet.** V1 requires a connection. Offline capture is V1.2+.
- **Dark by default.** Editorial serif voice, inheriting the direction set in the existing ontology page (Georgia/Bodoni Moda, `#0a0a0a` background).
- **Performance budget.** First paint on `/record` ≤ 1.2s on 4G; LCP ≤ 2.0s. Vercel Analytics measures both.

---

## 13. Acceptance Criteria

V1 ships when all of these are true:

- A stranger can land on `/`, read the spine, sign up with email, complete onboarding in ≤ 3 minutes, record their first entry and see it tagged within 3 seconds of save, and open their ontology and see at least their self-declared seed axiom.
- All nine product-surface items in §1 work end-to-end on iPhone Safari.
- Stripe charges a real card for $100 or $999. A first-100 user can be hand-issued a coupon and pass through checkout for $0.
- Webhook-driven subscription updates are reflected in the paywall within 30 seconds.
- Weekly debrief emails send to test users at Sunday 8am local time.
- Error rate (Sentry) < 1% of requests over a 24-hour window with 10 seed users on.

---

## 14. Next Version — Backlog (explicitly NOT V1)

Captured so V1 scope discipline holds. No timelines.

- Voice capture (press-and-hold record; transcribes to entry content).
- Assistant tool-calling (create entries, surface axioms, export summaries).
- Importers: Apple Health → sleep/exercise; MyFitnessPal → nutrition; Oura → HRV.
- Edit entries (V1 is delete-and-redo only).
- Global public axiom library (opt-in).
- Cohort features (shared axioms, study groups).
- Physical year-end Record book.
- Coach/therapist share link.
- Starter Pack onboarding (pre-loaded candidate axioms from replicated patterns).
- iOS native app (V1 is responsive web).
- Apple Watch complication ("record from the wrist").
- Slack / email / Notion capture ("forward to record@").

Everything in this section must be explicitly promoted out of backlog into a versioned spec before any implementation begins.

---

## 15. Out of Scope (Permanent)

- Social graph, feed, followers.
- Public profiles.
- Gamification (streaks, badges, points).
- Interpretation of feelings or clinical claims.
- Recommendations to third-party products or affiliates.
- Any free tier beyond the 7-day preview.
