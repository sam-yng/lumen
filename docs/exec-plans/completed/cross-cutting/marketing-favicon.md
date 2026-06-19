# Marketing Favicon Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** cross-cutting

**Goal:** Give the marketing site the same browser and Apple icons as the web app.

**Architecture:** Reuse the web app's three existing image assets verbatim in the marketing App Router root. Next.js 16 file-based metadata discovers the files and emits the relevant icon links, so no layout or runtime code changes are needed.

**Tech Stack:** Next.js 16 App Router file conventions, static image assets, Bun.

**Design:** [Marketing favicon parity](../../../superpowers/specs/2026-06-19-marketing-favicon-design.md)

## Global Constraints

- The marketing copies must remain byte-for-byte identical to the web app assets.
- Do not modify either app's root layout or add dependencies.
- Follow the installed Next.js 16 `favicon`, `icon`, and `apple-icon` file conventions.

---

### Task 1: Mirror the web app icon set

**Files:**
- Create: `apps/marketing/src/app/favicon.ico`
- Create: `apps/marketing/src/app/icon.svg`
- Create: `apps/marketing/src/app/apple-icon.png`
- Modify: `docs/PLANS.md`

**Interfaces:**
- Consumes: `apps/web/src/app/favicon.ico`, `apps/web/src/app/icon.svg`, and `apps/web/src/app/apple-icon.png`.
- Produces: Next.js file-based icon metadata for the marketing site.

- [x] **Step 1: Verify the marketing icon files are absent**

  Run:

  ```bash
  test ! -e apps/marketing/src/app/favicon.ico \
    && test ! -e apps/marketing/src/app/icon.svg \
    && test ! -e apps/marketing/src/app/apple-icon.png
  ```

  Expected: exit status 0, establishing that the icon parity check would fail before implementation.

- [x] **Step 2: Copy the complete icon set**

  Run:

  ```bash
  cp apps/web/src/app/favicon.ico apps/marketing/src/app/favicon.ico
  cp apps/web/src/app/icon.svg apps/marketing/src/app/icon.svg
  cp apps/web/src/app/apple-icon.png apps/marketing/src/app/apple-icon.png
  ```

- [x] **Step 3: Verify byte equality**

  Run:

  ```bash
  cmp apps/web/src/app/favicon.ico apps/marketing/src/app/favicon.ico
  cmp apps/web/src/app/icon.svg apps/marketing/src/app/icon.svg
  cmp apps/web/src/app/apple-icon.png apps/marketing/src/app/apple-icon.png
  ```

  Expected: all commands exit with status 0 and produce no output.

- [x] **Step 4: Run the repository gate**

  Run: `bun run check`

  Expected: lint, typecheck, tests, and repository policy checks all pass.

- [x] **Step 5: Verify in a browser**

  Run the marketing dev server with `bun run --filter=marketing dev`, load `/`, and inspect the document head plus favicon request.

  Expected: the page exposes the generated favicon, SVG icon, and Apple touch icon links without request failures.

- [x] **Step 6: Commit the completed change**

  ```bash
  git add apps/marketing/src/app/favicon.ico \
    apps/marketing/src/app/icon.svg \
    apps/marketing/src/app/apple-icon.png \
    docs/PLANS.md \
    docs/exec-plans/active/cross-cutting/marketing-favicon.md \
    docs/superpowers/specs/2026-06-19-marketing-favicon-design.md
  git commit -m "fix(marketing): match web app favicon"
  ```

## Outcome

Completed 2026-06-19. The marketing site now uses byte-identical copies of the
web app favicon, SVG icon, and Apple touch icon. `bun run check` passed with
394 tests, and browser verification confirmed that Next.js emitted and served
all three icon links with the expected content types and dimensions.
