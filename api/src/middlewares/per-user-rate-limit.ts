/**
 * per-user-rate-limit.ts
 *
 * Redis-based per-user rate limiter for sensitive write endpoints.
 *
 * Usage (as Fastify preHandler):
 *   import { perUserRateLimit } from "../middlewares/per-user-rate-limit.js";
 *
 *   app.post("/api/some-endpoint", {
 *     preHandler: [authenticate, perUserRateLimit({ max: 5, windowSec: 60 })],
 *   }, handler);
 *
 * This complements the global IP-based @fastify/rate-limit by scoping
 * limits to the authenticated userId — useful when many users share one IP
 * (e.g., mobile NAT, university network).
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../lib/redis.js";

export interface PerUserRateLimitOptions {
  /** Max requests allowed within the window. Default: 30 */
  max?: number;
  /** Time window in seconds. Default: 60 */
  windowSec?: number;
  /** Optional key prefix (to namespace different endpoints). Default: "ratelimit" */
  prefix?: string;
}

/**
 * Returns a Fastify preHandler that rate-limits by authenticated userId.
 * Falls back to IP if user is not authenticated.
 */
export function perUserRateLimit(options: PerUserRateLimitOptions = {}) {
  const max = options.max ?? 30;
  const windowSec = options.windowSec ?? 60;
  const prefix = options.prefix ?? "ratelimit";

  return async function handler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Use userId if authenticated, otherwise fall back to IP
    const identifier = request.user?.sub ?? request.ip ?? "anonymous";
    const key = `${prefix}:${identifier}`;

    try {
      const [current] = await redis
        .multi()
        .incr(key)
        .expire(key, windowSec)
        .exec() as [[null | Error, number], [null | Error, number]];

      const count = current[1];

      // Set informational headers (mirrors @fastify/rate-limit conventions)
      void reply
        .header("X-RateLimit-Limit", String(max))
        .header("X-RateLimit-Remaining", String(Math.max(0, max - count)))
        .header("X-RateLimit-Reset", String(Math.floor(Date.now() / 1000) + windowSec));

      if (count > max) {
        reply
          .code(429)
          .header("Retry-After", String(windowSec))
          .send({
            statusCode: 429,
            error: "Too Many Requests",
            message: `Тым көп сұраныс. ${windowSec} секундтан кейін қайталаңыз.`,
          });
      }
    } catch {
      // If Redis is unavailable, fail open — don't block the request
    }
  };
}
