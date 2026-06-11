# Stale Live Sessions Sweep Plan (v4 Milestone 5)

> **Status:** queued
> **Version:** v4
> **Area:** live transcription path, lifecycle hygiene
> **Created:** 2026-06-11
> **Depends on:** [`completed/v3/streaming-transcription.md`](../../completed/v3/streaming-transcription.md)
> (the Decision Record that accepted this debt). Independent of every other
> v4 child; may be scheduled at any point in the release.
> **Supersedes:** none — clears the
> [`tech-debt-tracker.md`](../../tech-debt-tracker.md) row "Abandoned live
> sessions stay in `live` status".

## Goal

No recording stays in `live` forever. Today a live capture whose tab closes
or crashes leaves a `recordings` row stuck in `live` with no audio object —
deletable by hand, but never resumable, finalized, or expired. The fix is a
sweep that **finalizes from the segments already stored** where there is
useful content (live segments are written incrementally by
`appendLiveSegments`), and expires the husk otherwise.

## Decisions To Resolve (small — record in this plan before build)

1. **Staleness signal:** no schema preferred — derive "stale" from existing
   timestamps (recording `updated_at` / newest segment `created_at`) against
   a threshold (e.g. no activity for 30–60 min). Add a heartbeat column only
   if the existing timestamps prove insufficient, and scope that migration
   here explicitly.
2. **Sweep mechanism:** a scheduled pg-boss job in the existing worker
   process (it already owns queue infrastructure) vs an opportunistic check
   when the user loads the library. Worker job is the likely answer; the
   spike note records why.
3. **Disposition:** segments exist → finalize through the standard
   `writeRecordingTranscript` path (transcript + semantic indexing work like
   any live finalize, minus the audio object — decide how a no-audio
   recording presents in the UI); no segments → mark `failed`/expired with a
   clear error message so the existing delete flow cleans it up.

## Scope

- The sweep job per the decisions above, env-configurable threshold via
  `config/env.ts`.
- Worker-side writes scoped by `user_id` on every query — the sweep runs
  service-role across all users' stale rows (`docs/SECURITY.md` caveat;
  this is the security-critical part of an otherwise small plan).
- UI: a swept-finalized recording reads like a normal transcript (with no
  audio playback); a swept-expired one surfaces the failure state the
  recordings UI already renders for `failed` jobs.
- Update the tech-debt tracker row to "addressed" in the same change.

## Out Of Scope

- Resuming an interrupted live session (deferred beyond v4 — recorded in the
  group index).
- Client-side crash recovery (rehydrating a live session from IndexedDB or
  similar).
- Any change to the happy-path finalize flow.

## Verification Gate

- `bun run check` green.
- Unit tests: staleness predicate (fresh vs stale, boundary); sweep
  finalizes a stale session with segments (transcript written, status
  `done`); sweep expires a segmentless husk; non-stale `live` sessions are
  untouched; all writes filtered by the owning `user_id`.
- Manual happy path (working rule #3): start a live session, kill the tab,
  fast-forward the threshold (config), run the sweep, and find the
  transcript in the library with search/citations working over it.
