# Frontend overhaul — mobile-first responsive + component quality (design)

**Date:** 2026-06-10
**Scope:** `apps/web` only (marketing site untouched).
**Branch:** `frontend-overhaul`

## Problem

The app's logic and dark-theme token work are solid, but the implementation
layer between tokens and screens is weak: ~20 responsive utilities across the
whole app, the sidebar stacks above content below `lg` (burying the library),
item rows inline seven controls each, dialogs are desktop-only centered modals,
raw `<select>` elements break the visual language, hover/alignment conventions
drift per surface. On a phone the app is close to unusable.

## Goals

- Mobile-first responsive layer across every app surface.
- Component quality pass: consistent alignment, hover/focus states, touch
  targets, dialog ergonomics.
- Stay on the existing design language: [DESIGN.md](../../DESIGN.md) handoff
  tokens, colors, and fonts are unchanged and remain source of truth for
  visuals.

## Non-goals

- ⌘K command palette, list/grid view toggle (handoff gaps deferred).
- New features, routes, or service-layer changes.
- Light theme, accent tweaks panel.

## Inputs

- `DESIGN.md` (claude design handoff) — per-screen specs, tokens, interaction
  states.
- External skill references (reviewed 2026-06-10):
  - `anthropics/skills` frontend-design — quality floor: responsive to mobile,
    visible keyboard focus, reduced-motion respect.
  - `jakubkrehel/make-interfaces-feel-better` — concentric radii, ≥40px hit
    areas, tabular-nums, explicit transition properties, interruptible
    animations, no `transition: all`.
  - `nextlevelbuilder/ui-ux-pro-max` — 44×44pt touch targets, mobile-first
    breakpoints, no horizontal scroll, bottom-sheet idioms, inputs ≥16px on
    mobile, hover states only on hover-capable devices.

## Decisions (user-approved)

1. **Scope:** all app surfaces — auth, library workspace, editor, transcript,
   live session, search, tags, dialogs.
2. **Mobile shell:** off-canvas drawer (option A) — no bottom tabs, no rail.
3. **Handoff gaps:** restyle + small gaps only — add tag filter chip bar and
   clickable breadcrumb ancestors; skip palette/grid toggle.
4. **Mobile dialogs:** bottom sheets below `sm`, centered modals at `sm+`.
5. **Approach:** foundation-first (shared primitives), then per-surface sweep.

## Design

### 1. Breakpoint system + app shell

- Mobile-first: base styles target ~375px phones; enhance at `sm` 640 /
  `md` 768 / `lg` 1024. No horizontal scroll at any width ≥320px.
- `LibraryShell`:
  - `≥lg`: existing `280px + 1fr` grid unchanged.
  - `<lg`: single column, sidebar not rendered in flow. New left `Sheet`
    drawer (~85vw, max 320px) hosts the entire `LibrarySidebar` content.
    Hamburger button in the top bar (left of breadcrumb) opens it. Folder/
    nav/tag selection closes the drawer. Esc + overlay click close; focus
    trapped while open.
- Safe areas: `env(safe-area-inset-*)` padding on shell edges and sticky bars;
  `h-dvh` retained.

### 2. UI primitives (foundation — everything inherits)

- **Sheet** (new, shadcn): side drawer + bottom-sheet support, reduced-motion
  aware.
- **Button**: visuals unchanged (handoff glow, 0.5px active nudge). Add
  ≥44×44px effective hit area for `icon-*`/`xs`/`sm` sizes on touch via
  expanded tap target (pseudo-element; no visual change), and
  `touch-action: manipulation`.
- **Dialog**: responsive — `<sm` bottom sheet (full width, rounded top,
  slide-up, safe-area bottom padding, actions stacked full-width); `≥sm`
  centered modal. Enter/exit animations via tw-animate, respecting
  `prefers-reduced-motion`. New `DialogHeader`/`DialogFooter` helpers so all
  dialog footers align identically.
- **DropdownMenu** (new, shadcn): for row action menus.
- **Select** (new): styled wrapper around native `<select>` — consistent
  border/height/focus ring; native element kept for mobile ergonomics.
- **Input**: 16px font-size below `sm` (prevents iOS focus zoom).
- **Globals**: `tabular-nums` on mono meta (timestamps, counts, sizes);
  `text-wrap: balance` on headings; `-webkit-font-smoothing: antialiased`.

### 3. Library surface

- **Item rows**: row becomes a single full-width tap target that opens the
  item. Right side: status badge + one `⋯` `DropdownMenu` (Open, Transcript,
  Add tag, Move, Rename, Delete). Add-tag and Move become small dialogs
  (bottom sheets on mobile) replacing inline selects. Desktop reveals `⋯` on
  hover/focus-within; touch devices always show it. Tag chips stay on the row,
  wrapping under the name.
- **Filter chip bar** (gap-close): under the folder header — "All" + one chip
  per tag (colored dot; selected chip tints to tag hue). Horizontally
  scrollable strip on mobile.
- **Breadcrumb** (gap-close): full clickable ancestor chain; mobile truncates
  the middle (`… › parent › current`).
- **Top bar**: hamburger added; existing icon-collapse (`hidden sm:inline`)
  behavior kept; spacing normalized to one gap system.
- **Empty state**: handoff spec — icon tile, "Nothing here yet", New note /
  Upload / Record actions; buttons stack on mobile.

### 4. Editor, transcript, live session

- **Editor**: sticky toolbar; `<sm` horizontally scrollable strip (no wrap,
  edge-fade hint), ≥44px touch buttons; page `p-4` on mobile, centered 700px
  column `≥md`; autosave indicator icon-only on mobile.
- **Transcript viewer**: player controls ≥44px, sticky under header; segment
  grid `56px 1fr` stacks below `sm` (timestamp above text); whole segment row
  is the seek target.
- **Live session**: same top-bar/spacing conventions; touch-sized controls.

### 5. Auth

Brand panel hidden below `lg`; form card centered, full-width within ≤400px
container; page padding on small screens; 16px inputs on mobile.

### 6. Search + tags

Search input full width on mobile; result rows are full tap targets. Tags view
rows + color picker get 44px targets; layout wraps cleanly at narrow widths.

### 7. Verification

- Per surface: Chrome DevTools screenshots at 375 / 768 / 1280.
- 320px no-horizontal-scroll check.
- Keyboard focus visibility + `prefers-reduced-motion` spot checks.
- `bun run check` green per commit; manual happy path in browser before
  milestone close (repo working rules).

## Error handling

No new data flows. UI-only: drawer/dialog state is local; existing TanStack
Query error/loading states keep their surfaces, restyled to the same spacing
system.

## Testing

- Existing unit tests must stay green; update DOM-structure assertions where
  rows/dialogs change.
- Playwright smoke (`bun run test:e2e`) must pass; add a mobile-viewport smoke
  (375×812) covering: open drawer → select folder → create note → row `⋯` menu
  → rename.

## Implementation order

1. Foundation: Sheet, responsive Dialog, DropdownMenu, Select, Button hit
   areas, globals.
2. Shell + drawer + top bar.
3. Library rows, chip bar, breadcrumb, empty state.
4. Editor / transcript / live.
5. Auth, search, tags.
6. Verification pass + screenshots.
