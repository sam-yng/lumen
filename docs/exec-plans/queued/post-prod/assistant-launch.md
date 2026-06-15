# AI Assistant — standalone page + post-launch enablement

> **Status:** queued — Phase 1 (relocate + gate) is do-now; Phase 2 (enable +
> verify) is deferred to **after** the production launch.
> **Version:** post-prod
> **Area:** assistant, retrieval, app shell, verification
> **Created:** 2026-06-15
> **Depends on:** [`completed/v2/in-app-assistant.md`](../../completed/v2/in-app-assistant.md),
> [`completed/v3/cited-retrieval.md`](../../completed/v3/cited-retrieval.md),
> [`completed/v3/citation-experience.md`](../../completed/v3/citation-experience.md),
> [`completed/v4/grounded-answers.md`](../../completed/v4/grounded-answers.md)
> **Supersedes:** the prod-readiness `prod-assistant-verification.md` gate
> (folded into Phase 2 here; the assistant is descoped from the launch).

## Why this exists

The in-app assistant (v2) + cited retrieval (v3/v4) are **built, tested, and
accepted**, but they cannot be exercised without a real Claude API key
(BYO-key, per-user via Supabase Vault). Rather than pin the production launch on
that key, the assistant is **descoped from launch**: relocated to its own
route and gated off, then enabled and verified once the prod instance exists and
a key is available.

This single plan replaces the old prod-readiness verification gate so the
launch critical path carries no Claude-key dependency.

## Phase 1 — relocate + gate (shipped 2026-06-15, branch `feat/production-tasks`)

Move the always-on right-rail panel to a dedicated, Claude-app-style
conversation page, and gate every on-ramp behind one flag so the working
assistant ships present-but-off.

- [x] Add `apps/web/src/lib/assistant-flags.ts` exporting
      `ASSISTANT_ENABLED = false` — the single flip for Phase 2.
- [x] Extract the conversation logic from the old
      `src/components/assistant/assistant-panel.tsx` into a full-page
      `AssistantConversation` client component (centered column, empty greeting
      state, message list with `CitedText` + `SourceCards`, sticky bottom
      composer, "answers may be wrong" disclaimer). `assistant-panel.tsx` deleted.
- [x] Add route `src/app/(app)/assistant/page.tsx` (path `/assistant`) with a
      minimal top bar + back-to-library link — **not** the folder sidebar (the
      route needs no folder/tag data).
- [x] Remove `<AssistantPanel/>` from `src/app/(app)/layout.tsx`.
- [x] Sidebar "Ask Lumen" entry: when `ASSISTANT_ENABLED` is false, keep it a
      disabled span (tooltip "enabling after launch", drop the `v2` badge); when
      true, render a `Link` to `/assistant`.
- [x] Settings Claude-key form: when `ASSISTANT_ENABLED` is false, disable
      inputs + buttons with an "enabling after launch" note.
- [x] Retarget the assistant component test to `AssistantConversation`.
- [x] `bun run check` green.

The page itself stays fully functional so it works in dev and the moment the
flag flips — gating is only the two entrances (nav + key entry).

## Phase 2 — enable + verify (post-launch, Claude-key-dependent)

Run once a prod instance exists and a real Claude key is available.

- [ ] Flip `ASSISTANT_ENABLED` to true (un-gates sidebar nav + key form).
- [ ] Confirm the BYO-key entry works end-to-end (key stored per-user via Vault,
      encrypted at rest, never re-shown).

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

### v3 m4 — citation experience happy-path

See [`completed/v3/citation-experience.md`](../../completed/v3/citation-experience.md);
build verified via fixture-driven tests, only this browser pass is key-gated.

- [ ] Ask a question answered by a real transcript → the answer renders `[S#]`
      chips and source cards under the turn.
- [ ] Click a transcript citation → the transcript viewer opens scrolled to the
      cited segment, highlighted, with audio seeked to its timestamp.
- [ ] Click a document citation → the note opens.
- [ ] A source with no resolved segment deep-links by timestamp; null timing
      opens the transcript at the top.

### v4 m2 — grounded answers / citation validation

See [`completed/v4/grounded-answers.md`](../../completed/v4/grounded-answers.md); validation
is fixture-tested, only this browser pass is key-gated.

- [ ] Ask a cited question → the source cards list only sources the answer
      actually cites, and every rendered `[S#]` chip is clickable; if the model
      invents a label, it renders as a degraded (non-link) chip with the
      unverified-citations note under the answer.

## Exit criteria

- [x] Phase 1 shipped: assistant lives at `/assistant`, gated off, `bun run
      check` green.
- [ ] Phase 2: both happy-paths above pass in a browser against real/seeded
      data with a live Claude key.
- [ ] On Phase 2 pass: tick the items, set this plan's status to **completed**,
      move it to `completed/post-prod/`, and update
      [`PLANS.md`](../../../PLANS.md).
