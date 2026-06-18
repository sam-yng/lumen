# Library Top Bar Recorder Implementation Plan

> **Status: ARCHIVED (superseded 2026-06-18).** Implemented on the
> folder/document workspace, then superseded by the navigation-node-tree
> migration, which reworked `LibraryWorkspace` and left `RecordAudioForm`
> unused (the top-bar recorder is no longer mounted). Kept as a historical
> record; do not implement from it. (See the follow-up to remove the now-dead
> `RecordAudioForm` or re-wire capture into the node UI.)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing `RecordAudioForm` control into the library top bar action slot while keeping Search available at the right edge of the top bar.

**Architecture:** `LibraryWorkspace` owns the selected-folder upload mutation, so it should render `RecordAudioForm` directly in the top bar and pass the same `onSave` handler previously threaded into `LibraryActions`. `LibraryActions` remains the lower action row for note/folder/upload/live-session actions and no longer carries the dormant recorder prop.

**Tech Stack:** React 19 client components, TanStack Query, Testing Library + Vitest, Tailwind v4 utilities.

## Global Constraints

- Do not change recording capture behavior in `RecordAudioForm`.
- Recorded audio should still upload into the currently selected folder.
- Replace the top-bar Upload/New note controls with the recorder control.
- Keep the top-bar Search icon button available and right-aligned.
- Keep the lower library action row for New note, New folder, Upload, and Live session.
- Run `bun run check` after the patch.

---

### Task 1: Move recorder to library top bar

**Files:**
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-actions.tsx`
- Test: `apps/web/src/components/library/__tests__/library-workspace.test.tsx`

**Interfaces:**
- Consumes: `RecordAudioForm({ onSave }: { onSave: (file: File) => void })`
- Produces: `LibraryWorkspace` top bar renders `RecordAudioForm` and passes `uploadMutation.mutate({ file, folderId: selectedFolderId })`.

- [x] **Step 1: Write failing workspace test**

Create `apps/web/src/components/library/__tests__/library-workspace.test.tsx` with a mocked `RecordAudioForm` and minimal mocked library children. Assert that the top bar renders the recorder and Search icon while no longer rendering the old top-bar Upload/New note controls.

- [x] **Step 2: Verify RED**

Run: `bun run --filter @lumen/web test src/components/library/__tests__/library-workspace.test.tsx`

Expected: FAIL because `LibraryWorkspace` still renders the Search/Upload/New note cluster instead of the recorder.

- [x] **Step 3: Implement move**

Import `RecordAudioForm` in `library-workspace.tsx`, remove unused top-bar icons/imports, and replace the action cluster with:

```tsx
<RecordAudioForm
  onSave={(file) => uploadMutation.mutate({ file, folderId: selectedFolderId })}
/>
```

Remove the unused recorder import and `onRecordSave` prop from `LibraryActions`.

- [x] **Step 4: Verify focused test**

Run: `bun run --filter @lumen/web test src/components/library/__tests__/library-workspace.test.tsx`

Expected: PASS.

- [x] **Step 5: Full gate**

Run: `bun run check`

Expected: PASS.

Observed 2026-06-17: PASS with 47 web test files and 298 tests.
