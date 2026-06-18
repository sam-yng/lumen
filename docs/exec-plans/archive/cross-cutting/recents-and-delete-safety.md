# Recents and Delete Safety Implementation Plan

> **Status: ARCHIVED (superseded 2026-06-18).** Implemented and shipped on the
> folder/document model (commit `665b432`), then superseded by the
> navigation-node-tree migration: the `/library/recents` view and
> `server/services/folders.ts` were removed (recents now redirects to `/`), and
> delete-safety is handled by `library_nodes` `ON DELETE CASCADE` plus the node
> bulk-delete confirmation. Kept as a historical record; do not implement from it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recents view for recently updated notes and make folder deletion intentionally delete its full subtree instead of spilling contents into the library root.

**Architecture:** `LibraryWorkspace` gains a `recents` view mode and renders a document-only recents list sorted by `updated_at` descending. The delete confirmation remains in `ItemRow`, but its destructive copy becomes type-specific. Folder cascade behavior is enforced in `server/services/folders.ts` by deleting owned documents/files in the target folder subtree before deleting the folders.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TanStack Query, Supabase service layer, Vitest + Testing Library.

## Global Constraints

- `/library/recents` must show documents only, ordered by `updated_at` descending.
- No folders should be visible in the recents view.
- Every document and folder delete must require the existing confirmation dialog.
- Deleting a folder deletes all descendant folders and all documents/files inside the deleted subtree.
- Deletion stays user-scoped through `user_id` filters.
- Run focused tests and `bun run check` after the patch.

---

### Task 1: Add the recents page and document-only view

**Files:**
- Create: `apps/web/src/app/(app)/library/recents/page.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-sidebar.tsx`
- Create/modify test: `apps/web/src/components/library/__tests__/library-workspace.test.tsx`

**Interfaces:**
- Consumes: `LibraryWorkspace({ view }: { view?: "library" | "tags" | "recents" })`
- Produces: `/library/recents` route and a recents view that renders documents sorted by `updated_at` descending.

- [x] **Step 1: Write failing recents tests**

Add tests asserting that `view="recents"` renders document rows ordered newest-first, excludes folders/files, and that the sidebar Recents item links to `/library/recents`.

- [x] **Step 2: Verify RED**

Run: `bun run --filter @lumen/web test src/components/library/__tests__/library-workspace.test.tsx`

Expected: FAIL because `recents` is not a valid view and the sidebar still renders Recents as disabled text.

- [x] **Step 3: Implement recents route and view**

Add `apps/web/src/app/(app)/library/recents/page.tsx`, widen the `view` prop union, update the sidebar Recents nav to a live link, and render a document-only list sorted by `updated_at` descending when `view === "recents"`.

- [x] **Step 4: Verify focused test**

Run: `bun run --filter @lumen/web test src/components/library/__tests__/library-workspace.test.tsx`

Expected: PASS.

### Task 2: Make delete confirmation copy type-specific

**Files:**
- Modify: `apps/web/src/components/library/library-item-row.tsx`
- Create/modify test: `apps/web/src/components/library/__tests__/library-item-row.test.tsx`

**Interfaces:**
- Consumes: existing `ConfirmDialog`.
- Produces: document and folder delete actions that open confirmation dialogs with item-type-specific destructive copy.

- [x] **Step 1: Write failing confirmation tests**

Add tests that open the row action menu, choose Delete, and assert document/folder-specific confirmation text before confirming.

- [x] **Step 2: Verify RED**

Run: `bun run --filter @lumen/web test src/components/library/__tests__/library-item-row.test.tsx`

Expected: FAIL because the dialog currently uses generic `"This action cannot be undone."` copy.

- [x] **Step 3: Implement confirmation copy**

Compute delete dialog title, description, and confirm label from `type`, with folders warning that all contents will be permanently deleted.

- [x] **Step 4: Verify focused test**

Run: `bun run --filter @lumen/web test src/components/library/__tests__/library-item-row.test.tsx`

Expected: PASS.

### Task 3: Delete folder subtrees explicitly

**Files:**
- Modify: `apps/web/src/server/services/folders.ts`
- Modify test: `apps/web/src/server/services/__tests__/library.test.ts`

**Interfaces:**
- Consumes: `deleteFolder(ctx, { id })`
- Produces: `deleteFolder` deleting descendant folders plus owned `documents` and `files` whose `folder_id` is in the deleted folder subtree.

- [x] **Step 1: Write failing service test**

Add a test proving deleting a folder removes child folders, nested documents, and nested files, while leaving outside/other-user rows alone.

- [x] **Step 2: Verify RED**

Run: `bun run --filter @lumen/web test src/server/services/__tests__/library.test.ts`

Expected: FAIL because documents/files inside the deleted folder subtree are not removed by the service.

- [x] **Step 3: Implement subtree deletion**

Load owned folders, compute descendant IDs, delete owned documents/files using `.in("folder_id", ids)`, then delete owned folders using `.in("id", ids)`, returning the originally deleted folder row.

- [x] **Step 4: Verify focused service test**

Run: `bun run --filter @lumen/web test src/server/services/__tests__/library.test.ts`

Expected: PASS.

### Task 4: Full verification

**Files:**
- Modify: `docs/exec-plans/active/cross-cutting/recents-and-delete-safety.md`

- [x] **Step 1: Run full gate**

Run: `bun run check`

Expected: PASS.

- [x] **Step 2: Record verification**

Update this plan with observed verification results.

Observed 2026-06-17:

- `bun run --filter @lumen/web test src/components/library/__tests__/library-workspace.test.tsx src/components/library/__tests__/library-sidebar.test.tsx src/components/library/__tests__/library-item-row.test.tsx src/server/services/__tests__/library.test.ts` PASS, 4 files and 28 tests.
- `bun run check` PASS, 49 web test files and 303 tests. Biome reported the pre-existing unused `LegalFooter` warning in `apps/web/src/app/(app)/layout.tsx`.
- Targeted browser smoke attempted with `bun run --filter @lumen/web test:e2e -- mobile-smoke.spec.ts`; sandboxed run could not bind to port 3000, escalated run started the dev server but Playwright could not launch because its managed Chromium binary is not installed at `/Users/samy/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
