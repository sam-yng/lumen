# In-app assistant

An authenticated chat panel that reasons over the user's vault using the same
MCP tool contract exposed to external hosts. Users provide their own Claude API
key (Settings → Claude API key); inference is billed to their Anthropic account,
never to the product.

## How it works

- The agent loop runs server-side (`server/services/assistant.ts`) on
  `claude-opus-4-8` with adaptive thinking, via a bounded manual tool-use loop.
- Tools come from the in-process MCP server (`buildMcpServer`) over an in-memory
  transport, so the in-app assistant and external MCP hosts exercise one
  contract — no duplicated tool logic. The tools are `search_notes`,
  `get_document`, `get_transcript`, `create_note`, and `list_by_tag`.
- The key is stored per-user in Supabase Vault behind `SECURITY DEFINER` RPCs
  (`set_ai_api_key` / `get_ai_api_key` / `delete_ai_api_key`) scoped by
  `auth.uid()`. The service never touches the `vault` schema directly, and the
  raw key is decrypted server-side only inside the loop.

## Surfaces

- `GET/PUT/DELETE /api/assistant/key` — key existence, save/replace, remove.
- `POST /api/assistant` — chat; returns a discriminated `state`
  (`ok` / `no_api_key` / `invalid_key` / `rate_limited` / `error`).
- `/settings` — key entry (masked, never re-displayed after save).
- Assistant panel in the authenticated app shell — empty / thinking /
  tool-trace / answer / error / no-key states.

## Demo: in-app vs external host parity

1. In the app, open Settings, paste a Claude API key, save.
2. In the assistant panel, ask "summarize my most recent transcript" and
   "create a note titled Recap". Observe the tool trace (`get_transcript`,
   `create_note`).
3. Point an external MCP host (bearer-JWT) at `/api/mcp` and call the same
   `get_transcript` / `create_note` tools. The results match — one contract.

## Limits (current)

- No streaming; the answer arrives as one message with a tool trace.
- One key per user; no team/shared keys, usage metering, or model selection.
- Pinned to `claude-opus-4-8`.
