# v2 AI & MCP Planning Group

> **ARCHIVED (2026-06-05).** Superseded by the live group index at
> [`active/v2/index.md`](../../active/v2/index.md). This is the original queued
> snapshot; do not use it to guide current implementation. Semantic search,
> MCP server + auth, and the in-app assistant have since shipped (see
> `completed/v2/`).

> **Status:** queued (historical)
> **Version:** v2
> **Area:** AI/MCP, semantic search, assistant
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/completed/post-v1/pre-v2-cleanup.md`
> **Supersedes:** none

## Goal

Turn the Lumen vault into something an agent can reason over and act on, then
expose the same capabilities through a real MCP server usable in-app and by
external MCP hosts.

## Source Material

- Roadmap handoff: `/Users/samy/Downloads/files/study-app-roadmap-v2-v4.md`
- Architecture seams: `ARCHITECTURE.md`
- Security model: `docs/SECURITY.md`
- v1 service layer: `apps/web/src/server/services/`
- Worker seam: `apps/web/worker/`

## Child Plans

Implement these as separate plans so each can ship and be reviewed on its own:

1. [semantic-search.md](../../completed/v2/semantic-search.md) - completed:
   pgvector, local embeddings, chunking, hybrid search, and worker indexing.
2. [mcp-server-auth.md](../../completed/v2/mcp-server-auth.md) - completed:
   TypeScript MCP server, Streamable HTTP transport, Supabase JWT validation,
   OAuth 2.1 posture, and user isolation tests.
3. [in-app-assistant.md](../../completed/v2/in-app-assistant.md) - completed: MCP
   client, Claude agent loop, chat panel, tool-call UX, and demo docs.

## Sequencing

1. Semantic search first: the assistant and MCP tools need retrieval that can
   cite documents and transcript chunks.
2. MCP server second: wrap the v1 service layer and semantic search as MCP
   resources, tools, and prompts without adding business logic to the adapter.
3. In-app assistant third: call the same MCP server from the product UI so the
   internal assistant and external hosts exercise the same contract.

## Non-Negotiables

- The MCP server is a thin adapter over existing services.
- Every tool/resource call is scoped to the authenticated Supabase user.
- Worker/service-role paths must scope every query by `user_id`.
- Embeddings are local/free to run; do not add a per-embedding API cost.
- v2 does not include realtime transcription, diarization, collaboration, or
  production deployment hardening beyond what each child plan explicitly needs.

## Promotion Rule

Move a child plan from `queued/` to `active/` only when implementation begins.
Update `docs/PLANS.md` in the same change so the index remains trustworthy.
