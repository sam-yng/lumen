# MCP Server And Auth Plan

> **Status: COMPLETED (2026-06-05).** Shipped in PR #21. TypeScript MCP server
> at `apps/web/src/app/api/mcp/route.ts` (Streamable HTTP), Supabase **bearer
> JWT** auth via `getMcpServiceContext`, tools/resources/prompts over the v1
> service layer, and user-isolation tests, all `bun run check` green. The proxy
> treats `/api/mcp` as a public prefix (the route enforces its own bearer auth;
> see `docs/SECURITY.md` → "MCP server auth and tenant isolation"). Follow-ups
> in `main`: proxy public-prefix exact/segment match hardening + regression test.
>
> **Version:** v2
> **Area:** MCP, auth, external integration
> **Created:** 2026-06-04
> **Completed:** 2026-06-05
> **Depends on:** `docs/exec-plans/completed/v2/semantic-search.md`
> **Supersedes:** none

## Goal

Expose Lumen through a TypeScript MCP server over Streamable HTTP, using
Supabase Auth to scope every tool, resource, and prompt to the current user.

## Scope

- Add an MCP server package or app-local server entrypoint consistent with the
  monorepo structure.
- Use the TypeScript MCP SDK and Streamable HTTP transport.
- Validate Supabase JWTs for incoming MCP requests.
- Document the OAuth 2.1 posture and any host-specific connection steps.
- Expose tools such as `search_notes`, `get_document`, `get_transcript`,
  `create_note`, `summarize_recording`, `make_flashcards`, and `list_by_tag`.
- Expose resources for documents and transcripts.
- Expose prompts for study workflows.
- Route all business operations through `apps/web/src/server/services/`.
- Add isolation tests that prove user A cannot access user B data through MCP.
- Update `docs/SECURITY.md` with the auth and tenant-isolation model.

## Detailed Plan

- [Implementation plan](../../../superpowers/plans/2026-06-05-v2-mcp-server-auth.md)
- [Design spec](../../../superpowers/specs/2026-06-05-v2-mcp-server-auth-design.md)

## Out Of Scope

- Reimplementing service-layer business logic inside the MCP adapter.
- In-app chat UI.
- Realtime collaboration.
- Public unauthenticated MCP access.

## Verification Gate

- `bun run check`
- MCP handler/unit tests for auth failure, user scoping, and tool schemas.
- Manual connection notes for at least one external MCP host.
