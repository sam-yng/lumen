# In-App Assistant Plan

> **Status:** queued
> **Version:** v2
> **Area:** assistant, MCP client, product UI
> **Created:** 2026-06-04
> **Depends on:** `docs/exec-plans/queued/v2-ai-mcp/mcp-server-auth.md`
> **Supersedes:** none

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
