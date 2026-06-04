# Lumen

A multi-tenant **study workspace**: keep a nested library of folders, write
rich-text notes, upload lectures/seminars, transcribe them locally on CPU, and
search across everything. Built all-TypeScript on Next.js + Supabase in a Bun
workspace.

> v1 builds the product foundation and the automated harness. The AI/MCP layer
> (assistant, semantic search) comes in v2+ behind clean seams — see
> [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- **Bun** ≥ 1.3 — package manager and script runner. https://bun.sh
- **Docker** — runs the local Supabase stack (Postgres + Auth + Storage).
- **FFmpeg** — host dependency for transcription (`nodejs-whisper`). Needed from
  milestone M4 onward; not required to run the app before then.
  - macOS: `brew install ffmpeg` · Debian/Ubuntu: `apt install ffmpeg`

## Setup

```bash
bun install

# Boot the local Supabase stack (Docker), then copy its keys into .env.local
cd apps/web
bunx supabase start
bunx supabase status            # shows the URL + publishable/secret keys
cp .env.example .env.local      # then paste the values from `status`

bun run db:types                # generate typed DB client
bun run dev                     # http://localhost:3000
```

Sign up at `/signup`, and you land in the protected workspace shell.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run check` | root gate: Biome + Turbo typecheck/test |
| `bun run lint` / `bun run format` | root Biome lint / autofix |
| `bun run typecheck` / `bun run test` | Turbo package tasks |
| `cd apps/web && bun run dev` | app Next dev server |
| `cd apps/web && bun run build` / `bun run start` | app production build / serve |
| `cd apps/web && bun run test:e2e` | app Playwright |
| `cd apps/web && bun run db:types` | regenerate `apps/web/src/server/db/database.types.ts` |
| `cd apps/web && bun run docs:db-schema` | regenerate `docs/generated/db-schema.md` |
| `cd apps/web && bun run worker:transcribe` | run the transcription worker |

Run `bun run check` after every change — a pre-commit hook (lefthook) and CI
both enforce it. See [BACKPRESSURE.md](BACKPRESSURE.md).

## Architecture

Thin App Router routes/actions over a framework-agnostic service layer (from
M2), backed by Supabase with **Row-Level Security as the isolation boundary**.
Full overview and the v2+ seams: [ARCHITECTURE.md](ARCHITECTURE.md). Security
model (auth, RLS, the service-role worker caveat): [docs/SECURITY.md](docs/SECURITY.md).

The agent-facing map of the whole repo is [AGENTS.md](AGENTS.md).

## Workspace Layout

- `apps/web` — the current authenticated study workspace app.
- `packages/ui` — shared CSS design tokens, exported as `@lumen/ui/tokens.css`.

## Roadmap

M0 harness → M1 schema+RLS → M2 library → M3 editor → M4 transcription →
M5 viewer+search → M6 harden+document. Plans live in
[docs/PLANS.md](docs/PLANS.md).
