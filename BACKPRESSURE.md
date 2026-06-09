# Backpressure

Automated checks — not humans — are the default gate for low-level correctness.
A human reviews design and taste at milestone boundaries; the machinery catches
everything below that.

## The one command

```bash
bun run check
```

runs, in order:

1. **Biome** (`biome check .`) — lint **and** format check in one tool.
2. **Turbo typecheck** (`turbo run typecheck`) — package TypeScript checks
   such as `tsc --noEmit` (Biome does not typecheck).
3. **Turbo test** (`turbo run test`) — package test suites such as Vitest.

Run it after **every** patch, in **every** iteration. Do not write the next
patch until it is green.

## Where it is enforced

- **Pre-commit:** `lefthook.yml` runs `bun run check`; a dirty tree cannot be
  committed.
- **CI quality gate:** `.github/workflows/ci.yml` runs `bun run check` on every
  push to `main` and every opened, reopened, ready-for-review, or freshly
  updated pull request. This job is deliberately DB-free so it runs without a
  live Supabase stack.
- **CI E2E smoke:** the same workflow then boots the local Supabase stack and
  runs `bun run test:e2e` against the seeded demo user. This proves the real
  authenticated browser path still works before a PR is merged.

## Types are backpressure

- Strict TypeScript (`strict: true`). Make impossible states impossible.
- No `any` without a one-line comment justifying it.
- Generated types (`apps/web/src/server/db/database.types.ts`) are checked in
  and never hand-edited — regenerate with `cd apps/web && bun run db:types`.

## Docs are backpressure too

- `docs/generated/db-schema.md` is regenerable with
  `cd apps/web && bun run docs:db-schema`.
- The docs tree must stay link-clean (see `AGENTS.md` for the map).

## Planning is backpressure too

The planning lifecycle is gated by the machine, not by memory, so every release
is held to the same standard. `bun run check` runs `check:plans`
(`scripts/check-plan-lifecycle.ts`), which fails when:

- a `docs/superpowers/{plans,specs}/*.md` design artifact is **orphaned** — not
  referenced from any exec plan under `docs/exec-plans/` (working rule #1: a spec
  must inform an exec plan before a build), or
- a version/initiative **bucket** under `docs/exec-plans/{queued,active,completed,archive}/*`
  is missing from `docs/PLANS.md`.

This is what kept v2 honest by hand; the check makes it impossible to skip.

## Per-milestone rhythm

1. Write/locate the design input (a `superpowers` spec is optional), then write
   a lightweight exec plan to `docs/exec-plans/active/` that links back to it.
2. Self-review it against the brief.
3. Implement, running `bun run check` after each patch.
4. Run the manual happy path in a browser, or `bun run test:e2e` when the
   happy path is covered by the smoke suite.
5. Pause at the milestone boundary for human review.
