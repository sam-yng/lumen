# MCP Server And Auth Plan

> **Status:** active
> **Version:** v2
> **Area:** MCP, auth, external integration
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/active/v2/semantic-search.md`
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
