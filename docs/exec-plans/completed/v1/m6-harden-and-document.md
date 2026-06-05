# M6 - Harden & Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close v1 by fixing real documentation drift, consolidating service-test scaffolding, adding the missing browser happy path, and recording the final v1 state without starting v2.

**Architecture:** M6 is a release-hardening milestone. It keeps the v1 product surface and v2 roadmap frozen, strengthens the existing service and documentation seams, and verifies the app through the existing check gate plus one Playwright happy path.

**Tech Stack:** Bun, Next.js 16 App Router, React 19, TypeScript strict, Biome, Vitest, Playwright, Supabase local stack, TanStack Query.

---

## Scope Freeze

- Do not add MCP, assistant, embeddings, pgvector, semantic search, OAuth/MCP auth, or any other v2 implementation scaffold.
- Do not redesign the workspace or apply the deferred visual restyle.
- Do not split `src/components/library/library-workspace.tsx` unless a required M6 change makes the split necessary. The file is large, but a cosmetic split is not release hardening.
- Preserve pre-existing worktree changes unless explicitly told otherwise. At plan time, `docs/exec-plans/completed/m4-transcription.md` already has an unstaged checkbox change marking the M4 review pause complete.

## Current Audit Findings

- `bun run check` is green: Biome, `tsc --noEmit`, and 38 Vitest tests pass.
- Supabase local stack is running.
- `docs/generated/db-schema.md` matches `supabase/migrations/*.sql`.
- Docs graph has no unreachable files.
- Broken internal links:
  - `docs/exec-plans/completed/m5-search-transcripts.md`: the inline link to `search-and-transcripts.md` resolves relative to the completed-plan directory.
  - `docs/exec-plans/completed/m5-search-transcripts.md`: the inline self-link to `exec-plans/completed/m5-search-transcripts.md` resolves relative to the completed-plan directory.
- Stale docs:
  - `docs/product-specs/library-and-notes.md` still says M5 full-text search remains pending.
  - `docs/QUALITY_SCORE.md` still has M6 placeholders for empty/loading/error states and e2e coverage.
- Real tech debt:
  - `src/server/services/__tests__/library.test.ts` still owns an inline Supabase fake while `src/server/services/__tests__/search.test.ts` uses `src/server/services/__tests__/fake-supabase.ts`.
- Playwright is configured, but no `e2e/` specs exist yet.

---

### Task 1: Fix Documentation Drift

**Files:**
- Modify: `docs/exec-plans/completed/m5-search-transcripts.md`
- Modify: `docs/product-specs/library-and-notes.md`
- Modify: `docs/QUALITY_SCORE.md`

- [x] **Step 1: Fix the broken product-spec link in the M5 completed plan**

In `docs/exec-plans/completed/m5-search-transcripts.md`, replace the stale inline Markdown link that points to `search-and-transcripts.md` from the completed-plan directory with a repo-correct relative link:

```markdown
[search-and-transcripts.md](../../../product-specs/search-and-transcripts.md)
```

- [x] **Step 2: Fix the broken completed-plan self-link**

In the same file, replace the link target inside the `docs/PLANS.md` closeout snippet so Markdown resolves it correctly from `docs/exec-plans/completed/`: keep the link text as `m5-search-transcripts.md` and set the target to `m5-search-transcripts.md`.

If the snippet is meant to demonstrate text that belongs inside `docs/PLANS.md`, prefer turning it into inline code instead of keeping a misleading link. Do not leave a broken relative link behind.

- [x] **Step 3: Update library-and-notes M5 status**

In `docs/product-specs/library-and-notes.md`, replace:

```markdown
Status: M4 implemented; M5 full-text search remains pending.
```

with:

```text
Status: M4 implemented; M5 full-text search is implemented in search-and-transcripts.md.
```

- [x] **Step 4: Update quality score after the e2e task lands**

After Task 3 is complete, update `docs/QUALITY_SCORE.md` so it reflects the final v1 state:

```markdown
| Empty/loading/error states | Green: core workspace, search, editor, upload/transcript states handled |
| Vitest units + Playwright e2e | Green: service/worker units plus one browser happy path |
| Docs link-clean | Green (M6) |
```

If Task 3 is not complete yet, leave the e2e row pending until it is true.

- [x] **Step 5: Verify docs links and gate**

Run:

```bash
bun run check
```

Expected:

```text
Checked ... files ... No fixes applied.
Test Files 6 passed
Tests 38 passed
```

---

### Task 2: Consolidate the Service Supabase Test Fake

**Files:**
- Modify: `src/server/services/__tests__/library.test.ts`
- Modify: `src/server/services/__tests__/fake-supabase.ts` only if the library tests expose a missing shared-fake behavior.
- Modify: `docs/exec-plans/tech-debt-tracker.md`

- [x] **Step 1: Replace the inline fake imports**

At the top of `src/server/services/__tests__/library.test.ts`, remove these imports:

```ts
import type {
  QueryResult,
  ServiceContext,
  ServiceQuery,
} from "@/server/services/context";
```

Add this import:

```ts
import {
  createContext,
  otherUserId,
  userId,
} from "@/server/services/__tests__/fake-supabase";
```

- [x] **Step 2: Delete the inline fake implementation**

Delete the local `type Row`, `FakeQuery`, `FakeSupabase`, `userId`, `otherUserId`, and `createContext` declarations from `src/server/services/__tests__/library.test.ts`.

Keep `FakeStorage` in `library.test.ts`; it is upload-specific and is not duplicated elsewhere.

- [x] **Step 3: Run the library service tests**

Run:

```bash
bunx vitest run src/server/services/__tests__/library.test.ts
```

Expected:

```text
Test Files 1 passed
```

If tests fail because the shared fake sorts differently from the inline fake, update `src/server/services/__tests__/fake-supabase.ts` to preserve the useful behavior:

```ts
if (typeof av === "number" && typeof bv === "number") return av - bv;
return String(av).localeCompare(String(bv));
```

Do not reintroduce a second fake.

- [x] **Step 4: Remove the completed debt row**

In `docs/exec-plans/tech-debt-tracker.md`, delete this row after the tests pass:

```markdown
| Two Supabase test fakes | M4's inline fake in `library.test.ts` (lexical `order`) vs shared `__tests__/fake-supabase.ts` (numeric `order`, `ilike`/`textSearch`). Consolidate onto the shared fake. | M6 |
```

Leave the `FFmpeg not installed locally` row unless manual verification proves it is no longer true.

- [x] **Step 5: Run the gate**

Run:

```bash
bun run check
```

Expected: Biome, TypeScript, and Vitest pass.

---

### Task 3: Add the v1 Browser Happy Path

**Files:**
- Create: `e2e/library-happy-path.spec.ts`
- Modify: `.gitignore` if Playwright output is picked up by `bun run check`.
- Modify: `src/components/editor/document-editor.tsx` if the browser pass exposes a release-blocking editor warning.
- Modify: `src/server/services/storage-provider.ts` if manual verification exposes a missing-object file-stream failure.
- Test: `src/server/services/__tests__/storage-provider.test.ts`
- Modify: `docs/QUALITY_SCORE.md` after the test passes.

- [x] **Step 1: Create the e2e directory and spec**

Create `e2e/library-happy-path.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("demo user can open the workspace, search a note, and open the editor", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("demo@lumen.test");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("heading", { name: "Lumen" })).toBeVisible();
  await expect(page.getByText("Welcome to Lumen")).toBeVisible();

  await page
    .getByLabel("Search notes and transcripts")
    .fill("mitochondria");
  const result = page.getByRole("button", { name: /Welcome to Lumen/i });
  await expect(result).toBeVisible();

  await result.click();

  await expect(
    page.getByRole("heading", { name: "Welcome to Lumen" }),
  ).toBeVisible();
  await expect(page.getByText("Rich-text note with autosave")).toBeVisible();
});
```

- [x] **Step 2: Run the e2e happy path**

Ensure the local Supabase stack is up and seeded:

```bash
bunx supabase status
```

If the demo user is missing, run:

```bash
bunx supabase db reset
```

Run:

```bash
bun run test:e2e
```

Expected:

```text
1 passed
```

- [x] **Step 3: If the test exposes missing accessible names, make the smallest UI fix**

Allowed fixes are limited to labels/testability or release-blocking warnings, for example adding `aria-label` to an icon-only control or removing duplicate TipTap extensions. Do not add product features.

- [x] **Step 4: Run the gate**

Run:

```bash
bun run check
```

Expected: green.

---

### Task 4: Manual Browser Verification

**Files:**
- No code changes expected.
- Modify docs only if the manual pass reveals a real release note or caveat.

- [x] **Step 1: Start the dev server**

Run:

```bash
bun run dev
```

Expected:

```text
Local: http://localhost:3000
```

- [x] **Step 2: Verify the happy path in a browser**

Use the in-app browser against `http://localhost:3000` and verify:

- login as `demo@lumen.test` / `demo12345`;
- folder tree renders;
- seeded note opens in the editor;
- search for `mitochondria` returns the seeded note;
- empty search state does not overlap or resize the sidebar badly;
- upload controls, record controls, and tag controls render without text overlap at desktop width.

- [x] **Step 3: Verify mobile framing**

Use a narrow viewport and verify:

- the workspace remains scrollable;
- sidebar/content stack cleanly;
- buttons and form text do not overflow their controls.

- [x] **Step 4: Record genuine findings only**

If the browser pass reveals a release-blocking issue, add a focused fix task before closeout. If it reveals only deferred polish, record it in the completed M6 retrospective or `docs/exec-plans/tech-debt-tracker.md`.

---

### Task 5: Final v1 Documentation Closeout

**Files:**
- Modify: `docs/PLANS.md`
- Modify: `docs/exec-plans/active/m6-harden-and-document.md`
- Move: `docs/exec-plans/active/m6-harden-and-document.md` to `docs/exec-plans/completed/m6-harden-and-document.md`

- [x] **Step 1: Fill the M6 retrospective**

Append this section to the active plan before moving it:

```markdown
## Retrospective

**Shipped:** Documentation drift fixed; shared Supabase service fake consolidated; one browser happy path added; v1 final gate and manual browser pass completed.

**Kept out:** No v2 MCP, assistant, embeddings, semantic search, OAuth/MCP auth, or visual restyle work.

**Verification:** `bun run check`; `bun run test:e2e`; manual browser happy path.

**Follow-up:** v2 starts from the original roadmap after v1 review, not from M6 scaffolding.
```

Adjust the wording only to match actual verification output.

- [x] **Step 2: Move the plan to completed**

Run:

```bash
git mv docs/exec-plans/active/m6-harden-and-document.md docs/exec-plans/completed/m6-harden-and-document.md
```

- [x] **Step 3: Update `docs/PLANS.md`**

Replace:

```markdown
- **active/** - one markdown plan per in-flight milestone. _(none)_
```

with:

```markdown
- **active/** - one markdown plan per in-flight milestone. _(none)_
```

If the active section was changed while M6 was active, restore it to `_(none)_`.

Add a completed entry whose link text is `m6-harden-and-document.md` and whose target is `exec-plans/completed/m6-harden-and-document.md`.

Update the build-order line only if needed to keep M6 listed as the final v1 milestone.

- [x] **Step 4: Final docs and gate checks**

Run:

```bash
bun run check
bun run test:e2e
```

Expected:

```text
bun run check -> green
bun run test:e2e -> 1 passed
```

- [x] **Step 5: Pause for human review**

Do not begin v2 work after M6. The next action is human review of the completed v1 release state.

---

## Plan Self-Review

- Scope coverage: Covers docs drift, test fake consolidation, e2e coverage, manual browser verification, and final milestone closeout.
- No v2 drift: Explicitly excludes MCP, assistant, embeddings, pgvector, semantic search, OAuth/MCP auth, and v2 scaffolding.
- Placeholders: No `TBD` or open implementation placeholders remain.
- Type consistency: Uses the existing shared fake exports from `src/server/services/__tests__/fake-supabase.ts` and existing Playwright config under `playwright.config.ts`.

## Retrospective

**Shipped:** Documentation drift fixed; shared Supabase service fake consolidated; one browser happy path added; Playwright output ignored so it does not poison `bun run check`; duplicate TipTap Link extension removed from the editor; v1 automated gate and manual browser pass completed.

**Kept out:** No v2 MCP, assistant, embeddings, semantic search, OAuth/MCP auth, pgvector, or visual restyle work.

**Verification:** `bun run check`; `bun run test:e2e`; manual browser happy path on desktop and a 390px-wide mobile viewport.

**Manual caveats:** Dense controls truncate or wrap in a few places, especially file/upload action rows; they remain usable and are better handled by the deferred visual restyle. A locally stale audio row without a matching Storage object exposed a file-stream error path; missing Storage objects now map to `not_found` instead of a 500.

**Follow-up:** v2 starts from the original roadmap after v1 review, not from M6 scaffolding.
