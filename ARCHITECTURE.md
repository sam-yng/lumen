# Architecture

Lumen is a multi-tenant study workspace: nested folders, rich-text notes, file
and audio uploads, local CPU transcription, transcript viewing, tagging, and
full-text search. This document covers the high-level system and — importantly —
the seams that let the v2+ AI/MCP layer drop in without a rewrite.

## Stack

- **Runtime/tooling:** Bun (package manager + script runner).
- **Framework:** Next.js 16 (App Router, `src/`) + React 19 + TypeScript strict.
  - Note: Next 16 renamed the `middleware` convention to **`proxy`** — see
    `src/proxy.ts`.
- **Backend:** Supabase — Postgres + Auth + Storage + Row-Level Security, run
  locally via the Supabase CLI (Docker). Schema lives in SQL migrations under
  `supabase/migrations/`; types are generated, never hand-edited.
- **Lint/format:** Biome. **Typecheck:** `tsc --noEmit`. **Tests:** Vitest +
  Playwright. See [BACKPRESSURE.md](BACKPRESSURE.md).
- **UI:** Tailwind v4 + shadcn/ui. **Client data:** TanStack Query.
- **Validation:** zod (all API input + env config).
- **Editor (M3):** TipTap. **Queue/worker (M4):** pg-boss + a separate worker
  process running `nodejs-whisper`.

## Layers

```
app/ (routes, UI)  ->  server/services/* (domain logic)  ->  Supabase (RLS)
        ^                        ^
   thin route handlers      authenticated context
   + server actions         (user_id + user-scoped client)
```

- **`app/`** — App Router routes, Server Components, server actions, Route
  Handlers. Kept thin: validate input (zod), call a service.
- **`server/services/*`** *(introduced in M2)* — framework-agnostic domain
  operations. Each takes an **authenticated context** (the user's id + a
  user-scoped Supabase client) and enforces per-user scoping. They must be
  callable outside an HTTP request.
- **`server/db/`** — Supabase client factories (`client.ts`) and generated types.
- **`server/config/env.ts`** — the single zod-validated env access point.

## Seams for v2+ (do not violate)

These boundaries exist so later milestones plug in cleanly:

1. **Service layer.** In v2 the MCP server exposes the *same* services as tools.
   They already take an authenticated context and enforce scoping, so they work
   outside an HTTP request unchanged.
2. **`TranscriptionProvider` interface** *(M4)*. `nodejs-whisper` is the v1
   implementation; v3 may add streaming behind the same interface.
3. **`StorageProvider` interface** *(M4)*. Supabase Storage is the v1
   implementation; the backend can be swapped without touching callers.

**Not built in v1** (clean boundaries, not placeholders): the MCP server, the
in-app assistant, vector/semantic search, embeddings, streaming/live
transcription, diarization, realtime collaboration.

## Security

RLS is the security boundary. The transcription worker runs with the service
role and **bypasses RLS**, so it must scope every query by `user_id` manually.
See [docs/SECURITY.md](docs/SECURITY.md).

## Data model

Generated from migrations: [docs/generated/db-schema.md](docs/generated/db-schema.md).
