# Lumen Design System

A design system for **Lumen** — a private, multi-tenant **study workspace**:
keep a nested library of folders, write rich-text notes, upload and record
lectures, transcribe them locally or live, and search across everything (with a
Claude-key AI assistant layered on top). *Notion, but for study. Granola, but for
seminars. Word, but with an intuitive file directory.*

This system documents a **redesign**: Lumen v1 shipped **dark-first**; this
project moves both products — the **web app** (priority) and the **marketing
site** — to a clean, **Notion-inspired light theme** with **skinnier chrome**
(a 240px sidebar, a 44px top bar, 29px rows, 32px controls) and tightened
component design.

## Sources

This system was built by reading Lumen's own codebase and design docs. Explore
them to build higher-fidelity work:

- **GitHub:** [`sam-yng/lumen`](https://github.com/sam-yng/lumen) — the Bun /
  Next.js 16 / Supabase monorepo (`apps/web`, `apps/marketing`, `packages/ui`).
- **Design docs read:** `docs/DESIGN.md` (the v1 dark token system + per-screen
  specs), `docs/FRONTEND.md` (responsive + component conventions), `README.md`,
  `AGENTS.md`, and `packages/ui/src/styles/tokens.css` (the shipped token layer).
- **Components read:** `apps/web/src/components/{ui,library,editor,transcripts,search}`
  and `apps/marketing/src/components/*`.

> The light token values, skinnier sizing, and the iris-on-white re-weighting in
> this system are **new** (the redesign brief); everything else mirrors what is
> actually in the repo. Read the repo for the source-of-truth IA and behaviour.

---

## Content fundamentals

How Lumen writes copy — keep to this voice in any new surface.

- **Voice:** plain, direct, technically literate, a little opinionated. It speaks
  to a serious student/researcher and never dumbs things down. *"Built for the
  messy middle of real study."* *"Not just storage. A tool-aware study system."*
- **Person:** addresses the user as **you / your** ("your notes", "your own
  Claude key", "scoped to you"). Lumen refers to itself as **Lumen**, not "we".
- **Casing:** **sentence case everywhere** — headings, buttons, nav. Titles read
  like sentences ("Turn lectures into a searchable study system."). The only
  uppercase is the mono **section labels / eyebrows** (`LIBRARY`, `FILTER`,
  `TRANSCRIPT`) with wide letter-spacing.
- **Buttons & actions:** short, verb-first — "New note", "Upload", "Log in",
  "Get started", "Retry", "Close". No trailing punctuation; no "Click here".
- **Meta / status:** terse and lowercase in mono — `done`, `transcribing`,
  `queued`, `failed`, `12:04 / 12:04`, `14 items`, `base.en · local CPU`.
- **Privacy is a recurring note, stated factually:** "Private by default · your
  recordings never leave your machine", "Audio processing stays local by design",
  "AI inference runs with your own Claude API key."
- **No emoji.** No exclamation-heavy hype. Lucide icons carry visual meaning, not
  emoji. Numbers are real, not decorative.
- **Vibe:** calm, focused, private, academic-but-modern. Less is more.

---

## Visual foundations

**Color.** A near-neutral, very-low-chroma cool gray system on a **true-white
canvas** (`--canvas: #fff`), off-white sidebar/panels (`--surface`), and warm
charcoal-cool ink (`--text`). Borders are hairlines (`--border` ≈ 1px, very
light). One brand accent — **iris** (`--accent-h: 282`) — re-weighted darker
(L≈0.56) so it carries contrast on white; used **sparingly** for the single
primary action, selection (`--accent-soft` tint + 2px left bar), focus rings, and
inline links (`--accent-text`). Status hues (ok/busy/warn/danger) are deepened
versions for legibility on light, each with a `-soft` 12–14% companion for badge
backgrounds.

**Type.** Three families: **Geist** for all interface chrome, **Newsreader** (a
screen serif) for reading surfaces — note bodies, transcript text, big editorial
taglines — and **Geist Mono** for structural meta (timestamps, counts, file
sizes, keycaps, uppercase section labels). The scale was trimmed a notch vs. dark
v1 for a denser read: display 28 / h1 20 / h2 16 / body 14 / sm 13 / mono 11.5.
Headings track tight (−0.014em); body slightly tight (−0.003em).

**Spacing & layout.** 4px base scale (`--s1…--s7`), density-aware. The redesign
**shrinks the chrome**: `--sidebar-w: 240px`, `--topbar-h: 44px`, `--row-h ≈ 29px`,
`--control-h: 32px`. Content columns are centered and capped (~820–880px) with
generous side padding. Layout is flat and structured — folder tree, breadcrumb,
grouped lists — never busy.

**Backgrounds.** Mostly flat white/off-white. No photographic imagery, no
repeating textures. The only "atmosphere" is a single soft **accent aurora**
(blurred radial glow) behind the marketing hero / final CTA and the auth brand
panel, plus an optional faint dotted/line grid. Media without a thumbnail uses the
`.l-ph` 135° hatch placeholder.

**Borders, corners & elevation.** Hairline borders do most of the structural
work. Corners are **skinny**: `--r: 5px` base, `--r-lg: 8px` for cards, `--r-xl:
12px` for large frames, pill for chips/badges. Elevation on light is a **soft,
low shadow + hairline ring** (`--shadow-card`, `--shadow-pop`) — never heavy
drops, never the dark theme's glow (except the small accent glow on the primary
button and the transcript playhead). Cards = 1px `--border-soft` + `--shadow-sm`;
hover lifts 1–2px to `--border-strong` + `--shadow-pop`.

**Motion.** Restrained. Transitions are 0.12–0.16s on `--ease`
`cubic-bezier(0.32,0.72,0,1)`. Hover = background/border color shift; press =
0.5px nudge down. The active transcript segment auto-scrolls (`scrollTo`, never
`scrollIntoView`). Status dots pulse only while busy/pending. Marketing has a slow
aurora drift and scroll-reveal fades. Everything respects
`prefers-reduced-motion`.

**Imagery vibe.** None photographic. Visual interest comes from the accent (cool
iris/violet), the serif/mono contrast, and structured product mocks — calm, cool,
high-contrast-on-white, never warm or grainy.

---

## Iconography

- **Lucide** is the icon system (the app uses `lucide-react`). Geometric line
  icons at **16px in chrome / 18px in headers**, ~1.75px stroke, round caps and
  joins. Common glyphs: Folder, FolderPlus, FileText, File, Mic, Search, Tag,
  Plus, ChevronRight, Settings, LogOut, Sparkles, Library, Clock, MoreHorizontal,
  Play, Pause, Bold, Italic, Heading2, List, ListChecks, Link, Table.
- The cards and UI kits load Lucide from CDN (`unpkg.com/lucide`) and render via
  `lucide.createElement(lucide.IconName)`; in production use `lucide-react`.
- **No emoji, ever.** No unicode-glyph icons. There are **no raster/SVG brand
  illustrations** in the repo — visual identity is the **wordmark** only (an iris
  dot with a soft glow + "Lumen"), recreated in `guidelines/foundations/brand-wordmark.html`.
- Status is communicated by colored mono badges + dots, not icon-only.

---

## Index / manifest

**Root**
- `styles.css` — the single entry point consumers link (an `@import` manifest).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `base.css` (resets + `.l-chip`/`.l-badge`/`.l-kbd`/`.l-ph`/editor prose),
  `components.css` (the `.lui-*` component classes).
- `README.md` (this file) · `SKILL.md`.

**Components** (`components/`) — React primitives, each with `.jsx` + `.d.ts` +
`.prompt.md` and a per-directory `@dsCard` HTML:
- `buttons/` — **Button** (variants: default/outline/secondary/ghost/destructive/link;
  sizes sm/default/lg/icon), **IconButton**.
- `forms/` — **Input** (default / lg).
- `display/` — **Badge** (status tones), **Tag** (colored-dot pill), **Avatar**, **Card**.

**Foundation cards** (`guidelines/foundations/`) — specimen HTML for the Design
System tab: neutrals, accent, status (Colors); UI / reading / mono (Type); spacing
scale, radius & elevation (Spacing); wordmark (Brand).

**UI kits** (`ui_kits/`)
- `web-app/` — interactive light-theme recreation of the study workspace
  (auth → library → note editor → transcript viewer). **The priority surface.**
- `marketing/` — light-theme uplift of the public landing page.

---

## Caveats

- **Fonts** load from **Google Fonts** (`tokens/fonts.css`) as the nearest match
  to the repo's `next/font` setup — Geist, Geist Mono, Newsreader are all genuine
  matches. If you have the exact bundled font binaries, drop them in and swap the
  `@import` for local `@font-face` rules.
- Light token values and the skinnier sizing are the **redesign proposal**, not
  values lifted from a shipped light theme (none exists yet).
