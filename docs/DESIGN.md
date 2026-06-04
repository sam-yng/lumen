# Design

Visual and interaction design language for Lumen v1 (dark theme), built on
Tailwind v4 + shadcn/ui.

> **Status: IMPLEMENTED for the v1 design pass.** This captures the
> high-fidelity design handoff (`design_handoff_lumen_v1`) and now describes the
> running app's dark-first visual language. The token layer is wired through
> [`globals.css`](../src/app/globals.css), the root layout loads the reading
> font, and the v1 auth/library/editor/transcript/search surfaces have been
> restyled from this spec. Design-time-only controls such as Tweaks, plus v2+
> features such as Ask Lumen/MCP/semantic search, remain documented intent rather
> than shipping v1 UI.
>
> Source of truth for the visuals is the handoff bundle's `tokens.css` /
> `app.css` (design references in HTML/CSS + in-browser-Babel JSX — a precise
> **spec**, not code to paste). See
> [references/index.md](references/index.md#design-handoff) for the pointer.

The design is **dark-first**. Tokens are authored as themeable axes (accent hue,
font pairing, radius, density) so a Tweaks panel and a future light theme can
override them. Ship the tokens as overridable CSS custom properties; the Tweaks
panel itself is a design-time aid and need not ship.

---

## Design tokens

### Color — neutral canvas (cool, very low chroma)

| Token | OKLCH | Role |
|---|---|---|
| `--canvas` | `oklch(0.171 0.011 274)` | App background (deepest) |
| `--surface` | `oklch(0.205 0.012 274)` | Sidebar / panels |
| `--surface-2` | `oklch(0.235 0.013 274)` | Cards / inputs / raised |
| `--surface-3` | `oklch(0.275 0.013 274)` | Hover / pressed raised |
| `--border` | `oklch(0.32 0.012 274)` | Hairline |
| `--border-soft` | `oklch(0.27 0.011 274)` | Subtle divider |
| `--border-strong` | `oklch(0.42 0.013 274)` | Emphasis hairline / waveform inactive |
| `--text` | `oklch(0.955 0.004 274)` | Primary text |
| `--text-2` | `oklch(0.74 0.009 274)` | Secondary text |
| `--text-3` | `oklch(0.585 0.011 274)` | Muted / meta |
| `--text-4` | `oklch(0.475 0.011 274)` | Faint / disabled |

### Color — accent ("lumen", luminous iris)

A single hue meaning focus / action / selection, used sparingly. `--accent-h` is
the **only** value that changes between accent options.

| Token | Value |
|---|---|
| `--accent-h` | `282` (default "iris") |
| `--accent` | `oklch(0.74 0.148 var(--accent-h))` |
| `--accent-bright` | `oklch(0.81 0.135 var(--accent-h))` (hover) |
| `--accent-deep` | `oklch(0.55 0.155 var(--accent-h))` (pressed / ring) |
| `--accent-text` | `oklch(0.80 0.115 var(--accent-h))` (accent as text on dark) |
| `--accent-soft` | `accent @ 14% alpha` (selection bg) |
| `--accent-line` | `accent @ 40% alpha` (focus border) |
| `--accent-glow` | `accent @ 28% alpha` (glow aura) |
| `--on-accent` | `oklch(0.18 0.02 274)` (text on filled accent) |

Accent hue options (all share L≈0.74 / C≈0.148): iris 282 · indigo 266 ·
blue 244 · cyan 212 · teal 195 · green 158 · lime 132 · amber 78 · orange 50 ·
rose 16 · magenta 330 · purple 302.

### Color — status (share accent's L≈0.76 / C≈0.13–0.14, hue varied)

| Token | OKLCH | Meaning |
|---|---|---|
| `--ok` | `oklch(0.76 0.14 158)` | done / transcribed |
| `--busy` | `oklch(0.74 0.13 244)` | processing / transcribing |
| `--warn` | `oklch(0.80 0.13 78)` | pending / queued |
| `--danger` | `oklch(0.70 0.16 18)` | failed / error |

Each has a `-soft` companion at 15% alpha for badge backgrounds.

### Typography

Repo already loads **Geist** + **Geist Mono**. The design adds **Newsreader** (a
screen serif) for reading surfaces. Load via `next/font`. Hanken Grotesk +
Source Serif 4 are only needed if the font-pairing tweak ships.

| Token | Stack | Used for |
|---|---|---|
| `--font-ui` | `'Geist', ui-sans-serif, system-ui` | All interface chrome |
| `--font-read` | `'Newsreader', Georgia, serif` | Note bodies, transcript text, AI answers, big taglines |
| `--font-mono` | `'Geist Mono', ui-monospace` | Timestamps, file meta, counts, keycaps |

Type scale (`font: weight size/line-height family`):

| Token | Value |
|---|---|
| `--t-display` | `600 30px/1.18` ui |
| `--t-h1` | `600 22px/1.25` ui |
| `--t-h2` | `560 17px/1.35` ui |
| `--t-body` | `400 14px/1.55` ui |
| `--t-sm` | `400 13px/1.5` ui |
| `--t-xs` | `500 12px/1.4` ui |
| `--t-meta` | `500 11.5px/1.35` **mono** |

Base body letter-spacing `-0.006em`; headings `-0.01em` to `-0.02em`.

### Shape, spacing, motion

- **Radius:** `--r: 6px` base (tweakable 0–16). Derived: `--r-sm` ≈ half,
  `--r-lg` = +4px, `--r-xl` = +10px, `--r-pill: 999px`.
- **Spacing** (`--density` multiplier, default 1; compact 0.86 / comfy 1.16):
  `--s1:4 --s2:8 --s3:12 --s4:16 --s5:22 --s6:30 --s7:44` (px × density).
  `--row-h` (tree/list rows) ≈ `32px × (0.55 + 0.45×density)`.
- **Easing:** `--ease: cubic-bezier(0.32, 0.72, 0, 1)`. Common transitions
  0.12–0.16s.
- **Elevation on dark = borders + faint glow, not heavy shadows.**
  `--shadow-pop: 0 18px 46px -14px oklch(0 0 0 / 0.7), 0 0 0 1px var(--border-soft)`.
- **Scrollbars:** 10px, thumb `--border` (→ `--border-strong` on hover),
  transparent track.
- **Selection:** background `--accent-soft`.

### Core primitive classes

From the handoff's `tokens.css`; in the repo, realize these as shadcn/ui
variants + Tailwind utilities rather than literal global classes.

- `.l-btn` — `--primary` (filled accent w/ glow ring), `--ghost`, `--sm`,
  `--icon` variants.
- `.l-input` — focus → `--accent-line` border + 3px `--accent-soft` ring.
- `.l-chip` — tag pill w/ colored dot.
- `.l-badge` — status pill: `--ok / --busy / --warn / --err`.
- `.l-kbd` — keycap.
- `.l-ph` — image/media placeholder: 135° hatch + mono label.

---

## Screens / views

The information architecture intentionally mirrors what's already built. Restyle
the existing components (`LibraryWorkspace`, `DocumentEditor`, `FolderTree`,
`TagPanel`, `AuthForm`) rather than rebuilding; only the M4 transcription/record/
upload screens are new.

### 1. Auth (restyle `AuthForm`)

- Login = "Log in" / "Welcome back to Lumen."; signup = "Sign up" / "Create your
  Lumen workspace." Bottom toggle link; "Continue with GitHub" secondary.
- Layout: `grid-template-columns: 1.05fr 1fr`, full viewport. Left = brand panel
  (`--surface`, hairline right border, large radial accent glow top-left); right
  = centered form card (max-width 360px). Collapse to single column < 860px
  (hide brand).
- Brand panel: wordmark (11px accent dot w/ glow + "Lumen"), serif tagline
  (`--font-read`, 38px/1.15), blurb, 4 feature points (28px accent-soft icon
  tile + label), mono footnote "Private by default · your recordings never leave
  your machine".
- Form card: title (22px), desc, Email + Password (`.l-input`, label `--t-xs`),
  full-width primary submit (height 38), "or" divider, GitHub button, alt-mode
  link (accent-text).

### 2. App shell (sidebar)

- Layout: `grid-template-columns: var(--sidebar-w) 1fr` (sidebar 280px),
  height 100dvh, overflow hidden. Rail variant → first column 60px.
- Sidebar (`--surface`, right hairline): header (wordmark + collapse-to-rail);
  actions row (primary "New note" + icon search opening ⌘K); nav rows (Library /
  Recents / Tags / **Ask Lumen** [accent sparkle, v2]); section label "Library" +
  new-folder button; recursive folder tree; footer (avatar + name + email +
  settings).
- Folder tree rows (`.l-trow`, height `--row-h`): caret (rotates −90°
  collapsed), kind icon, ellipsized label, optional status dot (recordings),
  mono item count. Selected = `--accent-soft` bg + 2px accent left bar +
  accent-text icon. Indent = `8 + depth*15` px. Clicking a folder toggles expand
  AND selects; clicking a leaf opens it.
- Rail variant: 60px icon column — brand dot (expand), accent "New" FAB, icon nav
  (library/recents/search/tags), avatar at bottom.

### 3. Library (restyle `LibraryWorkspace` / `LibraryContent`)

- Top bar (52px, bottom hairline): breadcrumb (clickable ancestors) + actions
  (search icon, list/grid segmented control, Upload, primary New note).
- Header: folder title (`--t-h1` 24px) + mono subtitle (`N items`).
- Filter bar: "Filter" label + All chip + one chip per tag (colored dot;
  selected chip tints to the tag hue). Tags carry a `color`/hue.
- List rows (`.l-row`): 34px kind-icon tile (folder→accent-text,
  recording→busy), name (500), mono meta (`N items` / `updated` / `size` /
  `duration`), right-aligned status badge (recordings) + tag chips,
  hover-revealed ⋯ button. Grouped under "Folders" / "Notes & files".
- Grid cards (`.l-card`): icon + status top row, name, mono meta foot, tag chips;
  hover lifts 1px + border-strong. `repeat(auto-fill, minmax(216px,1fr))`,
  gap 12px.
- Empty state: centered icon tile + "Nothing here yet" + sub + New note / Upload
  / Record buttons.

### 4. Note editor (restyle `DocumentEditor`)

- Top bar: breadcrumb (… › document name) + autosave indicator + ⋯. Autosave
  dot: amber "Saving…", green "Saved". Mirror repo states: Ready / Unsaved
  changes / Saving… / Saved / Save failed; debounce 800ms.
- Toolbar (sticky, centered, bottom hairline): icon buttons in groups
  `[Bold, Italic] | [Heading, BulletList, TaskList] | [Link, Table]` with 1px
  dividers (`.e-tdiv`). 32×30 buttons, hover `--surface-2`. **Match the repo's
  exact toolset.**
- Page (`.e-page`, max-width 700px, centered): tags row (chips + dashed "Tag"
  add), mono meta line (Updated · N words · in <folder path>), then blocks:
  - `h1` → serif 600 32px/1.2
  - `h2` → ui 600 17px
  - `p` / `ul` / `ol` → serif 17px/1.7; `ul` markers accent-text, `ol` markers
    mono
  - `callout` → `--accent-soft` bg + `--accent-line` border + sparkle icon,
    serif 16px
  - trailing empty paragraph shows placeholder "Start taking notes…" (match repo)

### 5. Transcript viewer — **signature** — M4 (new)

Schema: `recordings` (status pending|processing|done|failed), `transcripts`,
`transcript_segments` (start_ms/end_ms/text/speaker).

- Header (`.t-head`): 40px busy-tinted mic tile, title (19px), mono meta
  (duration · size · `en · base.en` · tags), right status badge.
- Audio player (`.t-player`, `--surface`, sticky under header): 44px round accent
  Play/Pause; **waveform** = ~150 flex bars, filled portion `--accent`, unplayed
  `--border-strong`, glowing playhead at `currentTime/duration`; click to seek;
  mono `m:ss / m:ss`; rate toggle (1× → 2.25× cycling). Wire to a real `<audio>`
  element.
- Segments (`.t-seg`, list, max-width 760 centered): grid `56px 1fr` = mono
  timestamp + (mono speaker label + serif 16.5px text). **Active** segment (last
  with `start ≤ currentTime`) = `--accent-soft` bg + 2px accent left bar + accent
  timestamp, auto-scrolls to ~40% from top (use `container.scrollTo`, NOT
  `scrollIntoView`). Clicking a segment seeks audio to its start.
- State views (status ≠ done):
  - **processing** → card with `transcribing N%` badge, "base.en · local CPU · no
    data leaves your machine" mono note, gradient progress bar (busy→accent),
    partial-text preview with blinking caret.
  - **pending** → centered clock icon, "Queued for transcription", queue
    position.
  - **failed** → centered error icon, mono error string, Retry (primary) +
    Download.

### 6. Search

Postgres full-text across documents + transcripts, RLS-scoped. Big search field
(56px, focus → accent ring) + mono hint "Postgres full-text · notes +
transcripts · scoped to you". Empty state = "Try" suggestion list. Results = icon
+ name + mono crumb + serif snippet with the matched term wrapped in `.l-mark`
(accent-soft highlight). Click → open item.

### 7. Recents / Tags

- Recents: row list of recently opened items with crumb + updated.
- Tags: card grid, one card per tag (colored dot + name + mono count + up to 4
  member rows). Maps to `tags` + `tag_links`.

### 8. Ask Lumen — v2 preview (do NOT build in v1)

Forward-looking mock badged "preview · ships in v2": chat thread (user bubble +
serif AI answer with bullets), **citation chips** linking back to a transcript
timestamp / note, input pill with mono footnote "Powered by the MCP server over
your own vault — every answer cites its source." Documents v2 intent only — no
MCP / assistant / embeddings in v1; leave seams, not stubs.

### 9. Modals — M4 (new)

- **Upload:** drag-drop zone + selected-file list with per-file progress; audio
  files show a "will transcribe" busy badge (audio upload → create `recording` +
  enqueue job). Destination folder in title.
- **Record:** mic orb (pulses red while recording), mono timer, live waveform,
  status line; Start → Pause/Resume → Stop & save (`MediaRecorder` → upload →
  treat as audio).
- **Command palette (⌘K):** overlay near top; search field; "Actions" group (New
  note / Upload / Record / Recents / Ask Lumen) + "Jump to" group (fuzzy match
  over the item index with crumbs). Esc closes.

---

## Interactions & behavior

- **Routing:** in the real app, map the prototype's in-memory view state
  (`library | doc | transcript | file | recents | tags | search | assistant`,
  `folderId`, `openId`, expanded-folder `Set`, `tagFilter`, sidebar `tree|rail`,
  active `modal`) to App Router routes / nested layouts + TanStack Query.
- **Open rules:** document → editor; recording → transcript viewer; file →
  preview; folder → select + expand. Opening an item auto-expands its ancestors.
- **⌘K / Ctrl-K** toggles the command palette globally.
- **Autosave:** debounce 800ms; dot amber while saving, green when saved.
- **Transcript playback:** active segment derived from `currentTime`; click
  segment to seek; active auto-scrolls (manual `scrollTo`, never
  `scrollIntoView`).
- **Hover/active:** rows/nav → `--surface-2`; primary buttons brighten to
  `--accent-bright`; buttons nudge 0.5px on `:active`.
- **Motion:** entrance/decorative motion minimal; respect
  `prefers-reduced-motion`. Status dots pulse (1.4s) only while busy/pending.

## State management

- Server state via **TanStack Query** against the existing `/api/library/*`
  handlers (folders, documents, files, tags, tag-links). Add `/recordings`,
  `/transcripts` for M4.
- Local UI state: selected folder/item, tree expansion set, list/grid layout,
  tag filter, modal, and Tweaks values (persist to localStorage).
- Audio: a real `<audio>` element; segment highlight = derived state from
  `audio.currentTime` (timeupdate listener).

## Assets

- **Icons:** prefer **lucide-react** (already in use); match the handoff's
  geometric line set (18×18, 1.5px stroke, round caps/joins — Folder, FileText,
  File, Mic, Search, Tag, Plus, Chevron, etc.).
- **No raster/photographic assets.** Media placeholders use the `.l-ph` hatch.
- **Avatars:** initials on an accent gradient.
- **Fonts:** Geist + Geist Mono (in repo) + Newsreader (add). Hanken Grotesk +
  Source Serif 4 only if the font-pairing tweak ships.

## Milestone alignment

- **Already in repo (restyle to this spec):** M2 library
  (`LibraryWorkspace`), M3 editor (`DocumentEditor`), auth (`AuthForm`).
- **This design adds M4–M5 UI:** upload + recording + transcript pipeline UI,
  transcript viewer with click-to-seek + status/retry, search results.
- **v2+ (assistant, MCP, semantic search, live/diarized transcription,
  collaboration):** documented as forward-looking only; do not build in v1 —
  leave the seams.
