/**
 * Sentry error tracking for the web app.
 * Only activates when VITE_SENTRY_DSN env variable is set.
 *
 * Setup:
 *   1. Register at sentry.io (free tier available)
 *   2. Create a React project → copy DSN
 *   3. Set VITE_SENTRY_DSN=<your-dsn> in production environment variables
 */

import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
