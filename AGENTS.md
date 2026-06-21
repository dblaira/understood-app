# Understood Agent Instructions

This repository backs the app surface currently associated with Vercel project `news-journal-app`, including `lab.understood.app`, `understood.sh`, and `www.understood.sh`.

Reference `WORKING_PATTERNS.md` when available. Start by deciding whether the request is Phase 1 ("help me judge this") or Phase 2 ("execute requirements"). If the task touches visible product behavior, wording, visual design, recommendations, ontology, knowledge graph, or agent communication, apply the strategy below before making decisions.

## Latest Strategy: June 13, 2026

This app is being built for me. I am the first user but hopefully not the last. Anything that doesn't resonate with me is useless or worse -- destructive. My taste and natural reaction to any wording, component, functionality, API call, font size, color scheme, recommendation engine, ontology, knowledge graph, and any other detail should use only my judgement as the bar of success. This means that anything I don't understand, when communicating with an agent is potentially harmful to the project. That said, if I want to add something just because it is a good idea and is there for others, that is fine too. But always. Always, the app is being designed solely for me.

## Operating Rule

Do not optimize Understood for a hypothetical average user before Adam has reacted to it. Adam's understanding, taste, and natural response are the acceptance criteria. If Adam does not understand the agent's explanation, naming, or proposed implementation, treat that as a product risk, not a communication footnote.

## Cursor Cloud specific instructions

Single Next.js 15 app (App Router, TypeScript). Package manager is **npm** (Node 20+; verified on Node 22). Dependencies are refreshed automatically on startup via the update script (`npm ci`), so you normally don't need to install anything.

Running and checking the app (standard scripts live in `package.json`):
- Dev server: `npm run dev` → http://localhost:3000.
- Typecheck: `npx tsc --noEmit` (passes clean). Use this as the de-facto check.
- `npm run lint` is **not usable non-interactively**: ESLint is not configured in the repo, so `next lint` drops into an interactive setup prompt. Don't rely on it in automation; prefer `npx tsc --noEmit`.

Environment / secrets (`.env.local`, gitignored):
- `.env.example` ships a **real, live Supabase URL + anon key** — that hosted project is the shared dev backend. Copy `.env.example` to `.env.local` to boot with auth + database working immediately. The full schema (entries, ontology, correlations, etc.) is already provisioned on it.
- Supabase **signup auto-confirms** (no email verification), so you can create accounts directly from the `/login` page (toggle to Sign Up) or via the Supabase auth REST API.
- Every route is gated by Supabase auth in `middleware.ts`; unauthenticated `/` redirects to `/login`. Auth + the journal feed render without any AI keys.
- `ANTHROPIC_API_KEY` is **required for core AI features** (capture inference via `/api/infer-entry`, weekly themes, extraction pipeline, correlations). Without it the capture modal's "Continue" step returns HTTP 500 `API key not configured` — the rest of the app still works. Set it to demo/build the capture→infer→save flow.
- `SUPABASE_SERVICE_ROLE_KEY` is only needed for admin scripts (`npm run setup:storage`, `npm run extract`), some uploads, and cron endpoints — not for basic dev.
- `OPENAI_API_KEY` (voice transcription), VAPID keys (web push), and `APNS_*` (iOS push) are optional; their features are disabled when unset.

Gotchas:
- Do not commit `package-lock.json` churn: `npm install` rewrites the lockfile root `name` to `workspace` (package.json has no `name` field). Use `npm ci` (the update script) which never mutates the lockfile.
- `npm run validate:ontology` requires Docker (pulls `stain/jena`); not needed for normal app dev.
