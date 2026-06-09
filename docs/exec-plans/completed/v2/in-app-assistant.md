# In-App Assistant Plan

> **Status:** completed
> **Version:** v2
> **Area:** assistant, MCP client, BYO Claude key, product UI
> **Created:** 2026-06-04
> **Completed:** 2026-06-08
> **Depends on:** `docs/exec-plans/completed/v2/mcp-server-auth.md` (shipped)
> **Supersedes:** none
> **Design:** `docs/superpowers/specs/2026-06-08-in-app-assistant-design.md`
> **Plan:** `docs/superpowers/plans/2026-06-08-in-app-assistant.md`

## Retrospective

Shipped the in-app assistant as a thin adapter over the existing service +
MCP layers. New since this plan was queued: **users bring their own Claude API
key** (inference billed to the user), stored per-user in Supabase Vault behind
`SECURITY DEFINER` RPCs scoped by `auth.uid()`.

- Parity seam: the in-app loop connects an in-memory MCP client to the same
  `buildMcpServer` external hosts use — one tool contract, zero duplicated
  tool logic.
- Loop: `claude-opus-4-8`, adaptive thinking, bounded manual tool-use loop;
  tool failures become `is_error` results so the model can recover.
- Flashcards needed no new subsystem — handled by the existing `make-flashcards`
  MCP prompt producing note content.

**Verification:** `bun run check` green (lint + typecheck + full test suite);
focused unit tests for the credentials service, MCP bridge, agent loop (incl.
tool-failure recovery + iteration cap), both routes (incl. BYO-key states), and
the chat panel states. Two-stage subagent review per task caught and fixed a
real runtime bug (scalar-vs-array RPC return) and several hardening items
(Vault write-grant lockdown, MCP bridge leak guard, `pause_turn` handling,
request size bound, input a11y + double-submit guard). **Pending human sign-off:**
the manual browser happy-path with a real Claude key (working rule 3).

## Goal

Add an in-app assistant that uses Claude plus the same MCP server exposed to
external hosts, so the product UI and external integrations exercise one tool
contract.

## Scope

- Add an authenticated chat panel in the app shell.
- Build an MCP client path for the app to call the Lumen MCP server.
- Add a Claude agent loop with strict tool-use boundaries.
- Support initial workflows: summarize a lecture, answer questions over the
  vault, generate notes, and make flashcards.
- Show tool-call progress, empty states, failures, and retry affordances.
- Keep prompts and UX copy clear that generated content should be checked.
- Add tests for assistant request routing, disabled/error states, and core UI
  interactions.
- Document the demo flow that shows in-app assistant and external MCP host
  parity.

## Out Of Scope

- New business logic outside the service layer or MCP server.
- Streaming/live transcription.
- Multi-user collaboration.
- Paid embedding APIs.

## Verification Gate

- `bun run check`
- Focused component tests for assistant UI states.
- Manual browser happy path: ask over existing notes/transcripts, create a note,
  generate flashcards, and recover from a tool failure.
