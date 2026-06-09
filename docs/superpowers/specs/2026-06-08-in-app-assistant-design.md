# In-App Assistant — Design

> **Status:** approved design (brainstorm complete)
> **Version:** v2
> **Area:** assistant, MCP client, BYO Claude key, product UI
> **Created:** 2026-06-08
> **Depends on:** `docs/exec-plans/completed/v2/mcp-server-auth.md` (shipped),
> `docs/exec-plans/completed/v2/semantic-search.md` (shipped)
> **Refines:** `docs/exec-plans/queued/v2/in-app-assistant.md`

## Goal

Add an authenticated in-app assistant: a chat panel in the app shell that
reasons over the user's vault and acts on it through the **same MCP tool
contract** exposed to external hosts. Users bring their own Claude API key —
the product never pays for inference.

This is the final v2 feature. No new business logic: the assistant is an
adapter over the already-shipped service layer + MCP server.

## Non-Negotiables (inherited)

- The MCP server stays a thin adapter over existing services; the assistant adds
  no business logic.
- Every tool call is scoped to the authenticated Supabase user.
- Embeddings/transcription remain local/free; only **inference** uses the user's
  key, billed to the user's Anthropic account.
- Seams, not stubs, for what's still out of scope (streaming, team billing).

## Key Decisions (from brainstorm)

1. **Key storage + loop location:** key stored server-side per user, encrypted at
   rest; the agent loop runs server-side in a Next route handler. The key never
   reaches the browser after entry.
2. **Encryption at rest:** Supabase Vault (pgsodium-backed). The app table holds
   only a Vault secret id; the raw key is never in a plain column.
3. **Tool contract:** the in-app loop connects to the in-process MCP server over
   an in-memory transport, so in-app and external hosts exercise one code path.
4. **Response mode:** non-streaming for v1 (request → final message + tool
   trace). Streaming is a later seam.
5. **Model:** `claude-opus-4-8`, adaptive thinking, manual tool-use loop via
   `@anthropic-ai/sdk`.

## Architecture

```
Browser (chat panel, settings)
  │  Supabase session (first-party auth)
  ▼
POST /api/assistant ──▶ assistant service (server)
  │                        │
  │                        ├─ ai-credentials service ─▶ get_ai_api_key() RPC ─▶ Supabase Vault (SECURITY DEFINER, auth.uid()-scoped)
  │                        │
  │                        └─ Anthropic SDK (user key, claude-opus-4-8, adaptive thinking)
  │                              │  manual tool-use loop
  │                              ▼
  │                        in-memory MCP transport ──▶ buildMcpServer(ctx)  ◀── same builder external hosts use
  ▼
final message + tool-call trace
```

### Components

**`server/services/ai-credentials.ts`** (new)

All key access goes through `SECURITY DEFINER` RPCs scoped to `auth.uid()` —
the service never touches the `vault` schema directly, and never needs the
service role for key material.
- `saveApiKey(ctx, key)` — calls `set_ai_api_key(p_key)` (inserts/replaces the
  Vault secret + upserts the `user_ai_credentials` row).
- `hasApiKey(ctx)` — boolean from the user-scoped row; never returns key material.
- `getDecryptedApiKey(ctx)` — server-only; calls `get_ai_api_key()` (which reads
  `vault.decrypted_secrets` scoped by `auth.uid()`). Used solely inside the loop.
- `deleteApiKey(ctx)` — calls `delete_ai_api_key()` (row + Vault secret).
- Framework-agnostic, takes `ServiceContext` (`server/services/context.ts`).

**`server/services/assistant.ts`** (new)
- `runAssistant(ctx, { messages, apiKey }) → { message, toolCalls }`.
- Builds an in-memory linked-pair transport: `buildMcpServer(ctx)` on the server
  end, an MCP `Client` on the loop end.
- `client.listTools()` → Anthropic tool definitions (MCP JSON Schema maps
  directly to `input_schema`).
- Manual loop: call Anthropic → for each `tool_use`, `client.callTool()` →
  append `tool_result` → repeat until `end_turn` or a bounded max-iteration cap.
- Maps SDK errors to typed assistant errors: `AuthenticationError` →
  `invalid_key`, `RateLimitError` → `rate_limited`, others → `inference_failed`.
- Collects a tool-call trace (name + status) for the UI.

**`app/api/assistant/route.ts`** (new)
- `POST`. Auth via existing Supabase server session (NOT the MCP bearer-JWT path
  — this is first-party).
- Resolve `ServiceContext`; if no key set, return a typed `no_api_key` state.
- Otherwise decrypt the key, call `runAssistant`, return final message + trace.

**Settings — `app/(app)/settings/`** (new route)
- Set / replace / remove the Claude API key. Masked input. On save, a validation
  ping (cheap Anthropic call) confirms the key works before persisting.
- Key is never re-displayed after save (show only "key set" + last-updated).

**Chat panel — in `app/(app)/layout.tsx` shell** (new components)
- Collapsible side panel, toggle in app chrome.
- TanStack Query mutation → `/api/assistant`.
- States: empty, thinking, tool-call progress (render the trace), answer,
  error + retry, and a distinct **no-key → go to settings** state.
- Copy makes clear that generated content should be verified.

### Data model

Migration `…_assistant_credentials.sql`:
- `user_ai_credentials (user_id uuid pk references auth.users on delete cascade,
  vault_secret_id uuid not null, created_at, updated_at)`.
- RLS: `user_id = auth.uid()` for select/insert/update/delete.
- Enable `[db.vault]` in `config.toml`.
- Regenerate `database.types.ts` + `docs/generated/db-schema.md` (never
  hand-edit).

## Workflows (v1)

Driven entirely by existing MCP tools/prompts — nothing new server-side:
- Answer questions over the vault (`search_notes`, `get_document`,
  `get_transcript`, `list_by_tag`).
- Summarize a recording (`summarize-recording` prompt + `get_transcript`).
- Generate a note (`create_note`).
- Make flashcards (`make-flashcards` prompt → `create_note`). **No flashcard
  subsystem** — it's a prompt template producing note content.

## Error Handling

| Condition | Surface |
| --- | --- |
| No key set | `no_api_key` state → settings CTA |
| Invalid/revoked key | `invalid_key` → settings CTA |
| Anthropic rate limit | `rate_limited` → retry affordance |
| Tool call fails | trace marks the step failed; loop surfaces a recoverable error; user can retry |
| Max iterations hit | bounded stop, partial answer + notice |

## Testing

- `assistant.ts`: loop happy path, tool dispatch, no-key, `invalid_key`, tool
  failure recovery, max-iteration cap. Fakes implement `.rpc()` + `.in()` per
  AGENTS.md.
- `ai-credentials.ts`: save / has / delete, user isolation, key never returned
  by `hasApiKey`.
- Route handler: unauthenticated, no-key, success.
- Component tests: panel states (empty / thinking / tool-progress / error /
  no-key).

## Out of Scope (seams, not stubs)

- Streaming / live token responses.
- Team/shared keys, usage metering, billing.
- Model selection UI (pinned to `claude-opus-4-8`).
- Multi-user collaboration, realtime transcription, diarization.

## Verification Gate

- `bun run check` green.
- Focused service + component + route tests.
- Manual browser happy path: set key → ask over existing notes → create a note →
  make flashcards → recover from a tool failure → remove key and confirm the
  no-key state.
- Demo doc: in-app assistant and an external MCP host hitting the same tools.
