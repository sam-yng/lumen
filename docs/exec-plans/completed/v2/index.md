# v2 AI & MCP Planning Group

> **Status:** completed — 3 of 3 child plans shipped (semantic search PR #19,
> MCP server + auth PR #21, in-app assistant PR #22) and accepted on human
> review.
> **One open gate (does not block completion of the build):** the in-app
> assistant's manual browser happy-path needs a real Claude key — an
> environmental/launch blocker, not unfinished build work. Carried forward to the
> consolidated
> [assistant verification gate](../../queued/post-prod/assistant-launch.md)
> (production-readiness).
> **Version:** v2
> **Area:** AI/MCP, semantic search, assistant
> **Created:** 2026-06-04
> **Activated:** 2026-06-04
> **Completed:** 2026-06-09
> **Depends on:** `docs/exec-plans/completed/post-v1/pre-v2-cleanup.md`
> **Supersedes:** `docs/exec-plans/archive/v2/index.md`

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

1. [semantic-search.md](semantic-search.md) - **completed**
   (PR #19): pgvector, local embeddings, chunking, hybrid search, and worker
   indexing.
2. [mcp-server-auth.md](mcp-server-auth.md) - **completed**
   (PR #21): TypeScript MCP server, Streamable HTTP transport, Supabase JWT
   validation, OAuth 2.1 posture, and user isolation tests.
3. [in-app-assistant.md](in-app-assistant.md) - **completed**
   (2026-06-08): BYO-key MCP client, Claude agent loop, key storage via Vault,
   chat panel, tool-call UX, and demo docs.

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
