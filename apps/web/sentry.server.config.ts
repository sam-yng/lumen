// Sentry init for the Next server runtime. DSN comes from the environment
// (set in Vercel), never hardcoded, so the SDK is inert locally / in CI when
// NEXT_PUBLIC_SENTRY_DSN is unset. See prod-sentry.md.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // Do not ship request PII; the privacy policy states Sentry receives no user
  // content. Keep it that way.
  sendDefaultPii: false,
});
