# Monorepo Migration

## Goal

Convert the flat Lumen app repo into a Bun workspace monorepo:

- `apps/web`: the existing app, moved mechanically with history preserved.
- `packages/ui`: shared design tokens exported as CSS.

The migration must preserve the app, worker, Supabase tooling, and `bun run
check` gate while keeping app source edits minimal.

This PR intentionally covers only the workspace move and token extraction.
Marketing app scaffolding and content are deferred to a later PR.

## Phase 0 Checks

- Other in-flight work from `task/v1-cleanup` is merged into `main`.
- Current branch is `task/monorepo-migration` at the same commit as `main`.
- Migration window is active; no new dependency or Supabase migration work is
  expected during the restructure.
- Existing generated-file dirtiness has no content diff, only line-ending
  warnings.
- Active prod-readiness plans are present but not mid-merge in this worktree.

## Phases

1. Move the current app into `apps/web`, create the workspace root package, add
   `turbo.json`, and keep the root gate green.
2. Extract shared design tokens from the app's global CSS into
   `packages/ui/src/styles/tokens.css`; make the app import those tokens.
3. Later PR: scaffold `apps/marketing` as a dependency-light Next.js 16 App
   Router app using shared tokens and its own port.
4. Later PR: build the marketing landing page with static metadata, robots, and
   sitemap.
5. Update CI, hooks, `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, and
   `README.md` for the monorepo layout.
6. Verify the gates and browser happy paths, then move this plan to completed
   with a short retrospective.

## Self-Review

- Scope: structural move and token extraction only; marketing is deferred.
- Collision control: do not refactor app components or auth/server code.
- Security: no new public app surface is introduced in this PR.
- Quality gate: after each patch, run `bun run check` from the root and keep it
  green.
- Docs: update the repo map in the same change so other agents resume against
  the new paths.

## Retrospective

Done. The migration shipped in two passes on `task/monorepo-migration`:

- **Pass 1** (phases 1, 2, 5): moved the app into `apps/web` with history
  preserved, added the workspace root + `turbo.json`, extracted shared tokens
  into `packages/ui`, and updated the docs/CI for the new layout.
- **Pass 2** (phases 3, 4): scaffolded `apps/marketing` — a dependency-light
  Next.js 16 App Router app on port 3001 that imports `@lumen/ui` tokens and
  renders a static landing page with `metadata`, `robots.txt`, and
  `sitemap.xml`. Originally scoped as a later PR; folded onto the same branch.

Notes for the next agent:

- `apps/marketing` is intentionally **public, static, and dataless** — no
  Supabase client, no service layer. It links to the app via
  `NEXT_PUBLIC_APP_URL` and sets its own origin via `NEXT_PUBLIC_SITE_URL`
  (see `apps/marketing/.env.example`); both default to localhost in dev.
- `sitemap.ts` uses a hand-bumped `lastModified` since the landing page is the
  only indexable route today. Add real routes there as the public surface grows.
- Verification: root `bun run check` green across all three packages
  (`@lumen/web`, `@lumen/ui`, `@lumen/marketing`); `next build` for marketing
  prerenders `/`, `/robots.txt`, `/sitemap.xml` as static; landing page
  rendered and spot-checked in a browser.
