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
bun install                       # install workspace deps from repo root
bun run check                     # GATE: root Biome + Turbo typecheck/test
bun run lint                      # root Biome lint
bun run format                    # root Biome check --write (autofix)
bun run typecheck                 # Turbo typecheck across packages
bun run test                      # Turbo test across packages

cd apps/web && bun run dev        # app Next dev server
cd apps/web && bun run build      # app production build
cd apps/web && bun run test:e2e   # app Playwright
cd apps/web && bun run db:types   # regenerate src/server/db/database.types.ts (never hand-edit)
cd apps/web && bun run docs:db-schema  # regenerate docs/generated/db-schema.md (never hand-edit)
cd apps/web && bun run worker:transcribe

cd apps/web && bunx supabase start     # local Postgres + Auth + Storage (Docker)
cd apps/web && bunx supabase status    # local URL + keys
cd apps/web && bunx supabase db reset  # re-apply migrations
```

## Stack (exact)

Bun workspaces + Turborepo · Next.js 16 App Router (`apps/web/src/`) + React
19 + TypeScript strict · Biome · Vitest + Playwright · Supabase
(Postgres/Auth/Storage/RLS, local via CLI) · `@supabase/ssr` · Tailwind v4 +
shadcn/ui · TanStack Query · zod · pg-boss + `nodejs-whisper` (M4) · TipTap
(M3) · lefthook · GitHub Actions.

> Next 16 note: the `middleware` convention is renamed to **`proxy`** — see
> `apps/web/src/proxy.ts`.

## Code layout

```
apps/web/src/app/        routes, Server Components, server actions, route handlers (thin)
apps/web/src/components/ UI (ui/ = shadcn), providers, forms
apps/web/src/server/     services/ (M2, domain logic) · db/ (supabase client + types) ·
                         config/env.ts (single zod env point) · auth/ (actions)
apps/web/src/proxy.ts    session refresh + protected-route guard
apps/web/supabase/       config.toml + migrations/ (schema source of truth)
apps/web/scripts/        gen-db-schema.ts
apps/web/worker/         transcription worker (M4)
packages/ui/             shared CSS design tokens (`@lumen/ui/tokens.css`)
turbo.json               workspace task pipeline
```

## Architecture seams (do not violate)

- **Service layer** (`apps/web/src/server/services/*`, from M2):
  framework-agnostic, takes an authenticated context (user id + user-scoped
  client), enforces per-user scoping. v2 MCP exposes these same services.
- **`TranscriptionProvider`** / **`StorageProvider`** interfaces (M4).
- Worker runs with the **service role → bypasses RLS → must scope every query by
  `user_id`** (security-critical).
- `packages/ui` is design-token only. App packages may import it; shared
  packages must not import `apps/web`.
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
