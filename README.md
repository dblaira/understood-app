# Understood

**Presence infrastructure for the energetic logger who doesn't look back.**

A personal data platform that watches the streams you're already generating — journal entries, purchases, watch history, nutrition logs, device data — extracts them into a structured ontology of your life, and surfaces patterns you'd never have the time or patience to find yourself.

The product isn't the journal. It isn't the charts. It's the **ontology** — the formal taxonomy of you that emerges from how you actually live, not what you were told to track.

---

## What This Is

Most self-tracking tools ask you to swim upstream against your own momentum: compose entries, tag them, review them, act on them. Most people don't. They capture voraciously and never look back.

Understood inverts that. You capture however feels natural. The inference layer does the structuring, the connecting, and the surfacing. Your job is to live; the system's job is to watch and notice.

**Core principles:**
- **Capture first, structure later.** Friction kills usage. AI handles metadata post-capture.
- **Glanceable by default, expandable when curiosity strikes.** Quick scan, progressive depth.
- **Organized to the present, not instructed.** Your ontology emerges from your life, not the reverse.
- **Witnessed, not surveilled.** The relationship is thinking partner, not authority.

The enemy the product fights: *the tragedy of the unlived life — potential that slips through the cracks of an unexamined day.*

---

## How It Works

Understood is not four apps. It's **four capture surfaces + one inference layer.**

### The Pipeline

**1. Capture** — Multiple streams feed in:
- Journal entries (text + voice)
- Amazon order history
- YouTube watch history
- MyFitnessPal nutrition data
- Apple account data (Health, Screen Time, etc.)

**2. Extraction** — Claude processes raw text and metadata into structured extractions. Each extraction carries a category, key-value data, and a confidence score (1.0 = explicit, 0.7 = strongly implied, 0.4 = loosely inferred). A single entry can produce zero or many extractions. No manual tagging.

**3. Ontology** — Extracted labels are collapsed into a two-level hierarchy: **14 parent categories, 38 child labels, 0 unmapped.** Parents include Social, Work, Health, Ambition, Exercise, Nutrition, Purchase, Affect, Belief, Insight, Learning, Sleep, Entertainment, Finance. **The ontology is the product.** It's the formal structure of the user's life — stable, legible, portable, owned.

**4. Correlation** — A cross-domain engine analyzes how the 14 categories move together over time. Co-movement, inverse movement, leading indicators (e.g., Exercise preceding Ambition by 1–2 weeks), anomaly weeks, and domain bridging. Claude interprets the math and generates natural-language insights.

**5. Surfacing** — Short, numerically grounded behavioral observations delivered without requiring the user to go looking. Not dashboards.

### Why the ontology is the product

A pattern observation ("you stress-eat on Tuesdays") is a moment. The ontology is a foundation — a structured self-model built from months of living that the user owns. Competitors can generate observations. The ontology is defensible because it's earned.

---

## Current State

**Complete**
- Extraction pipeline: 180 journal entries → 147 extractions (Step 1) → 5,025 extractions across 13 domains (Step 2)
- Formalized ontology: 14 parents / 38 children / 0 unmapped (Step 3)
- Cross-domain correlation engine with natural-language interpretation (Step 4)
- Visual design system: Bodoni Moda / Inter / Crimson Red / Vanity Fair editorial aesthetic
- Parallel development workflow via git worktrees for multi-agent Cursor builds

**On deck**
- User-facing insight surfacing layer (short pattern-based observations, not dashboards)
- Notification intelligence layer (infrastructure exists; surfacing does not)
- Copy & Paste component — the "integration moment" where users re-compose AI rewrites into their own voice
- Affect coverage gap (currently 59% weekly — the most critical data-quality issue given the product's purpose)

---

## Tech Stack

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Server Actions
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security)
- **AI:** Anthropic Claude API (extraction, ontology proposal, correlation interpretation)
- **Deployment:** Vercel (Cron, Edge Functions)
- **Development:** Cursor IDE, git worktrees for parallel agents, Playwright for E2E

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key

### Installation

1. Clone the repo
2. Install dependencies:
```bash
   npm install
```
3. Create `.env.local`:
```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   CRON_SECRET=your_cron_secret
```
4. Run dev server:
```bash
   npm run dev
```
5. Open http://localhost:3000

### Scripts
- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — ESLint
- `npm run test:e2e` — Playwright specs

---

## Database Schema

Understood uses five primary tables. All tables have RLS enabled with user-scoped policies.

```sql
-- Journal capture surface
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  headline TEXT NOT NULL,
  category TEXT NOT NULL,
  subheading TEXT,
  content TEXT NOT NULL,
  mood TEXT,
  versions JSONB,
  generating_versions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Structured extractions from all capture streams
CREATE TABLE extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  source_type TEXT NOT NULL,      -- 'journal' | 'amazon' | 'youtube' | 'mfp' | 'apple'
  source_id TEXT,
  category TEXT NOT NULL,         -- original child label
  parent_category TEXT,           -- Level 1 ontology parent
  data JSONB,
  confidence REAL,                -- 1.0 | 0.7 | 0.4
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The ontology — the actual product
CREATE TABLE ontology_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name TEXT NOT NULL,
  child_label TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Correlation engine output
CREATE TABLE correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  category_a TEXT NOT NULL,
  category_b TEXT NOT NULL,
  correlation_type TEXT,          -- 'co_movement' | 'inverse' | 'lagged' | 'anomaly'
  coefficient REAL,
  lag_weeks INTEGER,
  window_start DATE,
  window_end DATE,
  interpretation TEXT,            -- Claude-generated
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Behavioral signatures — recurring multi-category patterns
CREATE TABLE behavioral_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT,
  categories TEXT[],
  description TEXT,
  interpretation TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

Full migrations live in `/supabase/migrations`.

---

## Project Structure

```
├── app/
│   ├── api/                     # extract, correlate, interpret
│   ├── actions/                 # Server Actions
│   ├── extractions/             # bubble map + ontology views
│   ├── correlations/            # cross-domain patterns
│   ├── login/
│   ├── layout.tsx
│   └── page.tsx
├── components/                  # self-contained UI (shadcn philosophy)
├── lib/
│   ├── supabase/
│   ├── extraction/              # prompt templates + parsers
│   ├── ontology/                # hierarchy operations
│   ├── correlation/             # Pearson, stddev, lagged correlation (JS, not API)
│   └── utils.ts
├── types/
├── tests/                       # Playwright specs
└── styles/                      # Vanity Fair design tokens
```

---

## Design System

Understood follows a **Vanity Fair editorial** aesthetic — not a productivity-tool aesthetic.

- **Headings:** Bodoni Moda
- **Body:** Inter
- **Accent:** Crimson Red
- **Hierarchy:** four levels with documented component maps and interaction states

See `VISUAL-DESIGN-FRAMEWORK.md` for the full spec.

The visual choice reinforces the positioning: this isn't a tracker, it's a record. It treats the user's life the way a magazine treats its subject.

---

## Deployment

Configured for Vercel.

1. Push to GitHub
2. Import into Vercel
3. Add environment variables (see above)
4. Deploy

`vercel.json` configures Cron jobs for scheduled extraction runs and correlation refreshes. Redeploy after changing env vars.

---

## Roadmap

**Near-term**
- Insight surfacing layer (user-facing output from the correlation engine)
- Affect coverage remediation
- Notification intelligence layer

**Medium-term**
- Copy & Paste component (the voice-integration moment)
- Full Connections system
- Additional capture surfaces: Financial Patterns, Relationship Pulse, Energy/Recovery

**Long-term**
- Multi-tenant platform
- Opt-in shared ontology primitives across users

---

## License

MIT
