# Library Node Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` before each production-code patch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** active - implementation complete, awaiting review
**Version:** cross-cutting
**Area:** library navigation, routes, node UI, uploads/live sessions, recents
**Created:** 2026-06-18
**Depends on:** [`completed/cross-cutting/navigation-node-tree.md`](../../completed/cross-cutting/navigation-node-tree.md)

**Goal:** Keep the `library_nodes` foundation while restoring the feature set and interaction quality that regressed during the navigation-node-tree implementation.

**Architecture:** The database and service layer remain node-based. The recovery reintroduces missing UI and route surfaces on top of `library_nodes`: workspace/folder/note/file/audio product language, standalone editor/viewer routes, recents, upload/live-session entry points, stable selection/filter chrome, and disabled assistant navigation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, TanStack Query, Supabase node services, Vitest + Testing Library, Playwright/browser smoke.

---

## Binding Decisions

- Do not restore the old `folders`, `documents`, or `files` tables/services as primary code paths.
- Keep `library_nodes.kind = 'workspace' | 'page' | 'file' | 'audio'` internally for this pass, but use user-facing labels: workspace, folder, note, file, audio.
- Treat page nodes with children as folders/containers in the workspace shell. Treat leaf page nodes as notes that open in a standalone editor route.
- Standalone note, transcript, live-session, and recents routes remain under `/library/**` for continuity.
- Root Library (`/`) and workspace routes should show Library active in the sidebar. `/library/recents` is the only exclusion.
- DOM-shape stability is a product requirement: selection and filter controls stay mounted even at zero selections or zero tags.

## Tasks

### Task 1: Restore Route Surfaces

**Files:**
- Modify: `apps/web/src/app/(app)/library/recents/page.tsx`
- Modify: `apps/web/src/app/(app)/library/live/page.tsx`
- Modify: `apps/web/src/app/(app)/library/notes/[id]/page.tsx`
- Modify: `apps/web/src/app/(app)/library/transcripts/[recordingId]/page.tsx`
- Modify: `apps/web/src/app/(app)/[workspaceSlug]/[nodeSlug]/page.tsx`
- Modify: `apps/web/src/app/(app)/__tests__/navigation-pages.test.tsx`
- Modify: `apps/web/src/components/library/__tests__/library-routes.test.tsx`

- [x] Write failing route tests proving `/library/recents`, `/library/live`, note editor, and transcript routes render instead of redirecting.
- [x] Update App Router pages to restore those routes using node-aware props.
- [x] Ensure node routes dispatch leaf notes to standalone `/library/notes/:nodeId` and audio to `/library/transcripts/:recordingId`, while keeping containers in the workspace shell.
- [x] Run focused route tests.

### Task 2: Restore Actions And Uploads

**Files:**
- Restore/create: `apps/web/src/components/library/file-upload-picker.tsx`
- Restore/create: `apps/web/src/components/transcripts/record-audio-form.tsx`
- Modify: `apps/web/src/components/library/library-actions.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-api.ts`
- Modify tests under `apps/web/src/components/library/__tests__/`

- [x] Write failing tests for New note, New folder, Upload, Live session, and top-bar instant recording actions inside a workspace/container.
- [x] Restore action buttons and upload dialog on top of `createPage`, `uploadFile`, and `startLiveSession`.
- [x] For root Library, only workspace creation should be enabled until a workspace/container target exists.
- [x] Run focused workspace/action tests.

### Task 3: Restore Recents

**Files:**
- Restore/create: `apps/web/src/components/library/library-recents-content.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-sidebar.tsx`
- Modify tests under `apps/web/src/components/library/__tests__/`

- [x] Write failing tests that recents lists recently updated note nodes, sorted newest first, and excludes folders/files/audio.
- [x] Implement node-backed recents content.
- [x] Wire `/library/recents` and sidebar Recents to the recents view.
- [x] Run focused recents tests.

### Task 4: Fix Sidebar Navigation State

**Files:**
- Modify: `apps/web/src/components/library/library-sidebar.tsx`
- Modify: `apps/web/src/components/library/__tests__/library-sidebar.test.tsx`

- [x] Write failing tests for Library active state at `/` and workspace/container routes, Recents active state only at `/library/recents`, and disabled Ask Lumen visibility when `ASSISTANT_ENABLED` is false.
- [x] Add explicit `view`/active props instead of inferring from selected node alone.
- [x] Restore disabled Ask Lumen entry.
- [x] Run focused sidebar tests.

### Task 5: Fix Stable Selection And Filter Chrome

**Files:**
- Modify: `apps/web/src/components/library/library-content.tsx`
- Modify: `apps/web/src/components/library/library-item-actions.tsx`
- Modify: `apps/web/src/components/library/library-item-row.tsx`
- Modify: `apps/web/src/components/library/library-filter-chips.tsx`
- Modify: `apps/web/src/components/library/tag-panel.tsx`
- Modify tests under `apps/web/src/components/library/__tests__/`

- [x] Write failing tests for always-visible `0 selected`, always-visible filter row, full-card selected state, and right-aligned tag counts.
- [x] Keep selection actions mounted under `LibraryActions`; disable Move/Delete/Clear when nothing is selected.
- [x] Keep `Filter`, `All`, and tag chips mounted even when there are no tags.
- [x] Apply selected state to the whole row/card surface.
- [x] Right-align tag counts and swap hover/focus controls in the count slot.
- [x] Run focused content/sidebar tests.

### Task 6: Naming And Open Semantics

**Files:**
- Modify: `apps/web/src/components/library/library-item-row.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/editor/document-editor.tsx`
- Modify tests under `apps/web/src/components/library/__tests__/`

- [x] Write failing tests that leaf page nodes are labeled/opened as notes, container page nodes as folders, files as files, and audio as audio.
- [x] Update labels, empty states, action copy, and editor chrome away from generic "page" where user-facing text means note/file/folder.
- [x] Preserve node terminology only in internal service/API names.
- [x] Run focused UI text/opening tests.

### Task 7: Verification

- [x] Run focused Vitest suites touched by the recovery.
- [x] Run `bun run check`.
- [x] Run browser happy path: create workspace, create folder, create note, edit standalone note, upload a file, start/cancel live session, visit recents, select rows, clear selection, filter by tags, inspect disabled assistant nav.
- [x] Record verification notes in this plan before promotion.

## Verification Notes

- 2026-06-18: Focused Vitest route/workspace/sidebar/content suites passed after RED coverage for restored routes, actions, recents, stable filter/selection chrome, active nav, disabled assistant nav, and standalone note/transcript routes.
- 2026-06-18: `bun run check` passed: Biome, plan lifecycle, worker Dockerfile check, Turbo typecheck, and 55 Vitest files / 348 tests.
- 2026-06-18: `bun run --filter @lumen/web test:e2e` passed: 4 browser tests passed, live-session capture remained intentionally skipped unless `LIVE_SESSION_E2E=1`.
- 2026-06-18: Manual browser smoke passed against local dev server: created workspace, folder, uploaded file, opened live-session route with `workspaceId`/`parentId`, created standalone note, verified recents active state, verified Library active state, verified disabled Ask Lumen, selected/cleared/deleted workspace, and cleaned up created data.
