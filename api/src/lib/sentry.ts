/**
 * Sentry error tracking initialisation.
 * Only activates when SENTRY_DSN env variable is set.
 * Register this module BEFORE all other imports in server.ts.
 *
 * Setup: https://sentry.io → New Project → Node.js → copy DSN into SENTRY_DSN env var.
 */

import * as Sentry from "@sentry/node";
import { env } from "./env.js";

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
    enabled: env.NODE_ENV !== "test",
  });
}

export { Sentry };
