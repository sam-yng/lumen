// Sentry init for the browser. DSN is inlined from NEXT_PUBLIC_SENTRY_DSN at
// build time (set in Vercel); inert when unset so local/CI stay quiet.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
