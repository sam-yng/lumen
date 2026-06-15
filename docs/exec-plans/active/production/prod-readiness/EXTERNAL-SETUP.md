# External setup runbook — dashboards, accounts, DNS

> **Status:** active checklist (created 2026-06-12). Human/dashboard work only —
> no code. The codebase counterpart is
> [`prod-env-and-deploy.md`](prod-env-and-deploy.md) (which creates the worker
> Dockerfile and `DEPLOY.md` env matrix). Target: **working prod instance by
> Mon 2026-06-15** for the real-seminar transcription test
> (see [`index.md`](index.md), "Launch target").

Work through the steps in order — they're sequenced so DNS/SMTP propagation
(the only multi-hour waits) starts first, and each step lists the values to
copy into a scratch note for later steps.

## Suggested schedule

| When | Steps |
| --- | --- |
| Today (Thu) | 1–3: domain/DNS, Supabase project + push, Resend + SMTP |
| Fri | 4–6: Vercel (both apps), Railway worker — once the env/deploy code has landed |
| Sat/Sun | 7–8: Sentry, smoke test, fix fallout |
| Mon | Seminar test. 9 (Claude key + assistant gate) any time after deploy |

---

## Step 1 — Domain + DNS (start first; propagation is the long pole)

1. Pick the domain layout. Recommended: marketing on the apex
   (`lumen.example`), app on `app.lumen.example`. The repo already assumes
   marketing links out to the app via `NEXT_PUBLIC_APP_URL`.
2. In your DNS provider, be ready to add records for: Vercel (two
   CNAME/A records, step 4), Resend (SPF + DKIM TXT records, step 3).
3. **Collect:** the two final origins, e.g.
   - `NEXT_PUBLIC_APP_URL = https://app.lumen.example`
   - `NEXT_PUBLIC_SITE_URL = https://lumen.example`

> No custom domain by Monday? `*.vercel.app` URLs work fine for the seminar
> test — set `NEXT_PUBLIC_APP_URL` to the app's `*.vercel.app` origin and move
> the domain later (update Supabase auth URLs + Vercel envs when you do).

## Step 2 — Supabase production project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New project.
   Region close to you (e.g. `eu-west-2` London). Save the database password
   in your password manager.
2. From `apps/web`, link and push migrations:

   ```bash
   bunx supabase login
   bunx supabase link --project-ref <ref>   # ref from the project URL
   bunx supabase db push
   ```

   This creates **everything** schema-side: tables + RLS, the `library-files`
   private bucket + storage policies, the Vault extension +
   `user_ai_credentials` (assistant BYO keys), rate-limit-ready functions —
   no manual bucket or extension clicking. Verify in the dashboard: Table
   Editor shows `recordings` etc.; Storage shows `library-files` (private).
3. **Collect** from Project Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_…`) → `SUPABASE_SECRET_KEY`
4. **Collect** from Project Settings → Database → Connection string, for
   `PG_BOSS_DATABASE_URL`:
   - Preferred: **session-mode pooler** (Supavisor,
     `…pooler.supabase.com:5432`). pg-boss holds long-lived connections;
     session mode supports that, **transaction mode (port 6543) does not** —
     never use 6543.
   - The "direct" host (`db.<ref>.supabase.co:5432`) is **IPv6-only** on
     hosted Supabase; Railway/Vercel egress is IPv4, so direct will likely
     fail to connect unless you buy the IPv4 add-on. Session pooler avoids
     this — start there.

## Step 3 — SMTP (Resend) + Supabase Auth config

Without SMTP, email confirmation + password reset can't send to real
addresses (Supabase's built-in mailer is a few emails/hour, dev-only).

1. [resend.com](https://resend.com) → create account → Domains → add your
   domain → add the SPF/DKIM DNS records it shows → wait for "Verified".
2. Resend → API Keys → create one (this doubles as the SMTP password).
3. Supabase → Authentication → Emails/SMTP → enable custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`,
     password = the API key, sender = `no-reply@lumen.example`.
4. Supabase → Authentication → URL Configuration:
   - Site URL = `NEXT_PUBLIC_APP_URL`
   - Redirect allowlist: `<APP_URL>/auth/confirm`, `<APP_URL>/auth/callback`
   (Routes land with [`prod-auth.md`](prod-auth.md); setting the allowlist
   early is harmless.)

> **Monday fallback:** if domain verification drags, leave
> `enable_confirmations` off for launch-test week, sign up your own account,
> and flip confirmations on once Resend is verified — required before any
> public user. Record the decision in `prod-auth.md` if taken.

## Step 4 — Vercel: app project

1. [vercel.com](https://vercel.com) → Add New Project → import the GitHub
   repo.
2. Settings: **Root Directory = `apps/web`**, framework Next.js. Vercel
   detects Bun from `bun.lock`; build command stays `bun run build`.
3. Environment variables (Production):

   | Var | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | step 2 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | step 2 |
   | `NEXT_PUBLIC_APP_URL` | step 1 |
   | `SUPABASE_SECRET_KEY` | step 2 (server-only; upload routes enqueue jobs) |
   | `PG_BOSS_DATABASE_URL` | step 2 (session pooler) |
   | `NEXT_PUBLIC_SENTRY_DSN` | step 7 (add later) |

4. Domains → add `app.lumen.example`, follow the DNS instructions.
5. Deploy. Expect `/login` redirect when visiting the root.

## Step 5 — Vercel: marketing project

1. Add New Project → same repo again → **Root Directory = `apps/marketing`**.
2. Env vars: `NEXT_PUBLIC_APP_URL` (step 1), `NEXT_PUBLIC_SITE_URL` (step 1).
3. Domains → apex `lumen.example` (+ `www` redirect).
4. Not Monday-blocking — do it whenever; nothing else depends on it.

## Step 6 — Railway: worker service

Needs the worker Dockerfile from `prod-env-and-deploy.md` Task 3 merged first.

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Service settings:
   - **Dockerfile path: `apps/web/worker/Dockerfile`** (build context = repo
     root, which is Railway's default).
   - Start command: leave empty (Dockerfile `CMD`).
   - Sizing: start 2 vCPU / 2 GB.
3. Environment variables:

   | Var | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | step 2 — the worker's `getPublicEnv()` requires both `NEXT_PUBLIC_*` vars |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | step 2 |
   | `SUPABASE_SECRET_KEY` | step 2 |
   | `PG_BOSS_DATABASE_URL` | step 2 (session pooler) |
   | `TRANSCRIPTION_STORAGE_BUCKET` | `library-files` |
   | `WHISPER_MODEL` | `base.en` |
   | `TRANSCRIPTION_TMP_DIR` | `/tmp/lumen-transcription` |
   | `DIARIZATION_ENABLED` | `true` (speaker labels for the seminar test) |
   | `DIARIZATION_SEGMENTATION_MODEL_PATH` | baked image path (from `DEPLOY.md` once Task 3 lands) |
   | `DIARIZATION_EMBEDDING_MODEL_PATH` | baked image path (ditto) |
   | `LIVE_SESSION_STALE_MINUTES` | `45` (default; set explicitly for visibility) |
   | `SENTRY_DSN` | step 7 (add later) |

4. Watch the first build log: whisper.cpp compiles during `bun install`,
   diarization models download at build. First boot log should show the
   transcription, label-speakers, and stale-sweep (cron `*/15`) workers
   registering.

## Step 7 — Sentry

1. [sentry.io](https://sentry.io) → create org → two projects:
   `lumen-app` (platform: Next.js) and `lumen-worker` (platform: Node.js).
2. Copy DSNs → Vercel app project `NEXT_PUBLIC_SENTRY_DSN`, Railway
   `SENTRY_DSN`. Redeploy both.
3. Optional (source maps): Sentry auth token + `SENTRY_ORG` /
   `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` in Vercel build env.

## Step 8 — Smoke test (end-to-end, in prod)

1. Visit the app URL logged out → redirected to `/login`.
2. Sign up → (if confirmations on) receive the Resend email → confirm → land
   in the app.
3. Upload a short audio file → status `pending` → Railway log shows the job →
   status `done`, transcript renders, speakers labeled (diarization on).
4. Start a **live session** in the browser, speak a few lines, finalize →
   transcript appears; a `label-speakers` job runs in the Railway log and
   speaker chips appear shortly after.
5. Start a live session, kill the tab, wait past the stale threshold → the
   sweep finalizes or expires it (library shows Done/Failed, not `live`).
6. Full-text + semantic search over the new transcript from the sidebar.
7. Break something on purpose (e.g. upload an absurd file) → the error shows
   up in Sentry.

## Step 9 — Claude API key (assistant verification gate)

1. [console.anthropic.com](https://console.anthropic.com) → API key.
2. Enter it **in the app's assistant settings** (BYO-key, stored per-user via
   Supabase Vault) — there is no server env var for it.
3. Run the flows in
   [`prod-assistant-verification.md`](prod-assistant-verification.md) and tick
   them off; on pass, move that gate to `completed/production/`.

---

## Collected-values checklist

- [ ] App origin (`NEXT_PUBLIC_APP_URL`) · marketing origin (`NEXT_PUBLIC_SITE_URL`)
- [ ] Supabase: project URL · publishable key · secret key · session-pooler
      connection string · DB password (password manager)
- [ ] Resend: domain verified · API key · SMTP wired in Supabase
- [ ] Supabase Auth: Site URL + `/auth/confirm` + `/auth/callback` allowlisted
- [ ] Vercel: app project (root `apps/web`) · marketing project (root
      `apps/marketing`) · domains attached
- [ ] Railway: worker service building from `apps/web/worker/Dockerfile` · all
      env vars from step 6
- [ ] Sentry: two DSNs set · test event received from each runtime
- [ ] Claude key entered in-app · assistant gate run
