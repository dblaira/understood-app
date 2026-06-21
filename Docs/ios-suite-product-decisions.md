# iOS Suite — Product Decisions (June 2026)

> Phase 1 answers for Understood / Notorious / Re_Call iOS surfaces.
> Canonical pattern steps: `types/adam-pattern.ts`

---

## Decision log

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Replace life areas with Adam Pattern steps? | **Yes on iOS.** Pattern step is the primary classifier for capture, filter, and card metadata. Life domains stay in backend for extractions/correlations only — not shown in iOS nav. | **Approved** |
| 2 | Is Pattern optional at capture? | **Yes.** Default `None`. Haunt-capture and apathy states must not force a step. AI may suggest a step async. | **Approved** |
| 3 | Show empty image placeholders? | **No.** Never render a gray/image box when no photo exists. Text-only cards are the default layout. | **Approved** |
| 4 | Where do photos live in the feed? | **Moments strip** — a horizontal carousel of entries that *have* images only. Hidden when count = 0. Main feed is text-first for all entries. | **Approved** |
| 5 | Camera from FAB | Must open `PhotosPicker` / camera on the **same sheet** as capture. FAB must not dismiss capture before picker presents. Requires `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in Info.plist. | **Bug — fix in iOS repo** |
| 6 | One ontology or three? | **One spine** (per Knowledge Graph Authority PDF). Pattern step is a *process* dimension; life domain is a *content* dimension. iOS shows process; web lab shows content for ontology work. | **Approved** |

---

## 1. Sunset life areas → Adam Pattern (iOS only)

### What changes

| Before | After |
|--------|-------|
| Filter/nav by 13 life domains (Exercise, Sleep, Work…) | Filter/nav by 8 pattern steps |
| Category pill on card | Pattern step label (or none) |
| AI infer returns `life_domains[]` as primary tag | AI may still infer domains silently; iOS displays `pattern_step` |

### What stays

- Historical entries keep their `category` / `life_domains` in Postgres
- Extraction pipeline and correlation matrix still use life domains
- Web lab (`understood.app`) can keep domain filters until a later migration

### Pattern step list

1. Context
2. Circle
3. Close the Gap
4. Choose Success
5. Code the Pattern
6. Create Kill Switch
7. Clear Sign of Success
8. Compound

Plus **None** in the picker (not stored — omit field or store `null`).

### DB field (recommended)

```sql
ALTER TABLE entries ADD COLUMN IF NOT EXISTS pattern_step TEXT
  CHECK (pattern_step IS NULL OR pattern_step IN (
    'Context', 'Circle', 'Close the Gap', 'Choose Success',
    'Code the Pattern', 'Create Kill Switch', 'Clear Sign of Success', 'Compound'
  ));
```

---

## 2. Camera button on FAB capture

### Symptom

Tapping camera while creating an entry from the FAB does nothing.

### Likely causes (check in order)

| Layer | Check |
|-------|-------|
| **Permission** | Info.plist has `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` with user-facing strings |
| **Presentation** | FAB opens capture via `.sheet`; camera picker opened from a *second* sheet or after dismiss — iOS drops it. Fix: use `.photosPicker` inline on capture sheet, or `.fullScreenCover` for camera |
| **State** | `@State showCamera` toggles but `PhotosPicker`/`UIImagePickerController` not bound to same view hierarchy as FAB sheet |
| **Action wiring** | Camera button only wired on Reminder/Action detail form, not on FAB quick-capture variant — duplicate capture views with divergent toolbars |
| **Upload path** | Picker fires but upload to Supabase Storage fails silently — add visible error toast |

### Acceptance test (Stop Sign 1)

1. Tap FAB → capture opens
2. Tap camera → system picker appears
3. Take or choose photo → thumbnail shows on capture form
4. Save → entry persists with image URL
5. If any step fails → in-app error message (not console only)

---

## 3. Images — display policy

### Problem

Empty placeholder boxes on homepage and carousel are distracting. Photos are high-meaning but sparse.

### Rule (matches web `entry-card.tsx` + `story-carousel.tsx`)

```
IF entry has real image URL AND load succeeds
  THEN show thumbnail (160px) or hero image
ELSE
  NO image region — card is text-only, full width
```

**Never** show:
- Gray placeholder rectangles
- Category typography placeholders (legacy web pattern — retired)
- Broken-image icons in the card layout slot

### Recommended iOS layout

```
┌─────────────────────────────────────┐
│  UP NEXT                            │
├─────────────────────────────────────┤
│  [Moments carousel — ONLY if ≥1     │
│   entry has images; else hidden]    │
├─────────────────────────────────────┤
│  Text-only card                     │
│  PATTERN · PRIORITY · #tag          │
│  Headline (Bodoni)                  │
│  Description                        │
├─────────────────────────────────────┤
│  Card WITH photo (when exists)      │
│  ┌──────┐  Headline                 │
│  │ img  │  Meta                      │
│  └──────┘  Description              │
└─────────────────────────────────────┘
```

### Moments vs feed

| Surface | Contents | When hidden |
|---------|----------|-------------|
| **Moments** | Horizontal scroll, image entries only, large crop | Zero image entries |
| **Up Next feed** | All entry types; image column optional per card | Never |
| **Entry detail** | Full gallery (up to 6 images) | N/A |

Photos become **special** by being grouped, not by leaving empty slots beside text-only entries.

---

## 4. Open questions (need Adam judgment)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| A | Should AI infer `pattern_step` from entry text? | (1) Yes async (2) Never (3) Suggest only | **(3) Suggest** — show chip "AI thinks: Close the Gap" with accept/dismiss |
| B | Filter tabs at bottom — Pattern steps or entry types? | (1) Steps (2) Reminder/Action/Event (3) Both | **(2) Entry types** for nav; Pattern as filter inside list |
| C | Migrate old entries to a pattern step? | (1) Bulk AI pass (2) Leave null (3) Manual only | **(2) Leave null** — only new captures get steps |
| D | Web app follows iOS pattern sunset? | (1) Now (2) iOS first (3) Never | **(2) iOS first** — web lab still needs domains for ontology |

---

## 5. iOS repo checklist (not in this workspace)

Repo path (per build plan): `/Users/adamblair/Developer/GitHub/Understood`

- [ ] Unify FAB capture and form capture into one `CaptureView` with shared toolbar (camera, save, pattern picker)
- [ ] Replace life-area filter enum with `AdamPatternStep` from API or bundled constant
- [ ] Remove empty `AsyncImage` placeholder backgrounds
- [ ] Add `MomentsCarouselView` filtered by `images.count > 0`
- [ ] Add `pattern_step` to Entry model + Supabase insert
- [ ] Camera permission strings in Info.plist
- [ ] In-app error states for camera/upload failures

---

## 6. API surface (web backend)

```
GET /api/pattern-steps
→ { steps: [{ id, label, hint }] }
```

iOS fetches once at launch; stays in sync with `types/adam-pattern.ts`.
