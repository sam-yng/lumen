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
bun run test:e2e                  # app Playwright smoke tests via workspace filter

cd apps/web && bun run dev        # app Next dev server (port 3000)
cd apps/web && bun run build      # app production build
cd apps/web && bun run test:e2e   # app Playwright
cd apps/marketing && bun run dev  # marketing site Next dev server (port 3001)
cd apps/web && bun run db:types   # regenerate src/server/db/database.types.ts (never hand-edit)
cd apps/web && bun run docs:db-schema  # regenerate docs/generated/db-schema.md (never hand-edit)
cd apps/web && bun run worker:transcribe
cd apps/web && bun run worker:diarization-models  # fetch local diarization ONNX models

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
apps/marketing/src/app/  public landing page: page + static metadata, robots, sitemap (port 3001)
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
- `apps/marketing` is a public, static, unauthenticated site: no Supabase
  client, no service layer, no user data. Keep it dependency-light; it links
  out to the app (`NEXT_PUBLIC_APP_URL`) rather than importing it.
- Shipped in v2 (do not re-stub): vector/semantic search + local embeddings
  (`semantic_search_chunks`, pgvector, hybrid retrieval in
  `server/services/search.ts`) and the MCP server (`app/api/mcp/`, bearer-JWT
  auth, `/api/mcp` is a proxy public prefix). The service-layer client now has
  `.rpc()` + `.in()` (`server/services/context.ts`) — test fakes must implement
  both. See [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).
- Shipped in v2 (2026-06-08): the in-app AI assistant (browser verification
  still gated on a real Claude key — see
  `docs/exec-plans/active/production/prod-readiness/prod-assistant-verification.md`).
- Shipped in v3 m2: live/streaming transcription — browser-side Whisper
  (`src/lib/transcription/`, `StreamingTranscriptionProvider` seam) +
  live-session service (`server/services/live-sessions.ts`, recordings status
  `live`) finalizing through the batch transcript path. The batch
  `TranscriptionProvider` worker pipeline is untouched and stays the default.
- Shipped in v3 m3: batch speaker diarization — `DiarizationProvider` seam in
  `apps/web/worker/` with a sherpa-onnx implementation (local ONNX models via
  `worker:diarization-models`), env-gated by `DIARIZATION_ENABLED` and
  degrade-never-fail (errors → null speakers, job still `done`). Diarization
  runs before transcription because Whisper deletes its WAV input. Live path
  never labels speakers.
- Still not built: citation deep links (v3 m4), realtime collab. Seams, not
  stubs.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — system + v2+ seams.
- [BACKPRESSURE.md](BACKPRESSURE.md) — the check gate, in plain English.
- [docs/SECURITY.md](docs/SECURITY.md) — auth model, RLS, the worker caveat.
- [docs/design-docs/index.md](docs/design-docs/index.md) — beliefs + design.
- [docs/product-specs/index.md](docs/product-specs/index.md) — feature specs.
- [docs/PLANS.md](docs/PLANS.md) — lifecycle exec-plans (queued/active/completed/archive).
- [docs/references/index.md](docs/references/index.md) — external doc pointers.
- [docs/generated/db-schema.md](docs/generated/db-schema.md) — GENERATED schema.
- [docs/DESIGN.md](docs/DESIGN.md) ·
  [docs/FRONTEND.md](docs/FRONTEND.md) ·
  [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) ·
  [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md) ·
  [docs/RELIABILITY.md](docs/RELIABILITY.md)

## Agent skills

Portable skills are vendored in-repo at [`.agents/skills/`](.agents/skills/README.md)
so every machine/tool shares the same versions. Claude Code does **not**
auto-load `.agents/skills/` — read a skill's `SKILL.md` and follow it. Includes
`docs-sanity-check`, `finishing-a-development-branch`, `react-doctor`, and the
superpowers skills referenced by `docs/exec-plans/**` (`executing-plans`,
`subagent-driven-development`, `test-driven-development`). React Doctor also runs
in CI on every PR and push to `main` (`.github/workflows/react-doctor.yml`).

## Working rules

1. **Plan before build.** A design spec (e.g. a `superpowers` spec/plan) may be the design input, but before building you MUST have an exec plan in `docs/exec-plans/queued/` or `docs/exec-plans/active/`, self-reviewed and indexed in `docs/PLANS.md`. The exec plan links back to any informing spec rather than copying it. No `superpowers` spec/plan may exist without an exec plan referencing it — `bun run check` enforces this (see [BACKPRESSURE.md](BACKPRESSURE.md)).
2. Run `bun run check` after every patch; keep it green.
3. Run the manual happy path in a browser before declaring a milestone done.
4. Pause at each milestone boundary for human review.
5. Conventional commits; each commit leaves `bun run check` green.
6. We do not make dinner in a dirty kitchen: if a pre-existing failure appears,
   pause the current work, stash or otherwise isolate your changes, fix the
   baseline failure first, then resume. Do not wave it away as unrelated.
7. **Closing a branch** (impl complete, `bun run check` green): run
   [`docs-sanity-check`](.agents/skills/docs-sanity-check/SKILL.md) (fix
   `BROKEN`/`DRIFT`, triage the rest), then
   [`finishing-a-development-branch`](.agents/skills/finishing-a-development-branch/SKILL.md)
   to merge/PR/cleanup.
