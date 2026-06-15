# Production-readiness plans — index

> **Status:** active. Written 2026-06-04, parallel to other in-flight work.
> These plans are **additive** and live in their own folder so they don't
> collide with whatever else is editing `docs/`. (The original "PLANS.md not
> updated" note is resolved — these plans are indexed in
> [`docs/PLANS.md`](../../../../PLANS.md) under **production**.)
> **Scope refreshed 2026-06-12** against the post-v4 codebase — each child plan
> now carries a dated "Scope refinement" section that corrects drift; those
> sections are binding on implementers where they conflict with the original
> task snippets.

> **Path note after the monorepo migration:** these plans were written before
> the app moved into `apps/web`. Treat app paths such as `src/`, `supabase/`,
> `worker/`, `scripts/`, and `next.config.ts` as relative to `apps/web/`.
> App-local commands such as `bun run dev`, `bun run db:types`, and
> `bunx supabase ...` should run from `apps/web`; the root `bun run check`
> remains the workspace gate.

Goal: get Lumen from "v1 feature-complete" to "safe to put in front of the
public," covering only the **codebase** work. Codebase-external setup (Railway,
Supabase prod project, SMTP, DNS, Sentry account, etc.) has its own
step-by-step runbook: **[EXTERNAL-SETUP.md](EXTERNAL-SETUP.md)** (added
2026-06-12; supersedes the per-plan "External prerequisites" sections as the
working checklist — those sections remain as per-plan context).

Hosting decision (locked): **app → Vercel, worker → Railway.**
**Addendum (2026-06-12):** the monorepo now also contains `apps/marketing`
(public static site, port 3001 locally). It deploys as a **second Vercel
project** (root directory `apps/marketing`, env: `NEXT_PUBLIC_APP_URL` +
`NEXT_PUBLIC_SITE_URL`). Not on the launch-test critical path.

## Launch target (added 2026-06-12)

**A working prod instance by Mon 2026-06-15**, so live transcription can be
tested in a real seminar and real-world gaps surfaced. That target splits the
plans into a critical path and a deferrable tail:

| Order | Plan | Monday-blocking? | Notes |
| --- | --- | --- | --- |
| 1 | prod-env-and-deploy | **Yes** | Everything else needs real prod env. See its refinement section — the worker image must now also carry diarization models + ffmpeg for the v4 live-label + sweep jobs. |
| 2 | prod-auth | **Partially** | Tasks 1–3 (confirmation, callback, reset) + Task 5 (rate limit) yes — SMTP is the external long pole. Task 4 (Google OAuth) is deferrable; password auth suffices for the seminar test. |
| 3 | prod-sentry | **Yes (cheap)** | Small; the whole point of the seminar test is finding gaps, and a silent remote worker hides them. |
| 4 | prod-legal-pages | No | Required before *public* users, not for a private seminar test. Schedule immediately after. |
| 5 | prod-assistant-verification | No (but unblocked) | A prod instance + a real Claude key finally unblocks this gate — run it the same week. |

The seminar test exercises **live capture** (browser-side Whisper — needs only
the Vercel app + HTTPS) and the **post-finalize pipeline** (worker:
`label-speakers`, `sweep-stale-live-sessions`, batch transcription) — so the
Railway worker with `DIARIZATION_ENABLED=true` is part of the Monday target,
not a nice-to-have.

## The plans (split per subsystem, build in this order)

1. **[prod-env-and-deploy.md](prod-env-and-deploy.md)** — production env-var
   injection, env-schema hardening, Railway worker entrypoint + Dockerfile,
   Vercel build config. *Do this first — everything else needs prod env to be
   real.*
2. **[prod-auth.md](prod-auth.md)** — make auth production-grade: email
   confirmation, password reset, app-level rate limiting, Google OAuth. Adds the
   missing `/auth/confirm` + `/auth/callback` route handlers.
3. **[prod-sentry.md](prod-sentry.md)** — Sentry error tracking in both the
   Next app and the Railway worker (two separate SDKs).
4. **[prod-legal-pages.md](prod-legal-pages.md)** — drafted Privacy Policy +
   Terms (real first-draft copy, lawyer-review-pending), `/privacy` + `/terms`
   routes, footer links.

Each plan is independently shippable and leaves `bun run check` green.

## Launch verification gates (not codebase work)

Some launch blockers are **verification**, not code — the build is done and
accepted, but a manual check needs prod-only inputs (an API key, an external
account). These live here so a build-complete milestone can move to `completed/`
instead of being pinned in `active/` for the whole dev cycle.

- **[prod-assistant-verification.md](prod-assistant-verification.md)** — the
  Claude-key-dependent manual happy-paths for the v2 in-app assistant and v3
  cited retrieval. Both builds shipped; this gate is the single place the
  outstanding verification is tracked. **Lumen must not ship until it passes.**

> **Lifecycle rule:** when a milestone's only remaining item is an
> environmental/launch blocker, complete the milestone on build acceptance and
> record the blocker here — do not hold the milestone group open in `active/`.

## Nice-to-have recommendations (not yet planned)

Captured here so they aren't lost. Promote to a real plan when prioritised.

| Item | Why | Rough size |
| --- | --- | --- |
| Per-user upload / transcription quota | Whisper is CPU-bound; one user can starve the single Railway worker and run up the bill. Cap audio minutes or concurrent pending jobs per user. | M (service + UI) |
| Storage size cap per user | Uploads are unbounded today. Supabase Storage bills on size. | S (DB check + UI) |
| Account deletion (self-serve) | GDPR/CCPA "right to erasure" — currently no way for a user to delete their account + data. Pairs with the legal plan's stated promise. | M (cascade delete + UI) |
| Data export (self-serve) | GDPR "right to portability." Lower urgency than deletion. | M |
| Uptime + worker liveness monitoring | The worker fails silently on a remote box; a dead worker = transcripts stuck in `pending` forever with no alert. UptimeRobot/Better Stack ping + a worker heartbeat. | S |
| Structured logging in worker | Today worker errors only land on the `recordings.error` column. Add real logs for the Railway console. | S |
| `robots.txt` / `sitemap` / OG metadata | SEO + link previews for a public app. | S |
| Security headers (CSP, HSTS) | `next.config` headers; tighten before launch. | S |
| CI: run `bun run check` on PRs with prod env shape | Ensure the stricter env schema (deploy plan) doesn't break CI. | S |

## Cross-cutting conflict flags (for parallel / future agents)

These plans touch files that feature work also touches. If you're an agent
landing other work, watch for:

- **`src/proxy.ts`** — the auth plan extends `PUBLIC_PREFIXES` (adds
  `/privacy`, `/terms`, and relies on `/auth`). Merge carefully.
- **`src/server/auth/actions.ts`** + **`src/components/auth-form.tsx`** — the
  auth plan rewrites both. Any other auth UI work will conflict head-on.
- **`src/server/config/env.ts`** — the deploy plan tightens the schema (drops
  localhost defaults, adds Sentry + app-URL vars). Coordinate if you add env vars.
- **M4 upload Route Handlers** — the auth plan adds rate limiting at the
  transcription-enqueue boundary. Whoever owns the upload path should expect a
  wrapper there.
- **App shell layout** (the `(app)` group) — the legal plan adds footer links;
  the auth plan adds an OAuth button + "forgot password" link. Minor.
- **`next.config`** + **`worker/transcription-worker.ts`** — the Sentry plan
  wraps both. The worker entrypoint is also edited by the deploy plan
  (start script). Land deploy before Sentry to avoid re-touching the entry.
