# Bulk Node Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` before each production-code patch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** queued — design approved; implementation awaits written-spec review
**Version:** cross-cutting
**Area:** library selection, tag assignment, service API
**Created:** 2026-06-19
**Design:** [`2026-06-19-bulk-node-tagging-design.md`](../../../superpowers/specs/2026-06-19-bulk-node-tagging-design.md)

**Goal:** Let users apply and remove created tags across any single or
multi-selected library nodes through an always-visible tri-state Tags menu.

**Architecture:** Lift selected node IDs to `LibraryWorkspace`, derive tri-state
tag coverage with a pure helper, and render the editor in `LibraryActions`.
Persist desired tag state through one user-scoped bulk service/route operation,
then invalidate the library snapshot without clearing selection.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, TanStack
Query, Supabase service layer/RLS, Radix dropdown menu, Vitest + Testing Library.

## Global Constraints

- Read the relevant Next.js 16 route-handler guide under
  `node_modules/next/dist/docs/` before changing API routes.
- The Tags trigger is always rendered inside `LibraryActions`; it is disabled
  with zero selected nodes or while a tag mutation is pending.
- Checked means all selected nodes have the tag; indeterminate means some;
  unchecked means none.
- Checked clicks unlink from all; indeterminate/unchecked clicks link missing
  nodes. The menu stays open after a change.
- All reads and writes are scoped to the authenticated `ctx.userId`.
- Keep selection after success and failure; invalidate `["library"]` after the
  mutation settles.
- Run `bun run check` after every production patch and browser-verify before
  declaring the milestone done.

---

### Task 1: User-scoped bulk tag-link service and route

**Files:**
- Modify: `apps/web/src/server/services/tags.ts`
- Modify: `apps/web/src/server/services/__tests__/tags-read.test.ts`
- Create: `apps/web/src/app/api/library/tag-links/bulk/route.ts`
- Modify: `apps/web/src/components/library/library-api.ts`

**Interfaces:**
- Produces: `setTagOnNodes(ctx, input: { tagId: string; nodeIds: string[]; linked: boolean }): Promise<Tables<"tag_links">[]>`
- Produces: `setTagForNodes(input: { tagId: string; nodeIds: string[]; linked: boolean }): Promise<Tables<"tag_links">[]>`
- Route: `POST /api/library/tag-links/bulk` with the same JSON input.

- [ ] **Step 1: Read the Next.js 16 route-handler guide**

Locate the relevant installed guide with:

```bash
rg -n "Route Handlers|route.ts" node_modules/next/dist/docs
```

Read the matching guide completely and retain the existing authenticated route
conventions in `app/api/library/tag-links/route.ts`.

- [ ] **Step 2: Write failing service tests**

Add tests proving that linking validates all selected nodes, deduplicates input,
preserves existing links, and inserts only missing links:

```ts
it("links a tag to every owned node missing it", async () => {
  const ctx = createContext({
    tags: [{ id: "t1", user_id: "user-1", name: "Exam", color: null }],
    library_nodes: [docRow({ id: "n1" }), docRow({ id: "n2" })],
    tag_links: [{ id: "l1", tag_id: "t1", node_id: "n1" }],
  });

  const links = await setTagOnNodes(ctx, {
    tagId: "t1",
    nodeIds: ["n1", "n2", "n2"],
    linked: true,
  });

  expect(links.map((link) => link.node_id).toSorted()).toEqual(["n1", "n2"]);
  expect((ctx.supabase as FakeSupabase).tables.tag_links).toHaveLength(2);
});
```

Add separate tests for `linked: false` deleting every matching link, repeating
either desired state without error, and rejecting the whole request when one
node is foreign or missing.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
bun run --filter=web test src/server/services/__tests__/tags-read.test.ts
```

Expected: FAIL because `setTagOnNodes` is not exported.

- [ ] **Step 4: Implement the minimal bulk service**

In `tags.ts`, deduplicate `nodeIds`, reject an empty list, call
`assertTagOwned`, select all nodes with `.in("id", nodeIds).eq("user_id",
ctx.userId)`, and require an exact count. Select existing links with
`.eq("tag_id", tagId).in("node_id", nodeIds)`.

For `linked: true`, insert only missing `{ tag_id, node_id }` rows and return
the combined existing/inserted links. For `linked: false`, delete with both tag
and node filters and return the deleted rows. Use `assertNoDatabaseError` after
every query.

- [ ] **Step 5: Verify GREEN and run the repo gate**

```bash
bun run --filter=web test src/server/services/__tests__/tags-read.test.ts
bun run check
```

Expected: all focused tests and the full gate pass.

- [ ] **Step 6: Add the route and browser API helper test-first**

Create a zod schema using `uuidSchema`:

```ts
const bulkTagLinksSchema = z.object({
  tagId: uuidSchema,
  nodeIds: z.array(uuidSchema).min(1),
  linked: z.boolean(),
});
```

The route obtains `getRouteServiceContext`, parses JSON, calls
`setTagOnNodes`, and maps errors through `serviceErrorResponse`. Add to
`library-api.ts`:

```ts
export function setTagForNodes(input: {
  tagId: string;
  nodeIds: string[];
  linked: boolean;
}) {
  return requestJson<Tables<"tag_links">[]>("/api/library/tag-links/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

Run `bun run check` and expect PASS.

- [ ] **Step 7: Commit the backend slice**

```bash
git add apps/web/src/server/services/tags.ts apps/web/src/server/services/__tests__/tags-read.test.ts apps/web/src/app/api/library/tag-links/bulk/route.ts apps/web/src/components/library/library-api.ts
git commit -m "feat(library): add bulk tag link service"
```

### Task 2: Tri-state tag menu in LibraryActions

**Files:**
- Modify: `apps/web/src/components/ui/dropdown-menu.tsx`
- Modify: `apps/web/src/components/library/library-actions.tsx`
- Create: `apps/web/src/components/library/__tests__/library-actions.test.tsx`

**Interfaces:**
- Produces: `tagSelectionState(tagId: string, selectedNodeIds: ReadonlySet<string>, tagLinks: Tables<"tag_links">[]): boolean | "indeterminate"`
- `LibraryActions` additionally consumes `selectedNodeIds`, `tags`, `tagLinks`, `tagMutationPending`, and `onSetTag(tagId, linked)`.

- [ ] **Step 1: Write failing pure-state and component tests**

Cover none/some/all link coverage and the stable trigger:

```tsx
expect(tagSelectionState("t1", new Set(["n1", "n2"]), [])).toBe(false);
expect(tagSelectionState("t1", new Set(["n1", "n2"]), [link("n1")]))
  .toBe("indeterminate");
expect(tagSelectionState("t1", new Set(["n1", "n2"]), [link("n1"), link("n2")]))
  .toBe(true);

renderActions({ selectedNodeIds: new Set() });
expect(screen.getByRole("button", { name: "Tags" })).toBeDisabled();
```

Add interaction assertions that checked calls `onSetTag(tagId, false)`, mixed
and unchecked call `onSetTag(tagId, true)`, `preventDefault()` keeps the menu
open, pending disables the trigger, and an empty tag list renders
`No tags created yet` when selection enables the menu.

- [ ] **Step 2: Run the test and verify RED**

```bash
bun run --filter=web test src/components/library/__tests__/library-actions.test.tsx
```

Expected: FAIL because the new props/helper/menu do not exist.

- [ ] **Step 3: Add the checkbox dropdown primitive**

Extend `components/ui/dropdown-menu.tsx` with an exported
`DropdownMenuCheckboxItem` wrapping Radix `CheckboxItem`. Render the indicator
with the existing lucide `Check` icon and support Radix's
`boolean | "indeterminate"` checked value.

- [ ] **Step 4: Implement the minimal Tags menu**

In `library-actions.tsx`, export `tagSelectionState`, render the Tags trigger on
both root and non-root branches, and map tags into checkbox items. Use a small
color dot (`backgroundColor: tag.color ?? undefined`) and call:

```ts
const linked = tagSelectionState(tag.id, selectedNodeIds, tagLinks) !== true;
onSetTag(tag.id, linked);
```

Prevent the checkbox item select event from closing the menu. Disable the
trigger when `selectedNodeIds.size === 0 || tagMutationPending` and show a
spinner while pending.

- [ ] **Step 5: Verify GREEN and run the repo gate**

```bash
bun run --filter=web test src/components/library/__tests__/library-actions.test.tsx
bun run check
```

Expected: focused tests and full gate pass.

- [ ] **Step 6: Commit the UI slice**

```bash
git add apps/web/src/components/ui/dropdown-menu.tsx apps/web/src/components/library/library-actions.tsx apps/web/src/components/library/__tests__/library-actions.test.tsx
git commit -m "feat(library): add tri-state tag menu"
```

### Task 3: Lift selection and persist tag changes

**Files:**
- Modify: `apps/web/src/components/library/library-workspace.tsx`
- Modify: `apps/web/src/components/library/library-content.tsx`
- Modify: `apps/web/src/components/library/__tests__/library-content.test.tsx`
- Modify: `apps/web/src/components/library/__tests__/library-workspace.test.tsx`

**Interfaces:**
- `LibraryContent` consumes `selectedIds: Set<string>` and `onSelectedIdsChange(next: Set<string>): void` instead of owning selection state.
- `LibraryWorkspace` owns `selectedNodeIds` and calls `setTagForNodes` through TanStack Query.

- [ ] **Step 1: Write failing controlled-selection tests**

Update `renderContent` to own a test wrapper state and prove row gestures emit
the same single/Ctrl/Shift sets. Add a workspace test that selects nodes, opens
Tags, applies a tag, and asserts:

```ts
expect(apiMocks.setTagForNodes).toHaveBeenCalledWith({
  tagId: "tag-1",
  nodeIds: ["alpha", "beta"],
  linked: true,
});
expect(screen.getByText("2 selected")).toBeVisible();
```

Add a rejection case that retains `2 selected`, refreshes the library query,
and renders the error with `role="alert"` near the actions.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
bun run --filter=web test src/components/library/__tests__/library-content.test.tsx src/components/library/__tests__/library-workspace.test.tsx
```

Expected: FAIL because selection is not controlled and the workspace does not
provide tag mutation props.

- [ ] **Step 3: Make LibraryContent selection controlled**

Remove its local `useState<Set<string>>`. Replace every `setSelectedIds(...)`
with `onSelectedIdsChange(next)` or a next set calculated from the current prop.
Keep `anchorIndex`, move/delete dialogs, selection clearing after successful
move/delete, and the existing blocking delete overlay inside `LibraryContent`.

- [ ] **Step 4: Wire workspace state and mutation**

Add `const [selectedNodeIds, setSelectedNodeIds] = useState(new Set<string>())`
to `LibraryWorkspace`. Pass it to both `LibraryActions` and `LibraryContent`.
Create a `useMutation({ mutationFn: setTagForNodes, onSettled: ... })` that
invalidates `libraryQueryKey` without clearing selection. Pass mutation errors
to `LibraryActions` for inline `role="alert"` rendering.

- [ ] **Step 5: Verify GREEN and run the repo gate**

```bash
bun run --filter=web test src/components/library/__tests__/library-content.test.tsx src/components/library/__tests__/library-workspace.test.tsx
bun run check
```

Expected: focused tests and full gate pass.

- [ ] **Step 6: Commit the integration slice**

```bash
git add apps/web/src/components/library/library-workspace.tsx apps/web/src/components/library/library-content.tsx apps/web/src/components/library/__tests__/library-content.test.tsx apps/web/src/components/library/__tests__/library-workspace.test.tsx
git commit -m "feat(library): tag selected nodes"
```

### Task 4: Documentation and browser milestone

**Files:**
- Modify: `docs/product-specs/library-and-notes.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/exec-plans/active/cross-cutting/bulk-node-tagging.md` after promoting this plan from queued
- Modify: `docs/PLANS.md`

**Interfaces:** None; this task records the shipped contract and verification.

- [ ] **Step 1: Update durable docs**

Document tri-state bulk assignment, the always-visible disabled trigger,
selection ownership in `LibraryWorkspace`, and the bulk tag-link endpoint.
Promote this plan from queued to active before implementation and to completed
only after all automated and browser checks pass, updating `docs/PLANS.md` at
each lifecycle boundary.

- [ ] **Step 2: Run the full gate**

```bash
bun run check
```

Expected: PASS with Biome, plan validation, typecheck, and all tests green.

- [ ] **Step 3: Browser happy path**

Run the web app and verify:

1. Tags is visible and disabled with `0 selected`.
2. A single folder/note/PDF/audio selection can gain and lose a tag.
3. Two nodes with mixed tag coverage show indeterminate; clicking fills the
   missing link and the refreshed state becomes checked.
4. Several tags can be toggled without reopening the menu.
5. Selection remains after success and a forced failure.
6. Root workspace nodes are taggable.

- [ ] **Step 4: Update plan verification and commit docs**

Record exact commands, test counts, and browser observations in the completed
plan, then run `bun run check` once more.

```bash
git add docs/product-specs/library-and-notes.md docs/FRONTEND.md docs/exec-plans docs/PLANS.md
git commit -m "docs(library): document bulk node tagging"
```

## Self-Review

- Spec coverage: all binding UX, service scoping, error, test, documentation,
  and browser requirements map to Tasks 1–4.
- Placeholder scan: no TBD/TODO/deferred implementation steps remain.
- Type consistency: service, route, and client helper all use
  `{ tagId: string; nodeIds: string[]; linked: boolean }`; checkbox state is
  consistently `boolean | "indeterminate"`.
