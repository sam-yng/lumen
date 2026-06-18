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

- **post-prod** — AI assistant standalone page + post-launch enablement
  - [assistant-launch.md](exec-plans/queued/post-prod/assistant-launch.md)
    — Phase 1 (relocate the assistant to its own gated `/assistant` page) is
    do-now; Phase 2 (flip the enable flag + run the Claude-key verification
    flows) is deferred past launch. Absorbs the former
    `prod-assistant-verification` gate so the launch path carries no Claude-key
    dependency.

## Active

- **production** — targeted production deployment fixes
  - [railway-worker-whisper-bootstrap.md](exec-plans/active/production/railway-worker-whisper-bootstrap.md)
    — make the Railway worker image prebuild and verify `whisper-cli` so the
    service can return to an empty custom start command.
- **cross-cutting** — focused UI polish
  - [tag-color-picker-custom.md](exec-plans/active/cross-cutting/tag-color-picker-custom.md)
    — replace the native tag color select with a custom color-block picker and
    align the tag create controls on desktop.
  - [document-editor-fixed-shell.md](exec-plans/active/cross-cutting/document-editor-fixed-shell.md)
    — keep the note header and editor toolbar visible while document content
    scrolls inside the editor shell.
  - [library-topbar-recorder.md](exec-plans/active/cross-cutting/library-topbar-recorder.md)
    — move the recorder control into the library top bar action slot.
  - [recents-and-delete-safety.md](exec-plans/active/cross-cutting/recents-and-delete-safety.md)
    — add a document-only recents view and make folder deletion remove the
    full folder subtree.

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
- [index-m2-plus.md](exec-plans/completed/v3/index-m2-plus.md) — Advanced
  capture & retrieval group (m2–m4, all shipped; completes the v3 release)
- [streaming-transcription.md](exec-plans/completed/v3/streaming-transcription.md)
  (2026-06-10) — milestone 2; browser Transformers.js
  live capture finalizing through the batch transcript path
- [speaker-diarization.md](exec-plans/completed/v3/speaker-diarization.md)
  (2026-06-10) — milestone 3; sherpa-onnx batch diarization,
  env-gated, degrade-never-fail
- [citation-experience.md](exec-plans/completed/v3/citation-experience.md)
  (2026-06-11) — milestone 4; clickable [S#] citations, source cards, and
  transcript deep links; manual click-through carried by the assistant
  verification gate

### v4 shipped

- [index.md](exec-plans/completed/v4/index.md) — Grounded answers & capture
  hardening group (all 5 children shipped; group closed 2026-06-12)
- [document-anchors.md](exec-plans/completed/v4/document-anchors.md)
  (2026-06-11) — milestone 1; document semantic chunks carry optional
  paragraph anchors and document citations open highlighted note blocks
- [grounded-answers.md](exec-plans/completed/v4/grounded-answers.md)
  (2026-06-11) — milestone 2; server-side citation validation, assistant
  sources filtered to cited-and-valid, invalid labels rendered degraded;
  manual click-through carried by the assistant verification gate
- [retrieval-quality-reranking.md](exec-plans/completed/v4/retrieval-quality-reranking.md)
  (2026-06-11) — milestone 3; measurement-first retrieval-quality harness
  shipped (`__tests__/retrieval-eval/`), recorded **NO-GO** on a reranker:
  hybrid recall@8 misses are paraphrase-only and mostly out-of-pool, which
  reranking cannot recover
- [streaming-diarization.md](exec-plans/completed/v4/streaming-diarization.md)
  (2026-06-11, PR #36) — milestone 4; post-finalize speaker labels for live
  sessions via a `label-speakers` worker job reusing the batch
  `DiarizationProvider` (webm→WAV via ffmpeg), env-gated, degrade-never-fail
- [stale-live-sessions.md](exec-plans/completed/v4/stale-live-sessions.md)
  (2026-06-12, PR #37) — milestone 5; cron-scheduled worker sweep finalizes
  abandoned `live` recordings from stored segments or expires segmentless
  husks after `LIVE_SESSION_STALE_MINUTES`, using segment `created_at` as
  the activity signal; clears the stale-live tech-debt row

### production shipped

- [marketing-landing-redesign.md](exec-plans/completed/production/marketing-landing-redesign.md)
  (2026-06-12) — landing redesign Tasks 1–13 shipped and verified
  (design: [superpowers/specs](superpowers/specs/2026-06-04-marketing-landing-redesign-design.md));
  deployment rides the prod-readiness env-and-deploy plan
- [light-redesign.md](exec-plans/completed/production/light-redesign.md)
  (2026-06-16) — both apps dark→light (Notion-inspired light theme, skinnier
  chrome); milestones M0–M8 shipped, both apps browser-verified; binding
  decisions: light-only with the dark seam retained (no toggle) + no
  "Notify me" capture anywhere
  (design: [superpowers/specs](superpowers/specs/2026-06-16-light-redesign-design.md))
- **prod-readiness** — Production-readiness group (build complete 2026-06-17;
  moved `active/production/ → completed/production/`). All four child plans
  implemented and `bun run check` green; remaining work is codebase-external
  launch verification (Resend SMTP, Google OAuth client, Sentry DSNs,
  Vercel/Railway env, lawyer review, `{{…}}` placeholders) tracked in
  [EXTERNAL-SETUP.md](exec-plans/completed/production/prod-readiness/EXTERNAL-SETUP.md).
  - [index.md](exec-plans/completed/production/prod-readiness/index.md)
  - [DEPLOY.md](exec-plans/completed/production/prod-readiness/DEPLOY.md)
    — deploy runbook + prod env matrix
  - [prod-env-and-deploy.md](exec-plans/completed/production/prod-readiness/prod-env-and-deploy.md)
  - [prod-auth.md](exec-plans/completed/production/prod-readiness/prod-auth.md)
  - [prod-sentry.md](exec-plans/completed/production/prod-readiness/prod-sentry.md)
  - [prod-legal-pages.md](exec-plans/completed/production/prod-readiness/prod-legal-pages.md)

### Cross-cutting shipped

- [frontend-overhaul.md](exec-plans/completed/cross-cutting/frontend-overhaul.md)
  (PR #30, 2026-06-10) — mobile-first responsive sweep + component-quality pass
  (design: [superpowers/specs](superpowers/specs/2026-06-10-frontend-overhaul-design.md))
- [ci-cd-hardening.md](exec-plans/completed/cross-cutting/ci-cd-hardening.md)
  — PR-triggered `quality-gate` + Supabase-backed `e2e-smoke` CI jobs; dirty-kitchen rule
- [planning-lifecycle-enforcement.md](exec-plans/completed/cross-cutting/planning-lifecycle-enforcement.md)
  — `check:plans` gate enforcing the exec-plan-before-build rule

## Archive

- **v2** — [index.md](exec-plans/archive/v2/index.md) — original queued v2 group
  snapshot, superseded by [completed/v2/index.md](exec-plans/completed/v2/index.md).
