# Security

## Auth model

- Supabase Auth, email/password to start (OAuth providers are a clean future
  add — there is a seam in the auth forms, no provider code yet).
- Sessions are cookie-based via `@supabase/ssr`. The Next.js **Proxy**
  (`apps/web/src/proxy.ts`, formerly "middleware") refreshes the session on
  every request and guards the protected `(app)` shell.
- Defense in depth: protected Server Components **re-verify** the user with
  `supabase.auth.getUser()` (which revalidates against the auth server) rather
  than trusting routing alone.
- **Sign-up email confirmation (OTP):** new accounts must confirm with a
  six-digit code before the session is usable. Locally, `bunx supabase start`
  serves the code through Mailpit (`http://127.0.0.1:54324`). Production
  requires Supabase Auth email confirmations enabled, SMTP configured in the
  Supabase dashboard, and a confirmation template that includes `{{ .Token }}`
  so users can enter the one-time code in Lumen.

## RLS is the security boundary

Every domain table carries a `user_id` (or, for `profiles`, an `id` that is the
auth user id) and has **Row-Level Security policies** that restrict each user to
their own rows. RLS — not app-layer filtering — is what enforces isolation.

The canonical pattern (established by `profiles` in the M0 init migration):

- `alter table ... enable row level security;`
- per-operation policies keyed on `auth.uid()`.

Every M1 domain table copies this pattern. The policy summary is regenerated
into [generated/db-schema.md](generated/db-schema.md).

The app's Supabase clients (`apps/web/src/server/db/client.ts`) use the
**publishable** (anon) key and are bound to the user's session, so every query
runs under that user's RLS policies.

## The service-role / worker caveat (security-critical)

The transcription worker (M4) runs **outside any user session** and connects to
Postgres with the **service role / secret key**. The service role **BYPASSES
RLS**. Therefore the worker MUST:

- scope **every** query by `user_id` manually;
- never accept a `user_id` from untrusted input — derive it from the job payload
  that was enqueued by an already-RLS-scoped request.

Treat any worker query that is not explicitly `user_id`-scoped as a
vulnerability.

M4 implementation notes:

- Uploads enter through authenticated Route Handlers. The app derives `user.id`
  with `supabase.auth.getUser()`, creates object keys under
  `<user_id>/<generated-name>`, and stores the `file`/`audio` `library_nodes`
  row (and any `recordings` row) through the user-scoped client. File and audio
  bytes are served back only through `/api/library/nodes/:id/content`, which
  re-resolves the owning node under the caller's session.
- The private `library-files` bucket has `storage.objects` policies that allow
  authenticated users to access only keys whose first path segment is their
  `auth.uid()`.
- Worker jobs contain `{ userId, recordingId, nodeId, storageKey }` from the
  authenticated enqueue path. Worker reads/updates for `recordings`,
  `library_nodes`, and `transcripts` include `eq("user_id", userId)`; segment
  inserts use the transcript id created by that user-scoped transcript insert.

V4 m4 speaker-labeling notes:

- Post-finalize speaker labeling (`worker/speaker-label-worker.ts`) is a second
  service-role write path: it **updates** `transcript_segments.speaker` after a
  live session finalizes. `transcript_segments` has no `user_id` column, so
  ownership is established transitively — the job first loads the audio
  `library_nodes` row and the `transcripts` row with explicit
  `eq("user_id", userId)` (payload
  `userId` comes from the authenticated finalize route, like transcription
  jobs), and only then updates segments by the owned `transcript_id`. It also
  refuses jobs whose `storageKey` doesn't match the user-scoped audio node row.
- The job never touches `recordings`: labeling failure cannot change a
  finalized recording's status (degrade-never-fail).

V4 m5 stale-live-sweep notes:

- The stale-live sweep (`worker/stale-live-sweeper.ts`) is the one worker path
  with **no authenticated enqueue payload** — it runs on a cron schedule, so
  there is no user-provided `userId` at all. Its single intentionally
  cross-user query is the `recordings` scan filtered to `status = 'live'`;
  every subsequent read and write derives `user_id` from the scanned row
  itself and passes it explicitly (`eq("user_id", recording.user_id)`,
  including through `writeRecordingTranscript`, which scopes everything by
  the per-user context it is given). Segment reads use the transcript id from
  that user-scoped transcript load, mirroring the labeling job.
- Disposition writes are confined to the scanned row's owner: finalize goes
  through the standard user-scoped transcript write; expiry updates only
  `recordings` rows matched on both `id` and `user_id`.

V3 m2 live-session notes:

- Live capture adds no service-role surface. The live-session route handlers
  (`app/api/library/live-sessions/**`) authenticate the cookie session exactly
  like uploads, and the live-session service runs entirely on the user-scoped
  client — RLS governs every row it touches.
- Audio never reaches the server during a session; the browser runs Whisper
  locally and POSTs only text segments. Finalization uploads the audio blob to
  the storage key reserved under `<user_id>/…` at session start, so the
  existing bucket policies apply unchanged.

V2 semantic-search notes:

- Semantic chunks are stored in `semantic_search_chunks`, which is directly
  user-owned and protected by RLS policies keyed on `auth.uid() = user_id`.
- The schema also enforces parent ownership with composite foreign keys so a
  chunk row cannot claim one `user_id` while pointing at another user's page
  node (`node_id`), transcript, or recording.
- Worker/service-role indexing paths must still scope chunk replacement by
  `user_id`. The semantic indexing service validates source rows before
  embedding and deletes with explicit `user_id`, `source_type`, and source-id
  filters before inserting replacement chunks.
- Hybrid semantic retrieval remains service-layer opt-in: the public search
  route stays FTS-only unless a trusted caller supplies a local embedding
  provider.

## MCP server auth and tenant isolation

The MCP server (`apps/web/src/app/api/mcp/route.ts`) authenticates external
hosts with a **bearer Supabase JWT** (not the cookie session the web app uses).
`getMcpServiceContext` validates the token with `supabase.auth.getUser(token)`
and builds a `ServiceContext` whose Supabase client carries that JWT against the
**publishable (anon) key**. Every tool, resource, and prompt query therefore runs
under the user's **RLS policies** — the same guarantee as the web app, with no
service-role key and no manual `user_id` scoping. A missing or invalid token is
rejected with 401 before any service runs. Cross-user isolation is covered by
`apps/web/src/server/mcp/__tests__/isolation.test.ts`.

## Secrets

- `SUPABASE_SECRET_KEY` is server-only and never imported into client code. All
  env access goes through `apps/web/src/server/config/env.ts`; the secret is
  read only by `getServerEnv()`.
- `.env.local` is gitignored; `.env.example` documents the shape with
  placeholders.
