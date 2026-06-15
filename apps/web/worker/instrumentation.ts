// Sentry init for the transcription worker (Railway). Plain @sentry/node — the
// worker is a Bun/Node process, not Next. DSN from SENTRY_DSN (set in Railway);
// inert when unset so local runs and tests stay quiet. Imported FIRST in the
// worker entrypoint so instrumentation is active before anything else runs.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // The worker handles user audio/transcripts — never ship content/PII.
  sendDefaultPii: false,
});

export { Sentry };
