# Lumen Design Implementation Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved `docs/DESIGN.md` visual and interaction handoff across Lumen v1 without changing the service-layer contracts.

**Architecture:** This is a client/UI restyle pass over the completed v1 functional milestones. Ship the design tokens globally, then restyle the existing auth, app shell, library, editor, transcript, recording, and search components in place so API handlers and services remain untouched. New helper components may be extracted inside existing feature folders only when they make one of the current large client components easier to test and review.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui primitives, lucide-react, TanStack Query, TipTap, Vitest, Playwright.

---

## Source Material

- Spec: `docs/DESIGN.md`
- Next.js 16 docs to consult before framework edits: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`
- Existing UI entry points:
  - `src/app/layout.tsx`
  - `src/app/globals.css`
  - `src/app/(auth)/layout.tsx`
  - `src/app/(app)/layout.tsx`
  - `src/components/auth-form.tsx`
  - `src/components/library/library-workspace.tsx`
  - `src/components/editor/document-editor.tsx`
  - `src/components/transcripts/transcript-viewer.tsx`
  - `src/components/transcripts/record-audio-form.tsx`
  - `src/components/search/search-panel.tsx`
  - `src/components/ui/button.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/card.tsx`

## File Structure

- Modify `src/app/layout.tsx`: load Newsreader with `next/font/google`, attach CSS variables, keep the existing provider boundary.
- Modify `src/app/globals.css`: replace default shadcn neutral dark palette with Lumen tokens, Tailwind `@theme` mappings, base typography, scrollbar/selection/editor/transcript utility classes.
- Modify `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/card.tsx`: align primitive radius, focus, hover, filled/ghost/outline styling to the handoff.
- Modify `src/app/(auth)/layout.tsx` and `src/components/auth-form.tsx`: implement the split auth screen, brand panel, copy, secondary GitHub affordance, and responsive collapse.
- Modify `src/app/(app)/layout.tsx` and `src/components/library/library-workspace.tsx`: move visual shell responsibility into the library workspace, restyle sidebar, actions, folder tree, tag filters, item rows, upload/create/record controls, and empty states.
- Modify `src/components/editor/document-editor.tsx`: restyle autosave header, toolbar, and TipTap reading surface while preserving the exact toolset and 800ms debounce.
- Modify `src/components/transcripts/transcript-viewer.tsx`: replace native-only audio UI with a real audio-backed custom player, seekable waveform, active segment highlighting, manual scroll positioning, rate toggle, and status states.
- Modify `src/components/transcripts/record-audio-form.tsx`: restyle record controls and expose recording duration/status without changing the upload callback.
- Modify `src/components/search/search-panel.tsx` and `src/components/search/highlight.tsx`: restyle search field/results and accent matched snippets.
- Modify `docs/DESIGN.md`: update the status line after tokens/styles are wired.
- Keep generated files untouched.

---

### Task 1: Global Tokens, Fonts, And Primitives

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Re-read the Next.js font guide**

Run:

```bash
sed -n '1,90p' node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md
sed -n '735,825p' node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md
```

Expected: the docs confirm `next/font/google` self-hosts fonts and that CSS variables should be attached in `app/layout.tsx`.

- [ ] **Step 2: Load Newsreader**

In `src/app/layout.tsx`, import `Newsreader` from `next/font/google`, configure it with `variable: "--font-newsreader"`, `subsets: ["latin"]`, and include the variable class on `<html>` with the existing Geist variables.

- [ ] **Step 3: Wire Lumen tokens**

In `src/app/globals.css`, map the handoff tokens onto `:root`, `.dark`, and `@theme inline`: `--canvas`, `--surface`, `--surface-2`, `--surface-3`, `--border-soft`, `--border-strong`, `--text-*`, `--accent-*`, `--ok`, `--busy`, `--warn`, `--danger`, density spacing, radius, and font aliases.

- [ ] **Step 4: Update shadcn primitives**

Adjust button/input/card CVA classes so default buttons are filled accent, outlines/ghosts use dark surface states, focus uses `--accent-line` plus `--accent-soft`, and cards use the handoff's 6-10px radius with border/glow instead of heavy neutral defaults.

- [ ] **Step 5: Run the gate**

Run:

```bash
bun run check
```

Expected: `biome check`, `tsc --noEmit`, and `vitest run` pass.

---

### Task 2: Auth Screen Restyle

**Files:**
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/components/auth-form.tsx`

- [ ] **Step 1: Build the split auth layout**

Replace the centered-only auth route layout with a full viewport two-column shell. The left panel is hidden below `860px`; the right panel centers the existing form.

- [ ] **Step 2: Restyle the form card**

Keep the current server action wiring and `useActionState`. Add the design copy, labels, full-width primary submit, "or" divider, disabled GitHub secondary button, and bottom mode toggle.

- [ ] **Step 3: Verify auth route rendering**

Run:

```bash
bun run check
```

Expected: pass.

---

### Task 3: App Shell And Library Restyle

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/library/library-workspace.tsx`

- [ ] **Step 1: Flatten the protected layout**

Keep server-side auth verification and sign-out, but remove the extra top header chrome so the design shell can own the viewport. Pass user email/name display through the shell if needed.

- [ ] **Step 2: Restyle sidebar**

Add the wordmark, primary New note action, search affordance, nav rows, library section label, recursive folder tree rows, tag panel, and footer styling using the existing local state and mutations.

- [ ] **Step 3: Restyle library content**

Add the 52px top bar, breadcrumb/title/subtitle, filter chips, grouped rows for folders and notes/files, status badges for recordings, tag chips, hover actions, and the empty state with New note / Upload / Record controls.

- [ ] **Step 4: Preserve behavior**

Folder selection, document opening, recording transcript opening, create/move/rename/delete, tag attach/unlink, upload, and record upload must continue to call the existing mutations.

- [ ] **Step 5: Run the gate**

Run:

```bash
bun run check
```

Expected: pass.

---

### Task 4: Editor Restyle

**Files:**
- Modify: `src/components/editor/document-editor.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Restyle document shell**

Keep TipTap setup, exact toolbar toolset, and autosave debounce. Replace the bordered card with the handoff top bar, autosave dot states, grouped icon toolbar, centered page, meta line, and serif content styling.

- [ ] **Step 2: Add editor CSS**

Add scoped `.lumen-editor` styles for h1/h2/p/lists/task lists/tables/links/placeholder using `--font-read`, accent markers, and design spacing.

- [ ] **Step 3: Run the gate**

Run:

```bash
bun run check
```

Expected: pass.

---

### Task 5: Transcript, Recording, And Search Polish

**Files:**
- Modify: `src/components/transcripts/transcript-viewer.tsx`
- Modify: `src/components/transcripts/record-audio-form.tsx`
- Modify: `src/components/search/search-panel.tsx`
- Modify: `src/components/search/highlight.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Build the real audio-backed transcript player**

Keep the real `<audio>` element. Add play/pause state, duration/current time, 150-ish deterministic waveform bars, click-to-seek, glowing playhead, and rate cycling `1x -> 1.25x -> 1.5x -> 1.75x -> 2x -> 2.25x -> 1x`.

- [ ] **Step 2: Implement active segment behavior**

Derive active segment from `audio.currentTime`; segment clicks seek to `start_ms`. Store segment refs and use `container.scrollTo` to position the active segment around 40% from the top when playback advances.

- [ ] **Step 3: Restyle transcript states**

Implement processing, pending, and failed state cards from the spec, including local CPU/privacy copy and retry behavior.

- [ ] **Step 4: Restyle recording controls**

Keep `MediaRecorder -> File -> onSave` behavior. Add visible recording state, timer, pulse orb, and disabled states.

- [ ] **Step 5: Restyle search**

Use the existing Postgres search API. Apply the 56px focused search field, result rows, crumbs/snippets where available, and `.l-mark` matched term styling.

- [ ] **Step 6: Run the gate**

Run:

```bash
bun run check
```

Expected: pass.

---

### Task 6: Docs, Browser Verification, And Milestone Close

**Files:**
- Modify: `docs/DESIGN.md`
- Modify: `docs/PLANS.md`
- Move when complete: `docs/exec-plans/active/design-implementation-pass.md` to `docs/exec-plans/completed/design-implementation-pass.md`

- [ ] **Step 1: Update design status**

Update `docs/DESIGN.md` so the status note says the token/style pass has been wired, and call out any intentionally deferred design-time-only items such as the Tweaks panel or v2 Ask Lumen preview.

- [ ] **Step 2: Run full automated verification**

Run:

```bash
bun run check
```

Expected: pass.

- [ ] **Step 3: Run manual happy path**

Start the dev server:

```bash
bun run dev
```

Open the app in a browser and verify:

- Auth pages render the split layout.
- Library loads and preserves folder/tag/document/file interactions.
- Editor toolbar and autosave still work.
- Recording controls still create an upload.
- Transcript view can play, seek by waveform, seek by segment, and highlight the active segment.
- Search results open the expected document/file/transcript.

- [ ] **Step 4: Complete plan docs**

Move this plan to `docs/exec-plans/completed/`, add a short retrospective, and update `docs/PLANS.md`.

- [ ] **Step 5: Commit**

Run:

```bash
git status --short
git add src/app src/components docs/DESIGN.md docs/PLANS.md docs/exec-plans
git commit -m "feat: implement lumen design handoff"
```

Expected: commit succeeds with `bun run check` green.

---

## Self-Review

- **Spec coverage:** Covers global tokens/fonts/primitives; auth; sidebar/app shell; library list/filter/tag/upload/record controls; note editor; transcript viewer/player/status states; search; docs. The v2 Ask Lumen preview remains documented only, matching `docs/DESIGN.md`.
- **Placeholder scan:** No `TBD`, `TODO`, or deferred implementation placeholders are used as plan steps. Design-time-only items are explicitly excluded by the source spec.
- **Type consistency:** The plan preserves existing component and API names: `LibraryWorkspace`, `DocumentEditor`, `TranscriptViewer`, `RecordAudioForm`, `SearchPanel`, `libraryQueryKey`, `transcriptQueryKey`, and existing mutation helpers.
- **Scope check:** This is one milestone because it changes one coherent UI surface over already-completed v1 behavior; it does not add backend features or v2 AI/MCP functionality.

## Retrospective

- Implemented the v1 dark-first design pass across tokens, auth, library, editor, transcript, recording, and search surfaces.
- `bun run check` stayed green at the final gate.
- Manual browser verification covered the auth split layout, seeded demo login, library shell, search result highlighting, opening the editor from search, and transcript panel rendering. Seeded transcript audio mounted the player UI, but the seeded file endpoint returned 404, so audible playback should be rechecked with a real uploaded audio file.
