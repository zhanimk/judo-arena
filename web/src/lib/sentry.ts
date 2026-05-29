/**
 * Sentry error tracking for the web app.
 * Only activates when VITE_SENTRY_DSN env variable is set.
 *
 * Setup:
 *   1. Register at sentry.io (free tier available)
 *   2. Create a React project → copy DSN
 *   3. Set VITE_SENTRY_DSN=<your-dsn> in production environment variables
 *
 * Source maps: set SENTRY_AUTH_TOKEN in CI to upload source maps automatically.
 */

import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE ?? import.meta.env.VITE_APP_VERSION ?? "unknown",
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    integrations: [
      // Automatic browser performance tracing
      Sentry.browserTracingIntegration({
        // Track navigation as transactions
        instrumentNavigation: true,
        instrumentPageLoad: true,
      }),
      // Session replay on errors — full video of what happened
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
        // Mask sensitive inputs (passwords etc.)
        maskAllInputs: true,
      }),
    ],
    replaysSessionSampleRate: import.meta.env.PROD ? 0.05 : 0,
    replaysOnErrorSampleRate: 1.0,
    // Strip sensitive data from breadcrumbs/requests
    beforeSend(event) {
      // Remove password fields from form data
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        if (data.password) data.password = "[FILTERED]";
        if (data.token) data.token = "[FILTERED]";
      }
      return event;
    },
    // Ignore common noise
    ignoreErrors: [
      // Browser extensions
      "Non-Error exception captured",
      "ResizeObserver loop limit exceeded",
      // Network errors that are not bugs
      "NetworkError",
      "Failed to fetch",
      "Load failed",
    ],
  });
}

/**
 * Call when navigating to a new route so Sentry tracks page transitions.
 * Usage: call in TanStack Router onResolved/subscribe hooks.
 */
export function sentryTrackNavigation(to: string): void {
  Sentry.addBreadcrumb({
    category: "navigation",
    message: to,
    level: "info",
  });
}

export { Sentry };
