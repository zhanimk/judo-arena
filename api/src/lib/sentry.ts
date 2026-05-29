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
    release: process.env.RELEASE ?? process.env.npm_package_version ?? "unknown",
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    enabled: env.NODE_ENV !== "test",
    // Automatic Node.js instrumentation (http, pg, redis, etc.)
    integrations: [
      Sentry.postgresIntegration(),
      Sentry.redisIntegration(),
    ],
    // Scrub sensitive fields from payloads
    beforeSend(event) {
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        if (data.password) data.password = "[FILTERED]";
        if (data.passwordHash) data.passwordHash = "[FILTERED]";
        if (data.token) data.token = "[FILTERED]";
      }
      return event;
    },
  });
}

export { Sentry };
