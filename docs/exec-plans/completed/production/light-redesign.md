# Lumen Light-Theme Redesign Implementation Plan

> **Status:** completed 2026-06-16 (branch `design/light-redesign`). All
> milestones M0–M8 shipped; `bun run check` green (293 tests); browser
> happy-path verified for both apps (marketing hero + coming-soon cards;
> web-app two-column auth). Moved `active/production/ → completed/production/`.
> **Version:** production
>
> **Retrospective.** The single highest-leverage finding: the repo's token
> layer already named every token exactly as the handoff did (`--canvas`,
> `--surface`, `--accent`, `--row-h`, …), so M0's value-swap in
> `packages/ui/src/styles/tokens.css` + both `globals.css` cascaded the light
> theme through nearly every surface automatically. M2 (auth), M5 (transcript),
> and M6 (search) needed **no code change** — prior token-based work meant they
> re-themed for free. The remaining milestones were surgical: hardcoded chrome
> sizes (`280px`/`52px`/`38px`) swapped to the new chrome-size tokens, the
> `dark` class dropped from each `<html>`, and the marketing coming-soon
> treatment added. Two binding decisions held throughout: light-only with the
> `@custom-variant dark` seam left in place (no toggle), and **no "Notify me" /
> email capture anywhere** (marketing had none to begin with — it simply was
> not added). Gotchas: Biome `check .` linted the vendored handoff prototypes
> until the dir was added to `files.includes` ignore; the multi-line shadow
> tokens needed `bun run format` to settle.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

> **Design spec:**
> [`docs/superpowers/specs/2026-06-16-light-redesign-design.md`](../../../superpowers/specs/2026-06-16-light-redesign-design.md)
> — token values live in its vendored `docs/references/light-redesign-handoff/tokens/`;
> per-screen layout + behavior live in the handoff `README.md` and the
> interactive prototypes (`web-app/`, `marketing/`). **Two binding decisions:**
> (1) light-only, keep the seam — no dark toggle; (2) **no "Notify me" / email
> capture anywhere** — keep the rest of the "Coming soon" treatment.

**Goal:** Move both `apps/web` and `apps/marketing` from the v1 dark-first theme
to the Notion-inspired light theme with skinnier chrome, recreated inside the
existing codebase (token layer + shadcn primitives + feature components), with no
new product behavior.

**Architecture:** The repo already names its tokens exactly as the handoff does
(`--canvas`, `--surface`, `--accent`, `--row-h`, …) in
`packages/ui/src/styles/tokens.css`. The redesign is therefore mostly a **token
value swap** plus component-sizing/treatment updates that cascade through the
shadcn primitives and feature components. No data-layer, service, MCP, or worker
changes. The light values are authored in OKLCH so a future `.dark` scope can be
re-added by overriding one block.

**Tech Stack:** Next.js 16 App Router, React 19, TS strict, Tailwind v4,
`@lumen/ui` tokens, shadcn-style primitives, `lucide-react`, TipTap. No new deps.

---

## Conventions (read once before starting)

- **No TDD for visual work.** There is no unit test for "is it the right
  shade." The gate for every task is `bun run check` green (run from repo root)
  + the browser happy-path at each milestone boundary (AGENTS rule 3). Existing
  Vitest/Playwright suites must stay green — if a snapshot/DOM-shape test breaks
  on a structural change, update it in the same task.
- **Token values are authoritative.** Copy OKLCH values verbatim from
  `docs/references/light-redesign-handoff/tokens/`. Do not eyeball hex.
- **Keep token *values*, not prototype class names.** The prototypes use
  `.lui-*` / `.l-*`. Translate to the repo's shadcn primitives + Tailwind
  utilities; keep the values.
- **Accent utilities** (`--accent-soft`, `--accent-line`, `--accent-glow`,
  `--shadow-pop`, `--shadow-accent`, etc.) are not all mapped as Tailwind
  utilities — use arbitrary forms (`bg-[var(--accent-soft)]`,
  `shadow-[var(--shadow-accent)]`). `text-accent-text`, `bg-surface`,
  `bg-surface-2/3`, `text-text-2/3/4`, `border-border-soft/strong` are valid.
- **Dirty-kitchen rule (AGENTS rule 6):** if a pre-existing `bun run check`
  failure surfaces, stop, isolate your changes, fix the baseline, then resume.
- Run `bun install` from repo root once before starting.

## File map

```
packages/ui/src/styles/tokens.css        MODIFY — the value swap (M0)
apps/web/src/app/globals.css             MODIFY — base layer + .l-* + editor prose (M0)
apps/marketing/src/app/globals.css       MODIFY — base layer + marketing utilities (M0, M7)
apps/web/src/app/layout.tsx              VERIFY — next/font (Geist, Geist Mono, Newsreader)
apps/web/src/components/ui/*.tsx         MODIFY — button, input, card, dialog, sheet,
                                                  select, dropdown sizing/radius (M1)
apps/web/src/components/auth-form.tsx    MODIFY — two-column brand panel + form card (M2)
apps/web/src/components/forgot-password-form.tsx, reset-password-form.tsx  MODIFY (M2)
apps/web/src/components/library/**       MODIFY — shell, sidebar, content, rows (M3)
apps/web/src/components/editor/**        MODIFY — document editor, toolbar, prose (M4)
apps/web/src/components/transcripts/**   MODIFY — viewer, player bar, waveform, segments (M5)
apps/web/src/components/search/**        MODIFY — search input, results, highlight (M6)
apps/marketing/src/components/*.tsx      MODIFY — hero, app-mock, feature-grid,
                                                  how-it-works, final-cta, site-header,
                                                  trust-strip, site-footer (M7)
docs/DESIGN.md, docs/FRONTEND.md, docs/references/index.md  MODIFY (M8)
```

---

## Milestone M0 — Token foundation (the value swap)

Highest-leverage change: re-point the shared token layer + both `globals.css`
base layers to the light values. Most surfaces shift toward correct
automatically; later milestones fix sizing/structure that tokens can't express.

### Task 0.1 — Verify fonts are loaded

**Files:** `apps/web/src/app/layout.tsx`, `apps/marketing/src/app/layout.tsx`

- [ ] **Step 1:** Confirm `next/font` loads Geist, Geist Mono, **and** Newsreader
  and exposes them as the CSS vars the tokens reference (`--font-geist-sans`,
  `--font-geist-mono`, `--font-newsreader` — see how `--font-ui` / `--font-read`
  / `--font-mono` resolve in `tokens.css`). If Newsreader or Geist Mono is
  missing in either app, add the `next/font` loader and wire the variable. The
  handoff's `tokens/fonts.css` (Google Fonts `@import`) is for the prototype
  only — production uses `next/font`.
- [ ] **Step 2:** `bun run check`. Commit only if a font wiring change was
  needed: `style(fonts): ensure Newsreader/Geist Mono loaded in both apps`.

### Task 0.2 — Swap `packages/ui/src/styles/tokens.css` to light

**Files:** `packages/ui/src/styles/tokens.css`

The `@theme inline` block (lines ~1–59) stays — it maps token names to Tailwind
utilities and is theme-agnostic. **Add** the new utility mappings the light
system introduces: `--color-surface-inset: var(--surface-inset)`,
`--color-accent-softer: var(--accent-softer)`. Then replace the `:root` block
values.

- [ ] **Step 1:** In `:root`, set `color-scheme: light` (was `dark`).
- [ ] **Step 2:** Replace the neutral, accent, and status values with the light
  values from `docs/references/light-redesign-handoff/tokens/colors.css` verbatim — neutrals
  (`--canvas` … `--text-4`), accent block (note new `--accent-softer`), status
  (`--ok/--busy/--warn/--danger` + their `-soft` companions). Add
  `--surface-inset`.
- [ ] **Step 3:** Replace radius + spacing + chrome-sizing + motion + elevation
  from `docs/references/light-redesign-handoff/tokens/spacing.css` verbatim: `--r:5 --r-sm:3
  --r-lg:8 --r-xl:12`; add `--sidebar-w:240px --sidebar-rail-w:52px
  --topbar-h:44px --control-h:32px --control-h-sm:27px`; replace `--row-h` with
  the handoff formula `calc(29px * (0.62 + (0.38 * var(--density))))`; add
  `--ease-out --dur-fast --dur`; add `--shadow-sm --shadow-card --shadow-accent`
  and replace `--shadow-pop` with the light multi-layer value.
- [ ] **Step 4:** Update the shadcn semantic aliases to match
  `colors.css` (notably `--card: var(--canvas)` and `--popover: var(--canvas)`
  — light cards sit on white, not `--surface-2`). Keep the sidebar role block.
- [ ] **Step 5:** `bun run check`. The app should now render light. Commit:
  `feat(design): swap shared token layer to light theme`.

### Task 0.3 — Re-theme `apps/web/src/app/globals.css`

**Files:** `apps/web/src/app/globals.css`

- [ ] **Step 1:** `body` font stays Geist; confirm `letter-spacing` follows
  `--tracking-body` (`-0.003em`) per `base.css`. Update `::selection`,
  scrollbar colors (thumb `--border-strong`, hover `--text-4` per `base.css`).
- [ ] **Step 2:** Update `.l-chip` (height 22, border `--border`, bg
  `--surface`), `.l-badge` (height 21, gap 5, add the `--ok/busy/warn/danger`
  tone modifiers from `base.css`), `.l-mark`, `.l-ph` (border-based hatch).
- [ ] **Step 3:** Update `.lumen-editor` prose to the light reading scale from
  `base.css`: body `16.5px/1.7` Newsreader, h1 `30px`, h2 `16px` Geist,
  blockquote padding `10px 14px`, list/para margins. Preserve the existing
  `.l-citation-block-active` rule (citation feature — keep behavior, retint to
  light if needed).
- [ ] **Step 4:** `bun run check`. Commit: `feat(design): re-theme web globals
  base layer + editor prose`.

### Task 0.4 — Re-theme `apps/marketing/src/app/globals.css` base layer

**Files:** `apps/marketing/src/app/globals.css`

- [ ] **Step 1:** Re-theme the base/reset/`.l-*` portions to light (mirror
  Task 0.3). Leave the marketing-specific keyframes/reveal/aurora/grid
  utilities in place for now — M7 retunes them for light (aurora glow uses
  `--accent-glow` on white, grid lines lighten).
- [ ] **Step 2:** `bun run check`. Commit: `feat(design): re-theme marketing
  globals base layer`.

### M0 boundary — review checkpoint

- [ ] `cd apps/web && bun run dev` → load library, editor, transcript: surfaces
  are light, text legible, accent reads on white. Note remaining sizing/structure
  issues (expected — fixed in M1–M6).
- [ ] `cd apps/marketing && bun run dev` (port 3001) → page is light.
- [ ] **PAUSE for human review.**

---

## Milestone M1 — Web UI primitives

Recreate the handoff's Button / IconButton / Input / Card sizing + states
(`docs/references/light-redesign-handoff/tokens/components.css`) on the repo's shadcn
primitives, so every feature surface inherits correct controls.

**Files:** `apps/web/src/components/ui/{button,input,card,dialog,sheet,select,dropdown-menu,label}.tsx`

- [ ] **Button** (`button.tsx`): default control height `--control-h` (32px),
  radius `--r` (5px), font 13/500, gap 6, `svg` 15px; variants map to
  components.css: `default` = `--accent` fill + `--on-accent` +
  `shadow-[var(--shadow-accent)]`, hover `--accent-bright`; `outline` = `--canvas`
  bg + `--border`, hover `--surface-2`/`--border-strong`; `secondary` =
  `--surface-2`; `ghost` = `--text-2`, hover `--surface-2`; `destructive` =
  `--danger-soft`/`--danger`; `link` = `--accent-text`. Sizes: `sm`
  `--control-h-sm` (27px), `lg` 36px, `icon` square `--control-h`. Focus-visible
  = `--accent-line` border + `0 0 0 3px var(--accent-soft)`; active =
  `translateY(0.5px)`.
- [ ] **IconButton** affordance (the repo uses `Button` `size="icon"` /
  `variant="ghost"`): 32px square, icon 16px, ghost + outline forms per
  components.css.
- [ ] **Input** (`input.tsx`): height `--control-h`, radius `--r`, border
  `--border`, bg `--canvas`, focus `--accent-line` + `0 0 0 3px
  var(--accent-soft)`, placeholder `--text-4`, `lg` 44px. Keep the existing iOS
  16px-min guard in `globals.css`.
- [ ] **Card** (`card.tsx`): border `--border-soft`, radius `--r-lg` (8px), bg
  `--card` (white), `shadow-[var(--shadow-sm)]`; hover variant lifts to
  `--border-strong` + `--shadow-pop` + `translateY(-1px)`.
- [ ] **Overlays** (`dialog.tsx`, `sheet.tsx`, `select.tsx`,
  `dropdown-menu.tsx`): popover surfaces use `--canvas` + `--shadow-pop`
  (hairline ring), radius `--r-lg`; retune any hardcoded dark overlay scrims to
  a light scrim. `label.tsx` uses `--t-xs`.
- [ ] `bun run check` + commit per primitive group. Spot-check primitives in the
  running app. **PAUSE for human review at M1 boundary.**

---

## Milestone M2 — Auth surface

**Files:** `apps/web/src/components/auth-form.tsx`,
`forgot-password-form.tsx`, `reset-password-form.tsx`, the `(auth)` layout.

Recreate handoff §1 (README "1. Auth") + the `web-app` prototype auth screen:
two columns (`1.05fr / 1fr`), full viewport. Left brand panel (`--surface`, soft
`--accent-glow` aurora top-left, wordmark, Newsreader 38px headline, sub-copy,
4-item feature list with 28px `--accent-soft` icon tiles, privacy footer line).
Right form card (centered, max 340px, `--shadow-pop`, 26px padding): "Continue
with Google" outline → mono "or" divider → email + password → filled "Log in" →
"Need an account? Sign up". Reuse M1 primitives. Keep all existing auth
*behavior*/server actions and the Google-OAuth gating as-is — visual only.

- [ ] Build the two-column layout responsively (brand panel hides/stacks below
  `lg` per FRONTEND conventions). Wordmark = iris dot (`--accent`, soft glow) +
  "Lumen" Geist 600.
- [ ] Restyle forgot/reset forms to the same card treatment.
- [ ] `bun run check`; browser: sign-in + reset happy path renders. **PAUSE.**

---

## Milestone M3 — Library workspace (the priority surface)

**Files:** `apps/web/src/components/library/**` (shell, sidebar, workspace/content,
item rows, empty/loading/error states).

Recreate handoff §2. Key specs:
- **Sidebar** 240px (`--surface`, right border `--border-soft`): wordmark +
  settings icon; "New note" (filled sm) + search icon (outline sm); nav list
  30px rows (Library active, Recents disabled, Tags, **Ask Lumen** = accent icon,
  **disabled + "soon" badge** per binding decision 2). Active row = `--accent-soft`
  bg + `--accent-text`. "LIBRARY" mono uppercase label + FolderPlus; recursive
  folder tree (`--row-h` rows, 14px/level indent, chevron rotates 90°, selected
  row = `--accent-soft` + 2px `--accent` left bar). "TAGS" colored-dot pills.
  Footer: avatar + workspace name + email + logout.
- **Top bar** 44px (`--border-soft` bottom): breadcrumb left; Search / Upload
  (outline sm) / New note (filled sm) right.
- **Content** centered max 880px, 20×28 padding: h1 folder name + mono count;
  filter chips row; grouped "FOLDERS" / "NOTES & FILES" lists in a `--r-lg`
  hairline container.
- **Item row**: 30px rounded icon tile (recording `--busy-soft`/`--busy`, folder
  `--accent-soft`, doc/file `--surface-2`) + title (`--t-sm` 500) + mono meta;
  right = tag pills, status badge, MoreHorizontal that fades in on hover.
- **States:** loading skeleton rows; empty dashed `--border-strong` box; failed
  danger badge + retry; processing busy badge + pulsing dot. These map to the
  existing TanStack Query data layer — visual only, no query changes.

- [ ] Build sidebar; build top bar + content; build item rows + states. Commit
  per coherent chunk; `bun run check` each.
- [ ] Browser: navigate folders/tags, open items, hover rows. **PAUSE.**

---

## Milestone M4 — Note editor

**Files:** `apps/web/src/components/editor/**` (TipTap document editor + toolbar).

Recreate handoff §3: centered card max 820px, `--r-lg`, `--shadow-sm`; 44px
header (breadcrumb + h2 title; "Saved" green dot + "Close" outline); 40px toolbar
(`--surface`) with Bold/Italic | Heading2/List/ListChecks | Link/Table 28×26
buttons (active `--accent-soft`); prose per the `.lumen-editor` rules from M0
(Newsreader 16.5, accent markers, accent-soft blockquote). Tag pills + dashed
"+ Tag" chip + mono meta line above. Editor *behavior* unchanged.

- [ ] `bun run check`; browser: open a note, toolbar toggles work. **PAUSE.**

---

## Milestone M5 — Transcript viewer (signature view)

**Files:** `apps/web/src/components/transcripts/**`.

Recreate handoff §4: centered card max 880px; header 38px `--busy-soft` Mic tile
+ title + mono meta + status badge + Close; sticky player bar (`--surface`) with
40px round `--accent` play/pause (`--shadow-accent`), click-to-seek waveform
(filled `--accent`, rest `--border-strong`, glowing 1.5px playhead), mono time,
rate toggle; segments (max 720px) `54px timestamp | text`, active = 2px
`--accent` left + `--accent-soft` bg, **auto-scroll via `element.scrollTo({ top,
behavior })` — never `scrollIntoView`**. Mono uppercase 10px speaker label;
Newsreader 16px text. Citation deep-link behavior (`?segment` / `?t`) is
preserved unchanged.

- [ ] `bun run check`; browser: open a done recording, play, click waveform +
  segment, confirm active-segment auto-scroll. **PAUSE.**

---

## Milestone M6 — Search

**Files:** `apps/web/src/components/search/**`.

Re-theme search input, results list, and `.l-mark` match highlight to light
(accent-soft highlight). Results reuse the M3 item-row treatment. Search
behavior + ranking unchanged.

- [ ] `bun run check`; browser: run a search, verify highlight + result rows.
  **PAUSE — end of web-app priority block.**

---

## Milestone M7 — Marketing site

**Files:** `apps/marketing/src/components/{hero,app-mock,feature-grid,how-it-works,final-cta,site-header,trust-strip,site-footer}.tsx`,
`apps/marketing/src/app/globals.css` (light retune of keyframes/aurora/grid),
`apps/marketing/src/lib/site.ts` (copy only if needed).

Recreate handoff §5 + "Coming soon" treatment, **with binding decision 2: no
"Notify me" / email-capture form anywhere.**

- [ ] **site-header**: sticky translucent + `backdrop-blur(10px)`, hairline
  bottom; wordmark + nav (Features, How it works, Sign in) + "Get started"
  filled.
- [ ] **hero + app-mock**: centered column — eyebrow pill → Newsreader 54px
  headline → 18px sub-copy → two CTAs (Get started filled / Sign in ghost) → 3
  proof pills (one reads "Claude-key AI — coming soon", **no** link to a notify
  form). Centered `--accent-glow` aurora behind. `app-mock` full-width beneath
  (max 1000px): macOS traffic-lights bar + 3-column mock (sidebar / note /
  transcript) with a small waveform — rebuilt light.
- [ ] **trust-strip**: 4 hairline-separated proof badges, centered.
- [ ] **feature-grid**: centered intro; 3-col cards, lift-on-hover, lucide icon
  in `--accent-soft` tile. The **two AI cards** (Sparkles "Assistant over your
  workspace", KeyRound "Bring your Claude key") get the `.feat--soon` treatment:
  dashed `--border`, `--surface-inset` bg, outlined (`--accent-line`) icon tile,
  muted `--text-2` heading, and the top-right "Coming soon" / "Early access"
  mono badge (accent-soft bg, accent-text, 5px accent dot). **No CTA / no notify
  form** — the card simply states it's coming.
- [ ] **how-it-works**: centered intro; 3 numbered step cards (Capture →
  Transcribe → Retrieve & reason), number in 44px `--accent-soft` round badge
  (Newsreader).
- [ ] **final-cta**: centered, `--accent-glow` aurora, Newsreader 44px headline,
  a single "Get started" CTA. **Remove** the large "Notify me when the assistant
  ships" capture entirely (binding decision 2) — replace with the Get-started
  CTA only (or a calm "coming soon" line, no input).
- [ ] **site-footer**: wordmark + tagline + links + copyright.
- [ ] Light-retune `globals.css` motion/aurora/grid; keep
  `prefers-reduced-motion` + scroll-reveal behavior.
- [ ] **Delete any now-orphaned notify-me code** (component, handler, state,
  copy in `site.ts`) so nothing dead-references it. Grep for `notify`/`Notify`.
- [ ] `bun run check`; browser (port 3001): scroll the page, confirm aurora/
  reveal, coming-soon cards, no email inputs. **PAUSE.**

---

## Milestone M8 — Docs + close-out

- [ ] **`docs/DESIGN.md`**: rewrite from dark-first to the light system — token
  tables (from `colors.css`/`spacing.css`/`typography.css`), per-screen specs
  (240px sidebar, 44px top bar, 32px controls, ~29px rows), the iris-on-white
  re-weighting, and the "Coming soon" treatment with the no-notify decision.
- [ ] **`docs/FRONTEND.md`**: update the 280px sidebar → 240px and the
  "dark-first" statement → light-only-with-seam; keep responsive conventions.
- [ ] **`docs/references/index.md`**: add the light-redesign handoff pointer
  (`docs/superpowers/specs/docs/references/light-redesign-handoff/`).
- [ ] Sweep AGENTS.md / README / other docs for stale dark-theme or sizing
  claims surfaced by the change.
- [ ] Run [`docs-sanity-check`](../../../../.agents/skills/docs-sanity-check/SKILL.md)
  — **prioritize the design-related docs** above, then triage the rest;
  production folders (`docs/exec-plans/active/production`, `completed/production`)
  were touched by recent prod work and should be reviewed for drift in the same
  pass.
- [ ] Move this plan `active/production/ → completed/production/`, add a
  retrospective + verification note, update `docs/PLANS.md`.
- [ ] Run
  [`finishing-a-development-branch`](../../../../.agents/skills/finishing-a-development-branch/SKILL.md).

---

## Self-review notes

- **Spec coverage:** M0 covers all token files; M1 components.css; M2–M6 cover
  README §§1–4 + search; M7 covers §5 + the (de-scoped) "Coming soon" treatment;
  M8 covers implicated docs. Binding decision 1 (light-only seam) lands in M0;
  binding decision 2 (no notify) is enforced in M3 (Ask Lumen disabled) and M7
  (no capture, orphan cleanup).
- **No new behavior:** every milestone is visual; data/services/MCP/worker
  untouched. Existing test suites must stay green; structural DOM changes that
  break a test get the test updated in the same task.
- **Out of scope:** dark theme/toggle, lead capture, font-binary swap (keep
  `next/font`).
