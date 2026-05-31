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
    tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
    tracesSampler: (ctx) => {
      const name = ctx.name ?? "";
      if (name.includes("/health")) return 0;
      if (name.includes("/admin/")) return 1.0;
      return env.NODE_ENV === "production" ? 0.2 : 1.0;
    },
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
        for (const field of ["password", "passwordHash", "token", "refreshToken", "accessToken", "secret"]) {
          if (data[field]) data[field] = "[FILTERED]";
        }
      }
      // Scrub Authorization header
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        if (h["authorization"]) h["authorization"] = "[FILTERED]";
        if (h["x-judge-token"]) h["x-judge-token"] = "[FILTERED]";
        if (h["x-tatami-token"]) h["x-tatami-token"] = "[FILTERED]";
      }
      return event;
    },
  });
}

export { Sentry };
