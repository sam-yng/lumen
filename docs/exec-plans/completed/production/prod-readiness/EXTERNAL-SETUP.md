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

> **Where env vars live (read first).** None of these go in a local `.env.local`
> — that file is for local dev against local Supabase only, and the deployed
> hosts never read it. Each var has exactly one production home:
>
> | Var(s) | Destination |
> | --- | --- |
> | App runtime vars (`NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SECRET_KEY`, `PG_BOSS_DATABASE_URL`, `NEXT_PUBLIC_SENTRY_DSN`) | **Vercel → app project (root `apps/web`) → Settings → Environment Variables → Production** |
> | Marketing vars (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`) | **Vercel → marketing project (root `apps/marketing`) → Settings → Environment Variables → Production** |
> | Worker vars (all of step 6, incl. `SENTRY_DSN`) | **Railway → worker service → Variables** |
> | SMTP + Auth URLs | **Supabase dashboard** (Authentication settings — not an env var anywhere) |
>
> The Claude API key is **not** part of launch setup — the AI assistant is
> descoped to [`queued/post-prod/assistant-launch.md`](../../../queued/post-prod/assistant-launch.md)
> and enabled post-launch (BYO-key, per-user Supabase Vault, no env var).
>
> Steps 1–3 only *collect* values into a scratch note; steps 4–7 are where you
> paste them into the right dashboard. Each step below restates its destination.

## Suggested schedule

| When | Steps |
| --- | --- |
| Today (Thu) | 1–3: domain/DNS, Supabase project + push, Resend + SMTP |
| Fri | 4–6: Vercel (both apps), Railway worker — once the env/deploy code has landed |
| Sat/Sun | 7–8: Sentry, smoke test, fix fallout |
| Mon | Seminar test |

---

## Step 1 — Domain + DNS (start first; propagation is the long pole)

1. Pick the domain layout. Recommended: marketing on the apex
   (`lumen.example`), app on `app.lumen.example`. The repo already assumes
   marketing links out to the app via `NEXT_PUBLIC_APP_URL`.
2. In your DNS provider, be ready to add records for: Vercel (two
   CNAME/A records, step 4), Resend (SPF + DKIM TXT records, step 3).
3. **Collect into scratch note** (not yet pasted anywhere) — the two final
   origins, e.g.
   - `NEXT_PUBLIC_APP_URL = https://app.lumen.example`
   - `NEXT_PUBLIC_SITE_URL = https://lumen.example`

   > Destination later: `NEXT_PUBLIC_APP_URL` → Vercel **app** project (step 4)
   > + Railway worker (step 6) + Supabase Auth Site URL (step 3);
   > `NEXT_PUBLIC_SITE_URL` → Vercel **marketing** project (step 5).

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
3. **Collect into scratch note** from Project Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_…`) → `SUPABASE_SECRET_KEY`

   > Destination later: all three → Vercel **app** project (step 4) **and**
   > Railway worker (step 6). `SUPABASE_SECRET_KEY` is server-only — never put
   > it in the marketing project. None of these go in `.env.local`.
4. **Collect into scratch note** from Project Settings → Database → Connection
   string, for `PG_BOSS_DATABASE_URL` (destination: Vercel **app** project +
   Railway worker):
   - Preferred: **session-mode pooler** (Supavisor,
     `…pooler.supabase.com:5432`). pg-boss holds long-lived connections;
     session mode supports that, **transaction mode (port 6543) does not** —
     never use 6543.
   - The "direct" host (`db.<ref>.supabase.co:5432`) is **IPv6-only** on
     hosted Supabase; Railway/Vercel egress is IPv4, so direct will likely
     fail to connect unless you buy the IPv4 add-on. Session pooler avoids
     this — start there.

## Step 3 — SMTP (Resend) + Supabase Auth config

Provider decided 2026-06-12: **Resend**. Without SMTP, email confirmation +
password reset can't send to real addresses (Supabase's built-in mailer is a
few emails/hour, dev-only).

1. [resend.com](https://resend.com) → create account → Domains → add your
   domain → add the SPF/DKIM DNS records it shows → wait for "Verified".
2. Resend → API Keys → create one (this doubles as the SMTP password). It is
   entered directly into the Supabase dashboard below — **it is not an app env
   var** and goes in no Vercel/Railway project.
3. Supabase → Authentication → Emails/SMTP → enable custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`,
     password = the API key, sender = `no-reply@lumen.example`.
4. Supabase → Authentication → URL Configuration:
   - Site URL = `NEXT_PUBLIC_APP_URL`
   - Redirect allowlist: `<APP_URL>/auth/confirm`, `<APP_URL>/auth/callback`
   (Routes land with [`prod-auth.md`](prod-auth.md); setting the allowlist
   early is harmless.)
5. Supabase → Authentication → Emails → **edit the email templates**. This is
   **required**, not cosmetic: `supabase/config.toml`'s
   `[auth.email.template.*]` blocks apply to the **local CLI only**. Hosted
   Supabase ignores them and ships its own defaults, whose **Confirm signup**
   template is a `{{ .ConfirmationURL }}` **link**. But our signup is a
   **6-digit code** flow (`verifyOtp` in [`src/server/auth/actions.ts`](../../../../../apps/web/src/server/auth/actions.ts)),
   and the UI sits on a code-entry screen — a link email leaves the user with
   no code and a dead end. Mirror the repo templates by hand:
   - **Confirm signup** → subject `Your Lumen confirmation code`, body =
     [`supabase/templates/confirmation.html`](../../../../../apps/web/supabase/templates/confirmation.html)
     (uses `{{ .Token }}`, the 6-digit OTP — **not** `{{ .ConfirmationURL }}`).
   - **Reset password** → subject `Reset your Lumen password`, body =
     [`supabase/templates/recovery.html`](../../../../../apps/web/supabase/templates/recovery.html)
     (link flow via `/auth/confirm`, intentional).
   Re-paste whenever those repo files change — there is no sync; the dashboard
   is the source of truth in prod.

> **Monday fallback:** if domain verification drags, leave
> `enable_confirmations` off for launch-test week, sign up your own account,
> and flip confirmations on once Resend is verified — required before any
> public user. Record the decision in `prod-auth.md` if taken.

## Step 4 — Vercel: app project

1. [vercel.com](https://vercel.com) → Add New Project → import the GitHub
   repo.
2. Settings: **Root Directory = `apps/web`**, framework Next.js. Vercel
   detects Bun from `bun.lock`; build command stays `bun run build`.
3. Paste these into **this app project → Settings → Environment Variables →
   Production scope** (not `.env.local`, not the marketing project):

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
2. Paste into **this marketing project → Settings → Environment Variables →
   Production**: `NEXT_PUBLIC_APP_URL` (step 1), `NEXT_PUBLIC_SITE_URL`
   (step 1). Only these two — no Supabase keys or DB URL here.
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
3. Paste these into **this Railway worker service → Variables** (not Vercel,
   not `.env.local`):

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
   | `DIARIZATION_SEGMENTATION_MODEL_PATH` | `/app/apps/web/.models/diarization/segmentation.onnx` (baked into the image at build) |
   | `DIARIZATION_EMBEDDING_MODEL_PATH` | `/app/apps/web/.models/diarization/embedding.onnx` (baked into the image at build) |
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
2. Sign up → (if confirmations on) receive the Resend email containing a
   **6-digit code** (not a link — see Step 3.5) → enter it on the code screen →
   land in the app.
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

> **Step 9 (Claude key / assistant) was removed from launch setup.** The AI
> assistant is descoped from launch and tracked in
> [`queued/post-prod/assistant-launch.md`](../../../queued/post-prod/assistant-launch.md);
> its BYO-key entry + verification flows run post-launch (Phase 2).

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
