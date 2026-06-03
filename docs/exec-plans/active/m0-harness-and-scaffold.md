# M0 — Harness & Scaffold Implementation Plan

> **For agentic workers:** This is a milestone-level plan (approach + architecture + ordered work with explicit verification gates), per the kickoff brief's request for "a lightweight plan (approach + architecture, not implementation minutiae)." It is intentionally not a per-line TDD plan: M0 is configuration and scaffolding, not feature logic. Feature milestones (M2+) will use finer-grained TDD tasks. Steps use checkbox (`- [ ]`) syntax for tracking. **The gate is `bun run check` green after every phase.**

**Goal:** Stand up the full backpressure harness and documentation system of record so that every later milestone is built behind automated checks, and wire Supabase Auth end-to-end (signup/login/logout + a protected app shell) against a local Supabase stack.

**Architecture:** Next.js 16 App Router (`src/`) with a thin route/UI layer over a framework-agnostic service layer (added in M2). Supabase provides Postgres + Auth + Storage + RLS, run locally via the Supabase CLI (Docker). Auth uses `@supabase/ssr` with a per-request, cookie-bound Supabase client so RLS applies to every server query; middleware refreshes the session and guards the protected shell. A single aggregate command `bun run check` runs Biome + `tsc --noEmit` + Vitest and is enforced by a lefthook pre-commit hook and GitHub Actions. Knowledge lives in a versioned `docs/` tree mapped from `AGENTS.md`.

**Tech Stack:** Bun 1.3 · Next.js 16.2 (App Router) · React 19 · TypeScript strict · Biome 2.2 · Tailwind v4 · shadcn/ui · Supabase (CLI/local, `@supabase/supabase-js` + `@supabase/ssr`) · Vitest + Playwright · lefthook · zod · TanStack Query (installed, wired minimally).

**Pre-existing state (reconcile, don't recreate):** `create-next-app` already ran — `package.json`, `biome.json`, `tsconfig.json` (strict ✓), `next.config.ts`, `src/app/{layout,page,globals.css}` exist. `bun.lock` present. `.next/` build artifacts present. Docker is running. **FFmpeg is NOT installed** (host dep; only required at M4 — document now, install later). Next 16 / React 19 are newer than common training data; **read `node_modules/next/dist/docs/` before writing auth/middleware/route-handler code.**

---

## Definition of done (M0 boundary gate)

- [ ] `bun run check` exits 0 (Biome clean, `tsc --noEmit` clean, Vitest passes ≥1 real test).
- [ ] `bunx supabase start` boots; `bun run db:types` regenerates `src/server/db/database.types.ts`.
- [ ] Manual happy path in browser: sign up → redirected to protected shell → log out → protected route redirects to login.
- [ ] Pre-commit hook runs `bun run check` and blocks a dirty commit.
- [ ] GitHub Actions workflow runs `bun run check` on push/PR.
- [ ] Full `docs/` tree (§7) exists and is link-clean; `AGENTS.md` is the ~100-line map; `BACKPRESSURE.md` exists; `bun run docs:db-schema` regenerates `docs/generated/db-schema.md`.
- [ ] Plan moved to `docs/exec-plans/completed/` with a short retrospective.

---

## File structure (created/modified in M0)

- `package.json` — modify: full script set (`check`, `lint`, `format`, `typecheck`, `test`, `test:e2e`, `db:types`, `docs:db-schema`).
- `src/server/config/env.ts` — create: zod-validated env module (single source of env access).
- `src/server/db/client.ts` — create: browser + server (cookie-bound) Supabase client factories via `@supabase/ssr`.
- `src/server/db/database.types.ts` — generated: `supabase gen types` output (checked in, never hand-edited).
- `src/middleware.ts` — create: session refresh + protected-route guard.
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx` — create: auth forms.
- `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx` — create: protected shell + landing.
- `src/app/auth/callback/route.ts` (or action) — create: auth code exchange / signout route handler.
- `src/components/providers.tsx` — create: TanStack Query provider.
- `supabase/` — created by `bunx supabase init`; `supabase/migrations/000_init.sql` — create: extensions + `profiles` table with RLS (the canonical RLS pattern M1 follows).
- `scripts/gen-db-schema.ts` — create: regenerates `docs/generated/db-schema.md` from `supabase/migrations/`.
- `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts` — create: test harness.
- `lefthook.yml` — create: pre-commit → `bun run check`.
- `.github/workflows/ci.yml` — create: CI → `bun run check`.
- `AGENTS.md` — modify: replace placeholder with the ~100-line map (preserve the nextjs-agent-rules block).
- `BACKPRESSURE.md`, `ARCHITECTURE.md` — create.
- `docs/**` — create the full §7 tree (stubs where honest).
- `README.md` — modify: setup (Bun, Supabase, FFmpeg), scripts, architecture pointer.
- `.env.example` / `.env.local` — create: Supabase local URL + anon/service keys.

---

## Phase 1 — Backpressure harness (no Supabase yet)

Rationale: get `bun run check` green first so every subsequent change is gated.

- [ ] **1.1 Read the Next 16 docs** for App Router routing, route handlers, and middleware: skim `node_modules/next/dist/docs/01-app/` (note any deprecations vs. older App Router). Capture surprises in `docs/references/` if load-bearing.
- [ ] **1.2 Fix `package.json` scripts** to exactly:
  ```jsonc
  "check": "biome check . && tsc --noEmit && vitest run",
  "lint": "biome lint .",
  "format": "biome check --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "db:types": "supabase gen types typescript --local > src/server/db/database.types.ts",
  "docs:db-schema": "bun run scripts/gen-db-schema.ts"
  ```
  Keep `dev`/`build`/`start`.
- [ ] **1.3 Install test + hook tooling:**
  ```bash
  bun add -d vitest @vitejs/plugin-react @testing-library/react \
    @testing-library/jest-dom jsdom @playwright/test lefthook
  bunx playwright install
  ```
- [ ] **1.4 Add `vitest.config.ts` + `vitest.setup.ts`** (jsdom env, React plugin, jest-dom matchers, `@/` alias matching tsconfig). Write one real smoke test (e.g. `src/server/config/env.test.ts` placeholder or a trivial `lib/__tests__/smoke.test.ts`) so `vitest run` has a passing test, not zero.
- [ ] **1.5 Add `playwright.config.ts`** pointed at `bun run dev` (webServer), test dir `e2e/`. No e2e specs yet (full happy path lands in M6); config only.
- [ ] **1.6 Gate:** run `bun run check` → must be 0. Fix Biome/TS issues until green.
- [ ] **1.7 `lefthook.yml`** pre-commit → `bun run check`; `bunx lefthook install`. Verify a deliberately-broken commit is blocked, then revert.
- [ ] **1.8 `.github/workflows/ci.yml`**: on push/PR, setup Bun, `bun install`, `bun run check`. (Supabase-dependent steps stay out of CI for M0; `check` must not require a running DB — keep env access lazy/guarded.)
- [ ] **1.9 Commit:** `chore(m0): backpressure harness — scripts, vitest, playwright, lefthook, CI`.

## Phase 2 — shadcn/ui + Tailwind verification

- [ ] **2.1** Confirm Tailwind v4 is wired (`globals.css`, postcss). `bunx --bun shadcn@latest init` (App Router, `src/`, Tailwind v4 detected). Add a couple base components actually used by auth forms: `bunx --bun shadcn@latest add button input label card`.
- [ ] **2.2 Gate:** `bun run check` green. Commit: `feat(m0): shadcn/ui init + base components`.

## Phase 3 — Supabase local + env config + client factories

- [ ] **3.1 Install:** `bun add @supabase/supabase-js @supabase/ssr @tanstack/react-query zod`.
- [ ] **3.2** `bun add -d supabase` (CLI), `bunx supabase init`, `bunx supabase start`. Capture local URL + anon + service_role keys from the CLI output.
- [ ] **3.3** `.env.example` (committed, no secrets) + `.env.local` (gitignored) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- [ ] **3.4** `src/server/config/env.ts` — zod schema parsing `process.env`; export typed `env`. Separate public vs server-only (never expose service role to client bundles). This is the **only** place env is read.
- [ ] **3.5** `src/server/db/client.ts` — `createBrowserClient` factory + `createServerClient` factory (cookie-bound via `@supabase/ssr`, reads cookies through Next 16 APIs — verify cookie API in the Next docs). A service-role client factory is **deferred to M4** (worker); add a one-line TODO comment, not code.
- [ ] **3.6 `supabase/migrations/000_init.sql`** — enable `pgcrypto`; create `profiles` (`id uuid pk references auth.users`, `created_at`); enable RLS; policies: a user may select/insert/update only their own row (`auth.uid() = id`). This establishes the exact RLS pattern M1 reuses. (No domain tables here — those are M1.)
- [ ] **3.7** `bunx supabase db reset` (applies migration) → `bun run db:types` → `database.types.ts` regenerated and checked in.
- [ ] **3.8 Gate:** `bun run check` green. Commit: `feat(m0): supabase local, env config, ssr client factories, profiles+RLS`.

## Phase 4 — Auth wired (signup/login/logout + protected shell)

- [ ] **4.1** Re-read the Next 16 middleware + route-handler docs section before writing `src/middleware.ts`.
- [ ] **4.2** `src/middleware.ts` — refresh Supabase session on each request; redirect unauthenticated users hitting `(app)` routes to `/login`. Use the `@supabase/ssr` middleware pattern (verify against installed version's README in `node_modules`).
- [ ] **4.3** `(auth)/login` + `(auth)/signup` pages — email/password forms (server actions or route handlers) using the server client; on success redirect to `(app)`. Render with shadcn `card`/`input`/`button`. Leave a clearly-marked seam (comment) for OAuth providers — no provider code.
- [ ] **4.4** Signout route handler / action; `(app)/layout.tsx` protected shell with a signout control; `(app)/page.tsx` minimal landing showing the signed-in user's email.
- [ ] **4.5** `src/components/providers.tsx` — TanStack Query `QueryClientProvider`; mount in root layout. Minimal; real queries arrive in M2.
- [ ] **4.6 Gate:** `bun run check` green.
- [ ] **4.7 Manual happy path** in browser (`bun run dev`): signup → protected shell → logout → protected route bounces to `/login`. Record result in the plan/retro.
- [ ] **4.8** Commit: `feat(m0): supabase auth — signup/login/logout + protected app shell`.

## Phase 5 — Docs system of record + db-schema generator

- [ ] **5.1** Create the full §7 `docs/` tree. Honest stubs (`_(none yet)_`) where empty; `index.md` in each subdir so nothing is orphaned. Populate the four reference `*-llms.txt` as stubs or fetched docs.
- [ ] **5.2** Rewrite `AGENTS.md` as the ~100-line **map**: exact commands, exact stack, the architecture seams (§6), the worker/service-role RLS caveat pointer, and links into `docs/**`. Preserve the `nextjs-agent-rules` block. Every `docs/**` file reachable from `AGENTS.md` or an `index.md`.
- [ ] **5.3** `BACKPRESSURE.md` — the §0 checks in plain English (what `bun run check` runs, the "green before next patch" rule, types-as-backpressure, the human-only-at-boundaries rule).
- [ ] **5.4** `SECURITY.md` — auth model, RLS-is-the-boundary, and the **service-role worker bypasses RLS → must scope by `user_id` manually** caveat (even though the worker lands in M4, document the rule now).
- [ ] **5.5** `ARCHITECTURE.md` — high-level system + the v2+ seams (service layer, `TranscriptionProvider`, `StorageProvider`).
- [ ] **5.6** `scripts/gen-db-schema.ts` — parse `supabase/migrations/*.sql`, emit `docs/generated/db-schema.md` with a "GENERATED — do not edit" header, a `## Tables` heading, and one `### <table_name>` entry per table (format the docs-sanity-check expects). Run `bun run docs:db-schema`; verify `profiles` appears.
- [ ] **5.7** Run the `docs-sanity-check` routine if available; ensure link-clean, no orphans, generated docs current.
- [ ] **5.8** Update `README.md`: prerequisites (Bun, Docker, **FFmpeg via `brew install ffmpeg` — needed from M4**), setup steps, full script table, architecture pointer, roadmap pointer.
- [ ] **5.9 Gate:** `bun run check` green. Commit: `docs(m0): docs system of record, AGENTS map, BACKPRESSURE/SECURITY/ARCHITECTURE, db-schema generator`.

## Phase 6 — Close milestone

- [ ] **6.1** Re-run full DoD checklist above; run manual happy path once more.
- [ ] **6.2** Move this file to `docs/exec-plans/completed/m0-harness-and-scaffold.md` with a 3–5 line retrospective (what shipped, deviations, FFmpeg deferred to M4).
- [ ] **6.3** **PAUSE for human review at the M0 boundary** before starting M1.

---

## Self-review (run against the brief)

**§8 M0 coverage:** Bun ✓ (P1) · Next+TS strict ✓ (pre-existing, verified P1) · Biome ✓ (P1) · Tailwind+shadcn ✓ (P2) · Supabase CLI local + first migration ✓ (P3) · Auth signup/login/logout + protected shell ✓ (P4) · `bun run check` ✓ (P1) · pre-commit hook ✓ (P1.7) · GitHub Actions CI ✓ (P1.8) · full docs scaffold + AGENTS map + BACKPRESSURE + db-schema generator ✓ (P5). **No gaps.**

**§7 docs tree:** every listed file created in P5.1/5.2. Reachability enforced via `index.md` per subdir + AGENTS map. Generated db-schema format matches (`## Tables` → `### <table>`).

**§3/§10 scripts:** P1.2 sets the exact script block from the brief, including the `format = biome check --write` correction (current scaffold had `biome format --write`).

**§6 seams:** service layer not built in M0 (correct — it begins M2), but `ARCHITECTURE.md` (P5.5) documents the seam and `client.ts` keeps the user-scoped client pattern that services will consume. No MCP/AI/vector/streaming scaffolding (brief forbids). Service-role client deferred to M4 with a TODO comment, not faked.

**§0 backpressure:** every phase ends on a `bun run check` gate; hook + CI enforce it. CI deliberately excludes DB-dependent steps so `check` stays runnable without a live Supabase — risk: env module must not throw at import without env. Mitigation: P3.4 guards/lazy-parses, and Vitest provides test env values.

**Environment risks:** FFmpeg missing — not needed until M4, documented, no M0 blocker. Next 16/React 19 newer than training — mitigated by P1.1/P4.1 doc-reads and verifying `@supabase/ssr` cookie API against installed source. Tailwind v4 + shadcn compatibility — verified live in P2 before relying on it.

**Placeholder scan:** no "TBD/implement later" left as work; the only intentional deferrals (service-role client, OAuth, e2e specs) are explicitly scoped to later milestones with seams, per the brief.
