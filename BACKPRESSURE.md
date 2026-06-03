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
2. **`tsc --noEmit`** — full TypeScript typecheck (Biome does not typecheck).
3. **Vitest** (`vitest run`) — unit/component tests.

Run it after **every** patch, in **every** iteration. Do not write the next
patch until it is green.

## Where it is enforced

- **Pre-commit:** `lefthook.yml` runs `bun run check`; a dirty tree cannot be
  committed.
- **CI:** `.github/workflows/ci.yml` runs `bun run check` on every push to
  `main` and every pull request. CI is deliberately DB-free so it runs without a
  live Supabase stack.

## Types are backpressure

- Strict TypeScript (`strict: true`). Make impossible states impossible.
- No `any` without a one-line comment justifying it.
- Generated types (`src/server/db/database.types.ts`) are checked in and never
  hand-edited — regenerate with `bun run db:types`.

## Docs are backpressure too

- `docs/generated/db-schema.md` is regenerable with `bun run docs:db-schema`.
- The docs tree must stay link-clean (see `AGENTS.md` for the map).

## Per-milestone rhythm

1. Write a lightweight plan to `docs/exec-plans/active/`.
2. Self-review it against the brief.
3. Implement, running `bun run check` after each patch.
4. Run the manual happy path in a browser.
5. Pause at the milestone boundary for human review.
