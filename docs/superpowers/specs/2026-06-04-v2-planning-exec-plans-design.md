# v2 Planning And Exec-Plans Cleanup Design

## Purpose

Lumen is moving from the fixed v1 milestone ladder into v2 planning. The
current `docs/exec-plans/` structure still assumes one sequential milestone at
a time (`M0` through `M6`), but post-MVP work will overlap across product,
production, AI/MCP, retrieval, and documentation concerns.

This cleanup makes `docs/exec-plans/` status-first instead of milestone-first.
The goal is to make active work easy to find, preserve completed v1 history, and
start v2 planning without pretending future releases will be as rigid as the
MVP build.

## Current Findings

- `docs/PLANS.md` is stale: it says `active/` is empty, while
  `docs/exec-plans/active/prod-readiness/` contains active plans.
- The completed v1 plans use `m0` through `m6` names. Those names are useful
  historical markers and should not be renamed just for neatness.
- The active production-readiness plans already use grouped planning, which is
  the right pattern for post-MVP work, but the group is not reachable from the
  main plans index.
- A read-only docs audit found no broken internal Markdown links and no
  generated database schema drift.
- Some active plans still use app-local paths such as `src/proxy.ts` with a
  path note explaining that they now resolve under `apps/web/`. The cleanup
  should avoid rewriting large completed historical plans, but new and touched
  active plans should use current monorepo paths directly.

## Information Architecture

`docs/PLANS.md` remains the single human-readable planning index.

`docs/exec-plans/` uses lifecycle folders:

- `queued/` - approved or drafted plans that are not yet being implemented.
- `active/` - in-flight work. A grouped initiative may be a folder with an
  `index.md` plus child plans.
- `completed/` - shipped plans with retrospectives and verification notes.
- `archive/` - superseded plans or historical planning material that should not
  guide current implementation.

`docs/exec-plans/tech-debt-tracker.md` stays at the exec-plans root because it
cuts across statuses and versions.

## Plan Naming

New plan files should use descriptive slugs instead of fixed milestone numbers:

- `v2-ai-mcp/index.md`
- `v2-ai-mcp/semantic-search.md`
- `v2-ai-mcp/mcp-server-auth.md`
- `v2-ai-mcp/in-app-assistant.md`
- `prod-readiness/auth.md`

Version prefixes are allowed when useful, but they are metadata hints, not the
primary folder taxonomy. A production hardening plan that ships during v2 can
still live under `active/prod-readiness/`; it does not need to be forced into a
`v2/` folder.

Completed v1 files keep their existing `m0` through `m6` names and are listed
under a clearly labeled "v1 completed milestones" section in `docs/PLANS.md`.

## Plan Header

Every new or substantially touched exec plan should start with a compact status
block before the implementation plan body:

```markdown
> **Status:** queued | active | completed | archived
> **Version:** v2 | v3 | v4 | production | cross-cutting
> **Area:** semantic search | MCP | assistant | auth | deploy | docs
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/completed/pre-v2-cleanup.md`
> **Supersedes:** none
```

The status block is intentionally plain Markdown instead of YAML frontmatter so
it remains readable in the rendered docs and matches the current plan style.

## v2 Planning Seed

Create v2 as a queued grouped initiative first:

- `docs/exec-plans/queued/v2-ai-mcp/index.md` - overview, scope, sequencing,
  seams, cross-cutting security concerns, and links to child plans.
- `semantic-search.md` - pgvector, local embeddings, chunking, hybrid search,
  worker indexing, and search-service extension.
- `mcp-server-auth.md` - TypeScript MCP server, Streamable HTTP transport,
  Supabase JWT validation, OAuth 2.1 posture, resources, tools, prompts, and
  user isolation tests.
- `in-app-assistant.md` - MCP client, Claude agent loop, chat panel, tool-call
  UX, error states, and docs/demo flow.

These child plans can be promoted from `queued/` to `active/` individually when
implementation starts. The group index should record the intended build order
without requiring all v2 work to land as one monolithic milestone.

## Cleanup Strategy

The implementation should be small and mechanical:

1. Create missing lifecycle folders (`queued/` and `archive/`).
2. Refresh `docs/PLANS.md` so active, queued, completed, archived, and tech debt
   are all visible from one place.
3. Link the existing `active/prod-readiness/` group from `docs/PLANS.md`.
4. Add the v2 queued group and child plan stubs with enough scope and gates to
   become real implementation plans later.
5. Update agent-facing planning instructions only where needed so new work uses
   lifecycle folders instead of assuming "one active milestone."
6. Leave completed historical plans in place unless a link must be fixed.

## Out Of Scope

- Implementing v2 code: no pgvector migration, embedding worker, MCP server, or
  assistant UI ships in this cleanup.
- Renaming completed v1 plan files.
- Rewriting large completed plans to modernize paths.
- Deleting human-authored plans.
- Resolving active production-readiness implementation details beyond making
  those plans visible and consistent with the new structure.

## Verification

After the cleanup implementation:

- `docs/PLANS.md` links to every current active and queued planning group.
- No Markdown links in `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, or
  `docs/**/*.md` are broken.
- `docs/generated/db-schema.md` still matches the Supabase migrations.
- `bun run check` is green.
- The resulting diff is docs-only unless updating agent instructions requires a
  small `AGENTS.md` edit.

## Spec Self-Review

- Scope is focused on planning structure and v2 plan setup, not v2 feature
  implementation.
- Lifecycle folders solve the naming problem without overfitting future
  releases to fixed milestones.
- Existing v1 history is preserved.
- The v2 seed plans are specific enough to guide later implementation planning
  but do not contain unfinished implementation promises.
