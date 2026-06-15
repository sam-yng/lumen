# Planning Lifecycle Enforcement

> **Status:** active — implemented, pending human review (working rule #4)
> **Version:** cross-cutting
> **Area:** docs / process governance
> **Created:** 2026-06-09
> **Activated:** 2026-06-09
> **Depends on:** [`docs/exec-plans/completed/post-v1/planning-system-cleanup.md`](../../completed/post-v1/planning-system-cleanup.md)
> **Supersedes:** none

## Goal

Make the planning lifecycle hold to the **same standard on every release** by
closing the gap that let v3 ship code with no `docs/exec-plans/` entry. A
superpowers design spec may be the *upstream design input*, but an exec-plan
(informed by that spec) MUST exist, be self-reviewed, and be indexed in
`PLANS.md` before a build — and an automated check, not human memory, enforces
it.

## Problem / root cause

Two planning locations exist and were never reconciled:

- `docs/exec-plans/` — the repo-native lifecycle system (AGENTS.md working rule
  #1, [PLANS.md](../../../PLANS.md), [BACKPRESSURE.md](../../../../BACKPRESSURE.md)).
- `docs/superpowers/{plans,specs}/` — where the `superpowers` execution skill
  writes its design spec + checkbox task plan, and where the executor reads its
  task list from.

AGENTS.md rule #1 names only `docs/exec-plans/` and never acknowledges
superpowers. So since v2 the real workflow has been "superpowers writes the
plan → a human *manually* mirrors it into `docs/exec-plans/` + `PLANS.md`." That
second step is **unowned and ungated**: `bun run check` never inspects it, and
BACKPRESSURE's "docs are backpressure" only covers schema regen + link-clean
(a *missing* entry breaks no link). v2 was mirrored because someone remembered;
v3 was not because someone forgot.

**Current orphan audit** (the dirty dish to clean before adding the gate, per
rule #6): every superpowers artifact is already linked from an exec-plan
*except* the two v3 cited-retrieval files. v3 is the only violation.

## Target model (the reconciled flow)

```
design (superpowers spec/plan — optional, any depth)
        │  informs
        ▼
exec-plan in docs/exec-plans/{queued|active}/<bucket>/   ← rule #1 gate: exists + self-reviewed BEFORE build
        │  links back to the spec/plan (pointer, not a full copy)
        ▼
build → check → manual happy path → human review at milestone boundary
```

The exec-plan is the canonical pre-build record and the single thing `PLANS.md`
indexes. It **points at** the superpowers spec/plan (the existing v2
`> **Design:** / > **Plan:**` pointer convention) rather than duplicating the
body. No superpowers artifact may exist without an exec-plan referencing it.

## Tasks

### Task 1 — Reconcile v3 (clean the kitchen before adding the gate)

Mirror the v2 structure exactly (umbrella in `active/`, shipped child in
`completed/`):

- Create `docs/exec-plans/active/v3/index.md` — the v3 initiative umbrella
  (scope, milestone list, build order; milestone 1 marked shipped). Links the
  v3 design spec.
- Create `docs/exec-plans/completed/v3/cited-retrieval.md` — milestone 1
  retrospective + verification note, with `> **Design:**` / `> **Plan:**`
  pointers to
  [`specs/2026-06-09-v3-cited-retrieval-design.md`](../../../superpowers/specs/2026-06-09-v3-cited-retrieval-design.md)
  and
  [`plans/2026-06-09-v3-cited-retrieval.md`](../../../superpowers/plans/2026-06-09-v3-cited-retrieval.md),
  and a reference to PR #23 (`feat/v3-execution`).
- Update [`PLANS.md`](../../../PLANS.md): add an **Active → v3** entry and a
  **Completed → v3 shipped** section; move this plan out of "Queued: (none)".

### Task 2 — Refine AGENTS.md working rule #1

Rewrite rule #1 so the handoff is explicit and matches reality:

> 1. **Plan before build.** A design spec (e.g. a `superpowers` spec/plan) may be
>    the design input, but before building you MUST have an exec-plan in
>    `docs/exec-plans/{queued,active}/<bucket>/`, self-reviewed and indexed in
>    `PLANS.md`. The exec-plan links to any informing spec rather than copying
>    it. No superpowers spec/plan may exist without an exec-plan referencing it.

### Task 3 — Refine BACKPRESSURE.md

- Add a "Planning is backpressure too" note: the planning-lifecycle lint (Task
  4) is part of `bun run check`; an orphaned spec or an unindexed bucket fails
  the gate.
- Update the "Per-milestone rhythm" list so step 1 reads "Write/locate the
  design input (superpowers spec optional), then write the exec-plan to
  `active/`."

### Task 4 — Add the automated planning-lifecycle lint

Create `scripts/check-plan-lifecycle.ts` (repo root; plain Bun + `node:fs`, no
new deps). It asserts two invariants and exits non-zero with a clear,
file-named message on violation:

1. **No orphan specs/plans.** Every `docs/superpowers/{plans,specs}/*.md` is
   referenced by relative path from at least one file under `docs/exec-plans/`.
2. **No unindexed buckets.** Every version/initiative bucket directory under
   `docs/exec-plans/{queued,active,completed,archive}/*` is linked from
   `PLANS.md`.

Wire it into the gate with no CI change required:

```jsonc
// package.json
"check:plans": "bun run scripts/check-plan-lifecycle.ts",
"check": "biome check . && bun run check:plans && turbo run typecheck test"
```

CI's `quality-gate` job already runs `bun run check`, is DB-free, and so picks
this up automatically.

### Task 5 — Verify

- `bun run check` is green after Tasks 1–4.
- Temporarily rename a superpowers spec reference (or drop a PLANS.md bucket
  line) and confirm `check:plans` fails with the expected message; revert.
- Confirm the docs tree stays link-clean.

## Self-Review

- **Addresses the stated goal** ("same manner, same standard; rules must not
  deviate"): the standard is enforced by `bun run check`, not memory — the same
  backpressure philosophy the repo already applies to code.
- **Honors the user's directive**: superpowers specs remain valid design input;
  they simply must *inform* an exec-plan before build, and the lint guarantees
  the link exists.
- **Rule/reality gap closed**: rule #1 is rewritten to describe the actual
  superpowers→exec-plan flow instead of a single-system world that no longer
  exists.
- **Rule #6 respected**: v3 (the only current orphan) is reconciled in Task 1
  *before* the gate is switched on, so enabling the check does not red-light an
  already-dirty tree.
- **Scope discipline**: docs + one small DB-free lint script + `package.json`
  wiring. No product code, no CI YAML change, no superpowers artifacts rewritten.
- **Mirrors precedent**: v3's `active/index.md` + `completed/<child>.md` shape
  copies v2 exactly, so the structure does not itself deviate.
