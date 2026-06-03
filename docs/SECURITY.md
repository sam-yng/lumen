# Security

## Auth model

- Supabase Auth, email/password to start (OAuth providers are a clean future
  add — there is a seam in the auth forms, no provider code yet).
- Sessions are cookie-based via `@supabase/ssr`. The Next.js **Proxy**
  (`src/proxy.ts`, formerly "middleware") refreshes the session on every request
  and guards the protected `(app)` shell.
- Defense in depth: protected Server Components **re-verify** the user with
  `supabase.auth.getUser()` (which revalidates against the auth server) rather
  than trusting routing alone.

## RLS is the security boundary

Every domain table carries a `user_id` (or, for `profiles`, an `id` that is the
auth user id) and has **Row-Level Security policies** that restrict each user to
their own rows. RLS — not app-layer filtering — is what enforces isolation.

The canonical pattern (established by `profiles` in the M0 init migration):

- `alter table ... enable row level security;`
- per-operation policies keyed on `auth.uid()`.

Every M1 domain table copies this pattern. The policy summary is regenerated
into [generated/db-schema.md](generated/db-schema.md).

The app's Supabase clients (`src/server/db/client.ts`) use the **publishable**
(anon) key and are bound to the user's session, so every query runs under that
user's RLS policies.

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
  `<user_id>/<generated-name>`, and stores file/recording rows through the
  user-scoped client.
- The private `library-files` bucket has `storage.objects` policies that allow
  authenticated users to access only keys whose first path segment is their
  `auth.uid()`.
- Worker jobs contain `{ userId, recordingId, fileId, storageKey }` from the
  authenticated enqueue path. Worker reads/updates for `recordings`, `files`,
  and `transcripts` include `eq("user_id", userId)`; segment inserts use the
  transcript id created by that user-scoped transcript insert.

## Secrets

- `SUPABASE_SECRET_KEY` is server-only and never imported into client code. All
  env access goes through `src/server/config/env.ts`; the secret is read only by
  `getServerEnv()`.
- `.env.local` is gitignored; `.env.example` documents the shape with
  placeholders.
