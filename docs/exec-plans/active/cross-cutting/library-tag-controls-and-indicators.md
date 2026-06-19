# Library Tag Controls and Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` before each production-code patch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** active
**Version:** cross-cutting
**Area:** library selection, tag visibility
**Created:** 2026-06-19
**Depends on:** [`completed/cross-cutting/bulk-node-tagging.md`](../../completed/cross-cutting/bulk-node-tagging.md)
**Design:** [`2026-06-19-library-tag-controls-and-indicators-design.md`](../../../superpowers/specs/2026-06-19-library-tag-controls-and-indicators-design.md)

**Goal:** Put bulk tag editing beside the other selection actions and show stable, named tag indicators on each tagged library node.

**Architecture:** `LibraryWorkspace` keeps ownership of selection and tag mutations, and derives one ordered node-to-tags lookup from the library snapshot. `LibraryContent` owns the selection action bar and passes each row only its assigned tags; `ItemRow` renders a bounded three-chip summary plus a `+N` overflow chip without changing row height.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Radix dropdown menu, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Render Move, Tags, Delete, and Clear in that order inside `LibraryItemActions`.
- Preserve checked, indeterminate, unchecked, pending, empty, keep-open, error, and retained-selection bulk-tag behavior.
- Preserve tag snapshot order when showing row chips.
- Show at most three tag-name chips plus `+N`; never wrap or increase row height.
- Truncated and overflowed names remain available through accessible labels and native titles.
- Do not change services, routes, the database, or the `setTagForNodes` request contract.
- Run `bun run check` after every production patch and browser-verify before declaring the milestone done.

---

### Task 1: Relocate the bulk tag control

**Files:**
- Create: `apps/web/src/components/library/__tests__/library-item-actions.test.tsx`
- Modify: `apps/web/src/components/library/__tests__/library-actions.test.tsx`
- Modify: `apps/web/src/components/library/library-item-actions.tsx`
- Modify: `apps/web/src/components/library/library-actions.tsx`

**Interfaces:**
- `LibraryItemActions` consumes `selectedNodeIds: ReadonlySet<string>`, `tags: Tables<"tags">[]`, `tagLinks: Tables<"tag_links">[]`, `tagMutationPending: boolean`, `tagMutationError: Error | null`, and `onSetTag(tagId: string, linked: boolean): void` in addition to its existing move/delete/clear callbacks.
- `LibraryActions` retains creation/upload/live-session props only.

- [x] **Step 1: Write failing ownership and behavior tests**

Create a `LibraryItemActions` test fixture with two selected node IDs, three tags, and complete/partial/zero link coverage. Assert DOM button order with:

```ts
expect(
  screen.getAllByRole("button").map((button) => button.textContent?.trim()),
).toEqual(["Move", "Tags", "Delete", "Clear"]);
```

Open Tags and assert `aria-checked="true"`, `"mixed"`, and `"false"`; click each state and expect `(tagId, false)`, `(tagId, true)`, and `(tagId, true)`. Assert the menu stays visible between clicks. Add separate tests for zero-selection disabled state, pending disabled state, the empty-tags message, and inline mutation errors.

Update `library-actions.test.tsx` to assert creation actions remain while `queryByRole("button", { name: "Tags" })` returns `null`. Keep the pure `tagSelectionState` assertions there until Task 2 moves no helper API.

- [x] **Step 2: Run focused tests and verify RED**

```bash
cd apps/web && bun run test src/components/library/__tests__/library-actions.test.tsx src/components/library/__tests__/library-item-actions.test.tsx
```

Expected: FAIL because `LibraryItemActions` does not accept or render tag controls and `LibraryActions` still owns Tags.

- [x] **Step 3: Move the existing dropdown implementation**

Move the `TagsIcon`/`Loader2` imports, dropdown primitives, `tagSelectionState` usage, menu markup, and error paragraph from `LibraryActions` into `LibraryItemActions`. Derive:

```ts
const hasSelection = selectedNodeIds.size > 0;
const selectionDisabled = isBusy || !hasSelection;
const tagsDisabled = selectionDisabled || tagMutationPending;
```

Render Tags immediately after Move. Remove all tag props and tag UI from `LibraryActions`; do not change mutation semantics or menu item callbacks.

- [x] **Step 4: Verify GREEN and run the repo gate**

```bash
cd apps/web && bun run test src/components/library/__tests__/library-actions.test.tsx src/components/library/__tests__/library-item-actions.test.tsx
cd ../..
bun run check
```

Expected: focused tests and full gate PASS.

- [x] **Step 5: Commit the control relocation**

```bash
git add apps/web/src/components/library/library-actions.tsx apps/web/src/components/library/library-item-actions.tsx apps/web/src/components/library/__tests__/library-actions.test.tsx apps/web/src/components/library/__tests__/library-item-actions.test.tsx
git commit -m "feat(library): move tag control beside selection actions"
```

### Task 2: Add stable named tag summaries to rows

**Files:**
- Modify: `apps/web/src/components/library/library-tags.ts`
- Modify: `apps/web/src/components/library/__tests__/library-item-row.test.tsx`
- Modify: `apps/web/src/components/library/library-item-row.tsx`

**Interfaces:**
- Produces `tagsByNodeId(tags: Tables<"tags">[], tagLinks: Tables<"tag_links">[]): ReadonlyMap<string, Tables<"tags">[]>`.
- `ItemRow` consumes optional `assignedTags?: Tables<"tags">[]`, defaulting to `[]`.

- [x] **Step 1: Write failing lookup and row tests**

Add lookup assertions proving snapshot order wins over link order, missing tag IDs are ignored, and untagged nodes have no map entry:

```ts
expect(tagsByNodeId([exam, review], [reviewLink, examLink]).get("page-1"))
  .toEqual([exam, review]);
expect(tagsByNodeId([exam], [missingTagLink]).has("page-1")).toBe(false);
```

Add `ItemRow` tests for one through three named chips and for five assigned tags. For five tags, assert the first three names are visible, the fourth and fifth are absent as text, and a `+2` chip has a title/accessibility string containing both hidden names. Assert an untagged row has no `Tags:` region.

- [x] **Step 2: Run focused tests and verify RED**

```bash
cd apps/web && bun run test src/components/library/__tests__/library-item-row.test.tsx
```

Expected: FAIL because `tagsByNodeId` and `assignedTags` do not exist.

- [x] **Step 3: Implement the ordered lookup**

Build a `Map<string, Set<string>>` of linked tag IDs by node, then iterate the `tags` array for every linked node so output follows snapshot order and stale tag IDs disappear. Return a `ReadonlyMap` and do not mutate either input.

- [x] **Step 4: Render the fixed tag region**

In `ItemRow`, derive:

```ts
const visibleTags = assignedTags.slice(0, 3);
const hiddenTags = assignedTags.slice(3);
```

After the flexible title/meta span, render a right-aligned region only when tags exist. Give the region a bounded width, `shrink-0`, `overflow-hidden`, and `whitespace-nowrap`; give each visible chip `min-w-0`, a bounded max width, and `truncate`. Set each chip's `title` and accessible label to the full name. Render a non-shrinking `+${hiddenTags.length}` chip whose title and accessible label list the hidden tag names. Do not add wrapping or vertical padding.

- [x] **Step 5: Verify GREEN and run the repo gate**

```bash
cd apps/web && bun run test src/components/library/__tests__/library-item-row.test.tsx
cd ../..
bun run check
```

Expected: focused tests and full gate PASS.

- [x] **Step 6: Commit row summaries**

```bash
git add apps/web/src/components/library/library-tags.ts apps/web/src/components/library/library-item-row.tsx apps/web/src/components/library/__tests__/library-item-row.test.tsx
git commit -m "feat(library): show tag summaries on nodes"
```

### Task 3: Wire snapshot tags through the workspace

**Files:**
- Modify: `apps/web/src/components/library/__tests__/library-content.test.tsx`
- Modify: `apps/web/src/components/library/__tests__/library-workspace.test.tsx`
- Modify: `apps/web/src/components/library/library-content.tsx`
- Modify: `apps/web/src/components/library/library-workspace.tsx`

**Interfaces:**
- `LibraryContent` consumes `tagsByNodeId: ReadonlyMap<string, Tables<"tags">[]>` plus the tag-control props defined in Task 1.
- `LibraryWorkspace` computes the lookup with `useMemo(() => tagsByNodeId(tags, tagLinks), [tags, tagLinks])` and keeps `setTagForNodes` ownership unchanged.

- [ ] **Step 1: Write failing integration tests**

Extend the controlled `LibraryContent` fixture with tags, links, a lookup, mutation state, and `onSetTag`. Assert Tags appears between Move and Delete, a selected pair produces the expected callback, and tagged rows receive their named/overflow summaries.

Update the mocked `LibraryContent` in `library-workspace.test.tsx` to expose its received `onSetTag`, `tagMutationError`, and lookup. Keep the existing persistence tests but trigger the callback through the mock and assert the lookup maps the tagged node to the snapshot-ordered tag records.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd apps/web && bun run test src/components/library/__tests__/library-content.test.tsx src/components/library/__tests__/library-workspace.test.tsx
```

Expected: FAIL because the workspace/content prop chain does not carry the relocated control or assignment lookup.

- [ ] **Step 3: Wire control props and row assignments**

Pass selection, tags, links, tag pending/error state, and `onSetTag` from `LibraryWorkspace` to `LibraryContent`, then into `LibraryItemActions`. Pass `tagsByNodeId.get(node.id) ?? []` to each `ItemRow`. Remove the old tag props from `LibraryActions`.

- [ ] **Step 4: Derive the lookup once in the workspace**

Import `useMemo` and `tagsByNodeId`, derive the map before conditional returns, and pass it to `LibraryContent`. Keep query invalidation on mutation settlement and do not clear `selectedNodeIds`.

- [ ] **Step 5: Verify GREEN and run the repo gate**

```bash
cd apps/web && bun run test src/components/library/__tests__/library-content.test.tsx src/components/library/__tests__/library-workspace.test.tsx
cd ../..
bun run check
```

Expected: focused tests and full gate PASS.

- [ ] **Step 6: Commit workspace integration**

```bash
git add apps/web/src/components/library/library-content.tsx apps/web/src/components/library/library-workspace.tsx apps/web/src/components/library/__tests__/library-content.test.tsx apps/web/src/components/library/__tests__/library-workspace.test.tsx
git commit -m "feat(library): wire node tag indicators"
```

### Task 4: Documentation and browser milestone

**Files:**
- Modify: `docs/product-specs/library-and-notes.md`
- Modify: `docs/FRONTEND.md`
- Move: `docs/exec-plans/queued/cross-cutting/library-tag-controls-and-indicators.md` to `docs/exec-plans/active/cross-cutting/` before implementation and then `docs/exec-plans/completed/cross-cutting/` after verification
- Modify: `docs/PLANS.md` at each lifecycle transition

**Interfaces:** None; this records the shipped interaction contract and verification evidence.

- [ ] **Step 1: Update durable docs**

Document that bulk tagging belongs to the selection action bar and that rows show up to three ordered name chips plus `+N` without changing row height. Update the plan lifecycle and index in the same patch.

- [ ] **Step 2: Run the full gate**

```bash
bun run check
```

Expected: PASS with Biome, plan lifecycle, typecheck, and all tests green.

- [ ] **Step 3: Browser happy path**

Run the web app and verify: Tags appears after Move and nowhere in the creation toolbar; zero selection disables it; checked/mixed/unchecked changes persist without clearing selection; one-to-three names display on the correct nodes; four-or-more tags produce `+N`; long and duplicate-color names remain identifiable; and adding/removing tags does not change row height.

- [ ] **Step 4: Run React Doctor and final verification**

Follow `.agents/skills/react-doctor/SKILL.md` for the changed React files, fix actionable regressions, then run `bun run check` again. Record exact test counts and browser observations in this plan's Verification section before moving it to completed.

- [ ] **Step 5: Commit docs and verification**

```bash
git add docs/product-specs/library-and-notes.md docs/FRONTEND.md docs/exec-plans docs/PLANS.md
git commit -m "docs(library): document node tag indicators"
```

## Verification

Pending implementation.

## Self-Review

- Spec coverage: Tasks 1–4 cover control ownership, preserved tri-state behavior, stable ordered names, overflow, accessibility, wiring, durable docs, and browser verification.
- Placeholder scan: the only pending text is the explicit post-implementation Verification section; every implementation step has exact files, commands, expected results, and behavior.
- Type consistency: the plan consistently uses `ReadonlyMap<string, Tables<"tags">[]>`, `ReadonlySet<string>`, and the existing `(tagId: string, linked: boolean) => void` mutation callback.
