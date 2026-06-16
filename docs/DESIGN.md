# Design

Visual and interaction design language for Lumen, built on Tailwind v4 +
shadcn/ui.

> **Status: IMPLEMENTED (light redesign, 2026-06-16).** Lumen v1 shipped
> **dark-first**; the running app is now a clean, Notion-inspired **light**
> theme with skinnier chrome. The token layer is shared through
> [`packages/ui`](../packages/ui/src/styles/tokens.css) and imported by
> [`apps/web/globals.css`](../apps/web/src/app/globals.css) +
> [`apps/marketing/globals.css`](../apps/marketing/src/app/globals.css); the
> auth/library/editor/transcript/search surfaces and the marketing site all read
> from it.
>
> Source of truth for the light values + per-screen specs is the redesign
> handoff, vendored at
> [`docs/references/light-redesign-handoff/`](references/light-redesign-handoff/)
> and pointed to from [references/index.md](references/index.md#design-handoff).
> The design spec (with the two binding decisions) is
> [`docs/superpowers/specs/2026-06-16-light-redesign-design.md`](superpowers/specs/2026-06-16-light-redesign-design.md).

The design is **light-only**, but tokens stay authored in OKLCH as themeable
axes (accent hue, font pairing, radius, density) so a future dark theme can be
reintroduced by overriding a single scope — the `@custom-variant dark` seam in
each app's `globals.css` is left in place for that. **No dark toggle ships
today**; `:root` carries the light values and `color-scheme: light`.

---

## Design tokens

### Color — neutral canvas (cool, very low chroma, on true-white)

| Token | OKLCH | ~hex | Role |
|---|---|---|---|
| `--canvas` | `oklch(1 0 0)` | `#ffffff` | App background (pure white) |
| `--surface` | `oklch(0.985 0.0015 274)` | `#fafafb` | Sidebar / panels (off-white) |
| `--surface-2` | `oklch(0.971 0.002 274)` | `#f4f4f6` | Cards / inputs / raised |
| `--surface-3` | `oklch(0.948 0.003 274)` | `#ededf0` | Hover / pressed raised |
| `--surface-inset` | `oklch(0.992 0.001 274)` | `#fbfbfc` | Faint inset wells |
| `--border` | `oklch(0.916 0.003 274)` | `#e4e4e8` | Hairline |
| `--border-soft` | `oklch(0.94 0.0025 274)` | `#ececef` | Subtle divider |
| `--border-strong` | `oklch(0.86 0.004 274)` | `#d3d3da` | Emphasis hairline / waveform inactive |
| `--text` | `oklch(0.285 0.008 274)` | `#2e2e36` | Primary ink |
| `--text-2` | `oklch(0.46 0.009 274)` | `#5f5f6b` | Secondary |
| `--text-3` | `oklch(0.6 0.009 274)` | `#84848f` | Muted / meta |
| `--text-4` | `oklch(0.72 0.008 274)` | `#a8a8b1` | Faint / disabled |

### Color — accent ("lumen", iris) — re-weighted for white

A single hue meaning focus / action / selection, used **sparingly** (the one
primary action, selection tint + 2px left bar, focus rings, inline links).
`--accent-h` is the **only** value that changes between accent options; on light
the accent is re-weighted darker (L≈0.56) so it carries contrast on white.

| Token | Value | Role |
|---|---|---|
| `--accent-h` | `282` (default "iris") | hue knob |
| `--accent` | `oklch(0.56 0.19 var(--accent-h))` | fills / primary action |
| `--accent-bright` | `oklch(0.5 0.2 var(--accent-h))` | hover (darkens) |
| `--accent-deep` | `oklch(0.44 0.19 var(--accent-h))` | pressed / ring |
| `--accent-text` | `oklch(0.52 0.2 var(--accent-h))` | accent as inline text on white |
| `--accent-soft` | `accent @ 9% alpha` | selection / tint bg |
| `--accent-softer` | `accent @ 5% alpha` | faint tint |
| `--accent-line` | `accent @ 32% alpha` | focus border |
| `--accent-glow` | `accent @ 22% alpha` | soft aura |
| `--on-accent` | `oklch(0.99 0 0)` | text on filled accent |

### Color — status (deepened so they hold on white)

| Token | OKLCH | ~hex | Meaning |
|---|---|---|---|
| `--ok` | `oklch(0.56 0.13 158)` | `#2f9e6e` | done / transcribed |
| `--busy` | `oklch(0.54 0.15 244)` | `#3a7bd5` | processing / transcribing |
| `--warn` | `oklch(0.64 0.13 70)` | `#cf8a2b` | pending / queued |
| `--danger` | `oklch(0.55 0.19 18)` | `#d6453f` | failed / error |

Each has a `-soft` companion (11–14% alpha) for badge backgrounds.

### Typography

Three families, loaded via `next/font` in both apps. The scale was trimmed a
notch vs. dark v1 for a denser, more Notion-like read.

| Token | Stack | Used for |
|---|---|---|
| `--font-ui` | `'Geist', ui-sans-serif, system-ui` | All interface chrome |
| `--font-read` | `'Newsreader', Georgia, serif` | Note bodies, transcript text, AI answers, big taglines |
| `--font-mono` | `'Geist Mono', ui-monospace` | Timestamps, file meta, counts, keycaps, uppercase section labels |

Type scale (`font: weight size/line-height family`):

| Token | Value |
|---|---|
| `--t-display` | `600 28px/1.18` ui |
| `--t-h1` | `600 20px/1.25` ui |
| `--t-h2` | `600 16px/1.35` ui |
| `--t-body` | `400 14px/1.55` ui |
| `--t-sm` | `400 13px/1.5` ui |
| `--t-xs` | `500 12px/1.4` ui |
| `--t-meta` | `500 11.5px/1.35` **mono** |
| `--t-read` | `400 16.5px/1.7` read |
| `--t-read-h1` | `600 30px/1.2` read |

Tracking: body `-0.003em`; headings `-0.014em`. Mono section labels / eyebrows
are uppercase with `letter-spacing: .05em`.

### Shape, spacing, motion

- **Radius (skinnier than dark v1):** `--r: 5px` base, `--r-sm: 3px`,
  `--r-lg: 8px` (cards), `--r-xl: 12px` (large frames), `--r-pill: 999px`.
- **Spacing** (`--density` multiplier, default 1; compact 0.86 / comfy 1.16):
  `--s1:4 --s2:8 --s3:12 --s4:16 --s5:22 --s6:30 --s7:44` (px × density).
- **Chrome sizing (the skinnier redesign):** `--sidebar-w: 240px`,
  `--topbar-h: 44px`, `--control-h: 32px`, `--control-h-sm: 27px`,
  `--row-h ≈ 29px × (0.62 + 0.38×density)`.
- **Easing:** `--ease: cubic-bezier(0.32, 0.72, 0, 1)`; transitions 0.12–0.16s
  (`--dur-fast`, `--dur`). Press = `translateY(0.5px)`.
- **Elevation on light = soft low shadow + hairline ring, never heavy drops:**
  - `--shadow-sm: 0 1px 2px oklch(0.2 0.02 274 / 6%)` (cards)
  - `--shadow-card: --shadow-sm + 0 0 0 1px var(--border-soft)`
  - `--shadow-pop: 0 14px 40px -12px …/18%, 0 2px 8px -2px …/8%, 0 0 0 1px var(--border)` (popovers/dialogs)
  - `--shadow-accent: 0 8px 22px -12px var(--accent-glow)` (primary button only)
- **Scrollbars:** 10px, thumb `--border-strong` (→ `--text-4` on hover),
  transparent track.
- **Selection:** background `--accent-soft`.

### Core primitive classes

Realized in the repo as shadcn/ui variants + Tailwind utilities (see
`apps/web/src/components/ui/*`) rather than literal global classes; the handoff's
`components.css` documents the target sizing/states.

- **Button** — `default` (filled accent + `--shadow-accent`), `outline`
  (canvas bg + hairline), `secondary`, `ghost`, `destructive`, `link`; default
  height `--control-h` (32px), `sm` 27px, focus → `--accent-line` border + 3px
  `--accent-soft` ring.
- **Input / Select** — canvas bg, `--border` hairline, height `--control-h`,
  same focus ring.
- **Card** — `--border-soft` hairline + `--shadow-sm`, radius `--r-lg`.
- `.l-chip` — tag pill w/ colored dot. `.l-badge` — status pill
  (`--ok/--busy/--warn/--danger` tones). `.l-kbd` — keycap. `.l-ph` — 135° hatch
  media placeholder. `.l-mark` — accent-soft search highlight.

---

## "Coming soon" treatment (Claude-key / AI features)

The AI features (in-app assistant, bring-your-own Claude key) are not live for
the public yet. Wherever they surface, they use a calm "coming soon" treatment
rather than presenting as shipped — and, **per the product decision on
2026-06-16, with no "Notify me" / email capture anywhere**:

- **Cards** (marketing feature grid): dashed `--border`, `--surface-inset` bg,
  a muted (`--text-2`) heading, and a top-right badge pill (`--accent-soft` bg,
  `--accent-text`, mono uppercase 10px, 5px accent dot) — **"Coming soon"** for
  the assistant, **"Early access"** for bring-your-key. No call to action.
- **Ask Lumen** sidebar nav item: disabled, accent sparkle icon, a "soon" badge.
- **Hero proof pill**: "AI uses your Claude key — coming soon".

---

## Screens / views

The information architecture mirrors what's built. The light redesign restyles
the existing components rather than rebuilding them.

**Routes:** `/library` (list + actions), `/library/notes/[id]` (full-page note),
`/library/transcripts/[recordingId]` (full-page transcript), `/library/tags`
(Tags view). `/` and authenticated auth pages redirect to `/library`. The
assistant lives at the gated `/assistant` route.

### 1. Auth (`AuthForm` + `(auth)/layout.tsx`)

- Layout: `grid-template-columns: 1.05fr 1fr`, full viewport. Left = brand panel
  (`--surface`, hairline right border, soft `--accent-glow` aurora top-left);
  right = centered form card (max-width ~360px, `--shadow-pop`). Collapse to a
  single column below ~860px (hide brand).
- Brand panel: wordmark (iris dot w/ glow + "Lumen"), serif tagline
  (`--font-read`, 38px), blurb, 4 feature points (28px `--accent-soft` icon tile
  + label), mono footnote "Private by default · your recordings never leave your
  machine".
- Form card: title, desc, "Continue with Google" outline → mono "or" divider →
  Email + Password (`Input`, label `--t-xs`) → full-width primary submit
  (`--control-h`) → alt-mode link (`--accent-text`). Email-OTP confirm +
  forgot/reset share the same card treatment.

### 2. App shell (sidebar)

- Layout: `grid-template-columns: var(--sidebar-w) 1fr` (sidebar 240px), height
  100dvh, overflow hidden. Below `lg` the sidebar moves into a left drawer
  (Sheet).
- Sidebar (`--surface`, right hairline): header (wordmark + settings); actions
  row (primary "New note" + icon search); nav rows (Library / Recents [disabled]
  / Tags / **Ask Lumen** [accent sparkle, disabled + "soon" badge]); section
  label "Library" + new-folder button; recursive folder tree; footer (avatar +
  name + email + logout).
- Folder tree rows (height `--row-h`): caret (rotates 90° when open), kind icon,
  ellipsized label, mono item count. Selected = `--accent-soft` bg + 2px accent
  left bar + accent-text. Indent ≈ `8 + depth*14` px. Clicking a folder toggles
  expand AND selects; clicking a leaf opens it.

### 3. Library (`LibraryWorkspace` / `LibraryContent`)

- Top bar (`--topbar-h` 44px, bottom hairline): breadcrumb (clickable ancestors)
  + actions (search, Upload outline-sm, primary New note sm).
- Content centered (max ~880px): folder title (`--t-h1`) + mono subtitle
  (`N items`); filter chips ("Filter" label + All + tag pills, selected tints to
  `--accent-soft`); grouped "Folders" / "Notes & files" lists in a `--r-lg`
  hairline container.
- Item rows: 30px kind-icon tile (recording → `--busy-soft`, folder →
  `--accent-soft`, doc/file → `--surface-2`), name (`--t-sm` 500), mono meta,
  right-aligned tag pills + status badge + hover-revealed ⋯ button.
- Empty state: dashed `--border-strong` box + accent-soft icon tile + "Nothing
  here yet" + helper copy. Loading = skeleton rows; failed = danger badge +
  retry; processing = busy badge + pulsing dot.

### 4. Note editor (`DocumentEditor`, TipTap)

- Header (`--topbar-h`): breadcrumb + title (`--t-h2`) + autosave indicator
  (amber "Saving…" / green "Saved").
- Toolbar (sticky, ~40px, `--surface`): icon buttons in groups
  `[Bold, Italic] | [Heading2, BulletList, TaskList] | [Link, Table]`, active =
  `--accent-soft`.
- Prose (`.lumen-editor`, max ~680px): Newsreader 16.5px/1.7 body, `h1` serif
  30px, `h2` ui 16px, accent list markers, `--accent-soft` left-bar blockquote.
  Tag chips + dashed "Tag" add + mono meta line above.

### 5. Transcript viewer — **signature**

- Header: 38px `--busy-soft` mic tile, title, mono meta (duration · size ·
  `en · base.en` · tags), right status badge + Close.
- Player (sticky, `--surface`): 40px round `--accent` Play/Pause with
  `--shadow-accent`; **waveform** = thin flex bars, filled portion `--accent`,
  unplayed `--border-strong`, glowing playhead; click to seek; mono `m:ss / m:ss`;
  rate toggle.
- Segments (max ~720px centered): grid `54px 1fr` = mono timestamp + (mono
  speaker label + Newsreader 16px text). **Active** segment = `--accent-soft` bg
  + 2px accent left bar, auto-scrolls via `container.scrollTo` (**never**
  `scrollIntoView`). Clicking a segment seeks. Citation deep links
  (`?segment` / `?t`) scroll + highlight + seek.
- State views (status ≠ done): processing (gradient progress + partial preview),
  pending (queued), failed (error + Retry).

### 6. Search

Hybrid full-text + semantic retrieval, RLS-scoped. Search field (focus → accent
ring), results = icon + name + mono crumb + snippet with the matched term wrapped
in `.l-mark` (accent-soft highlight). Click → open item.

### 7. Recents / Tags

- Recents: deferred — the sidebar entry is visible but disabled (explanatory
  `title`).
- Tags: `/library/tags` view for create/rename/delete with preset colors and tag
  filtering.

### 8. Ask Lumen (assistant)

Lives at the gated `/assistant` route. Chat thread (user bubble + Newsreader AI
answer), **citation chips** (`[S#]`) linking back to transcript timestamps /
note blocks, source cards. Gated behind a per-user Claude key; presented as
"coming soon" in marketing + the sidebar until enabled.

---

## Interactions & behavior

- **Open rules:** document → editor; recording → transcript viewer; folder →
  select + expand. Processing/queued recordings are not openable.
- **Autosave:** debounce; dot amber while saving, green when saved.
- **Transcript playback:** active segment derived from `currentTime`; click to
  seek; active auto-scrolls (manual `scrollTo`, never `scrollIntoView`).
- **Hover/active:** rows/nav → `--surface-2`; primary buttons brighten to
  `--accent-bright`; buttons nudge 0.5px on `:active`.
- **Marketing:** centered hero with the product mock full-width beneath, centered
  section intros, slow `--accent-glow` aurora drift, scroll-reveal fades.
- **Motion:** restrained; respect `prefers-reduced-motion`. Status dots pulse
  only while busy/pending.

## State management

- Server state via **TanStack Query** against the library/recordings/transcripts
  handlers. Local UI state: selected folder/item, tree expansion set, tag filter,
  drawer/dialog state.
- Audio: a real `<audio>` element; segment highlight = derived state from
  `audio.currentTime`.

## Assets

- **Icons:** **lucide-react** (16px chrome / 18px headers, ~1.75px stroke).
  Marketing stays dependency-light and renders its mock with CSS, no icon lib.
- **No raster/photographic assets.** Media placeholders use the `.l-ph` hatch;
  the only brand mark is the wordmark (iris dot + "Lumen").
- **Avatars:** initials on an accent gradient.
- **Fonts:** Geist + Geist Mono + Newsreader via `next/font`.
