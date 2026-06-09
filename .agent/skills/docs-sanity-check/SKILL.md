---
name: docs-sanity-check
description: Use when validating a repo's /docs knowledge base for stale content, broken internal links, orphaned files, drifted generated docs, or outdated code references. Invoke manually before releases, after big refactors, when docs feel untrustworthy, or to audit the AGENTS.md → docs/ map for unreachable files and stub rot.
---

# docs-sanity-check

Detect and prune drift between a repo's `docs/` tree and its live codebase. **Propose, then apply** — never silently rewrite human-authored content.

## When to use

- Before cutting a release.
- After a refactor that renamed files or moved code.
- When an agent (or human) reports docs pointing at things that no longer exist.
- Periodically (e.g. monthly) as routine hygiene.

## When NOT to use

- On repos without a structured `docs/` tree (nothing to audit).
- To *author* new docs — this skill only validates and prunes.
- On `node_modules/`, build output, or generated dependency docs.

## Repo contract this skill assumes

- A root `AGENTS.md` acts as the map (table-of-contents).
- Cross-cutting docs live at `docs/*.md`; topic areas under `docs/<topic>/index.md`.
- Machine-written files live under `docs/generated/` (and say so in a header).
- Implementation plans live under `docs/exec-plans/{active,completed}/`.

If the repo's layout is different, adapt the checks — don't abandon them.

## Checks

Run all six; aggregate findings into a single report before touching anything.

1. **Broken internal links** — For every markdown file in `AGENTS.md`, `ARCHITECTURE.md`, and `docs/**/*.md`: extract every `[text](path)` where `path` is relative (not `http(s)://`). For each, resolve against the file's dir and verify the target exists (allow `#anchor` suffixes). Report the (file, line, broken link, resolved path) tuples.

2. **Orphaned code refs** — Grep doc files for `src/**/*.{ts,tsx}`, `supabase/**/*.sql`, and other repo-relative paths. For each referenced path, verify existence via `Glob`. Skip references that are clearly filename templates (contain `YYYY-MM-DD`, `[slug]`, `<topic>`, or other placeholder tokens). Also grep for backticked identifiers that look like symbols (function/component names) and spot-check a handful via `Grep`. Report references to paths/symbols that no longer exist.

3. **Unreachable docs** — BFS the link graph starting at `AGENTS.md` (plus any `docs/*/index.md` and `README.md` as extra roots). Any `docs/**/*.md` not reached is orphaned. Report the orphans.

4. **Generated drift** — For each file under `docs/generated/`, re-derive it from its declared source (e.g. `db-schema.md` from `supabase/migrations/*.sql`). Diff against the on-disk file. Report sections that differ. When scanning `db-schema.md` for tables, only extract `### `-headed entries that appear **after** the `## Tables` heading — skip enum and function sections which use the same heading level.

5. **Freshness** — For each non-generated, non-stub doc, compare `git log -1 --format=%ct <doc>` to the last-commit time of the code paths it references (take the max). Flag docs whose code has been touched >30 days *after* the doc was last touched. Rule of thumb; use judgment.

6. **Stub rot** — Grep doc files for `TODO`, `FIXME`, or `_(none yet)_` markers. List the (file, marker) tuples. Not necessarily bad — but old stubs are the most common form of rot.

## Workflow

1. **Discover**: `Glob docs/**/*.md`, `Glob AGENTS.md ARCHITECTURE.md README.md`.
2. **Run all six checks** (read-only).
3. **Report**: one consolidated message to the user, grouped by severity:
   - `BROKEN` — dead links, missing code refs (act first)
   - `DRIFT` — generated docs out of sync with source
   - `ORPHAN` — unreachable doc files
   - `STALE` — freshness flags
   - `STUB` — TODO markers (lowest priority; informational)
4. **Confirm per group**: ask the user which groups to apply fixes for. Do NOT bundle "apply all".
5. **Apply**:
   - `BROKEN` → edit the referring doc (remove link, or fix path if the target clearly moved).
   - `DRIFT` → overwrite the `docs/generated/` file with the freshly derived content.
   - `ORPHAN` → propose either: add a link from the nearest index/map, or move the file to `docs/exec-plans/completed/` with a status note. Never auto-delete.
   - `STALE` / `STUB` → report only; leave to human.

## Guardrails

- **Never auto-delete human-authored content.** Only `docs/generated/` is safe to overwrite without asking.
- **Never silently rewrite content.** All edits outside `docs/generated/` require explicit per-file confirmation.
- **Never touch `CLAUDE.md` or `AGENTS.md` content** unless the user explicitly opted in to "fix broken links in AGENTS.md" — those files are load-bearing for every agent session.
- **Preserve link text.** When fixing a broken path, keep the original anchor text; only change the target.
- **Keep the report under ~400 lines.** If a check produces more findings than that, summarize + attach a full list as a follow-up artifact.

## Output format

```
# docs-sanity-check report — <repo> — <date>

## BROKEN (N)
- <file>:<line> — `[text](bad/path)` → resolved `/abs/path` (missing)
...

## DRIFT (N)
- docs/generated/db-schema.md — 3 tables changed (profiles, orders, payments)
...

## ORPHAN (N)
- docs/foo.md — not reachable from AGENTS.md or any index.md
...

## STALE (N)
- docs/SECURITY.md — last touched 2025-11-02; referenced code last touched 2026-03-14
...

## STUB (N)
- docs/DESIGN.md:5 — TODO
...

## Proposed actions
1. BROKEN: fix 4 links in docs/payments/index.md
2. DRIFT: regenerate docs/generated/db-schema.md
3. ORPHAN: add link OR move — 1 file
(reply with which groups to apply)
```

## Common mistakes

- **Over-aggressive pruning.** A stub is not rot; a TODO marker is a signal, not a failure. Report, don't delete.
- **Treating `_(none yet)_` as brokenness.** It's an intentional empty-state.
- **Ignoring anchors.** `[text](foo.md#section)` — verify the file exists; don't require the anchor to resolve (markdown anchors are fuzzy).
- **Forgetting the generator.** If `docs/generated/db-schema.md` drifts, you must regenerate it from `supabase/migrations/`, not hand-edit it.
- **Running checks in isolation.** Always produce the combined report first; piecemeal fixing creates churn.
