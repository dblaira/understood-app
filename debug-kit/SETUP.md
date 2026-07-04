# Debug Kit — Installation Guide

A portable debug overlay and logging layer for Next.js + Supabase apps.
Logs persist to your Supabase database and surface in an in-app overlay.
A green bug icon in the top-right corner is the entry point — tap to open.

---

## Prerequisites

Before installing, confirm your project has:

- Next.js 14+ with App Router (`app/` directory)
- Supabase with `@supabase/supabase-js` and `@supabase/ssr` installed
- TypeScript
- The `@/` path alias in `tsconfig.json` (standard Next.js default)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`

No additional npm packages are required.

---

## Step 1: Run SQL Migrations

Open your project's **Supabase Dashboard → SQL Editor** and run these two files **in order**.

### File 1: `sql/001-create-debug-logs.sql`

Creates the `debug_logs` table with columns for timestamp, level, page, message,
metadata (JSON), and session tracking. Also creates indexes for fast queries.

Paste the contents of `debug-kit/sql/001-create-debug-logs.sql` into the SQL Editor and click **Run**.

**Expected result:** "Success. No rows returned."

### File 2: `sql/002-debug-logs-rls.sql`

Adds Row Level Security policies so each user can only insert, read, and delete
their own debug logs.

Paste the contents of `debug-kit/sql/002-debug-logs-rls.sql` into the SQL Editor and click **Run**.

**Expected result:** "Success. No rows returned."

### Verify

In **Supabase Dashboard → Table Editor**, confirm you see a `debug_logs` table.
It will be empty — that's correct.

---

## Step 2: Copy Code Files

Copy each file to the **exact destination path** below. Create directories that don't exist.

| Source (in debug-kit/)                     | Destination (in your project)          |
|--------------------------------------------|----------------------------------------|
| `src/lib/debug/debug-logger.ts`            | `lib/debug/debug-logger.ts`            |
| `src/lib/debug/debug-config.ts`            | `lib/debug/debug-config.ts`            |
| `src/components/debug-overlay.tsx`         | `components/debug-overlay.tsx`         |
| `src/app/api/debug-logs/route.ts`          | `app/api/debug-logs/route.ts`          |

### Copy-paste commands (run from your project root)

```bash
# Create directories
mkdir -p lib/debug
mkdir -p app/api/debug-logs

# Copy files (adjust the source path if debug-kit is elsewhere)
cp debug-kit/src/lib/debug/debug-logger.ts    lib/debug/debug-logger.ts
cp debug-kit/src/lib/debug/debug-config.ts    lib/debug/debug-config.ts
cp debug-kit/src/components/debug-overlay.tsx  components/debug-overlay.tsx
cp debug-kit/src/app/api/debug-logs/route.ts  app/api/debug-logs/route.ts
```

---

## Step 3: Verify the Supabase Client Import

Open `lib/debug/debug-logger.ts` and check **line 11**. It imports the
browser-side Supabase client:

```typescript
import { supabase } from '@/lib/supabase/client'
```

### Does your project match?

**Pattern A — Singleton export at `@/lib/supabase/client`:**
No change needed. This is the default.

**Pattern B — Different path** (e.g. `@/utils/supabase-client` or `@/lib/supabase`):
Update line 11 to match your project's import path.
To find your project's pattern, search for: `from.*supabase.*client`

**Pattern C — Factory function** (e.g. `createBrowserClient()`):
You'll need to call the factory inside the logger's `flushQueue` function
instead of using a module-level import. Replace the import with your factory
call at the top of `flushQueue()`.

Also check `components/debug-overlay.tsx` **line 5** — it has the same import.
Update it to match if needed.

Also check `app/api/debug-logs/route.ts` **line 2** — it imports the *server*
client. The debug kit ships with:

```typescript
import { createClient } from '@/lib/supabase/server'
```

If your server client lives elsewhere, update that import too.

---

## Step 4: Add DebugOverlay to the Root Layout

Open your root layout file (usually `app/layout.tsx`).

### 1. Add the import at the top of the file:

```typescript
import { DebugOverlay } from '@/components/debug-overlay'
```

### 2. Add the component inside `<body>`, after all other content:

```tsx
<body>
  {/* ...existing providers and children... */}
  {children}
  {/* ...existing components like toasts, modals, etc... */}
  <DebugOverlay />
</body>
```

### Important notes

- Place `<DebugOverlay />` **inside** the `<body>` tag
- Place it **after** `{children}` and any providers/wrappers
- It does **not** need to be wrapped in any provider
- It is a client component — the root layout can stay as a server component
- In development, a **green bug icon** appears in the top-right corner — tap it to open the debug panel
- The keyboard shortcut **Cmd+Shift+D** and **triple-tap** (mobile) also toggle it
- When `DEBUG_ENABLED` is `false` (production by default), nothing renders at all

---

## Step 5: Configure PAGE_LABELS and HIDDEN_PATHS

Open `lib/debug/debug-config.ts` and update two constants for your app's routes.

### PAGE_LABELS

A map of route paths to human-readable names. The overlay uses these in its
header and page filter dropdown.

```typescript
export const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/login': 'Login',
  '/settings': 'Settings',
  '/dashboard': 'Dashboard',
  '/entries/[id]': 'Entry Detail',
  // Add every user-facing route in your app
}
```

**How to fill this in:**

1. Look at your `app/` directory — each folder with a `page.tsx` is a route
2. Dynamic routes use bracket notation: `app/entries/[id]/page.tsx` → `/entries/[id]`
3. Give each a short, plain-English label

**Quick discovery command** (run from project root):

```bash
find app -name "page.tsx" | sed 's|app||;s|/page.tsx||;s|^$|/|'
```

### HIDDEN_PATHS

Routes that should NOT appear in the overlay. Typically API routes, auth
callbacks, and internal pages.

```typescript
export const HIDDEN_PATHS: string[] = [
  '/api',           // All API routes (prefix match)
  '/auth/callback', // Supabase auth callback
]
```

**Matching rules:**
- **Prefix match:** `/api` hides `/api/debug-logs`, `/api/entries`, everything under `/api`
- **Exact match:** `/auth/callback` hides only that specific path

---

## Step 6: Verify It Works

1. Start your dev server: `npm run dev`
2. Open any page in your app
3. You should see a **green bug icon** in the top-right corner
4. Tap/click it — the debug panel should slide up from the bottom
5. Navigate between pages — the overlay header should show the current page label
6. Trigger any action that calls `debugLog.info(...)` — you should see entries appear
7. The keyboard shortcut **Cmd+Shift+D** / **Ctrl+Shift+D** also toggles the panel

### Troubleshooting

**No green bug icon visible:**
- Check the browser console for import errors
- Verify `<DebugOverlay />` is in your root layout's `<body>`
- Verify the file exists at `components/debug-overlay.tsx`
- Confirm `DEBUG_ENABLED` is `true` in your environment (it's `true` in development by default)
- If the current route is in `HIDDEN_PATHS`, the icon won't appear on that page

**Overlay appears but no logs:**
- The overlay only shows logs written via `debugLog.info()` / `.warn()` / `.error()` / `.debug()`
- Add a test log somewhere: `debugLog.info('/test', 'Hello from debug kit')`
- Logs are batched and flushed every 2 seconds — wait a moment then hit Refresh

**Supabase error in console:**
- Verify you ran both SQL files in Step 1
- Verify the import path in `debug-logger.ts` matches your Supabase client
- Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`

---

## Usage

Once installed, import and call the logger from anywhere in your client code:

```typescript
import { debugLog } from '@/lib/debug/debug-logger'

// Basic logging
debugLog.info('/dashboard', 'Page loaded')
debugLog.warn('/settings', 'Slow response from API', { ms: 3200 })
debugLog.error('/entries', 'Failed to save entry', { entryId, error: err.message })
debugLog.debug('/login', 'Auth state changed', { event, session: !!session })

// Force-flush the queue (logs are batched every 2 seconds by default)
await debugLog.flush()
```

### Parameters

| Param    | Type                        | Description                              |
|----------|-----------------------------|------------------------------------------|
| page     | `string`                    | The route path (e.g. `'/dashboard'`)     |
| message  | `string`                    | What happened                            |
| metadata | `Record<string, unknown>`   | Optional — any extra data to attach      |

### Configuration flags (in `debug-config.ts`)

| Flag           | Default                          | What it does                                           |
|----------------|----------------------------------|--------------------------------------------------------|
| `DEBUG_ENABLED`| `true` in development            | Master switch — set to `false` to disable all logging  |
| `MAX_LOG_ROWS` | `500`                            | Auto-prunes oldest rows per user. `0` = no limit       |

---

## File Reference

```
Your project after install:
├── lib/debug/
│   ├── debug-logger.ts       ← Import { debugLog } from here
│   └── debug-config.ts       ← PAGE_LABELS, HIDDEN_PATHS, flags
├── components/
│   └── debug-overlay.tsx     ← The visual panel (Cmd+Shift+D)
└── app/api/debug-logs/
    └── route.ts              ← GET (query logs) and DELETE (clear logs)
```
