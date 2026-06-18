# Library Node Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` before each production-code patch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** active - implementation complete, awaiting review
**Version:** cross-cutting
**Area:** library navigation, routes, node UI, uploads/live sessions, recents
**Created:** 2026-06-18
**Depends on:** [`completed/cross-cutting/navigation-node-tree.md`](../../completed/cross-cutting/navigation-node-tree.md)
**Design:** [`library-workspace-hardening-design.md`](../../../superpowers/specs/2026-06-18-library-workspace-hardening-design.md)

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

### Task 8: Harden Workspace Architecture And Route Dispatch

**Files:**
- Modify: `apps/web/src/app/(app)/[workspaceSlug]/[nodeSlug]/page.tsx`
- Modify: `apps/web/src/app/(app)/__tests__/navigation-pages.test.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Create focused reducer/presentation modules under `apps/web/src/components/library/`
- Modify: `apps/web/src/components/library/__tests__/library-workspace.test.tsx`
- Add focused tests under `apps/web/src/components/library/__tests__/`

**Interfaces:**
- Route resolution consumes `LibraryNodeSnapshot`, `workspaceSlug`, and
  `nodeSlug`; it produces a container render or a note/transcript redirect URL.
- Workspace reducer consumes dialog/tag actions and produces one active dialog
  plus the selected tag ID set.
- Extracted presentation modules consume data/callback props only; query and
  mutation ownership stays in `LibraryWorkspace`.

- [x] Write route-resolution tests for note redirect, transcript redirect,
  container rendering, and audio-without-recording fallback; run the focused
  test and confirm RED because route resolution still happens in effects.
- [x] Implement server-side route resolution and remove both navigation effects;
  run the focused tests and confirm GREEN.
- [x] Write reducer tests for dialog exclusivity, tag toggle, and clear; run the
  focused test and confirm RED because the reducer does not exist.
- [x] Implement the reducer-backed hook, extract focused presentation/dialog
  modules, and replace the upload `onSubmit` handler with a form action.
- [x] Run `bun run check` after each production patch and keep the gate green.
- [x] Run `bunx react-doctor@latest --verbose --diff`; confirm all seven reported
  warnings are gone and the score does not regress.

### Task 9: Stabilize Smoke Coverage And Audit The Test Suite

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Modify as justified: tests under `apps/web/e2e/`, `apps/web/src/**/__tests__/`,
  `apps/web/worker/__tests__/`, and `apps/web/scripts/__tests__/`
- Modify: this plan with the final audit and verification record

**Interfaces:**
- Playwright expectations remain locator/URL condition waits; CI receives a
  cold-compilation-aware timeout without fixed sleeps.
- Every test retained must map to a current production module, security
  invariant, user journey, or distinct regression risk.

- [x] Add a configuration test or inspectable assertion for the CI expectation
  budget; confirm RED against the five-second default.
- [x] Add the minimal CI-aware expectation budget and rerun the targeted smoke.
- [x] Inventory all test files, production imports, overlapping assertions,
  skipped paths, obsolete terminology, and tests for modules without production
  consumers.
- [x] Delete or consolidate only cases with evidence of staleness/redundancy;
  run `bun run check` after every patch.
- [x] Record a strict audit table in Verification Notes: removed, consolidated,
  retained, and gaps that require new coverage.
- [x] Run the full Playwright suite and the manual library happy path.
- [x] Run docs-sanity-check's six read-only checks and report all groups before
  applying any human-authored documentation fixes.

## Verification Notes

- 2026-06-18: Focused Vitest route/workspace/sidebar/content suites passed after RED coverage for restored routes, actions, recents, stable filter/selection chrome, active nav, disabled assistant nav, and standalone note/transcript routes.
- 2026-06-18: `bun run check` passed: Biome, plan lifecycle, worker Dockerfile check, Turbo typecheck, and 55 Vitest files / 348 tests.
- 2026-06-18: `bun run --filter @lumen/web test:e2e` passed: 4 browser tests passed, live-session capture remained intentionally skipped unless `LIVE_SESSION_E2E=1`.
- 2026-06-18: Manual browser smoke passed against local dev server: created workspace, folder, uploaded file, opened live-session route with `workspaceId`/`parentId`, created standalone note, verified recents active state, verified Library active state, verified disabled Ask Lumen, selected/cleared/deleted workspace, and cleaned up created data.
- 2026-06-18: Task 8 focused coverage added four pure route-resolution cases,
  three reducer cases, and a Server Component dispatch assertion. The client
  navigation effects were removed; dialog and top-bar presentation were split
  from query/mutation ownership. Local React Doctor v0.5.1 scanned 24 changed
  files with zero issues. Its optional remote score API was unavailable, so no
  numeric score is claimed.
- 2026-06-18: Strict suite inventory covered 58 Vitest files, 3 Playwright spec
  files, 8 shared test-support modules, and their local import graph. All shared
  helpers have consumers. The only modules reached exclusively from tests are
  legitimate Next route/proxy entry points, the Playwright config, the schema
  generator, and the transcription worker—not dead production modules. No
  `.only`, pending test marker, fixed sleep, or unexplained skip remains; the single
  skipped browser case is the explicit `LIVE_SESSION_E2E=1` microphone path.

| Test-audit disposition | Strict finding | Action |
| --- | --- | --- |
| Removed | Unified snapshot, descendant-move, subtree-delete, and tag-ownership cases in the umbrella library suite duplicated focused `library-nodes` or `tags-read` coverage. | Removed four duplicate cases. |
| Consolidated | Workspace create/delete and page-create coverage repeated `library-nodes`; only cross-user parent rejection was distinct. | Removed two umbrella cases and retained one focused ownership test in `library-nodes.test.ts`. |
| Corrected | Stale-live-sweeper fixtures still used the dropped `recordings.file_id` field; permissive fakes let the mismatch pass. | Migrated fixtures to `node_id` and typed the row factory against generated `Tables<"recordings">`. |
| Retained | Retrieval, semantic indexing, worker, MCP, citation, component, and browser cases map to current production modules, security boundaries, degraded-operation behavior, or distinct user journeys. | Kept; large files are long because they cover separate source types and failure boundaries, not copy-pasted assertions. |
| Gap | Live audio capture remains opt-in, and several thin API handlers (live sessions, uploads, tags/tag-links, recording retry, transcript detail, search, and auth callbacks) lack direct route-level tests. | Service coverage and browser smoke reduce risk, but auth/validation/error mapping at those handler seams still deserves focused future coverage. |
| Gap | No coverage provider is installed. | This audit makes no line/branch coverage claim; conclusions come from import/consumer analysis, assertion overlap, schema terminology, skips, and executed journeys. |

- 2026-06-18: After consolidation, `bun run check` passed with 58 Vitest files
  and 353 tests. Full Playwright passed 4 tests with the one intentional live
  audio skip. Manual browser verification created a temporary workspace and
  note, confirmed stable zero-selection/filter chrome, disabled Ask Lumen,
  workspace actions, instant-record controls, standalone note creation, and
  server-side nested-note dispatch; the temporary data was deleted.
- 2026-06-18: docs-sanity-check six-check report: BROKEN 0, DRIFT 0,
  ORPHAN 0, STALE 0, STUB 7, HISTORICAL 68. All seven stub hits are literal
  marker discussions inside completed plans, not live placeholders. Historical
  paths remain unchanged because modernizing completed milestones would falsify
  the record; this active plan records the triage instead.
