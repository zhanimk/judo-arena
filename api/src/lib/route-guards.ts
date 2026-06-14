/**
 * Route guards — утилиты для декларативной защиты роутов.
 *
 * Позволяют задать preHandler одной строкой:
 *
 *   app.get("/admin/stuff", adminOnly, handler);
 *   app.get("/club-stuff", coachOrAdmin, handler);
 *   app.post("/bracket",   adminOnly, handler);
 *
 * Вместо:
 *   app.get("/admin/stuff", { preHandler: [authenticate, authorize("ADMIN")] }, handler);
 *
 * Принцип работы: guard — обычный объект Fastify RouteOptions с preHandler.
 * TypeScript гарантирует что handler видит request.user (не undefined).
 */

import type { RouteShorthandOptions } from "fastify";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// ── Готовые guards ────────────────────────────────────────────────────────────

/** Только ADMIN. */
export const adminOnly: RouteShorthandOptions = {
  preHandler: [authenticate, authorize("ADMIN")],
};

/** ADMIN или COACH. */
export const coachOrAdmin: RouteShorthandOptions = {
  preHandler: [authenticate, authorize("ADMIN", "COACH")],
};

/** ADMIN или ATHLETE. */
export const athleteOrAdmin: RouteShorthandOptions = {
  preHandler: [authenticate, authorize("ADMIN", "ATHLETE")],
};

/** Только COACH. */
export const coachOnly: RouteShorthandOptions = {
  preHandler: [authenticate, authorize("COACH")],
};

/** Только ATHLETE. */
export const athleteOnly: RouteShorthandOptions = {
  preHandler: [authenticate, authorize("ATHLETE")],
};

/** Любой авторизованный пользователь. */
export const authenticated: RouteShorthandOptions = {
  preHandler: [authenticate],
};

/** ADMIN, COACH или ATHLETE — любой зарегистрированный. */
export const anyRole: RouteShorthandOptions = {
  preHandler: [authenticate, authorize("ADMIN", "COACH", "ATHLETE")],
};

// ── Builder для кастомных guards ─────────────────────────────────────────────

/**
 * Создать guard с произвольным набором ролей.
 *
 * @example
 *   const coachOnly = requireRole("COACH");
 *   app.get("/coach/...", coachOnly, handler);
 */
export function requireRole(...roles: ("ADMIN" | "COACH" | "ATHLETE")[]): RouteShorthandOptions {
  return {
    preHandler: [authenticate, authorize(...roles)],
  };
}

/**
 * Объединить guard с дополнительным rate limit.
 *
 * @example
 *   app.get("/...", withRateLimit(adminOnly, { max: 5, timeWindow: "1 minute" }), handler);
 */
export function withRateLimit(
  guard: RouteShorthandOptions,
  rateLimit: { max: number; timeWindow: string },
): RouteShorthandOptions {
  return {
    ...guard,
    config: { rateLimit },
  };
}
