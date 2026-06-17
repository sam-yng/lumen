# Deploy runbook & env matrix

App → Vercel. Marketing site → Vercel (separate project). Worker → Railway.
All read the same Supabase prod project.

> **Monorepo note:** this is a Bun + Turborepo workspace. Vercel has **two
> projects**, each with its own **root directory** (`apps/web` and
> `apps/marketing`). The worker builds from `apps/web/worker/Dockerfile` with
> the **repo root** as the Docker build context.

## Env var matrix

### App (Vercel — root dir `apps/web`)

| Var | Required | Value source |
| --- | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase API (publishable/anon) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your app domain, e.g. https://lumen.app |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase API (secret/service role) — server-only |
| `PG_BOSS_DATABASE_URL` | ✅ | Supabase → Database → Connection string (session-mode pooler, port `5432`) |

The app needs `SUPABASE_SECRET_KEY` + `PG_BOSS_DATABASE_URL` because the upload
Route Handlers enqueue pg-boss jobs from the request path.

### Marketing site (Vercel — root dir `apps/marketing`)

| Var | Required | Value source |
| --- | :---: | --- |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Marketing domain, e.g. https://lumen.app (metadataBase/robots/sitemap) |
| `NEXT_PUBLIC_APP_URL` | ✅ | The app domain the "Open the app" links point to |

No Supabase vars, no service layer, no user data — keep it dependency-light.

### Worker (Railway — Docker from `apps/web/worker/Dockerfile`)

| Var | Required | Value source |
| --- | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase API (publishable/anon) |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase API (secret/service role) |
| `PG_BOSS_DATABASE_URL` | ✅ | Supabase DB connection (session-mode pooler, port `5432`) |
| `TRANSCRIPTION_STORAGE_BUCKET` | ✅ | `library-files` |
| `WHISPER_MODEL` | ✅ | `base.en` (or larger if you size up the box) |
| `TRANSCRIPTION_TMP_DIR` | ✅ | `/tmp/lumen-transcription` |
| `DIARIZATION_ENABLED` | ✅ | `true` to label speakers; `false` to skip |
| `DIARIZATION_SEGMENTATION_MODEL_PATH` | if diarizing | `/app/apps/web/.models/diarization/segmentation.onnx` (baked into image) |
| `DIARIZATION_EMBEDDING_MODEL_PATH` | if diarizing | `/app/apps/web/.models/diarization/embedding.onnx` (baked into image) |
| `DIARIZATION_CLUSTER_THRESHOLD` | optional | `0.9` (0–1) |
| `DIARIZATION_NUM_SPEAKERS` | optional | `-1` (auto) |
| `LIVE_SESSION_STALE_MINUTES` | optional | `45` |

The worker is a **single three-job process** (`bun run worker:transcribe`):
batch transcription, `label-speakers` (live-session speaker labels), and the
cron-scheduled `sweep-stale-live-sessions`. One Railway service suffices — no
extra service, no external cron.

> `PG_BOSS_DATABASE_URL` should use the Supabase **session-mode pooler** host
> (`...pooler.supabase.com:5432`). Do not use the transaction pooler on `:6543`;
> pg-boss holds long-lived connections. Avoid the direct `db.<ref>.supabase.co`
> host on Railway/Vercel unless the Supabase IPv4 add-on is enabled.

> **No server-side Claude key.** The in-app assistant is BYO-key per-user via
> Supabase Vault (`user_ai_credentials`, `supabase_vault` extension). There is
> no `ANTHROPIC_API_KEY` env var to set. When pushing migrations to the prod
> project, confirm the **Vault extension is enabled** (the
> `20260608034021_assistant_credentials.sql` migration depends on it).

## Supabase prod project (one-time)

1. Create the project; `supabase link` + `supabase db push` to apply migrations.
2. Confirm the **Vault** extension is enabled (assistant credentials migration).
3. Create the **`library-files` private bucket** with its `storage.objects`
   policies.
4. Set **Auth → URL Configuration** Site URL + redirect allowlist to
   `NEXT_PUBLIC_APP_URL` (see the auth plan).
5. Copy the publishable + secret keys and the session-mode pooler Postgres
   connection string.

## Railway worker service

- Build from `apps/web/worker/Dockerfile` with **repo root** as build context.
- Start command is the Dockerfile `CMD` (`bun run worker:transcribe` from
  `apps/web`). Leave Railway's custom start command empty; do not carry over
  bootstrap commands from manual incident recovery.
- The image **bakes the whisper model and the diarization ONNX models** at
  build, and verifies `whisper-cli` exists before the image can publish, so
  there's zero runtime download and no volume is required. `/tmp` audio is
  ephemeral by design.
- Sizing: start at 2 vCPU / 2 GB. `batchSize: 1` ⇒ one transcription at a time
  per instance; scale by adding instances (pg-boss distributes via Postgres).

## Vercel projects

- Both: Framework preset Next.js. App build `bun run build`. No extra config
  beyond the per-project root directory and env vars above.

## Smoke test after first deploy

1. Visit `NEXT_PUBLIC_APP_URL` → redirected to `/login`.
2. Sign up → confirm email → land in app (auth plan).
3. Upload a short audio file → recording shows `pending` → worker logs in
   Railway show it picked up → status flips to `done` (with speaker labels if
   `DIARIZATION_ENABLED=true`).
