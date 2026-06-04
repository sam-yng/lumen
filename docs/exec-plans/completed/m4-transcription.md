# M4 - Transcription Implementation Plan

> **For agentic workers:** Milestone-level plan. M4 makes uploads real, creates
> audio recording rows, runs local CPU transcription through a retryable queue,
> and exposes transcript status/viewing inside the library workspace. Steps use
> checkbox (`- [ ]`) syntax for tracking. The gate is `bun run check` green
> after every patch.

**Goal:** Add real file/audio upload plus a local transcription pipeline that
stores transcripts and segments per user.

**Architecture:** Extend the existing M2/M3 service -> route -> TanStack Query
path. Browser clients upload through authenticated Route Handlers, domain
services stay framework-agnostic, and the worker runs separately with the
service role while manually scoping every query by `user_id`.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, Supabase
Storage/Postgres/Auth/RLS, pg-boss, nodejs-whisper, Bun with a Node fallback for
the worker process, zod, Vitest, Playwright.

---

## Definition of Done

- [ ] Supabase has a private `library-files` Storage bucket and storage object
      policies that permit authenticated users to operate only under their own
      `user_id` path prefix.
- [ ] Runtime configuration documents and validates the worker/queue settings:
      Supabase URL, publishable key, secret key, pg-boss Postgres URL, storage
      bucket name, Whisper model, and local temp directory.
- [ ] `pg-boss` and `nodejs-whisper` dependencies are installed and locked; a
      `worker:transcribe` script starts the transcription worker.
- [ ] Uploading a non-audio file stores bytes in Supabase Storage and creates a
      `files` row with the real `storage_key`.
- [ ] Uploading or recording audio stores bytes, creates the `files` row,
      creates a `recordings` row in `pending`, and enqueues one transcription
      job.
- [ ] Recording rows surface in the shared library snapshot so audio files show
      `pending`, `processing`, `done`, or `failed` status.
- [ ] The worker consumes jobs, downloads the scoped object, marks the recording
      `processing`, transcribes locally, writes `transcripts` and
      `transcript_segments`, marks the recording `done`, and stores a readable
      error on failure.
- [ ] Every worker query includes an explicit `user_id` filter or insert value;
      job payload `userId` comes only from the authenticated enqueue path.
- [ ] The workspace lets a user upload a file, record audio with
      `MediaRecorder`, open an audio item, view status, retry failed jobs, and
      play a completed transcript with clickable timestamp segments.
- [ ] M5 full-text search, AI/MCP, embeddings, streaming transcription,
      diarization, and realtime collaboration remain out of scope.
- [ ] Tests cover storage-key construction, upload orchestration, recording
      state transitions, transcript writes/reads, retry behavior, and worker
      `user_id` scoping.
- [ ] `bun run check` is green after each patch; manual browser happy path
      verifies upload -> queued -> worker -> transcript playback.
- [ ] This plan moves to `docs/exec-plans/completed/` with a short
      retrospective at milestone close, then pause for review.

---

## Design Decisions

1. **Upload through a Route Handler, not direct browser Storage calls.** M4 keeps
   auth, folder validation, storage-key creation, file-row creation, recording
   creation, and queue enqueueing in one server-side transaction boundary that
   can be tested at the service layer. The route accepts `multipart/form-data`
   and passes bytes plus metadata into the service.
2. **Files remain the visible library item.** A recording belongs to an audio
   file, so the library list keeps rendering files while joining recording
   status for audio rows. Transcript detail is loaded only when opening an audio
   item.
3. **Queue payloads are minimal and trusted by origin.** Jobs contain
   `{ userId, recordingId, fileId, storageKey }`. The user id is derived from the
   authenticated request that enqueued the job and is never accepted from the
   browser.
4. **Provider seams are real interfaces, not stubs.** `StorageProvider` wraps
   Supabase Storage for upload/download/remove. `TranscriptionProvider` wraps
   `nodejs-whisper` and returns normalized `{ fullText, language, segments }`
   data. Tests use fakes behind the same interfaces.
5. **Worker code owns service-role access.** The app's existing Supabase client
   remains publishable-key and RLS-bound. Service-role construction lives under
   `worker/` so the secret cannot drift into client-importable modules.
6. **M4 includes the functional transcript viewer, but not search.** `docs/DESIGN.md`
   assigns the transcript viewer to M4, while M5 owns search. This plan follows
   that split: playable transcript UI now, full-text search later.

---

## File Structure

- Modify: `package.json`, `bun.lock` - add `pg-boss`, `nodejs-whisper`, and the
  `worker:transcribe` script.
- Modify: `.env.example` - document `PG_BOSS_DATABASE_URL`,
  `TRANSCRIPTION_STORAGE_BUCKET`, `WHISPER_MODEL`, and
  `TRANSCRIPTION_TMP_DIR`.
- Modify: `src/server/config/env.ts` - validate the new server-only worker and
  storage settings without exposing them to client code.
- Create: `supabase/migrations/20260603090000_storage_bucket.sql` - create the
  private Storage bucket and object policies scoped by user-id path prefix.
- Create: `src/server/services/storage-provider.ts` - `StorageProvider`
  interface plus storage-key helpers.
- Create: `src/server/services/uploads.ts` - authenticated upload orchestration:
  folder ownership, storage upload, file row insert, optional recording insert,
  optional enqueue callback, and cleanup on partial failure.
- Create: `src/server/services/recordings.ts` - recording create/read/update,
  status transitions, retry reset, and user-scoped lookups.
- Create: `src/server/services/transcripts.ts` - transcript detail read and
  worker write helpers, including segment ordering.
- Modify: `src/server/services/library.ts` - include `recordings` in the shared
  snapshot while keeping transcript segments out of the list query.
- Modify: `src/server/services/context.ts` - keep the table-query service
  client contract compatible with the new services and test fakes.
- Modify: `src/server/services/__tests__/library.test.ts` - add upload,
  recording, transcript, and worker-scope service coverage.
- Create: `src/server/queue/transcription-jobs.ts` - pg-boss queue name,
  payload schema, enqueue helper, and retry helper.
- Create: `src/app/api/library/uploads/route.ts` - `POST` multipart upload route.
- Create: `src/app/api/library/recordings/[id]/route.ts` - `GET` recording
  detail/status and `PATCH` retry route.
- Create: `src/app/api/library/transcripts/[recordingId]/route.ts` - `GET`
  transcript detail route.
- Modify: `src/components/library/library-api.ts` - upload, recording retry, and
  transcript-detail client calls.
- Modify: `src/components/library/library-workspace.tsx` - upload controls,
  recording controls, audio row status badges, and transcript opening.
- Create: `src/components/transcripts/transcript-viewer.tsx` - audio player,
  waveform bars, status states, retry action, and clickable segments.
- Create: `src/components/transcripts/record-audio-form.tsx` - `MediaRecorder`
  capture and upload handoff.
- Create: `worker/supabase.ts` - service-role Supabase client construction for
  worker-only code.
- Create: `worker/transcription-provider.ts` - provider types and normalized
  transcript result shape.
- Create: `worker/whisper-provider.ts` - `nodejs-whisper` adapter and temp-file
  handling.
- Create: `worker/transcription-worker.ts` - pg-boss worker loop, status
  updates, scoped download, provider call, transcript write, and error handling.
- Modify: `docs/SECURITY.md` - expand worker scoping examples once code lands.
- Modify: `docs/RELIABILITY.md` - document queue retry and status semantics.
- Modify: `docs/FRONTEND.md` and `docs/product-specs/library-and-notes.md` -
  mark M4 upload/transcription behavior.
- Modify: `docs/references/supabase-llms.txt` and `docs/references/bun-llms.txt`
  - replace M4 stubs with local notes discovered during implementation.

---

## Implementation Phases

### Phase 0 - Baseline and Workspace

- [x] Read M4-relevant docs: `ARCHITECTURE.md`, `docs/SECURITY.md`,
      `docs/RELIABILITY.md`, `docs/DESIGN.md`, `docs/FRONTEND.md`,
      `docs/product-specs/library-and-notes.md`, completed M1-M3 plans,
      generated schema, and relevant installed Next 16 route/cookie docs.
- [x] Run baseline `bun run check`.
- [x] Fix the pre-existing Biome gate blocker by excluding `.claude` from
      `biome.json`.
- [x] Re-run `bun run check` and confirm the gate is green before planning M4.
- [x] Before product-code implementation, decide whether to continue on the
      current branch or create an isolated worktree.

### Phase 1 - Dependencies, Env, and Storage Bucket

- [x] Install `pg-boss` and `nodejs-whisper`; add `worker:transcribe`.
- [x] Update `.env.example` and `src/server/config/env.ts` with the worker and
      storage settings.
- [x] Write a migration for `library-files` bucket creation and Storage object
      policies.
- [x] Run `bun run db:types` only if the migration changes generated DB types;
      otherwise leave generated types untouched.
- [x] Run `bun run check`; keep it green.

### Phase 2 - Upload and Recording Services

- [x] Write failing service tests for non-audio upload creating only a `files`
      row and audio upload creating both `files` and `recordings` rows.
- [x] Write failing tests for upload cleanup when storage succeeds but database
      insert/enqueue fails.
- [x] Implement `StorageProvider`, upload key helpers, and upload orchestration.
- [x] Add the multipart upload route and client API call.
- [x] Replace metadata-only browser file creation with real upload while keeping
      existing metadata routes for rename/move/delete.
- [x] Run `bun run check`; keep it green.

### Phase 3 - Queue Contract and Retry Semantics

- [x] Write failing tests for transcription job payload validation and enqueue
      behavior.
- [x] Implement `src/server/queue/transcription-jobs.ts` with a single queue
      name and zod-validated payloads.
- [x] Write failing tests for recording retry: `failed` can reset to `pending`
      and enqueue a new job; `pending`, `processing`, and `done` reject retry.
- [x] Implement recording retry route/client call.
- [x] Run `bun run check`; keep it green.

### Phase 4 - Worker and Transcription Provider

- [x] Write failing worker tests with fake storage, fake provider, and fake
      Supabase client proving every `recordings`, `files`, `transcripts`, and
      `transcript_segments` operation is scoped by `user_id`.
- [x] Implement worker-only service-role Supabase construction under `worker/`.
- [x] Implement `TranscriptionProvider` types and the `nodejs-whisper` adapter.
- [x] Implement the pg-boss worker loop with processing/done/failed transitions.
- [x] Ensure temp files are removed after success and failure.
- [x] Run `bun run check`; keep it green.

### Phase 5 - Transcript Read API and Workspace UI

- [x] Write failing transcript service tests for reading transcript detail by
      recording id, including ordered segments and user scoping.
- [x] Add transcript detail and recording detail routes.
- [x] Extend `LibrarySnapshot` with recordings and render audio status badges.
- [x] Build upload controls and `MediaRecorder` recording controls inside the
      workspace.
- [x] Build `TranscriptViewer` with the M4 states from `docs/DESIGN.md`:
      pending, processing, failed with retry, and done with real `<audio>`,
      waveform bars, rate toggle, and clickable segments.
- [x] Run `bun run check`; keep it green.

### Phase 6 - Docs, Manual Path, and Closeout

- [x] Update product, frontend, security, reliability, and reference docs in the
      same change as the code they describe.
- [x] Run `bun run check`.
- [x] Start `bun run dev`.
- [x] With local Supabase running, verify manually as `demo@lumen.test` /
      `demo12345`: upload a non-audio file, upload an audio file, run the
      worker, see status progress, open the transcript, seek by segment, retry a
      forced failure, and reload to confirm persistence.
- [x] Move this file to `docs/exec-plans/completed/m4-transcription.md` with a
      short retrospective.
- [x] Pause for human review at the M4 boundary.

---

## Self-Review

- **Scope check:** This is one milestone but multiple connected subsystems:
  storage/upload, recording rows, queue/worker, and transcript UI. They are
  sequentially dependent and all serve M4 transcription. M5 search remains out
  of scope.
- **Architecture check:** The plan extends existing services, thin route
  handlers, `LibrarySnapshot`, and TanStack Query patterns. It does not add
  MCP/AI/vector/search stubs.
- **Security check:** User-session code stays RLS-bound. Service-role access is
  worker-only, and every worker operation is planned with explicit `user_id`
  scoping tests.
- **Reliability check:** pg-boss retry, recording statuses, failed-job errors,
  temp-file cleanup, and retry semantics are all first-class tasks.
- **Testing check:** Each behavior phase starts with failing tests before
  implementation, then runs the full `bun run check` gate.
- **Docs check:** M4 updates the docs that currently mark upload/transcription
  as pending or stubbed.

---

## Retrospective

M4 shipped the first real media pipeline: authenticated uploads now write bytes
to private Supabase Storage, audio uploads create recording rows, pg-boss carries
transcription jobs, and the worker writes transcripts plus ordered timestamped
segments through explicit `user_id` scoping.

Manual browser verification covered demo login, text upload, audio upload, a
real local Storage/Postgres-backed worker pass using a fake transcription
provider, transcript viewer rendering, the private audio file route, reload
persistence, and retry from a forced `failed` recording. The manual run did not
pull or execute a real Whisper model; the `nodejs-whisper` adapter is covered by
unit tests and remains the runtime provider for `worker:transcribe`.

One implementation note for M5: recordings are now part of the shared library
snapshot, while transcript detail stays lazy-loaded by recording id. Search can
index documents and completed transcript text without changing the upload or
worker contracts.
