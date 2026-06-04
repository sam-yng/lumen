# Plans

Execution plans live under [exec-plans/](exec-plans/). The folder is organized
by lifecycle, not by release number, because post-MVP work can overlap across
product, production, AI/MCP, retrieval, and docs.

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

## Queued

- **v2 AI & MCP**
  - [index.md](exec-plans/queued/v2-ai-mcp/index.md)
  - [semantic-search.md](exec-plans/queued/v2-ai-mcp/semantic-search.md)
  - [mcp-server-auth.md](exec-plans/queued/v2-ai-mcp/mcp-server-auth.md)
  - [in-app-assistant.md](exec-plans/queued/v2-ai-mcp/in-app-assistant.md)

## Active

- **Production readiness**
  - [index.md](exec-plans/active/prod-readiness/index.md)
  - [prod-env-and-deploy.md](exec-plans/active/prod-readiness/prod-env-and-deploy.md)
  - [prod-auth.md](exec-plans/active/prod-readiness/prod-auth.md)
  - [prod-sentry.md](exec-plans/active/prod-readiness/prod-sentry.md)
  - [prod-legal-pages.md](exec-plans/active/prod-readiness/prod-legal-pages.md)

## Completed

### v1 completed milestones

- [m0-harness-and-scaffold.md](exec-plans/completed/m0-harness-and-scaffold.md)
- [m1-schema-and-rls.md](exec-plans/completed/m1-schema-and-rls.md)
- [m2-library.md](exec-plans/completed/m2-library.md)
- [m3-editor.md](exec-plans/completed/m3-editor.md)
- [m4-transcription.md](exec-plans/completed/m4-transcription.md)
- [m5-search-transcripts.md](exec-plans/completed/m5-search-transcripts.md)
- [m6-harden-and-document.md](exec-plans/completed/m6-harden-and-document.md)

### Post-v1 cleanup and foundation

- [design-implementation-pass.md](exec-plans/completed/design-implementation-pass.md)
- [monorepo-migration.md](exec-plans/completed/monorepo-migration.md)
- [planning-system-cleanup.md](exec-plans/completed/planning-system-cleanup.md)
- [pre-v2-cleanup.md](exec-plans/completed/pre-v2-cleanup.md)

## Archive

No archived plans yet.
