<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lumen — agent map

Lumen is a multi-tenant study workspace: nested folders, rich-text notes, file +
audio uploads, local CPU transcription, transcript viewing, tagging, and
full-text search. v1 builds the product foundation and the harness; the AI/MCP
layer comes in v2+ behind clean seams.

This file is a **map**, not an encyclopedia. Deeper knowledge lives in `docs/`
and is updated in the same change as the code it describes. If it isn't in the
repo, it doesn't exist.

## Commands

```bash
bun install                 # install deps
bun run dev                 # Next dev server
bun run check               # GATE: biome + tsc --noEmit + vitest (run after every patch)
bun run lint                # biome lint
bun run format              # biome check --write (autofix)
bun run typecheck           # tsc --noEmit
bun run test                # vitest run
bun run test:e2e            # playwright
bun run db:types            # regenerate src/server/db/database.types.ts (never hand-edit)
bun run docs:db-schema      # regenerate docs/generated/db-schema.md (never hand-edit)

bunx supabase start         # local Postgres + Auth + Storage (Docker)
bunx supabase status        # local URL + keys
bunx supabase db reset      # re-apply migrations
```

## Stack (exact)

Bun · Next.js 16 App Router (`src/`) + React 19 + TypeScript strict · Biome ·
Vitest + Playwright · Supabase (Postgres/Auth/Storage/RLS, local via CLI) ·
`@supabase/ssr` · Tailwind v4 + shadcn/ui · TanStack Query · zod · pg-boss +
`nodejs-whisper` (M4) · TipTap (M3) · lefthook · GitHub Actions.

> Next 16 note: the `middleware` convention is renamed to **`proxy`** — see
> `src/proxy.ts`.

## Code layout

```
src/app/        routes, Server Components, server actions, route handlers (thin)
src/components/  UI (ui/ = shadcn), providers, forms
src/server/      services/ (M2, domain logic) · db/ (supabase client + types) ·
                 config/env.ts (single zod env point) · auth/ (actions)
src/proxy.ts     session refresh + protected-route guard
supabase/        config.toml + migrations/ (schema source of truth)
scripts/         gen-db-schema.ts
worker/          transcription worker (M4)
```

## Architecture seams (do not violate)

- **Service layer** (`server/services/*`, from M2): framework-agnostic, takes an
  authenticated context (user id + user-scoped client), enforces per-user
  scoping. v2 MCP exposes these same services.
- **`TranscriptionProvider`** / **`StorageProvider`** interfaces (M4).
- Worker runs with the **service role → bypasses RLS → must scope every query by
  `user_id`** (security-critical).
- Not in v1: MCP server, AI assistant, vector/semantic search, embeddings,
  streaming/live transcription, diarization, realtime collab. Seams, not stubs.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — system + v2+ seams.
- [BACKPRESSURE.md](BACKPRESSURE.md) — the check gate, in plain English.
- [docs/SECURITY.md](docs/SECURITY.md) — auth model, RLS, the worker caveat.
- [docs/design-docs/index.md](docs/design-docs/index.md) — beliefs + design.
- [docs/product-specs/index.md](docs/product-specs/index.md) — feature specs.
- [docs/PLANS.md](docs/PLANS.md) — milestone exec-plans (active/completed).
- [docs/references/index.md](docs/references/index.md) — external doc pointers.
- [docs/generated/db-schema.md](docs/generated/db-schema.md) — GENERATED schema.
- [docs/DESIGN.md](docs/DESIGN.md) ·
  [docs/FRONTEND.md](docs/FRONTEND.md) ·
  [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) ·
  [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) ·
  [docs/RELIABILITY.md](docs/RELIABILITY.md)

## Working rules

1. Write a milestone plan to `docs/exec-plans/active/`, self-review, then build.
2. Run `bun run check` after every patch; keep it green.
3. Run the manual happy path in a browser before declaring a milestone done.
4. Pause at each milestone boundary for human review.
5. Conventional commits; each commit leaves `bun run check` green.
