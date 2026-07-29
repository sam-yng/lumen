# Demo Library Readiness Implementation Plan

**Status:** completed
**Version:** cross-cutting
**Area:** library sidebar, selection, navigation feedback
**Created:** 2026-07-29
**Reopened:** 2026-07-29 — same-route navigation regression
**Completed:** 2026-07-29
**Depends on:**
[`library-node-recovery.md`](../../active/cross-cutting/library-node-recovery.md)

## Goal

Make the library workspace unambiguous and responsive for the go-live demo:
use the correct root creation label, remove the unused settings control, let a
selected row's check control clear the current selection, and provide immediate
feedback while app navigation is pending.

## Scope and decisions

- The sidebar primary action says **New workspace** whenever there is no current
  workspace/container in which a note can be created; it continues to say
  **New note** inside a workspace.
- Remove the sidebar settings gear only. The existing settings route is outside
  this demo-focused cleanup.
- A selected row exposes an accessible **Clear selection** control in the check
  position. Activating it clears the whole current selection, matching the
  selection action bar's **Clear** behavior.
- Add both immediate client-side navigation feedback in the library shell and a
  route-level App Router loading fallback. PDF modal and new-tab file opening
  are not route navigations and do not show the route transition overlay.
- Preserve the existing node services, URLs, mutations, and desktop selection
  modifier semantics.

## Milestone 1: Correct sidebar and selection behavior

**Files:**

- Modify `apps/web/src/components/library/library-sidebar.tsx`
- Modify `apps/web/src/components/library/library-content.tsx`
- Modify `apps/web/src/components/library/library-item-row.tsx`
- Modify focused tests under
  `apps/web/src/components/library/__tests__/`

- [x] Add failing tests for the root/workspace primary-action labels and absent
      Settings control.
- [x] Add a failing controlled-content test proving the selected row check
      clears all selected visible nodes.
- [x] Implement the minimal accessible UI changes.
- [x] Run the focused tests and `bun run check`.
- [x] Pause for milestone review.

## Milestone 2: Immediate navigation feedback

**Files:**

- Modify `apps/web/src/components/library/library-sidebar.tsx`
- Modify `apps/web/src/components/library/library-workspace.tsx`
- Add a focused navigation-feedback component if needed
- Add `apps/web/src/app/(app)/loading.tsx`
- Modify focused component and route tests

- [x] Add failing tests proving link and programmatic navigation show an
      immediate, named busy state.
- [x] Add a route-level loading fallback following the bundled Next.js 16.2
      App Router guidance.
- [x] Route library links, row double-clicks, breadcrumbs, and post-create
      redirects through the shared feedback state.
- [x] Run focused tests and `bun run check`.
- [x] Run React Doctor's changed-file regression scan.
- [x] Manually verify the library happy path in a browser.
- [x] Record verification results and pause for final review.

## Milestone 3: Same-route navigation guard

**Files:**

- Modify `apps/web/src/components/library/library-sidebar.tsx`
- Modify `apps/web/src/components/library/library-workspace.tsx`
- Modify focused tests under
  `apps/web/src/components/library/__tests__/`

- [x] Add failing tests proving already-open sidebar and programmatic
      destinations do not activate loading feedback.
- [x] Route link and programmatic navigation through a shared current-path
      guard.
- [x] Run focused tests, `bun run check`, and React Doctor's changed-file
      regression scan.
- [x] Manually verify repeated workspace/folder opening in a browser.

## Milestone 4: Responsive tag mutations

**Files:**

- Modify `apps/web/src/components/library/tag-panel.tsx`
- Modify `apps/web/src/components/library/library-workspace.tsx`
- Modify focused tests under
  `apps/web/src/components/library/__tests__/`

- [x] Add failing tests for visible tag-creation progress, preserving input
      while pending, and surfacing creation errors.
- [x] Add failing tests proving tag creation and assignment update the existing
      library cache without a full snapshot refetch.
- [x] Apply assignments optimistically and restore the prior snapshot if the
      server rejects the change.
- [x] Run focused tests, `bun run check`, React Doctor, and browser verification.

## Milestone 5: PDF viewer demo notes

**Files:**

- Modify `docs/DEMO.md`

- [x] Add a short PDF viewer walkthrough and architecture note.
- [x] Add a **Why Extend UI?** rationale with the source link.
- [x] Run `bun run check`.

## Milestone 6: Search-only demo scope

**Files:**

- Modify `docs/DEMO.md`

- [x] Remove the assistant from the search walkthrough and supporting demo
      notes.
- [x] Mention the assistant near the end as an intentionally deferred feature.
- [x] Run `bun run check`.

## Milestone 7: Testing and delivery demo notes

**Files:**

- Modify `docs/DEMO.md`

- [x] Explain the static, Vitest/React Testing Library, Playwright, and React
      Doctor test layers.
- [x] Add concise **Why this testing library?** talking points.
- [x] Describe the GitHub Actions CI pipeline and distinguish it from
      production delivery.
- [x] Run `bun run check`.

## Milestone 8: Plain-language demo walkthrough

**Files:**

- Modify `docs/DEMO.md`

- [x] Reshape the guide around short, scannable walkthrough bullets.
- [x] Replace low-level implementation claims with surface-level explanations
      suitable for the presenter.
- [x] Link the official documentation behind each named package or framework.
- [x] Preserve the verified demo order, limitations, setup, and checklist.
- [x] Run `bun run check`.

## Self-review

- The implementation scope remains limited to the requested library behavior
  and demo-runbook refinements.
- Loading feedback covers the named workspace/note entry paths and the other
  navigation controls owned by the same shell without changing service seams.
- TDD is feasible through existing sidebar, content, item-row, workspace, and
  route test suites.
- The route fallback follows the repository's installed Next.js documentation;
  no remembered framework convention is assumed.

## Verification notes

- 2026-07-29 baseline: `bun run check` passed with 62 test files / 394 tests
  before implementation.
- TDD red phase produced the seven expected focused failures. The implemented
  sidebar, selection, and navigation-feedback behavior then passed all 40
  focused component tests.
- `bun run check` passed after implementation with 62 test files / 400 tests.
- Playwright passed all four runnable app smoke tests; the microphone-dependent
  live-session case remained capability-gated and skipped.
- React Doctor scored the changed React surface 98/100 with an empty
  diagnostics report.
- Browser verification covered root **New workspace**, absent Settings, whole
  selection clearing from a selected row's check control, workspace
  **New note**, the route-level **Loading Lumen** fallback, and immediate named
  feedback while opening a note.
- The closing `docs-sanity-check` found no dead Markdown links, generated drift,
  or stale docs. It identified two stale implementation paths in active plans
  and one unreachable reference README; all three were corrected. Its nine
  stub markers are explanatory wording in completed plans, while the remaining
  legacy path references were confirmed historical or planned.
- Reopened after browser use exposed that navigating to the already-current
  workspace or folder left the immediate feedback overlay active indefinitely.
- Milestone 3 TDD produced the three expected failures, then passed 24 focused
  sidebar/workspace tests. The final `bun run check` passed 62 test files / 402
  tests.
- The shared guard compares each intended destination with
  `window.location.pathname` at interaction time. This covers both `Link`
  navigation intents and programmatic `router.push` calls without subscribing
  the whole workspace to pathname changes.
- React Doctor initially flagged a `usePathname` handler-only subscription; the
  canonical deferred-read fix restored its score to 98/100 with no findings.
- Browser verification reopened the current workspace and a temporary current
  folder without showing either loading overlay. The temporary folder was
  deleted after verification.
- Tag mutation review found that both creation and bulk assignment wait on a
  full `GET /api/library` invalidation after their focused mutation request.
  That follow-up reload fetches unrelated nodes, recordings, and transcripts as
  well as tags. Milestone 4 removes this avoidable wait by reconciling the
  existing query cache from server mutation results, with optimistic assignment
  rollback and explicit creation feedback.
- Milestone 4 TDD produced the six expected failures, then passed 28 focused
  sidebar/workspace tests. The final `bun run check` passed 62 test files / 406
  tests.
- Creation now keeps the entered name until success, disables and spins the
  submit button, renders a named live status, and surfaces a retryable inline
  error without discarding input.
- Creation reconciles the returned tag directly into the cached snapshot.
  Assignment applies the desired tag-link state optimistically, replaces
  temporary links with the server response, and restores the prior snapshot on
  error. Neither successful path invalidates the full library query.
- React Doctor returned to 98/100 with no findings after its single-pass cache
  reconciliation recommendation.
- Browser verification observed only `POST /api/library/tags` for creation and
  `POST /api/library/tag-links/bulk` for assignment—no follow-up
  `GET /api/library`. The tag row, count, and selected node chip updated in the
  existing view; the temporary tag was deleted afterward.
- The demo runbook now covers uploading and opening a PDF, the viewer controls,
  client-only dynamic loading, and the decision to adapt Extend UI. It also
  reflects the direct cache reconciliation introduced for tag mutations.
- `bun run check` passed after the documentation update with 62 test files /
  406 tests.
- The search walkthrough now contains no assistant flow, credentials, citations,
  or assistant-specific code links. A short closing note records the assistant
  as intentionally deferred while preserving search and MCP as independent
  architecture seams.
- The testing section now explains the static checks, Vitest, React Testing
  Library, Playwright, and React Doctor layers; their trade-offs; and the
  ordered GitHub Actions jobs. It explicitly identifies the repository workflow
  as CI rather than claiming a GitHub-controlled production deployment.
- `bun run check` passed after both documentation refinements with 62 test
  files / 406 tests.
- The runbook is now a click-by-click walkthrough built from **What to do**,
  **What to say**, short rationale, and **Useful reading** bullets. The auth
  section deliberately stops at visible behavior and database-level user
  separation, tells the presenter not to guess about cookies or tokens, and
  links the official Supabase Auth/RLS and Next.js Proxy guides for follow-up.
- Official or maintainer-owned reading now accompanies Next.js, React,
  TypeScript, Supabase, TanStack Query, TipTap, Extend UI, pg-boss,
  nodejs-whisper, FFmpeg, CMake, sherpa-onnx, Transformers.js, Web Workers,
  Postgres search, pgvector, Vitest, Testing Library, Playwright, GitHub
  Actions, Biome, and React Doctor.
- `bun run check` passed after the plain-language rewrite with 62 test files /
  406 tests.
