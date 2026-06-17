# Sentry Error Tracking Implementation Plan

> **Status:** completed (build) — 2026-06-17. Implementation shipped (app + both
> degrade-never-fail worker jobs capture) and `bun run check` is green; group
> moved `active/ → completed/` per the lifecycle rule. Checkboxes reflect in-repo
> work done. **Codebase-external remainder:** set `NEXT_PUBLIC_SENTRY_DSN` (app)
> and `SENTRY_DSN` (worker) in Vercel/Railway and confirm an event lands — see
> [EXTERNAL-SETUP.md](EXTERNAL-SETUP.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

> **Path note after the monorepo migration:** this plan was written before the
> app moved into `apps/web`. Treat app paths such as `src/`, `supabase/`,
> `worker/`, `scripts/`, and `next.config.ts` as relative to `apps/web/`.
> App-local commands such as `bun run dev`, `bun run db:types`, and
> `bunx supabase ...` should run from `apps/web`; the root `bun run check`
> remains the workspace gate.

**Goal:** Capture unhandled errors from both runtimes — the Next.js app (Vercel) and the transcription worker (Railway) — into Sentry, so failures on remote boxes are visible instead of silent.

**Architecture:** Two separate SDKs. The app uses `@sentry/nextjs` with the Next 16 instrumentation conventions (`instrumentation.ts` + `onRequestError`, `instrumentation-client.ts`, `global-error.tsx`, `withSentryConfig`). The worker is a plain Node/Bun process and uses `@sentry/node` directly, wrapping `startTranscriptionWorker` and each job. DSNs come from env vars, never committed.

**Tech Stack:** `@sentry/nextjs`, `@sentry/node`, Next.js 16, Bun, pg-boss worker.

**Sequencing:** land AFTER `prod-env-and-deploy.md` (the worker entrypoint/Dockerfile is finalised there; wrapping it here avoids re-touching).

**Reference:** [Sentry Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) · [Sentry Node](https://docs.sentry.io/platforms/javascript/guides/node/).

---

## Scope refinement — 2026-06-12 (binding; corrects drift since 2026-06-04)

1. **All app-side files live under `apps/web/`** (the path note applies to
   `instrumentation.ts`, `sentry.*.config.ts`, `next.config.ts` too — "repo
   root" in Task 2 means the `apps/web` package root). The current
   `next.config.ts` already has `transpilePackages` + `turbopack.root`; wrap
   it, don't replace it.
2. **The worker is now three jobs, one process.** Besides
   `processTranscriptionJob`, capture failures in
   `worker/speaker-label-worker.ts` (label-speakers, v4 m4) and
   `worker/stale-live-sweeper.ts` (cron sweep, v4 m5) — tag
   `area: "speaker-labeling"` / `area: "stale-live-sweep"`. Both paths are
   degrade-never-fail by design, so without explicit capture their errors are
   *swallowed*, which is exactly what Sentry is here to prevent. The
   import-first init in `transcription-worker.ts` covers the shared process.

---

## External prerequisites (dashboard, not code)

- Create a Sentry account + two projects (or one project, two DSNs):
  `lumen-app` (Next.js platform) and `lumen-worker` (Node platform).
- Copy each DSN. Set env vars:
  - Vercel: `NEXT_PUBLIC_SENTRY_DSN` (the app DSN — client + server read it).
  - Railway: `SENTRY_DSN` (the worker DSN).
- For source maps upload (optional, recommended): `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel build env.

## File map

- Modify: `package.json` — add `@sentry/nextjs`, `@sentry/node`.
- Create: `instrumentation.ts` (repo root or `src/`) — server/edge init + `onRequestError`.
- Create: `instrumentation-client.ts` — browser init.
- Create: `sentry.server.config.ts`, `sentry.edge.config.ts` — runtime inits.
- Create: `src/app/global-error.tsx` — React render-error capture.
- Modify: `next.config.ts` — wrap with `withSentryConfig`.
- Create: `worker/instrumentation.ts` — `@sentry/node` init for the worker.
- Modify: `worker/transcription-worker.ts` — init + capture in the entrypoint and per job.

---

### Task 1: Install SDKs

- [x] **Step 1: Add deps**

Run: `bun add @sentry/nextjs @sentry/node`
Expected: both appear in `package.json` dependencies.

- [x] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "build: add sentry sdks"
```

---

### Task 2: Wire Sentry into the Next app

**Files:** `sentry.server.config.ts`, `sentry.edge.config.ts`,
`instrumentation.ts`, `instrumentation-client.ts`, `src/app/global-error.tsx`,
`next.config.ts`.

- [x] **Step 1: Create the runtime config files (repo root)**

```ts
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
```

```ts
// sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
```

- [x] **Step 2: Create `instrumentation.ts` with `onRequestError`**

```ts
// instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

- [x] **Step 3: Create `instrumentation-client.ts`**

```ts
// instrumentation-client.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

- [x] **Step 4: Create `src/app/global-error.tsx`**

```tsx
// src/app/global-error.tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
```

- [x] **Step 5: Wrap `next.config.ts`**

```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when a token is present (CI/prod); silent locally.
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
```

- [x] **Step 6: Run the gate**

Run: `bun run check`
Expected: green. (With no DSN set, `enabled:false` — Sentry is inert, build
still succeeds.)

- [x] **Step 7: Verify capture locally (optional, needs a DSN)**

Set `NEXT_PUBLIC_SENTRY_DSN` in `.env.local`, add a throwaway route that throws,
hit it, confirm the event lands in Sentry, then remove the throwaway route.

- [x] **Step 8: Commit**

```bash
git add sentry.server.config.ts sentry.edge.config.ts instrumentation.ts instrumentation-client.ts src/app/global-error.tsx next.config.ts
git commit -m "feat(observability): sentry in the next app"
```

---

### Task 3: Wire Sentry into the worker

**Files:** `worker/instrumentation.ts`, `worker/transcription-worker.ts`.

> **Conflict flag:** `worker/transcription-worker.ts` is also touched by the
> deploy plan (start script is unchanged there, but be aware). Land deploy first.

- [x] **Step 1: Create the worker Sentry init**

```ts
// worker/instrumentation.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.SENTRY_DSN),
});

export { Sentry };
```

- [x] **Step 2: Import it first in the worker entry + capture job failures**

At the very TOP of `worker/transcription-worker.ts` (before other imports so
instrumentation is set up first):

```ts
import { Sentry } from "./instrumentation";
```

In the `processTranscriptionJob` catch block, add a capture before re-throwing
(the existing code already marks the recording failed and re-throws):

```ts
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: "transcription" },
      extra: { recordingId: payload.recordingId, userId: payload.userId },
    });
    await markRecordingFailed(
      deps.supabase,
      payload.userId,
      payload.recordingId,
      error instanceof Error ? error.message : "Unknown transcription error.",
    );
    throw error;
  } finally {
```

And in the bottom entrypoint guard, capture fatal startup errors:

```ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  startTranscriptionWorker().catch((error) => {
    Sentry.captureException(error, { tags: { area: "worker-startup" } });
    console.error(error);
    process.exitCode = 1;
  });
}
```

> **PII note:** `userId` is a UUID, not PII, and helps trace a failed job back
> to a user via the DB. Do NOT add file contents / transcript text to Sentry.

- [x] **Step 3: Run the gate**

Run: `bun run check`
Expected: green.

- [x] **Step 4: Commit**

```bash
git add worker/instrumentation.ts worker/transcription-worker.ts
git commit -m "feat(observability): sentry in the transcription worker"
```

---

## Self-review notes

- **Spec coverage:** app capture ✅(T2), worker capture ✅(T3).
- **DSN handling:** every `init` is `enabled:` gated on the DSN, so absent env
  vars make Sentry a no-op — CI and local stay green without secrets.
- **Not run through zod env:** Sentry config files read `process.env` directly
  by SDK convention (the build needs them before the lazy env parse). Acceptable
  exception to the "single env point" rule; documented here so a future reviewer
  doesn't treat it as a violation.
- **Follow-up (out of scope):** add `Sentry.setUser({ id })` in the app's
  authenticated layout for better error attribution; tune `tracesSampleRate`
  before launch.
