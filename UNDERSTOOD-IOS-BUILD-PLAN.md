# Understood — iOS App Build Plan

> **Capture** on iOS. **Compose** on the web.

This document is the complete build plan for the native SwiftUI iPhone app for Understood. It covers product vision, architecture, phased implementation, and App Store submission.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Architecture](#architecture)
3. [The Belief Engine — Three Surfacing Moments](#the-belief-engine--three-surfacing-moments)
4. [Phase 0: Environment + Learning](#phase-0-environment--learning-days-1-5)
5. [Phase 1: Authentication](#phase-1-authentication-week-1)
6. [Phase 2: Entry Feed + Detail](#phase-2-entry-feed--detail-weeks-2-3)
7. [Phase 3: Capture](#phase-3-capture-weeks-3-4)
8. [Phase 4: Belief Library](#phase-4-belief-library-weeks-5-6)
9. [Phase 5: Push Notifications via APNs](#phase-5-push-notifications-via-apns-weeks-7-8)
10. [Phase 6: Design System + Polish](#phase-6-design-system--polish-weeks-9-10)
11. [Phase 7: TestFlight + App Store](#phase-7-testflight--app-store-weeks-11-12)
12. [Changes to the Existing Web Codebase](#changes-to-the-existing-web-codebase)
13. [iOS Project Structure](#ios-project-structure)
14. [Estimated Timeline](#estimated-timeline)
15. [The Learning Curve, Honestly](#the-learning-curve-honestly)

---

## Product Vision

Two tools, two modes of thinking.

### iOS: "Capture"

The moment is happening. You just had a conversation with your boss, a friend said something that stuck, a pattern repeated itself. You open the app, write it down with minimal friction. The AI does the heavy lifting after you close the app:

- Infers which beliefs are at play ("You tend to assume good intent gets rewarded in hierarchies")
- Links this entry to past experiences that validate or challenge that belief
- Surfaces connections you didn't consciously make ("This is the third time this month a social situation triggered your scarcity pattern")
- Rewrites the entry in different voices so you can see the same event through different lenses

The user's job is just: **write what happened.** Everything else is automated inference.

### Web: "Composition"

It's Sunday evening. You want to understand your week, your month, your quarter. You open the web app and see the panoramic view — timelines of entries, clusters of beliefs, patterns across life areas. You "compose" by pulling threads together:

- Mind maps that show how beliefs connect across Business, Social, Romance, Health
- Long-form narratives that weave multiple entries into a coherent story
- PDF exports that crystallize a period of growth into something you can hold
- Deep dives into a single belief and every experience that shaped it

The user's job here is: **see the bigger picture and make meaning from it.**

### Why This Split Works

The phone is for motion, the moment, between things. Capture should feel like texting yourself. The desktop is for seated, reflective, unhurried work. Composition should feel like editing a magazine.

The AI is the bridge. It takes raw captures and builds the connective tissue that makes composition possible later.

### iOS Feature Set

| Feature | Purpose |
|---|---|
| Quick capture | Text entry, voice-to-text, minimal fields |
| Belief inference | AI reads the entry and tags relevant beliefs/connections |
| Connection feed | A stream of "here's what the AI noticed" — validated beliefs, new patterns, contradictions |
| AI rewrites | The 4 voice versions, so users can see events from different angles |
| Notification nudges | "A belief you captured last week just showed up again" — the app reaches out to you |
| Entry reading | Beautiful presentation of past entries with their connections |

**Deliberately excluded from iOS:**
- Mind maps
- PDF/document export
- Long-form story composition
- Deep analytics
- Settings management (beyond basic preferences)
- Admin features

That absence is the product decision. The iOS app is fast because it doesn't try to do everything.

---

## Architecture

The iOS app is a native SwiftUI client that shares the same Supabase backend as the web app. It connects directly to Supabase for auth and data, and calls existing Vercel API routes for AI operations (inference, version generation). Both apps read and write the same database — no data migration needed.

```
┌─────────────────────────────────────────────────────────┐
│                   User-Facing Apps                      │
│                                                         │
│   ┌─────────────────┐       ┌─────────────────┐        │
│   │  Next.js Web App│       │ SwiftUI iOS App │        │
│   │    (Vercel)     │       │   (App Store)   │        │
│   └────────┬────────┘       └────────┬────────┘        │
└────────────┼─────────────────────────┼──────────────────┘
             │                         │
             ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Shared Backend                        │
│                                                         │
│   ┌─────────────────┐       ┌─────────────────┐        │
│   │    Supabase     │       │ Vercel API Routes│       │
│   │ Auth + DB + RLS │◄──────│ AI + Cron + PDF │        │
│   └─────────────────┘       └─────────────────┘        │
└─────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                 Apple Services (new)                     │
│                                                         │
│   ┌─────────────────┐                                   │
│   │      APNs       │──────► Delivers to iOS device     │
│   └─────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- Target **iOS 17+** (enables `@Observable` macro, modern NavigationStack, and the latest SwiftUI features — covers 90%+ of active iPhones)
- Use **supabase-swift v2.0** via Swift Package Manager for auth and database
- AI operations stay server-side — the iOS app calls Vercel endpoints over HTTPS
- Push notifications switch from Web Push/VAPID to **APNs** for iOS devices (the web app keeps web push)
- Start **online-only** — no offline caching in V1

---

## The Belief Engine — Three Surfacing Moments

The belief system has four types that map to four distinct cognitive needs:

| Type | What it does | When it matters |
|---|---|---|
| **Identity Anchor** | "This is who I am when I'm settled" | When social pressure is pulling you off-center |
| **Pattern Interrupt** | "Zoom out — you're in the weeds" | When you're spiraling or over-indexing on a moment |
| **Validated Principle** | "This conclusion was earned, not guessed" | When you're second-guessing yourself |
| **Process Anchor** | "Here's the specific sequence that works" | When you know *what* but forgot *how* |

A scoring engine decides *which* belief to surface *when*, based on time windows, staleness, how often the user said "this landed" versus "snooze," priority, and a touch of randomness.

### Moment 1: "After I Write" (Inference)

The user just wrote an entry about a frustrating meeting where their boss took credit for their idea. They hit save. They're about to put their phone down.

**What happens:**

The AI processes the entry via existing `infer-entry` and `infer-enrichment` routes. On iOS, a card slides up from the bottom — not a modal, not a popup, just a card that rises gently:

> **Connected to a belief you hold:**
> *"People in hierarchies optimize for visibility, not truth."*
> Validated Principle · surfaced 4 times · landed 3

The user can:
- **Tap the belief** to see every entry that connects to it (the lineage trail)
- **Tap "This landed"** to strengthen the signal
- **Swipe away** to dismiss without penalty

If the AI detects a *new* belief — something the user has never articulated before — the card says:

> **The AI noticed something new:**
> *"You expect reciprocity in professional relationships but rarely receive it."*
> Tap to save to your belief library

The card is a native iOS sheet (`.presentationDetent` in SwiftUI). It responds to swipe gestures. It has haptic feedback when the belief card appears.

### Moment 2: "During My Day" (Surfacing)

It's 2pm. The user hasn't opened the app. They're about to walk into a meeting with the same boss from this morning.

**What happens:**

A push notification arrives — not from the entry they wrote today, but from a belief the scoring engine selected:

> **Pattern Interrupt**
> "When you feel unseen, check whether you're performing for the wrong audience."

The user pulls down the notification. Two actions:
- **"This Landed"** — the belief resonated. Counter increments. Next time it scores higher.
- **"Not Now"** — snooze. No penalty, but it won't come back for 48 hours.

If they tap into the notification, the app opens to a **belief detail view** that shows:
- The belief text, large and prominent (Level 1 treatment — Bodoni Moda, hero styling)
- **The trail:** a compact timeline of every entry that connects to this belief, most recent first
- Each entry shows: date, headline, one-line preview, context (mood, energy, environment)
- A quiet stat line: "Surfaced 6 times · Landed 5 · Last connected: today"

### Moment 3: "When I'm Browsing" (The Belief Library)

Sunday evening. The user opens the app with no specific intent.

**What they see:**

**Top: "Active Belief"** — a single belief card, the one the scoring engine considers most relevant right now. It rotates on each visit. Just the belief text, its type badge, and the landed/surface ratio rendered as a simple confidence bar.

**Below: "Recent Captures"** — the last 5–7 entries, each showing its headline, timestamp, and a small chip showing which belief it connected to. Entries without connections just show the entry. Entries with connections show the thread.

**Tab: "Beliefs"** — a dedicated tab that shows the full belief library, organized by the four types. Each belief shows the text, type badge, strength indicator, last surfaced date, and number of connected entries.

### The Inference Loop

```
User writes entry
      │
      ▼
AI infers beliefs ──► Belief library grows
      │                       │
      │                       ▼
      │               Scoring engine evaluates
      │                       │
      │                       ▼
      │               Right belief, right moment
      │                       │
      │                       ▼
      │               User: "This landed" or "Not now"
      │                       │
      └───────────────────────┘
              (feedback loop)
```

Every capture makes the system smarter. Every "this landed" or "not now" refines what surfaces next. Over weeks and months, the app learns not just *what* the user believes, but *when* those beliefs matter most.

---

## Phase 0: Environment + Learning (Days 1–5)

**Goal:** Get Xcode running, learn enough Swift/SwiftUI to be dangerous, and have a blank app on your physical iPhone.

### Steps

1. **Apple Developer Account setup**
   - Log into [developer.apple.com](https://developer.apple.com) with your existing account
   - Verify your membership is active ($99/year — check if it needs renewal)
   - Create a new App ID in Certificates, Identifiers & Profiles (e.g., `com.understood.journal`)
   - Enable Push Notifications capability on the App ID

2. **Xcode setup**
   - Install Xcode 16 from the Mac App Store (~12GB)
   - Create a new project: File > New > Project > iOS > App
   - Interface: SwiftUI, Language: Swift, Storage: None
   - Bundle Identifier: `com.understood.journal`
   - Team: your Apple Developer account

3. **Learn SwiftUI basics** (2–3 days of hands-on exploration)
   - Apple's official tutorial: [developer.apple.com/tutorials/swiftui](https://developer.apple.com/tutorials/swiftui) — do the first 3 sections
   - Focus on: `Text`, `VStack`/`HStack`, `List`, `NavigationStack`, `@State`, `@Observable`
   - It feels like React with different names: `View` = component, `@State` = `useState`, `body` = `render`

4. **Run on your iPhone**
   - Connect your iPhone via USB
   - Select it as the build target in Xcode
   - Hit Run (Cmd+R) — Xcode handles signing automatically
   - Confirm the blank app launches on your device

**Deliverable:** A blank SwiftUI app running on your physical iPhone, ready for real code.

---

## Phase 1: Authentication (Week 1)

**Goal:** User can log in with their existing Supabase account and see a "Welcome" screen.

### Steps

1. **Add Supabase Swift package**
   - In Xcode: File > Add Package Dependencies
   - URL: `https://github.com/supabase/supabase-swift.git`
   - Version: 2.0.0+
   - Add the `Supabase` product to your target

2. **Create Supabase client** — a single shared instance

   ```swift
   import Supabase

   let supabase = SupabaseClient(
     supabaseURL: URL(string: "YOUR_SUPABASE_URL")!,
     supabaseKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
   )
   ```

3. **Build login screen**
   - Email + password fields (matching existing Supabase Auth setup)
   - Call `supabase.auth.signIn(email:password:)` on submit
   - On success, navigate to the main app
   - On failure, show error message

4. **Session management**
   - Check `supabase.auth.session` on app launch
   - If session exists, skip login and go to main app
   - If not, show login screen
   - Handle session refresh automatically (Supabase Swift SDK does this)

5. **Protected navigation**
   - Root view checks auth state
   - Logged in: show `MainTabView`
   - Logged out: show `LoginView`

**Deliverable:** Existing web app users can log into the iOS app with the same credentials.

---

## Phase 2: Entry Feed + Detail (Weeks 2–3)

**Goal:** User sees their journal entries and can tap into a full entry view with AI versions.

### Steps

1. **Define Swift data models** — mirror the TypeScript types from `types/index.ts`

   ```swift
   struct Entry: Codable, Identifiable {
     let id: String
     var headline: String
     var category: String
     var subheading: String?
     var content: String
     var mood: String?
     var versions: [Version]?
     var generatingVersions: Bool?
     var entryType: String?
     var connectionType: String?
     var createdAt: String
     var metadata: EntryMetadata?
   }

   struct Version: Codable {
     let name: String
     let title: String
     let content: String
     var headline: String?
     var body: String?
   }
   ```

2. **Build entry feed** — a SwiftUI `List` fetching from Supabase

   ```swift
   let entries: [Entry] = try await supabase
     .from("entries")
     .select()
     .eq("entry_type", value: "story")
     .order("created_at", ascending: false)
     .limit(20)
     .execute()
     .value
   ```

3. **Entry feed UI**
   - Each row shows: category label (Level 4), headline (Level 3 — Bodoni Moda), timestamp, mood chip
   - Pull-to-refresh
   - Tap navigates to detail view

4. **Entry detail view**
   - Hero section with headline, subheading, category
   - Content body (Inter, readable line height)
   - AI versions section: horizontal tabs or swipeable cards for Literary, News, Poetic
   - If `generating_versions` is true, show skeleton loading state

5. **Trigger version generation** — if an entry has no versions yet, call the existing Vercel API route:
   - `POST https://your-app.vercel.app/api/generate-versions`
   - Same payload the web app sends
   - Poll or listen for completion, then refresh

**Deliverable:** User can browse their journal and read entries with AI rewrites.

---

## Phase 3: Capture (Weeks 3–4)

**Goal:** User can write a new entry with minimal friction. AI infers context and beliefs automatically.

### Steps

1. **Capture screen** — the iOS app's signature interaction
   - Large text field (headline auto-focuses on open)
   - Category selector (7 pills in a horizontal scroll)
   - Content area (multiline, generous height)
   - Minimal chrome — the screen is mostly empty space and the keyboard

2. **Auto-captured context** — happens silently on save
   - Timestamp, day of week, time of day (morning/afternoon/evening/night)
   - Device: always `"mobile"`
   - Location: request permission, capture GPS, reverse geocode

3. **Save to Supabase** — insert into the entries table
   - Same fields the web app writes
   - Set `entry_type: "story"` by default

4. **Trigger AI inference** — after save, call two Vercel API routes in parallel:
   - `POST /api/infer-entry` — classifies the entry, detects if it contains a belief
   - `POST /api/infer-enrichment` — infers activity, energy, mood, environment, trigger
   - Update the entry's metadata with enrichment results

5. **Post-capture belief card** — the Moment 1 experience
   - If `infer-entry` returns `entry_type: "connection"`, show a card:
     - "The AI noticed something: [belief text]"
     - "Save to belief library" / "Dismiss"
   - If the entry connects to an *existing* belief, show:
     - "This connects to: [belief text]"
     - Belief type badge, landed count
   - Card appears as a SwiftUI `.sheet` with `.presentationDetent([.fraction(0.3)])` — a small bottom sheet
   - Subtle haptic on appearance (`UIImpactFeedbackGenerator(style: .light)`)

6. **Floating action button** — always accessible from any tab
   - "+" button in bottom-right or as a prominent tab bar item
   - Tapping it opens the capture screen instantly

**Deliverable:** User can capture an entry in under 30 seconds, and the AI connects it to their belief library automatically.

---

## Phase 4: Belief Library (Weeks 5–6)

**Goal:** User can browse, read, and interact with their beliefs.

### Steps

1. **Beliefs tab** — dedicated tab in the bottom navigation
   - Fetch entries where `entry_type = 'connection'`
   - Group by `connection_type` (4 sections)
   - Each belief shows: text, type badge, strength indicator (landed/surfaced ratio)

2. **Belief detail view** — the Moment 2 experience when browsing
   - Belief text: large, Bodoni Moda, hero treatment
   - Type badge (Identity Anchor, Pattern Interrupt, etc.)
   - Stats row: surfaced count, landed count, last surfaced date
   - **Connected entries list:** all entries where `source_entry_id` links to this belief, shown as a compact timeline
   - Each connected entry shows: date, headline, one-line content preview, context chips (mood, energy)
   - Action buttons: "This Landed" / "Not Now"

3. **Belief strength visualization**
   - Simple progress bar: `landed_count / surface_count`
   - Color: crimson fill on muted background
   - No numbers — just a visual ratio

4. **Active Belief card** — on the home/feed tab
   - Top of the feed: a single featured belief (highest score from the scoring algorithm)
   - Rotates on each app open
   - Tapping navigates to belief detail

5. **Manual belief extraction** (stretch goal for this phase)
   - Long-press on text in an entry detail view
   - "Save as belief" option in context menu
   - Opens a sheet to confirm type and save

**Deliverable:** User can see their full belief library, understand which beliefs are strongest, and trace the experiences behind each one.

---

## Phase 5: Push Notifications via APNs (Weeks 7–8)

**Goal:** The scoring engine surfaces beliefs via native iOS push notifications with actionable responses.

### Steps

1. **APNs setup in Apple Developer Portal**
   - Create an APNs Authentication Key (Key ID + .p8 file) in Certificates, Identifiers & Profiles > Keys
   - Download the .p8 file — you'll upload it to your server
   - Note your Team ID (visible in account settings)

2. **Enable push in Xcode**
   - Target > Signing & Capabilities > + Capability > Push Notifications
   - Also add Background Modes > Remote notifications

3. **Register device token** — when the app launches:

   ```swift
   UIApplication.shared.registerForRemoteNotifications()
   ```

   In your AppDelegate (bridged from SwiftUI):

   ```swift
   func application(
     _ app: UIApplication,
     didRegisterForRemoteNotificationsWithDeviceToken token: Data
   ) {
     let tokenString = token.map {
       String(format: "%02x", $0)
     }.joined()
     // Send tokenString to your server
   }
   ```

4. **New API route on Vercel: `POST /api/push/register-ios`**
   - Receives: `{ user_id, device_token, device_name }`
   - Stores in a new `ios_push_tokens` table (or add a `platform` column to existing `push_subscriptions`)
   - Separate from web push subscriptions

5. **Modify `evaluate-connections` cron job**
   - After scoring and selecting a connection to surface, check if the user has iOS device tokens
   - If yes, send via APNs (use a library like `apns2` on the server, or call APNs HTTP/2 API directly)
   - If they also have web push subscriptions, send both
   - The APNs payload includes:
     - Title: connection type label
     - Body: belief text (truncated to 200 chars)
     - Category: `"CONNECTION"` (enables action buttons)
     - Custom data: `{ connection_id: "..." }`

6. **Notification actions**
   - Register a `UNNotificationCategory` named `"CONNECTION"` with two actions:
     - `"LANDED"` — "This Landed" (foreground action)
     - `"SNOOZE"` — "Not Now" (background action)
   - When user taps an action, the app calls the existing `/api/notifications/response` endpoint
   - When user taps the notification body, open the app to the belief detail view

7. **Permission prompt**
   - On first launch after login, show a pre-permission screen explaining what notifications do (not the system prompt — your own branded screen)
   - Then trigger the system permission dialog
   - Store preference

**Deliverable:** Beliefs surface via native iOS notifications at the right time, and user responses feed back into the scoring engine.

---

## Phase 6: Design System + Polish (Weeks 9–10)

**Goal:** The app looks and feels like "Understood" — same editorial quality as the web app, but native.

### Steps

1. **Typography**
   - Add Bodoni Moda and Inter as custom fonts in the Xcode project (add .ttf/.otf files to the target, update Info.plist)
   - Create a `Typography` enum with presets matching the design system levels:
     - `.hero` — Bodoni Moda, 34pt (scales with Dynamic Type)
     - `.sectionTitle` — Bodoni Moda, 28pt
     - `.cardHeadline` — Bodoni Moda, 20pt
     - `.body` — Inter, 15pt
     - `.metadata` — Inter, 11pt, uppercase, tracking 0.08em

2. **Color system**
   - Define colors in an Asset Catalog or Swift extension matching the CSS variables:
     - `.understoodCrimson` = `#DC143C`
     - `.understoodCream` = `#F5F0E8`
     - `.textPrimary` = `#000000`
     - `.textMuted` = `#666666`
     - `.borderLight` = black at 5% opacity

3. **Component library** — SwiftUI equivalents of key components:
   - `CategoryBadge` — Level 4 treatment (red, uppercase, letterspaced)
   - `BeliefCard` — the belief display unit with type badge and strength bar
   - `EntryRow` — the feed item with headline, category, timestamp
   - `CaptureSheet` — the entry creation view

4. **Animations and haptics**
   - Belief card appearance: slide up + light haptic
   - Pull-to-refresh: native iOS behavior (free with SwiftUI `List`)
   - Tab switching: default iOS tab bar animation
   - "This Landed" button: success haptic (`UINotificationFeedbackGenerator`)
   - Card tap: subtle scale-down on press (`.scaleEffect` with `.onLongPressGesture`)

5. **Loading and error states**
   - Skeleton views for entry feed (animated placeholder rectangles)
   - AI generation spinner (when waiting for versions or inference)
   - Error alerts for network failures
   - Empty states for new users ("Write your first entry")

6. **App icon and launch screen**
   - Design app icon (1024x1024 for App Store, Xcode generates all sizes)
   - Launch screen: dark background, "Understood." in Bodoni Moda, centered

**Deliverable:** The app feels premium, editorial, and intentionally designed — matching the web app's quality bar.

---

## Phase 7: TestFlight + App Store (Weeks 11–12)

**Goal:** The app is in the App Store.

### Steps

1. **App Store Connect setup**
   - Log into [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Create a new app record (name: "Understood", bundle ID: your app ID)
   - Fill in metadata: description, keywords, support URL, privacy policy URL

2. **TestFlight beta**
   - In Xcode: Product > Archive
   - Upload to App Store Connect
   - Add yourself as a tester in TestFlight
   - Install via TestFlight app on your iPhone
   - Test all flows: login, capture, belief library, notifications
   - Invite 2–3 trusted testers for feedback

3. **App Store screenshots**
   - Capture screenshots on iPhone 15 Pro Max simulator (required size)
   - Key screens: entry feed, capture flow, belief detail, notification
   - Optional: use a tool like Fastlane or Screenshots.pro for framing

4. **Privacy and review prep**
   - Privacy policy page (required — can be a simple page on the Vercel site)
   - App Review will ask what the login credentials are — provide a demo account
   - Data collection disclosure: what data you collect, why, whether it's linked to identity
   - If using location: explain why in the permission prompt string

5. **Submit for review**
   - App Review typically takes 24–48 hours
   - Common rejection reasons: missing login info for reviewers, privacy policy issues, crashes
   - After approval, you control when it goes live

6. **StoreKit 2 subscriptions** (V4 prep — can be a fast-follow, not blocking launch)
   - Set up subscription group in App Store Connect
   - Define tiers and pricing
   - Implement StoreKit 2 in the app (Apple's modern subscription API)
   - Note: Apple takes 15% (Small Business Program) or 30% of subscription revenue

**Deliverable:** "Understood" is live in the App Store.

---

## Changes to the Existing Web Codebase

The web app stays untouched except for three additions:

| Change | File | What |
|---|---|---|
| iOS push token registration | New: `app/api/push/register-ios/route.ts` | Receives and stores APNs device tokens |
| APNs delivery in cron | Modified: `app/api/cron/evaluate-connections/route.ts` | Sends via APNs in addition to web push |
| Platform column | Database migration | Add `platform` field to `push_subscriptions` table to distinguish web vs iOS |

Everything else is additive — a new Xcode project alongside the existing Next.js project.

---

## iOS Project Structure

```
Understood/
  UnderstoodApp.swift              -- App entry point
  Services/
    SupabaseService.swift          -- Supabase client + auth
    APIService.swift               -- Calls to Vercel API routes
    NotificationService.swift      -- APNs registration + handling
  Models/
    Entry.swift                    -- Entry, Version, EntryMetadata
    Connection.swift               -- Connection types, SurfaceConditions
    User.swift                     -- User session model
  Views/
    Feed/
      FeedView.swift               -- Entry list
      EntryRow.swift               -- Single entry in list
      EntryDetailView.swift        -- Full entry view with versions
    Capture/
      CaptureView.swift            -- Entry creation
      PostCaptureSheet.swift       -- Belief inference result
    Beliefs/
      BeliefLibraryView.swift      -- All beliefs by type
      BeliefDetailView.swift       -- Single belief with timeline
      BeliefCard.swift             -- Reusable belief display
    Auth/
      LoginView.swift              -- Login screen
    Components/
      CategoryBadge.swift          -- Reusable category label
      StrengthBar.swift            -- Belief strength indicator
      SkeletonView.swift           -- Loading placeholders
  Design/
    Typography.swift               -- Font presets
    Colors.swift                   -- Color definitions
    Haptics.swift                  -- Haptic feedback helpers
  Resources/
    Fonts/                         -- Bodoni Moda + Inter .otf files
    Assets.xcassets/               -- App icon, colors
```

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 0: Environment + Learning | 5 days | Week 1 |
| Phase 1: Authentication | 5 days | Week 2 |
| Phase 2: Entry Feed + Detail | 8 days | Weeks 3–4 |
| Phase 3: Capture + Inference | 8 days | Weeks 4–5 |
| Phase 4: Belief Library | 8 days | Weeks 6–7 |
| Phase 5: Push Notifications | 8 days | Weeks 8–9 |
| Phase 6: Design + Polish | 8 days | Weeks 10–11 |
| Phase 7: TestFlight + App Store | 5 days | Week 12 |

**Total: ~12 weeks to App Store.** This assumes part-time work (a few hours per day). Full-time focus could compress this to 6–8 weeks.

---

## The Learning Curve, Honestly

Swift and SwiftUI will feel foreign for about 3 days. Then it'll start clicking because:

- SwiftUI is declarative, like React — you describe what the UI should look like
- Swift has `async/await`, just like TypeScript
- Supabase's Swift client has the same `.from().select().eq()` query pattern
- You already understand the data model, the business logic, and the product

The hardest parts will be:

- **Xcode** — it's a complex IDE with a lot of panels and settings. Give yourself grace here.
- **Signing and provisioning** — Apple's certificate system is confusing the first time. It's a checklist, not a concept.
- **APNs setup** — the server-side push notification integration has multiple moving parts.

None of these are intellectual challenges. They're administrative hurdles that every iOS developer has crossed exactly once.

### Swift Concepts That Map to TypeScript

| TypeScript | Swift | Notes |
|---|---|---|
| `interface` | `struct` (with `Codable`) | Structs are value types in Swift |
| `useState` | `@State` | Same idea — triggers re-render on change |
| `useContext` | `@Environment` | Dependency injection via the view tree |
| `async/await` | `async/await` | Nearly identical syntax |
| `null` / `undefined` | `nil` (with Optionals) | Swift makes you handle nil explicitly with `?` and `!` |
| `map`, `filter`, `reduce` | `map`, `filter`, `reduce` | Same functional patterns |
| Component | `View` (with `body` property) | Declarative UI composition |
| Props | Init parameters | Passed to view's initializer |
| `fetch()` | `URLSession` or Supabase client | HTTP calls |

### Recommended Learning Path

1. **Days 1–3:** Apple's SwiftUI tutorial (first 3 sections)
2. **Days 4–5:** Supabase's iOS quickstart guide
3. **Week 2:** Build the login screen (Phase 1) — learning by doing
4. **Ongoing:** Reference Swift documentation when you hit something unfamiliar

The best way to learn is to start building Phase 1. Everything after that is incremental.
