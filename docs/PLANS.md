# Plans

Execution plans live under [exec-plans/](exec-plans/). The top level is
organized by **lifecycle** (status), and within each lifecycle folder plans are
grouped into **version/phase buckets** so the tree stays legible as releases
accumulate.

## Lifecycle

- **[queued/](exec-plans/queued/)** - approved or drafted plans that are not yet
  being implemented.
- **[active/](exec-plans/active/)** - in-flight work. Grouped initiatives may
  use an `index.md` plus child plans.
- **[completed/](exec-plans/completed/)** - shipped plans with retrospectives
  and verification notes.
- **[archive/](exec-plans/archive/)** - superseded plans or historical planning
  material that should not guide current implementation.
- **[tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)** - known shortcuts
  and follow-ups that cut across statuses and versions.

## Bucket rule

Inside every lifecycle folder, plans live in a **version/phase bucket** — never
loose at the lifecycle root. Bucket names come from the plan `Version` field:
`v1`, `post-v1`, `v2`, `v3`, `v4`, `production`, `cross-cutting`. A bucket holds
either loose plan files (e.g. `completed/v1/m0-…md`) or a grouped initiative
(`index.md` + child plans, e.g. `queued/v2/index.md`).

When a plan changes lifecycle (queued → active → completed), move it into the
**same-named bucket** under the new folder and update this index in the same
change (see the Promotion Rule in each group `index.md`). The bucket name
travels with the plan; only the lifecycle folder changes. `archive/` follows the
same rule when it gains content.

## Queued

- **v3** — Advanced capture & retrieval (m4+: citation experience)
  - [index.md](exec-plans/queued/v3/index.md)
  - [citation-experience.md](exec-plans/queued/v3/citation-experience.md)

## Active

- **v3** — Streaming transcription (m2; spike resolved: browser Transformers.js
  + segment POSTs)
  - [streaming-transcription.md](exec-plans/active/v3/streaming-transcription.md)

- **v3** — Speaker diarization (m3; spike resolved: sherpa-onnx Node bindings)
  - [speaker-diarization.md](exec-plans/active/v3/speaker-diarization.md)

- **cross-cutting** — CI/CD hardening
  - [ci-cd-hardening.md](exec-plans/active/cross-cutting/ci-cd-hardening.md)
- **cross-cutting** — Planning lifecycle enforcement (implemented; pending review)
  - [planning-lifecycle-enforcement.md](exec-plans/active/cross-cutting/planning-lifecycle-enforcement.md)
- **production** — Production readiness
  - [index.md](exec-plans/active/production/prod-readiness/index.md)
  - [prod-env-and-deploy.md](exec-plans/active/production/prod-readiness/prod-env-and-deploy.md)
  - [prod-auth.md](exec-plans/active/production/prod-readiness/prod-auth.md)
  - [prod-sentry.md](exec-plans/active/production/prod-readiness/prod-sentry.md)
  - [prod-legal-pages.md](exec-plans/active/production/prod-readiness/prod-legal-pages.md)
  - [prod-assistant-verification.md](exec-plans/active/production/prod-readiness/prod-assistant-verification.md)
    — Claude-key launch gate for the v2 assistant + v3 cited retrieval
- **production** — Marketing landing redesign
  - [marketing-landing-redesign.md](exec-plans/active/production/marketing-landing-redesign.md)
    (design: [superpowers/specs](superpowers/specs/2026-06-04-marketing-landing-redesign-design.md))

## Completed

### v1 completed milestones

- [m0-harness-and-scaffold.md](exec-plans/completed/v1/m0-harness-and-scaffold.md)
- [m1-schema-and-rls.md](exec-plans/completed/v1/m1-schema-and-rls.md)
- [m2-library.md](exec-plans/completed/v1/m2-library.md)
- [m3-editor.md](exec-plans/completed/v1/m3-editor.md)
- [m4-transcription.md](exec-plans/completed/v1/m4-transcription.md)
- [m5-search-transcripts.md](exec-plans/completed/v1/m5-search-transcripts.md)
- [m6-harden-and-document.md](exec-plans/completed/v1/m6-harden-and-document.md)

### Post-v1 cleanup and foundation

- [design-implementation-pass.md](exec-plans/completed/post-v1/design-implementation-pass.md)
- [monorepo-migration.md](exec-plans/completed/post-v1/monorepo-migration.md)
- [planning-system-cleanup.md](exec-plans/completed/post-v1/planning-system-cleanup.md)
- [pre-v2-cleanup.md](exec-plans/completed/post-v1/pre-v2-cleanup.md)

### v2 shipped

- [index.md](exec-plans/completed/v2/index.md) — AI & MCP group (3 of 3 children
  shipped; assistant happy-path carried to the production verification gate)
- [semantic-search.md](exec-plans/completed/v2/semantic-search.md) (PR #19)
- [task-2-chunking-embedding-provider.md](exec-plans/completed/v2/task-2-chunking-embedding-provider.md)
- [task-3-semantic-indexing-service.md](exec-plans/completed/v2/task-3-semantic-indexing-service.md)
- [task-4-hybrid-search-service.md](exec-plans/completed/v2/task-4-hybrid-search-service.md)
- [mcp-server-auth.md](exec-plans/completed/v2/mcp-server-auth.md) (PR #21)
- [in-app-assistant.md](exec-plans/completed/v2/in-app-assistant.md) (2026-06-08)

### v3 shipped

- [index.md](exec-plans/completed/v3/index.md) — Cited retrieval & grounding
  group (m1 was the only scoped milestone; group complete)
- [cited-retrieval.md](exec-plans/completed/v3/cited-retrieval.md) (PR #23,
  2026-06-09) — milestone 1; manual assistant happy-path pending a Claude key
  (production-readiness blocker)

## Archive

- **v2** — [index.md](exec-plans/archive/v2/index.md) — original queued v2 group
  snapshot, superseded by [completed/v2/index.md](exec-plans/completed/v2/index.md).
