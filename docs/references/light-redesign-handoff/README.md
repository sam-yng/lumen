# Handoff: Lumen light-theme redesign (web app + marketing)

## Overview

This package documents a **redesign of Lumen** — the private study workspace
(*Notion for study; Granola for seminars; Word with an intuitive file directory*).
Lumen v1 shipped **dark-first**; this redesign moves **both products** to a clean,
**Notion-inspired light theme** with **skinnier chrome** and tightened component
design:

- **`apps/web`** (the study workspace — **priority**): light surfaces, a 240px
  sidebar (was 280px), a 44px top bar (was 52px), ~29px tree/list rows, 32px
  controls (was 38px), hairline borders, and soft low shadows.
- **`apps/marketing`** (the public landing page): a light uplift with a
  Notion-style **centered hero** (eyebrow → headline → sub-copy → CTAs, product
  shot full-width beneath), centered section intros, and a **"Coming soon"**
  treatment for all Claude-key / AI features (dashed outline cards, a badge, and a
  "Notify me" email capture).

## About the design files

The files in this bundle are **design references created in HTML** — prototypes
that show the intended look and behavior. They are **not** production code to copy
directly. The task is to **recreate these designs inside the existing Lumen
codebase** (`sam-yng/lumen` — Bun + Next.js 16 + React + Tailwind v4 +
`packages/ui` tokens + shadcn-style primitives + `lucide-react`), using its
established patterns.

Concretely, this redesign maps onto the real repo like this:

- The token values below replace the dark values in
  **`packages/ui/src/styles/tokens.css`** (and the `@theme`/`:root` blocks in
  `apps/web/src/app/globals.css` + `apps/marketing/src/app/globals.css`).
- The component sizing/treatment maps onto the existing
  **`apps/web/src/components/ui/*`** (button, input, card, …) and the feature
  components in **`apps/web/src/components/{library,editor,transcripts,search}`**.
- The marketing changes map onto **`apps/marketing/src/components/*`**
  (`hero.tsx`, `feature-grid.tsx`, `how-it-works.tsx`, `final-cta.tsx`, `app-mock.tsx`).

## Fidelity

**High-fidelity.** Final colors, typography, spacing, radii, shadows, and
interaction states are all specified below and in the HTML. Recreate the UI
pixel-perfectly using the codebase's existing libraries (Tailwind tokens, shadcn
primitives, `lucide-react`, TipTap for the editor). Where the HTML uses plain CSS
classes (`.lui-*`, `.l-*`), translate them to the equivalent Tailwind/shadcn
component in the repo — keep the *values*, not the literal class names.

---

## Design tokens

All tokens are authored in **OKLCH** so a future dark theme can be reintroduced by
overriding one scope. The canonical source is `tokens/colors.css`,
`tokens/typography.css`, and `tokens/spacing.css` in this bundle. Approximate hex
equivalents are given for convenience.

### Color — neutrals (light)

| Token | OKLCH | ~hex | Role |
|---|---|---|---|
| `--canvas` | `oklch(1 0 0)` | `#ffffff` | App background (pure white) |
| `--surface` | `oklch(0.985 0.0015 274)` | `#fafafb` | Sidebar / panels (off-white) |
| `--surface-2` | `oklch(0.971 0.002 274)` | `#f4f4f6` | Cards / inputs / raised |
| `--surface-3` | `oklch(0.948 0.003 274)` | `#ededf0` | Hover / pressed raised |
| `--surface-inset` | `oklch(0.992 0.001 274)` | `#fbfbfc` | Faint inset wells |
| `--border` | `oklch(0.916 0.003 274)` | `#e4e4e8` | Hairline border |
| `--border-soft` | `oklch(0.94 0.0025 274)` | `#ececef` | Subtle divider |
| `--border-strong` | `oklch(0.86 0.004 274)` | `#d3d3da` | Emphasis hairline |
| `--text` | `oklch(0.285 0.008 274)` | `#2e2e36` | Primary ink |
| `--text-2` | `oklch(0.46 0.009 274)` | `#5f5f6b` | Secondary |
| `--text-3` | `oklch(0.6 0.009 274)` | `#84848f` | Muted / meta |
| `--text-4` | `oklch(0.72 0.008 274)` | `#a8a8b1` | Faint / disabled |

### Color — accent (iris) & status

The accent is a single hue knob: `--accent-h: 282`. Re-weighted darker (L≈0.56)
vs. the dark theme so it carries contrast on white. **Use it sparingly** — the one
primary action, selection tint + 2px left bar, focus rings, inline links.

| Token | OKLCH | ~hex | Role |
|---|---|---|---|
| `--accent` | `oklch(0.56 0.19 282)` | `#7c5cff` | Fills / primary action |
| `--accent-bright` | `oklch(0.5 0.2 282)` | `#6a44f5` | Hover (darkens) |
| `--accent-deep` | `oklch(0.44 0.19 282)` | `#5a37d6` | Pressed / ring |
| `--accent-text` | `oklch(0.52 0.2 282)` | `#6e4cf0` | Accent as inline text |
| `--accent-soft` | `accent / 9%` | — | Selection / tint bg |
| `--accent-softer` | `accent / 5%` | — | Faint tint |
| `--accent-line` | `accent / 32%` | — | Focus border |
| `--accent-glow` | `accent / 22%` | — | Soft aura |
| `--on-accent` | `oklch(0.99 0 0)` | `#fdfdfd` | Text on filled accent |
| `--ok` | `oklch(0.56 0.13 158)` | `#2f9e6e` | done / transcribed |
| `--busy` | `oklch(0.54 0.15 244)` | `#3a7bd5` | processing |
| `--warn` | `oklch(0.64 0.13 70)` | `#cf8a2b` | pending / queued |
| `--danger` | `oklch(0.55 0.19 18)` | `#d6453f` | failed / error |

Each status color has a `-soft` companion at 11–14% opacity for badge
backgrounds.

### Typography

Three families. **Geist** (UI chrome), **Newsreader** (reading surfaces — note
bodies, transcript text, big editorial headlines), **Geist Mono** (meta:
timestamps, counts, file sizes, keycaps, uppercase section labels). In the repo
these are loaded via `next/font`; in this bundle via Google Fonts.

| Token | Value | Use |
|---|---|---|
| `--t-display` | `600 28px/1.18` Geist | Large display |
| `--t-h1` | `600 20px/1.25` Geist | Page title |
| `--t-h2` | `600 16px/1.35` Geist | Section title |
| `--t-body` | `400 14px/1.55` Geist | Body |
| `--t-sm` | `400 13px/1.5` Geist | Secondary |
| `--t-xs` | `500 12px/1.4` Geist | Labels |
| `--t-meta` | `500 11.5px/1.35` Geist **Mono** | Timestamps / counts |
| `--t-read` | `400 16.5px/1.7` Newsreader | Note / transcript body |
| `--t-read-h1` | `600 30px/1.2` Newsreader | Note heading |

Tracking: headings `-0.014em`, body `-0.003em`. Section labels/eyebrows are
uppercase mono with `letter-spacing: .05em`.

### Spacing, shape & motion

- **Spacing:** 4px base — `--s1:4 --s2:8 --s3:12 --s4:16 --s5:22 --s6:30 --s7:44`
  (density-aware via `--density`).
- **Chrome sizing (the redesign):** `--sidebar-w:240px`, `--topbar-h:44px`,
  `--row-h:~29px`, `--control-h:32px`, `--control-h-sm:27px`.
- **Radius:** `--r-sm:3 --r:5 --r-lg:8 --r-xl:12 --r-pill:999`. Skinny — cards use
  `--r-lg`, large frames `--r-xl`, chips/badges pill.
- **Elevation (light):** soft low shadow + hairline ring, never heavy drops.
  - `--shadow-sm: 0 1px 2px oklch(0.2 0.02 274 / 6%)`
  - `--shadow-card: 0 1px 2px …/5% , 0 0 0 1px var(--border-soft)`
  - `--shadow-pop: 0 14px 40px -12px …/18% , 0 2px 8px -2px …/8% , 0 0 0 1px var(--border)`
  - `--shadow-accent: 0 8px 22px -12px var(--accent-glow)` (primary button only)
- **Motion:** transitions `0.12–0.16s` on `--ease cubic-bezier(0.32,0.72,0,1)`.
  Hover = bg/border color shift; press = `translateY(0.5px)`. Respect
  `prefers-reduced-motion`. Never use `scrollIntoView` for the transcript
  auto-scroll — use `element.scrollTo({ top, behavior: 'smooth' })`.

---

## Screens / views

### 1. Auth (`apps/web` — `auth-form.tsx`)
- **Layout:** two columns (`1.05fr / 1fr`), full viewport height.
  - **Left (brand panel):** `--surface` bg, a soft accent aurora (blurred radial,
    `--accent-glow`) top-left, the wordmark, a Newsreader 38px headline ("Turn
    lectures into a searchable study system."), sub-copy, and a 4-item feature
    list (28px accent-soft icon tiles + label). Footer line: "Private by default ·
    your recordings never leave your machine".
  - **Right (form card):** centered, max 340px, `--shadow-pop`, 26px padding.
    "Continue with Google" outline button → mono "or" divider → Email + Password
    inputs → filled "Log in" button → "Need an account? Sign up" link.

### 2. Library workspace (`apps/web` — `library-shell` + `library-sidebar` + `library-workspace`/`library-content`)
- **Layout:** flex row, full height. Sidebar (240px) + main column.
- **Sidebar** (`--surface`, `1px --border-soft` right border):
  - Header: wordmark + settings icon button; then a grid row of "New note"
    (filled, sm) + a search icon button (outline, sm).
  - Nav list (30px rows, 8px gap-2 icon+label): Library (active), Recents
    (disabled), Tags, **Ask Lumen** (accent icon, disabled, "soon" badge). Active
    row = `--accent-soft` bg + `--accent-text`.
  - "LIBRARY" mono uppercase label + FolderPlus button; recursive **folder tree**
    (rows = `--row-h`, indent 14px/level, chevron rotates 90° when open, selected
    row gets `--accent-soft` bg + a 2px `--accent` left bar).
  - "TAGS" section: colored-dot tag pills (wrap). Selected tag = accent-soft.
  - Footer: avatar + workspace name + email + logout icon button.
- **Main column:**
  - **Top bar** (44px, `1px --border-soft` bottom): breadcrumb (Library / … /
    folder, ChevronRight separators) on the left; Search icon, "Upload" (outline
    sm), "New note" (filled sm) on the right.
  - **Content** (centered, max 880px, 20×28px padding): h1 folder name + mono item
    count; **filter chips** row ("Filter" label + All + tag pills, 26px pills,
    selected = accent-soft border+bg+text); then grouped lists ("FOLDERS",
    "NOTES & FILES") inside a `--r-lg` hairline container.
  - **Item row** (8px vertical, `--border-soft` bottom divider): a 30px rounded
    icon tile (recording = `--busy-soft`/`--busy`; folder = accent-soft; doc/file =
    `--surface-2`) + title (`--t-sm` 500) + mono meta line; right side = tag pills,
    status badge, and a MoreHorizontal button that fades in on row hover.
  - **Empty state:** dashed `--border-strong` box, 44px accent-soft icon tile,
    "Nothing here yet" + helper copy.

### 3. Note editor (`apps/web` — `editor/document-editor.tsx`, TipTap)
- Centered card (max 820px), `--r-lg`, `--shadow-sm`.
- **Header bar** (44px): breadcrumb + title (h2) on the left; a "Saved" indicator
  (green dot) + "Close" outline button on the right.
- **Toolbar** (40px, centered, `--surface` bg): Bold, Italic | Heading2, List,
  ListChecks | Link, Table — 28×26px buttons, active = accent-soft.
- **Prose** (max 680px, `.lumen-editor`): Newsreader 16.5px/1.7 body, h1 Newsreader
  30px, h2 Geist 16px, accent list markers, accent-soft left-bar blockquote. Tag
  pills + a dashed "+ Tag" chip above; mono meta line ("Updated 2d ago · 96 words").

### 4. Transcript viewer (`apps/web` — `transcripts/transcript-viewer.tsx`) — signature view
- Centered card (max 880px), `--r-lg`, `--shadow-sm`.
- **Header:** 38px `--busy-soft` Mic tile + title + mono meta ("12:04 · 2.4 MB · en
  · base.en"); "done" status badge + Close.
- **Player bar** (sticky, `--surface` bg): a 40px round **accent** play/pause button
  with `--shadow-accent`; a **waveform** (130 thin bars, filled portion = `--accent`,
  rest = `--border-strong`) that is **click-to-seek**, with a glowing 1.5px playhead;
  mono "0:12 / 12:04" time; a rate toggle button (1× → 2×).
- **Segments** (max 720px, scrollable): each is `54px timestamp | text`, the active
  one gets a 2px `--accent` left border + `--accent-soft` bg and **auto-scrolls into
  view** as the (fake) clock advances. Speaker label is mono uppercase 10px; text is
  Newsreader 16px.

### 5. Marketing landing (`apps/marketing`)
- **Header** (`site-header.tsx`): sticky, translucent + `backdrop-filter: blur(10px)`,
  hairline bottom. Wordmark + nav (Features, How it works, Sign in) + "Get started"
  (filled).
- **Hero** (`hero.tsx` + `app-mock.tsx`): **centered** column — eyebrow pill →
  Newsreader 54px headline → 18px sub-copy → two CTAs (Get started filled / Sign in
  ghost) → 3 proof pills. A soft accent aurora sits behind it (centered, top). The
  **product frame** (`app-mock.tsx`) sits **full-width beneath** (max 1000px): macOS
  traffic lights bar + a 3-column mock (sidebar / note / transcript) with a small
  waveform.
- **Trust strip** (`trust-strip.tsx`): 4 hairline-separated proof badges, centered.
- **Feature grid** (`feature-grid.tsx`): centered section intro; 3-col cards
  (lift-on-hover, lucide icon in an accent-soft tile). **See "Coming soon" below.**
- **How it works** (`how-it-works.tsx`): centered intro; 3 numbered step cards
  (Capture → Transcribe → Retrieve & reason), the number in a 44px accent-soft round
  badge (Newsreader).
- **Final CTA** (`final-cta.tsx`): centered, accent aurora, Newsreader 44px headline,
  "Get started" + a large **"Notify me"** capture (see below).
- **Footer** (`site-footer.tsx`): wordmark + tagline + links + copyright line.

---

## "Coming soon" treatment (all Claude-key / AI features)

The AI features are **not live yet** (they require a user-supplied Claude API key).
Everywhere they appear, use this pattern instead of presenting them as shipped:

- **Cards** get `.feat--soon`: **dashed** `--border` border, `--surface-inset` bg,
  an **outlined** (transparent, `--accent-line` border) icon tile, and a muted
  (`--text-2`) heading.
- **Badge** (top-right of the card): a pill — `--accent-soft` bg, `--accent-text`,
  mono uppercase 10px, a 5px accent dot. Labels in use: **"Coming soon"** (the
  assistant) and **"Early access"** (bring-your-own-key).
- **CTA** changes from a normal action to **"Notify me"** (outline button with a
  lucide `Bell` icon). On click it swaps in an inline email form
  (`you@university.edu` input + "Get updates" filled button). On submit it shows a
  green `Check` + "You're on the list — we'll email you when it ships."
- **Where it applies:** the two AI feature cards (Sparkles "Assistant over your
  workspace" / KeyRound "Bring your Claude key"), the **final CTA** (a large
  "Notify me when the assistant ships" capture), the hero proof pill ("Claude-key
  AI — coming soon"), and the **"Ask Lumen"** sidebar nav item in the app (disabled
  + "soon" badge).

In the real codebase, wire the "Notify me" form to your existing lead-capture /
email endpoint (e.g. a Next.js route handler writing to Supabase), with client
validation on the email field and an optimistic success state.

---

## Interactions & behavior

- **App routing:** auth → library; selecting a folder/tag filters the library;
  opening a document → note editor; opening a *done* recording → transcript viewer;
  processing/queued recordings are not openable. Breadcrumb + "Back to library"
  return.
- **Folder tree:** click selects and toggles expand; chevron rotates.
- **Row hover:** MoreHorizontal action button fades in (`opacity` 0→1, 0.12s).
- **Transcript:** play/pause drives a fake clock; the active segment is derived
  from current time and auto-scrolls (`scrollTo`, smooth); clicking a segment or the
  waveform seeks. Rate cycles 1 / 1.25 / 1.5 / 1.75 / 2×.
- **Marketing:** scroll-reveal fades on sections; slow aurora drift; "Notify me"
  expand → submit → success as described.
- **States to build for real data:** loading (skeleton rows), empty (dashed box),
  error/failed (danger badge + retry), processing (busy badge + pulsing dot).

## State management
- App view (`auth | library | note | transcript`), selected folder, selected tag,
  expanded folder set, open item title.
- Transcript: `time`, `playing`, `rate`, derived `activeIdx`.
- Notify forms: `idle | open | submitted` per instance.
- In production these map to the repo's TanStack Query data layer + Supabase; the
  prototypes use in-memory fixtures.

## Assets & iconography
- **Icons:** Lucide (`lucide-react` in the repo). 16px in chrome / 18px in headers,
  ~1.75px stroke. Glyphs used: Folder, FolderPlus, FileText, File, Mic, Search, Tag,
  Plus, ChevronRight, ArrowLeft, Settings, LogOut, Sparkles, Library, Clock,
  MoreHorizontal, Play, Pause, Bold, Italic, Heading2, List, ListChecks, Link,
  Table, KeyRound, Bell, Check.
- **No emoji, no unicode-glyph icons.** No raster/SVG brand illustrations exist —
  the only brand mark is the **wordmark**: an iris dot (`--accent`, soft glow) +
  "Lumen" in Geist 600.
- **Fonts:** Geist, Geist Mono, Newsreader (genuine matches to the repo's
  `next/font` setup).

## Files in this bundle
- `styles.css` — `@import` manifest (link this one file).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `base.css` (resets + `.l-*` helpers), `components.css` (`.lui-*` classes).
- `web-app/` — the interactive app prototype: `index.html` (orchestrator),
  `app-data.jsx`, `app-screens.jsx`, `app-detail-screens.jsx`.
- `marketing/index.html` — the landing-page prototype (incl. "Coming soon" cards).
- `DESIGN_SYSTEM_README.md` — the full design guide (content voice, visual
  foundations, iconography, and the component API summary).

> The reusable UI primitives (Button, IconButton, Input, Badge, Tag, Avatar,
> Card) are documented in `DESIGN_SYSTEM_README.md` and demonstrated in the
> prototypes. Recreate them with the repo's existing shadcn-style primitives in
> `apps/web/src/components/ui/*` — keep the token *values* above, not the
> prototype's literal `.lui-*` class names.

> Reference the source repo for the source-of-truth IA and behavior:
> **https://github.com/sam-yng/lumen** (`apps/web`, `apps/marketing`,
> `packages/ui/src/styles/tokens.css`, and `docs/DESIGN.md` / `docs/FRONTEND.md`).
