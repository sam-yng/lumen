# Production-readiness plans — index

> **Status:** active. Written 2026-06-04, parallel to other in-flight work.
> These plans are **additive** and live in their own folder so they don't
> collide with whatever else is editing `docs/`. **`docs/PLANS.md` was
> intentionally NOT updated** (another agent owns it right now) — whoever lands
> the first of these should add a row there.

> **Path note after the monorepo migration:** these plans were written before
> the app moved into `apps/web`. Treat app paths such as `src/`, `supabase/`,
> `worker/`, `scripts/`, and `next.config.ts` as relative to `apps/web/`.
> App-local commands such as `bun run dev`, `bun run db:types`, and
> `bunx supabase ...` should run from `apps/web`; the root `bun run check`
> remains the workspace gate.

Goal: get Lumen from "v1 feature-complete" to "safe to put in front of the
public," covering only the **codebase** work. Codebase-external setup (Railway,
Supabase prod project, SMTP, DNS, Sentry account, etc.) is tracked separately —
see the deploy plan's "External prerequisites" section.

Hosting decision (locked): **app → Vercel, worker → Railway.**

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
