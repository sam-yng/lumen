# Stale Live Sessions Sweep Plan (v4 Milestone 5)

> **Status:** completed — shipped 2026-06-12 (PR #37); see Verification
> Record. Promoted 2026-06-12; moved to `completed/v4/` 2026-06-12.
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

## Decisions (spike resolved 2026-06-12)

1. **Staleness signal: existing timestamps are insufficient — one scoped
   migration.** The no-schema option assumed timestamps that do not exist:
   `recordings` carries only `created_at` (no `updated_at`), and
   `transcript_segments` has no timestamp column at all. `created_at` alone
   would falsely expire a long-running *active* session. The cheapest
   activity signal is the migration scoped here: add
   `created_at timestamptz not null default now()` to `transcript_segments`.
   Every `appendLiveSegments` insert then stamps activity automatically — no
   app-code heartbeat write, no trigger. Predicate:
   `lastActivityAt = max(recording.created_at, newest segment created_at)`;
   stale iff `now − lastActivityAt > LIVE_SESSION_STALE_MINUTES` (env,
   default 45 — inside the plan's 30–60 band). Backfill note: pre-existing
   segments default to migration time, which can only *delay* a sweep by one
   threshold, never falsely expire fresh work. Recorded edge: an open-mic
   session that produces zero segments for the whole threshold is swept as a
   husk; a later finalize then 409s ("Live session is not open."). Accepted —
   silence for the full threshold *is* the no-activity signal, and the audio
   lives only client-side until finalize anyway.
2. **Sweep mechanism: scheduled pg-boss job in the existing worker process**
   (`boss.schedule()` cron, every 15 minutes, same process as transcription
   and speaker labeling). The opportunistic library-load check was rejected
   because it never runs for users who don't come back — precisely the
   abandoned-session case — and it would push lifecycle writes into a read
   path. The worker already owns the queue infrastructure, the service-role
   client, and the `docs/SECURITY.md` scoping discipline.
3. **Disposition:** segments exist → finalize through the standard
   `writeRecordingTranscript` with a per-user ctx
   (`{ userId: recording.user_id, supabase }`): `fullText` = segment texts
   joined with spaces, `language: null`, **no `embeddingProvider`** — exactly
   what the live finalize route passes today (semantic indexing is
   provider-gated everywhere; FTS via the generated `full_text_tsv` column is
   automatic, so library search works over swept transcripts). No-audio
   presentation: the transcript viewer hides the audio player when
   `file.size_bytes === 0` (live sessions only set a size when finalize
   uploads audio) and shows a short "no audio" note; segment clicks already
   no-op without a media element. No segments → `status = 'failed'` with
   error "Live session was interrupted before any transcript was captured."
   — the existing failed-state UI and delete flow handle the rest.

## Scope

- The sweep job per the decisions above, env-configurable threshold via
  `config/env.ts` (`LIVE_SESSION_STALE_MINUTES`).
- The scoped migration from decision 1: `transcript_segments.created_at`
  (+ regenerate `database.types.ts` and the generated schema doc).
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

## Verification Record (2026-06-12)

- `bun run check` green (281 tests, 44 files).
- Unit tests in `apps/web/worker/__tests__/stale-live-sweeper.test.ts`:
  predicate fresh/stale/boundary/segmentless-fallback; finalize-with-segments
  (status `done`, joined `full_text`, rewritten segments); husk expiry
  (`failed` + clear error); fresh sessions untouched; cross-user scoping
  (every per-recording read/write carries the owning `user_id`; the only
  unscoped query is the `status='live'` scan); per-recording error
  containment.
- Manual happy path run against the real stack (local Supabase + dev server +
  worker with `LIVE_SESSION_STALE_MINUTES=1`): two live sessions created
  through the app's own API with an authenticated browser session (one with
  two appended segments, one segmentless), tab closed, sweep job sent through
  the real pg-boss queue to the running worker. Result: the segmented session
  shows **Done** in the library, opens with the "No audio" note and both
  segments, and is found by library search ("mitochondria", FTS) in both the
  API and the sidebar panel; the husk shows **Failed** with the expired-error
  message in the existing failure UI. Citations over swept transcripts ride
  the unchanged deep-link path; assistant-driven citation click-through
  remains under the existing Claude-key-gated verification gate
  (post-launch in `queued/post-prod/assistant-launch.md`), same as every retrieval milestone.
