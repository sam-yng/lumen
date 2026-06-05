# MCP Server & Auth — Design

> **Status:** approved design (pre-plan)
> **Version:** v2
> **Area:** MCP, auth, external integration
> **Created:** 2026-06-05
> **Exec plan:** `docs/exec-plans/queued/v2/mcp-server-auth.md` (promote to `active/v2/` when implementation begins)
> **Depends on:** none at build time — semantic search is deferred behind the
> existing FTS search, so this plan does not block on `feat/v2-execution`.

## Goal

Expose Lumen through a TypeScript MCP server over Streamable HTTP, scoping every
tool, resource, and prompt to the authenticated Supabase user, as a thin adapter
over the existing v1 service layer.

## Hosting context (locked)

Per `docs/exec-plans/active/production/prod-readiness/index.md`: **app → Vercel,
worker → Railway.** The MCP server is part of the app, so it deploys to Vercel
with the rest of `apps/web`. This rules out a persistent server process for v2;
the transport runs in **stateless** mode to fit Vercel function execution.

## Architecture

### Placement & transport

App-local Next.js route handler at `apps/web/src/app/api/mcp/route.ts`, following
the existing `app/api/**/route.ts` pattern. Uses `@modelcontextprotocol/sdk`
`StreamableHTTPServerTransport` in **stateless** mode: a fresh `McpServer` +
transport are constructed per request, with no server-side session store. The
`POST` handler bridges the Web `Request`/`Response` to the transport. This suits
serverless: each MCP call is an independent request/response with no long-lived
connection.

### Auth model (security core)

External MCP hosts authenticate with a **Bearer Supabase JWT** rather than the
cookie session the web app uses. Two additions:

- `createTokenSupabase(accessToken)` in `apps/web/src/server/db/client.ts` —
  builds a Supabase client with the **publishable (anon) key** plus a global
  `Authorization: Bearer <jwt>` header. It does **not** use the service-role key.
- `getMcpServiceContext(request)` in `apps/web/src/server/mcp/auth.ts` — mirrors
  the cookie-based `getRouteServiceContext`. It extracts the bearer token,
  validates it with `supabase.auth.getUser(token)`, and on success returns a
  `ServiceContext { userId, supabase }`.

Because the client carries the user's JWT against the anon key, **every query
runs under that user's RLS policies** — the same tenant-isolation guarantee as
the web app, with no manual `user_id` scoping and no RLS bypass. A missing,
malformed, or invalid/expired token yields a 401 and never reaches a service.

OAuth 2.1 is documented as the posture for external hosts; v2 accepts a
Supabase-issued JWT as the bearer credential. Full OAuth flow is out of scope.

### Surface

Every tool/resource routes through existing `apps/web/src/server/services/`. The
adapter holds no business logic.

**Tools** (zod input schema → service call → structured content):

| Tool | Backing service |
|------|-----------------|
| `search_notes` | `searchLibrary` (M5 full-text — see Search note below) |
| `get_document` | documents read |
| `get_transcript` | `getTranscriptDetail` |
| `create_note` | `createDocument` |
| `list_by_tag` | tags query |

**Resources:** documents and transcripts, addressed by id, read-only.

**Prompts:** `summarize-recording`, `make-flashcards`, and a tag-study prompt.
These are prompt **templates** that inject document/transcript content as
context; the **host's** LLM performs generation. The server makes no LLM call,
so there is no per-request API cost — consistent with the v2 non-negotiable.

### Search note

`search_notes` ships backed by the existing M5 `searchLibrary` (full-text)
**now**, so this plan carries no dependency on the unmerged semantic-search work
on `feat/v2-execution`. When semantic/hybrid search lands on `main`, the tool's
backing query is swapped behind the **same tool contract** — no change for MCP
hosts.

## File structure

```
apps/web/src/app/api/mcp/route.ts   transport bridge + POST handler (thin)
apps/web/src/server/mcp/server.ts   builds McpServer; registers tools/resources/prompts
apps/web/src/server/mcp/auth.ts     getMcpServiceContext + bearer extraction
apps/web/src/server/mcp/tools.ts    tool definitions → service calls
apps/web/src/server/mcp/resources.ts document/transcript resources
apps/web/src/server/mcp/prompts.ts  study-workflow prompt templates
apps/web/src/server/db/client.ts    + createTokenSupabase
```

Each `server/mcp/*` file has one responsibility and is independently testable.
`route.ts` stays thin: parse, auth, hand to the server.

## Testing

- **Unit:** each tool's input schema and service wiring; auth failures (no
  token, malformed token, invalid/expired token → 401); prompt template
  rendering with injected content.
- **Isolation (security-critical):** user A's token cannot read or mutate user
  B's document, transcript, or tag through any tool or resource. Asserted
  end-to-end against RLS denial, proving tenant isolation through the MCP path.

## Out of scope

Seams, not stubs:

- Semantic `search_notes` (FTS now; swap on merge, same contract).
- In-app chat UI and the Claude agent loop (the in-app-assistant plan).
- Any LLM call inside the MCP server (generation stays host-side via prompts).
- Realtime, diarization, collaboration.
- Public unauthenticated MCP access; full OAuth 2.1 authorization-server flow.

## Verification gate

- `bun run check` green.
- MCP unit tests + isolation tests pass.
- Manual connection notes for at least one external MCP host.
- `docs/SECURITY.md` updated with the MCP auth and tenant-isolation model.
