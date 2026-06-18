# Document Editor Fixed Shell Implementation Plan

> **Status: COMPLETED.** Shipped (editor split `f5abb55`); the viewport-bounded
> flex shell with non-scrolling header/toolbar is live in
> `components/editor/document-editor.tsx` and remains valid under the
> navigation-node-tree page editor.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the document header and editor toolbar visible while long note content scrolls inside the editor.

**Architecture:** `DocumentEditor` becomes a viewport-bounded flex column. `DocumentHeader` and `EditorToolbar` remain non-scrolling children, while the editor body becomes the only vertical scroll container.

**Tech Stack:** React 19 client component, TipTap, Tailwind v4 utilities, Testing Library + Vitest.

## Global Constraints

- Do not change TipTap schema, extensions, autosave behavior, or citation marking.
- Keep `DocumentHeader` and `EditorToolbar` in view for long documents.
- Put vertical overflow on the in-document body, not the page.
- Preserve horizontal toolbar overflow behavior on narrow screens.
- Run `bun run check` after the patch.

---

### Task 1: Viewport-bounded editor shell

**Files:**
- Modify: `apps/web/src/components/editor/document-editor.tsx`
- Test: `apps/web/src/components/editor/__tests__/document-editor.test.tsx`

**Interfaces:**
- Consumes: `DocumentEditor({ document, citationBlockIndex })`
- Produces: a rendered editor shell with `data-testid="document-editor-shell"` and an internal scroller with `data-testid="document-editor-scroll"`; the shell is viewport-bounded and the scroller owns vertical overflow.

- [x] **Step 1: Write failing layout test**

Add a test asserting the shell and scroll container classes:

```tsx
it("keeps header and toolbar fixed while the document body scrolls", async () => {
  renderEditor(null);

  const shell = await screen.findByTestId("document-editor-shell");
  const scroller = screen.getByTestId("document-editor-scroll");

  expect(shell).toHaveClass("h-[calc(100dvh-var(--app-shell-top-offset,0px))]");
  expect(shell).toHaveClass("flex");
  expect(shell).toHaveClass("flex-col");
  expect(scroller).toHaveClass("min-h-0");
  expect(scroller).toHaveClass("flex-1");
  expect(scroller).toHaveClass("overflow-y-auto");
});
```

- [x] **Step 2: Verify RED**

Run: `bun run --filter @lumen/web test src/components/editor/__tests__/document-editor.test.tsx`

Expected: FAIL because the component does not expose the shell/scroller contract yet.

- [x] **Step 3: Implement fixed shell**

Update `DocumentEditor` so the outer section has fixed viewport height and flex column layout. Wrap the editor body in a `min-h-0 flex-1 overflow-y-auto` container. Keep `DocumentHeader` and `EditorToolbar` as direct non-scrolling children above the scroll container.

- [x] **Step 4: Verify focused test**

Run: `bun run --filter @lumen/web test src/components/editor/__tests__/document-editor.test.tsx`

Expected: PASS.

- [x] **Step 5: Browser check**

Use local browser automation against `/library` as the seeded demo user. Confirm the document shell height is viewport-bounded and the internal scroll container owns vertical overflow.

Observed 2026-06-17: seeded note shell measured 808px tall in a 900px
viewport; injected long editor content made `document-editor-scroll` overflow
(`scrollHeight` 3554 / `clientHeight` 698). Scrolling the internal container
moved `scrollTop` to 2856 while the document header and editor toolbar kept
the same Y positions.

- [x] **Step 6: Full gate**

Run: `bun run check`

Expected: PASS.

Observed 2026-06-17: PASS with 46 web test files and 297 tests.
