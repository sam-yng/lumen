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
   - **Skip links inside fenced code blocks (` ``` `) and inline code spans.** Plans and skills quote markdown templates ("add this line to the index: `[foo.md](foo.md)`"); those snippets resolve relative to the *target* doc, not the doc that quotes them, and are not real links. Known example: `docs/superpowers/plans/2026-06-08-in-app-assistant.md` quotes an index entry for `docs/product-specs/index.md` inside a fence — not broken.

2. **Orphaned code refs** — Grep doc files for `src/**/*.{ts,tsx}`, `supabase/**/*.sql`, and other repo-relative paths. For each referenced path, verify existence via `Glob`. Skip references that are clearly filename templates (contain `YYYY-MM-DD`, `[slug]`, `<topic>`, or other placeholder tokens). Also grep for backticked identifiers that look like symbols (function/component names) and spot-check a handful via `Grep`. Report references to paths/symbols that no longer exist.
   - **Completed exec plans are historical records.** For `docs/exec-plans/completed/**`, a code path that no longer exists is not automatically `BROKEN`; it may record what that milestone created before later refactors renamed or moved it. Do not rewrite completed plans just to match current paths. If the completed plan or a later completed plan records the rename/move/deletion (for example Next `middleware` → `proxy`, timestamped migrations replacing `000_init.sql`, or `components/transcript/` becoming `components/transcripts/`), classify it as `HISTORICAL`/informational and take no edit action.
   - **Active and queued exec plans are allowed to point forward.** A missing path in `docs/exec-plans/active/**` or `docs/exec-plans/queued/**` is only `BROKEN` when the surrounding text says the file should already exist. If it is listed under create/delete steps, conflict flags, or future implementation instructions, classify it as planned work rather than rot.

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
   - `HISTORICAL` — obsolete code refs intentionally preserved in completed plans (informational; do not edit)
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
- **Do not rewrite completed milestones to modernize paths.** Completed plans are evidence of what was built at that time; changing `src/middleware.ts` to `src/proxy.ts` or `000_init.sql` to a later timestamped migration can falsify the record unless the completed plan itself is explicitly documenting the later correction.
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

## HISTORICAL (N)
- docs/exec-plans/completed/v1/m0-harness-and-scaffold.md:33 — `src/middleware.ts` was later renamed to `src/proxy.ts`; no edit
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
- **Flagging links quoted in code fences.** A markdown link inside a fenced block or inline code is template/example content, not a navigable link. Strip fenced and inline code before extracting links, or every quoted index-entry snippet becomes a false `BROKEN`.
- **Forgetting the generator.** If `docs/generated/db-schema.md` drifts, you must regenerate it from `supabase/migrations/`, not hand-edit it.
- **Running checks in isolation.** Always produce the combined report first; piecemeal fixing creates churn.
