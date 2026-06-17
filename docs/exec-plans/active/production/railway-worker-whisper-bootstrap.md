# Railway Worker Whisper Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** production

**Goal:** Make the Railway worker image boot with a prebuilt `whisper-cli` so the service can run with an empty custom start command.

**Architecture:** Keep the bootstrap in the worker Docker image, not Railway runtime settings. Add a small repository check that guards the Dockerfile against missing native build prerequisites, swallowed Whisper bootstrap failures, and absent `whisper-cli` verification.

**Tech Stack:** Docker, Bun, `nodejs-whisper`, CMake, Railway.

## Global Constraints

- The Railway worker service builds from `apps/web/worker/Dockerfile` with the repo root as build context.
- The worker service start command should remain empty so Dockerfile `CMD ["bun", "run", "worker:transcribe"]` owns runtime startup.
- `PG_BOSS_DATABASE_URL` should use Supabase session-mode pooler `...pooler.supabase.com:5432`, not transaction pooler `:6543`.
- Diarization remains optional via `DIARIZATION_ENABLED`; disabling it must not affect the core record -> transcript -> view path.

---

### Task 1: Guard Worker Bootstrap

**Files:**
- Create: `scripts/check-worker-dockerfile.ts`
- Modify: `package.json`
- Modify: `apps/web/worker/Dockerfile`
- Modify: `docs/exec-plans/completed/production/prod-readiness/DEPLOY.md`
- Modify: `apps/web/.env.example`
- Modify: `docs/PLANS.md`

**Interfaces:**
- Consumes: `apps/web/worker/Dockerfile` text.
- Produces: `bun run check:worker-dockerfile`, included in root `bun run check`.

- [x] **Step 1: Write the failing Dockerfile check**

  Add `scripts/check-worker-dockerfile.ts` that asserts:
  - the worker apt package list includes `git`
  - `worker:download-model` is not followed by `|| true`
  - the Dockerfile has an explicit `cmake -S node_modules/nodejs-whisper/cpp/whisper.cpp`
  - the Dockerfile has a `test -x node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-cli`

- [x] **Step 2: Run the check to verify it fails**

  Run: `bun run scripts/check-worker-dockerfile.ts`

  Expected: FAIL because the current Dockerfile omits `git`, swallows `worker:download-model`, and does not verify `whisper-cli`.

- [x] **Step 3: Patch the worker Dockerfile**

  Add `git` to the native packages, run `worker:download-model` without `|| true`, explicitly run CMake, and verify the executable exists before the image can publish.

- [x] **Step 4: Wire the check into the root gate**

  Add `check:worker-dockerfile` to `package.json` and include it in `bun run check`.

- [x] **Step 5: Correct deploy docs**

  Update the deploy matrix and `.env.example` to include worker `NEXT_PUBLIC_SUPABASE_*`, prefer the session-mode pooler, and state that Railway custom start command should be empty after this Dockerfile ships.

- [x] **Step 6: Verify**

  Run:

  ```bash
  bun run check:worker-dockerfile
  bun run check
  ```

  Expected: both pass.
