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
