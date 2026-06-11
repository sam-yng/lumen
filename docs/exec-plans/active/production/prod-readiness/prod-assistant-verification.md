# Assistant Verification Gate (Claude-key-dependent)

> **Status:** active — launch gate, not codebase work. Blocked on a real Claude
> API key (BYO-key inference); all the code it verifies has shipped.
> **Version:** production
> **Area:** verification, assistant, retrieval
> **Created:** 2026-06-09
> **Depends on:** [`completed/v2/in-app-assistant.md`](../../../completed/v2/in-app-assistant.md),
> [`completed/v3/cited-retrieval.md`](../../../completed/v3/cited-retrieval.md)

## Why this exists (and why it is not a milestone blocker)

The in-app assistant (v2) and cited retrieval (v3) are **built, tested, and
accepted** — but their *manual browser happy-paths* can only be exercised with a
real Claude API key, which is not available during development. That is an
**environmental** blocker, not unfinished build work.

Leaving it attached to a milestone group would pin that group in `active/` for
the entire dev cycle, which misrepresents the build status. So all
Claude-key-dependent manual verifications are consolidated **here**, as a single
production-readiness gate. **Lumen must not ship until this gate passes.** The
milestone groups (`completed/v2/`, `completed/v3/`) record their builds as done
and point at this gate for the carried-forward verification.

> **Lifecycle rule:** when a milestone's only outstanding item is an
> environmental/launch blocker (API key, external account, prod-only config),
> complete the milestone on build acceptance and move the blocker here. Do not
> keep build-complete milestones in `active/`.

## Verification flows (run once a Claude key is configured)

### v2 — in-app assistant happy-path

- [ ] Configure a real Claude API key (BYO-key, stored per-user via Vault).
- [ ] Ask a question over existing notes/transcripts → get a grounded answer.
- [ ] Create a note via the assistant.
- [ ] Generate flashcards via the assistant.
- [ ] Force a tool failure → confirm the loop recovers (error surfaced, no crash).
- [ ] Remove the key → confirm the no-key / disabled state renders correctly.

### v3 — cited retrieval happy-path

- [ ] Ask a factual question whose answer is in a real transcript → the answer
      cites `[S#]` labels that correspond to returned sources.
- [ ] Confirm transcript citations carry `transcriptId` / `recordingId` /
      `segmentId` / `startMs` / `endMs`, and document citations carry
      `documentId`.
- [ ] Ask an unanswerable question → the assistant says the sources do not cover
      it rather than guessing.
- [ ] (MCP) Call `search_notes` and confirm the `{ query, sources }` payload with
      stable `citationId`s.

### v3 m4 — citation experience happy-path (added 2026-06-11)

See [`active/v3/citation-experience.md`](../../v3/citation-experience.md);
build verified via fixture-driven tests, only this browser pass is key-gated.

- [ ] Ask a question answered by a real transcript → the answer renders `[S#]`
      chips and source cards under the turn.
- [ ] Click a transcript citation → the transcript viewer opens scrolled to the
      cited segment, highlighted, with audio seeked to its timestamp.
- [ ] Click a document citation → the note opens.
- [ ] A source with no resolved segment deep-links by timestamp; null timing
      opens the transcript at the top.

## Exit criteria

- [ ] Both flows above pass in a browser against the seeded/real data.
- [ ] On pass: tick the items, set this gate's status to **completed**, move it
      to `completed/production/`, and update [`PLANS.md`](../../../../PLANS.md).
