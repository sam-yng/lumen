# CI/CD Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run lint, typecheck, unit/integration tests, and Supabase-backed Playwright smoke tests on every opened, reopened, or freshly updated pull request.

**Architecture:** Keep the root `bun run check` gate DB-free and fast. Add a separate GitHub Actions E2E job that boots the local Supabase stack, applies migrations and seed data, installs Playwright Chromium, and runs the browser smoke tests against the real authenticated app. Document the updated gate and add the dirty-kitchen failure rule to `AGENTS.md`.

**Tech Stack:** GitHub Actions, Bun 1.3.14, Turbo, Biome, TypeScript, Vitest, Playwright, Supabase CLI, Docker, Next.js 16.

---

## Current Findings

- `.github/workflows/ci.yml` already ran on `pull_request`, which by GitHub's default includes opened, reopened, and synchronize events, but the workflow did not make that intent explicit.
- CI previously ran only `bun run check`, which covers Biome plus Turbo typecheck/test.
- `bun run check` does not run `apps/web` Playwright tests.
- The existing Playwright suite logs in as the seeded `demo@lumen.test` user and needs the local Supabase stack.
- The workflow installed Bun `1.3.13`, while root `package.json` declares `bun@1.3.14`.
- The suite had one stale harness-only Vitest smoke test that asserted `1 + 1`; substantive tests now cover the harness.

## Scope

- Update CI workflow triggers and jobs.
- Add a root E2E script for local and CI ergonomics.
- Update docs and agent working rules.
- Run the existing suite and inspect failures before declaring the pipeline hardened.
- Remove stale tests discovered during the audit.
- Do not add unrelated product features or production deployment automation.
- Do not bypass the real auth/storage path for E2E smoke tests.

### Task 1: Make PR CI Intent Explicit

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Update workflow metadata and trigger intent**

Set the workflow to run on `pull_request` activity types `opened`, `synchronize`, `reopened`, and `ready_for_review`, keep `push` to `main`, add `workflow_dispatch`, set read-only repository permissions, and cancel stale in-progress runs for the same ref.

- [x] **Step 2: Align Bun with `package.json`**

Set `oven-sh/setup-bun` to `bun-version: 1.3.14`.

- [x] **Step 3: Keep the DB-free gate as its own job**

Name the existing job `quality-gate` and keep `bun run check` as the command that proves lint, typecheck, unit tests, and integration-style Vitest tests pass without Supabase.

- [x] **Step 4: Run the gate**

Run: `bun run check`

Actual: passes.

### Task 2: Add Supabase-Backed E2E Smoke CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Create: `apps/web/scripts/validate-e2e-env.ts`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/marketing/next.config.ts`

- [x] **Step 1: Add a root E2E script**

Add root `test:e2e` as `bun run --filter @lumen/web test:e2e`. Keep Playwright out of Turbo because Turbo env isolation does not reliably carry local Supabase env from the repo root into the app package.

- [x] **Step 2: Add E2E env preflight**

Add `apps/web/scripts/validate-e2e-env.ts` and run it before `playwright test` so local E2E failures stop immediately when Supabase env is missing instead of timing out in repeated Next/Zod errors.

- [x] **Step 3: Add an `e2e-smoke` CI job**

The job installs dependencies, starts/resets Supabase from `apps/web`, exports local Supabase env vars from `supabase status -o env`, installs Playwright Chromium, runs `bun run test:e2e`, and uploads Playwright artifacts on failure.

- [x] **Step 4: Ensure the E2E job depends on the quality gate**

Use `needs: quality-gate` so the heavier Docker/browser job only runs after lint/typecheck/Vitest pass.

- [x] **Step 5: Fix local Next 16 dev-server root detection**

Set `turbopack.root` in both Next configs to the repo root, following the local Next 16 docs, so parent lockfiles outside the repo do not make Turbopack watch the wrong directory.

- [x] **Step 6: Run the gate**

Run: `bun run check`

Actual: passes.

- [x] **Step 7: Run the browser smoke locally if Supabase is available**

Run from the repo root: `bun run test:e2e`

Actual: local browser execution is blocked because Docker Desktop is not running and Supabase CLI cannot reach the Docker engine. The command now exits quickly at the env preflight instead of timing out in Next.js.

### Task 3: Document the Pipeline and Failure Hygiene

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `BACKPRESSURE.md`
- Modify: `docs/RELIABILITY.md`
- Modify: `docs/PLANS.md`

- [x] **Step 1: Add the dirty-kitchen working rule**

Add a working rule to `AGENTS.md`: when a pre-existing failure is discovered, pause, stash or otherwise isolate current changes, fix the baseline failure first, then resume the original work.

- [x] **Step 2: Update the command map and reliability docs**

Document that CI runs `bun run check` plus `bun run test:e2e`, with Supabase-backed Playwright smoke tests in the separate E2E job.

- [x] **Step 3: Update `docs/PLANS.md`**

List this plan under Active `cross-cutting`.

- [x] **Step 4: Run the gate**

Run: `bun run check`

Actual: passes.

### Task 4: Review Test Suite Freshness

**Files:**
- Delete: `apps/web/src/lib/__tests__/smoke.test.ts`
- Modify: `docs/exec-plans/active/cross-cutting/ci-cd-hardening.md`

- [x] **Step 1: Inventory automated tests**

Record the Vitest and Playwright test areas covered by the current suite.

- [x] **Step 2: Identify stale or wasteful tests**

Look for placeholder smoke tests, duplicated coverage that no longer guards a meaningful seam, tests that assert implementation trivia, and E2E steps that mutate shared seeded state in a brittle way.

- [x] **Step 3: Remove stale coverage**

Delete `apps/web/src/lib/__tests__/smoke.test.ts`. It only asserted `1 + 1` and documented that real tests would arrive later.

- [x] **Step 4: Record recommendations**

Add concrete recommendations for the next CI maturity steps, including branch protection, artifact retention, dependency caching, E2E sharding thresholds, and eventual production deployment gates.

- [x] **Step 5: Final verification**

Run: `bun run check`

Actual: passes with 22 Vitest files and 103 tests.

Run: `bun run test:e2e`

Actual: blocked locally by Docker Desktop not running and missing app E2E env; preflight exits clearly.

## Test Suite Audit

**Vitest coverage kept:**
- Proxy/auth guard behavior, including the `/api/mcp` public-prefix exception.
- Auth form, tag color picker, and file upload picker UI behavior.
- Service-layer library, document read, tag read, storage-provider, queue, search, semantic chunking, semantic indexing, and deterministic embedding behavior.
- MCP auth, server registration, tools, resources, prompts, and tenant isolation.
- Worker transcription orchestration and Whisper JSON normalization/provider behavior.

**Playwright coverage kept:**
- Seeded demo-user login and authenticated library route flow.
- Folder and note creation through the UI.
- Search result navigation to the note route.
- Upload picker selected-file/clear behavior.
- Tag creation with preset color.

**Removed stale coverage:**
- Deleted `apps/web/src/lib/__tests__/smoke.test.ts`. It was a harness-only placeholder and no longer added signal.

**No other stale tests found:**
- The remaining tests map to current seams or user-visible flows. The service tests use fakes, but they guard user scoping, semantic search, queue payloads, and worker behavior without requiring a database in the fast gate.

## Recommendations

- Make `quality-gate` and `e2e-smoke` required branch-protection checks before merging to `main`.
- Add dependency caching once the first few CI runs establish stable timings; keep `bun install --frozen-lockfile` as the correctness guard.
- Add a scheduled nightly workflow for heavier checks later: production build, docs/schema drift checks, and DB-backed integration tests that are too slow for every PR.
- Split Playwright into shards only after the smoke suite grows beyond roughly 8-10 specs or consistently exceeds 8 minutes.
- Add deployment gates separately from PR CI: preview deploy smoke checks first, then protected production deployment with required CI status and environment approvals.
- Keep the E2E smoke path real-auth/real-Supabase. Do not replace it with test-only auth bypasses unless a separate lower-level browser component suite is introduced.

## Plan Self-Review

- Scope coverage: The plan covers PR trigger intent, lint/typecheck, Vitest unit/integration tests, Playwright E2E smoke tests, docs, the requested AGENTS working rule, stale-test removal, and test-suite review.
- Configuration-first exception: Workflow YAML and package scripts do not have a practical red/green unit test seam; verification is through `bun run check`, local Playwright preflight, and workflow review.
- No placeholders: Each task names exact files, commands, and actual outcomes.
- Risk: CI E2E depends on Docker and Supabase CLI behavior in GitHub Actions. If Supabase startup is too slow or the pgvector extension is unavailable in the local image, the fix should be to repair the local-stack path rather than replace the browser smoke with a fake auth path.

## Retrospective

**Shipped:** PR CI now has an explicit fast `quality-gate` and a Supabase-backed `e2e-smoke` job; Bun is aligned to 1.3.14; stale CI runs cancel; jobs have timeouts; Playwright artifacts upload on failure; root `bun run test:e2e` exists; E2E env preflight fails fast; Next Turbopack root is pinned for both apps; dirty-kitchen guidance is in `AGENTS.md`; stale harness-only Vitest smoke test removed.

**Verification:** `bun run check` passes after each patch. `bun run test:e2e` is locally blocked by Docker Desktop not running, but now exits in preflight with a clear message instead of timing out.
