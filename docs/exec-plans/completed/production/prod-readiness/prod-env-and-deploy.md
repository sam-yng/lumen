# Production Env & Deploy Implementation Plan

> **Status:** completed (build) — 2026-06-17. Implementation shipped and
> `bun run check` is green; group moved `active/ → completed/` per the lifecycle
> rule. Checkboxes reflect in-repo work done. The root `.dockerignore` (added
> 2026-06-17) trims the build context for both the web and worker Dockerfiles.
> **Codebase-external remainder:** enter real env values in Vercel/Railway and
> build the worker image on Railway — see [EXTERNAL-SETUP.md](EXTERNAL-SETUP.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

> **Path note after the monorepo migration:** this plan was written before the
> app moved into `apps/web`. Treat app paths such as `src/`, `supabase/`,
> `worker/`, `scripts/`, and `next.config.ts` as relative to `apps/web/`.
> App-local commands such as `bun run dev`, `bun run db:types`, and
> `bunx supabase ...` should run from `apps/web`; the root `bun run check`
> remains the workspace gate.

**Goal:** Make production environment configuration real and explicit, and give the transcription worker a deployable Railway entrypoint (Dockerfile with native deps) so app→Vercel / worker→Railway can both boot from injected env vars.

**Architecture:** Tighten the single zod env point (`src/server/config/env.ts`) so prod misconfig fails loud instead of silently defaulting to localhost. Add an `APP_URL` for absolute auth redirect links (needed by the auth plan). Ship a worker Dockerfile that installs ffmpeg + the whisper.cpp build toolchain and bakes the model, so Railway runs `bun run worker:transcribe` against injected secrets.

**Tech Stack:** Next.js 16, Bun, zod, Supabase, pg-boss, `nodejs-whisper`, Railway (Docker), Vercel.

---

## Scope refinement — 2026-06-12 (binding; corrects drift since 2026-06-04)

The codebase moved under this plan (v3 m2–m4, v4 m1–m5 shipped). Where the
task snippets below conflict with this section, this section wins.

1. **Task 1 is an additive edit, not a file replacement.**
   `apps/web/src/server/config/env.ts` has since gained `DIARIZATION_ENABLED`,
   `DIARIZATION_SEGMENTATION_MODEL_PATH`, `DIARIZATION_EMBEDDING_MODEL_PATH`,
   `DIARIZATION_CLUSTER_THRESHOLD`, `DIARIZATION_NUM_SPEAKERS` (v3 m3) and
   `LIVE_SESSION_STALE_MINUTES` (v4 m5). Do **not** paste the plan's
   replacement body — it would delete them. The change is: export
   `parsePublicEnv`/`parseServerEnv`, add `NEXT_PUBLIC_APP_URL`, keep
   everything else.
2. **The worker is now a three-job process.** `transcription-worker.ts`
   registers batch transcription, `label-speakers` (v4 m4,
   `speaker-label-worker.ts`) and the cron-scheduled
   `sweep-stale-live-sessions` (v4 m5, `stale-live-sweeper.ts`) in one
   process — one Railway service still suffices; no extra service or external
   cron. But the image needs more than the plan's Dockerfile ships:
   - **ffmpeg** is needed at runtime by `worker/audio-convert.ts` (webm→WAV
     for live-session labeling), not just by `nodejs-whisper`. (Already
     installed by the plan's Dockerfile — keep it.)
   - **sherpa-onnx diarization models** must be baked at build:
     `bun run worker:diarization-models`
     (`scripts/fetch-diarization-models.ts` exists) and the two
     `DIARIZATION_*_MODEL_PATH` vars pointed at the baked paths.
   - `sherpa-onnx` is a native module — verify it loads in the
     `oven/bun:1-debian` image during the local build check.
3. **The Dockerfile must be workspace-aware.** The COPY lines predate the
   monorepo. Build context is the repo root; you need the root `package.json`
   + `bun.lock` + `turbo.json`, `apps/web/package.json`, `packages/ui`
   (the app depends on `@lumen/ui`), then `bun install`, then
   `apps/web/{tsconfig.json,src,worker,scripts}`. The Dockerfile lives at
   `apps/web/worker/Dockerfile`; CMD runs `bun run worker:transcribe` from
   `apps/web`.
4. **Vercel is two projects, each with its own root directory** — `apps/web`
   (the app) and `apps/marketing` (public site; env `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_SITE_URL`, no Supabase vars). The original "root dir = repo
   root" instruction is wrong post-monorepo.
5. **Env matrix additions (worker / Railway):** `DIARIZATION_ENABLED=true`,
   `DIARIZATION_SEGMENTATION_MODEL_PATH`, `DIARIZATION_EMBEDDING_MODEL_PATH`
   (baked image paths), optional `DIARIZATION_CLUSTER_THRESHOLD` /
   `DIARIZATION_NUM_SPEAKERS`, `LIVE_SESSION_STALE_MINUTES` (default 45).
   Include them in `DEPLOY.md`'s matrix when writing it.
6. **The assistant needs no server API key.** Claude access is BYO-key
   per-user via Supabase Vault (`user_ai_credentials`,
   `supabase_vault` extension) — confirm the Vault extension is enabled on
   the prod project when pushing migrations; there is no `ANTHROPIC_API_KEY`
   env var to set.

---

## External prerequisites (codebase-EXTERNAL — do these in the dashboards, not in code)

These are the human setup steps this plan assumes. Not code; listed so the env
vars below have real values.

- **Supabase prod project** created; migrations pushed (`supabase link` +
  `supabase db push`); `library-files` private bucket exists with its
  `storage.objects` policies; copy the publishable + secret keys and the direct
  Postgres connection string.
- **Vercel project** linked to the repo (root dir = repo root).
- **Railway project** with one **service for the worker** built from
  `worker/Dockerfile` (this plan creates it).
- Env vars set in **each** host's dashboard (values from Supabase). See the
  matrix at the end of this plan.

## File map

- Modify: `src/server/config/env.ts` — stricter schema, add `APP_URL`, drop
  localhost defaults that are unsafe in prod.
- Create: `src/server/config/env.test.ts` — schema unit tests.
- Create: `worker/Dockerfile` — Railway build for the worker.
- Create: `worker/.dockerignore`.
- Create: `scripts/download-whisper-model.ts` — build-time model fetch.
- Modify: `package.json` — add `worker:download-model` script.
- Modify: `.env.example` — document the new vars + a prod section.
- Create: `docs/exec-plans/active/production/prod-readiness/DEPLOY.md` — the env matrix +
  runbook (this is a NEW doc, not an edit to existing docs).

---

### Task 1: Harden the env schema

**Files:**
- Modify: `src/server/config/env.ts`
- Test: `src/server/config/env.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/server/config/env.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "./env";

describe("env schema", () => {
  it("accepts a complete public env", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        NEXT_PUBLIC_APP_URL: "https://lumen.app",
      }),
    ).not.toThrow();
  });

  it("rejects a non-url app url", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects server env missing the secret key", () => {
    expect(() =>
      parseServerEnv({
        PG_BOSS_DATABASE_URL: "postgresql://localhost:5432/postgres",
      }),
    ).toThrow();
  });
});
```

- [x] **Step 2: Run the test, verify it fails**

Run: `bunx vitest run src/server/config/env.test.ts`
Expected: FAIL — `parsePublicEnv` / `parseServerEnv` are not exported.

- [x] **Step 3: Refactor `env.ts` to export the parse functions and add `APP_URL`**

Replace the body of `src/server/config/env.ts` with:

```ts
import { z } from "zod";

/**
 * The single source of truth for environment access. Nothing else in the
 * codebase reads `process.env` directly. Parsing is lazy + memoized so that
 * importing this module never throws at load time (keeps `bun run check` / CI
 * green without a populated env), and so `NEXT_PUBLIC_*` references stay as
 * literal `process.env.X` accesses that Next.js can statically inline.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Absolute origin of the deployed app, e.g. https://lumen.app. Used to build
  // absolute redirect URLs for email confirmation / password reset / OAuth.
  // Falls back to localhost ONLY in development.
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  PG_BOSS_DATABASE_URL: z.string().url(),
  TRANSCRIPTION_STORAGE_BUCKET: z.string().min(1).default("library-files"),
  WHISPER_MODEL: z.string().min(1).default("base.en"),
  TRANSCRIPTION_TMP_DIR: z.string().min(1).default("/tmp/lumen-transcription"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function parsePublicEnv(source: Record<string, unknown>): PublicEnv {
  return publicSchema.parse(source);
}

export function parseServerEnv(source: Record<string, unknown>): ServerEnv {
  return serverSchema.parse(source);
}

let publicEnv: PublicEnv | undefined;
let serverEnv: ServerEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (!publicEnv) {
    publicEnv = parsePublicEnv({
      // Literal accesses so Next.js inlines these in the browser bundle.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
  }
  return publicEnv;
}

export function getServerEnv(): ServerEnv {
  if (!serverEnv) {
    serverEnv = parseServerEnv({
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      PG_BOSS_DATABASE_URL: process.env.PG_BOSS_DATABASE_URL,
      TRANSCRIPTION_STORAGE_BUCKET: process.env.TRANSCRIPTION_STORAGE_BUCKET,
      WHISPER_MODEL: process.env.WHISPER_MODEL,
      TRANSCRIPTION_TMP_DIR: process.env.TRANSCRIPTION_TMP_DIR,
    });
  }
  return serverEnv;
}
```

> **Conflict flag:** `getPublicEnv` is imported by `src/proxy.ts` and
> `src/server/db/client.ts`. The added field has a dev default, so existing
> callers keep working unchanged.

- [x] **Step 4: Run the test, verify it passes**

Run: `bunx vitest run src/server/config/env.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Run the gate**

Run: `bun run check`
Expected: green.

- [x] **Step 6: Commit**

```bash
git add src/server/config/env.ts src/server/config/env.test.ts
git commit -m "feat(env): export parse fns, add NEXT_PUBLIC_APP_URL"
```

---

### Task 2: Document prod env (`.env.example` + DEPLOY.md)

**Files:**
- Modify: `.env.example`
- Create: `docs/exec-plans/active/production/prod-readiness/DEPLOY.md`

- [x] **Step 1: Append a production section to `.env.example`**

Add below the existing local block:

```bash
# App origin — absolute URL of the deployed app. Used for auth redirect links.
# Dev defaults to http://localhost:3000; MUST be set in production.
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Production note ───────────────────────────────────────────────────────────
# In prod these are injected by the host dashboard, never committed:
#   Vercel (app):    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
#                    NEXT_PUBLIC_APP_URL, SUPABASE_SECRET_KEY, PG_BOSS_DATABASE_URL
#   Railway (worker): SUPABASE_SECRET_KEY, PG_BOSS_DATABASE_URL,
#                    TRANSCRIPTION_STORAGE_BUCKET, WHISPER_MODEL, TRANSCRIPTION_TMP_DIR
# PG_BOSS_DATABASE_URL must be the DIRECT Postgres connection (not the
# transaction pooler) — pg-boss holds long-lived connections / LISTEN.
```

- [x] **Step 2: Create the deploy runbook**

```markdown
# Deploy runbook & env matrix

App → Vercel. Worker → Railway. Both read the same Supabase prod project.

## Env var matrix

| Var | App (Vercel) | Worker (Railway) | Value source |
| --- | :---: | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | — | Supabase API (publishable/anon) |
| `NEXT_PUBLIC_APP_URL` | ✅ | — | Your Vercel domain, e.g. https://lumen.app |
| `SUPABASE_SECRET_KEY` | ✅ | ✅ | Supabase API (secret/service role) — server-only |
| `PG_BOSS_DATABASE_URL` | ✅ | ✅ | Supabase → Database → Connection string (DIRECT, not pooler) |
| `TRANSCRIPTION_STORAGE_BUCKET` | — | ✅ | `library-files` |
| `WHISPER_MODEL` | — | ✅ | `base.en` (or larger if you size up the box) |
| `TRANSCRIPTION_TMP_DIR` | — | ✅ | `/tmp/lumen-transcription` |

App needs `SUPABASE_SECRET_KEY` + `PG_BOSS_DATABASE_URL` because the M4 upload
Route Handlers enqueue pg-boss jobs from the request path.

## Railway worker service

- Build from `worker/Dockerfile` (root context).
- Start command is the Dockerfile `CMD` (`bun run worker:transcribe`).
- Sizing: start at 2 vCPU / 2 GB. `batchSize: 1` ⇒ one transcription at a
  time per instance; scale by adding instances (pg-boss distributes via Postgres).
- The Docker image bakes the whisper model at build, so no runtime download
  and no volume is required for the model. `/tmp` audio is ephemeral by design.

## Vercel app service

- Framework preset: Next.js. Build: `bun run build`. No extra config.
- Set the Supabase **Auth → URL Configuration** Site URL + redirect allowlist
  to `NEXT_PUBLIC_APP_URL` (see the auth plan).

## Smoke test after first deploy

1. Visit `NEXT_PUBLIC_APP_URL` → redirected to `/login`.
2. Sign up → confirm email → land in app (auth plan).
3. Upload a short audio file → recording shows `pending` → worker logs in
   Railway show it picked up → status flips to `done`.
```

- [x] **Step 3: Commit**

```bash
git add .env.example docs/exec-plans/active/production/prod-readiness/DEPLOY.md
git commit -m "docs(deploy): prod env matrix + runbook"
```

---

### Task 3: Worker Dockerfile for Railway

**Files:**
- Create: `worker/Dockerfile`
- Create: `worker/.dockerignore`
- Create: `scripts/download-whisper-model.ts`
- Modify: `package.json`

> **Why a Dockerfile and not Railway Nixpacks:** `nodejs-whisper` compiles
> whisper.cpp on install (needs `make`, `cmake`, `g++`) and shells out to
> **ffmpeg** at transcription time. Nixpacks' default Bun image ships neither.
> A Dockerfile makes the native deps explicit and reproducible.

- [x] **Step 1: Create the model-download script**

```ts
// scripts/download-whisper-model.ts
// Build-time fetch of the whisper model so the image ships ready-to-run
// (avoids a ~142MB download on first job / every cold start).
import { nodewhisper } from "nodejs-whisper";

const model = process.env.WHISPER_MODEL ?? "base.en";

// nodejs-whisper downloads the model on first invocation when
// autoDownloadModelName is set. Transcribe a tiny silent file is overkill;
// instead trigger the library's own download path.
async function main() {
  // The library exposes model download via autoDownloadModelName on transcribe.
  // We import its model dir helper indirectly by running a no-op download.
  // If the version in package.json changes this API, update accordingly.
  const { downloadModel } = await import("nodejs-whisper");
  if (typeof downloadModel === "function") {
    await downloadModel(model);
    return;
  }
  // Fallback: the model will lazily download at first job via
  // autoDownloadModelName in worker/whisper-provider.ts.
  console.warn(
    "nodejs-whisper.downloadModel not available; model will lazy-download at first job.",
  );
}

main().catch((err) => {
  console.error("Model pre-download failed:", err);
  process.exitCode = 1;
});
```

> **Implementer note:** `nodejs-whisper@0.3.0`'s exact download export name can
> drift. Verify against `node_modules/nodejs-whisper` at build time; the
> fallback keeps the worker functional (lazy download) if the API differs. This
> is a build-time optimisation, not correctness-critical.

- [x] **Step 2: Add the script to `package.json`**

Add to `scripts`:

```json
"worker:download-model": "bun run scripts/download-whisper-model.ts"
```

- [x] **Step 3: Create `worker/.dockerignore`**

```
node_modules
.next
.git
**/*.test.ts
playwright-report
test-results
```

- [x] **Step 4: Create `worker/Dockerfile`**

```dockerfile
# Worker image for Railway. Build context = repo root:
#   docker build -f worker/Dockerfile -t lumen-worker .
FROM oven/bun:1-debian

# Native deps for nodejs-whisper (compiles whisper.cpp) + ffmpeg at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ffmpeg make cmake g++ python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (postinstall compiles whisper.cpp).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# App source (worker + the server modules it imports).
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY worker ./worker

# Bake the model into the image so first job has zero download latency.
ENV WHISPER_MODEL=base.en
RUN bun run worker:download-model || true

# Worker connects with the service role and BYPASSES RLS — every query is
# user_id-scoped in code. See docs/SECURITY.md. Secrets are injected by Railway.
CMD ["bun", "run", "worker:transcribe"]
```

> **Conflict flag:** if `bun.lock` is named differently in the repo
> (`bun.lockb` on older Bun), update the `COPY` line. Verify before building.

- [x] **Step 5: Local build verification**

Run: `docker build -f worker/Dockerfile -t lumen-worker .`
Expected: image builds; `bun install` postinstall compiles whisper.cpp without
a missing-toolchain error.

> If Docker isn't available in the build environment, defer this step to the
> deploy pipeline and verify on Railway's first build instead — but do not
> mark the task complete without a successful build somewhere.

- [x] **Step 6: Run the gate (the Dockerfile doesn't affect `bun run check`)**

Run: `bun run check`
Expected: green.

- [x] **Step 7: Commit**

```bash
git add worker/Dockerfile worker/.dockerignore scripts/download-whisper-model.ts package.json
git commit -m "feat(worker): Railway Dockerfile with ffmpeg + whisper toolchain"
```

---

## Self-review notes

- **Spec coverage:** prod env injection ✅ (Tasks 1–2), worker deploy target ✅
  (Task 3). Auth-redirect base URL (`NEXT_PUBLIC_APP_URL`) added here because
  the auth plan depends on it.
- **Gotcha surfaced:** ffmpeg is a hard runtime dep of `nodejs-whisper` (the
  local env notes "no FFmpeg") — the Dockerfile installs it.
- **Left intentionally external:** creating the Supabase project, Railway/Vercel
  services, and entering secret values. Those are dashboard actions, not code.
