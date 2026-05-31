/**
 * Общий Fastify error handler для всех роутов.
 * Использование: attachErrorHandler(app) в начале каждого route plugin.
 *
 * Обрабатывает:
 *   - Доменные ошибки (любой класс с .code + .httpStatus)
 *   - ZodError (400 VALIDATION_ERROR)
 *   - Fastify AJV validation errors (400 VALIDATION_ERROR)
 *   - Rate limit (429 RATE_LIMIT)
 *   - Всё остальное → 500 INTERNAL_ERROR
 */

import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

/** Любая доменная ошибка с httpStatus + code */
interface DomainError {
  httpStatus: number;
  code: string;
  message: string;
}

function isDomainError(err: unknown): err is DomainError {
  return (
    err instanceof Error &&
    typeof (err as any).httpStatus === "number" &&
    typeof (err as any).code === "string"
  );
}

export function attachErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    // Доменные ошибки (AuthError, ClubError, MatchError, etc.)
    if (isDomainError(err)) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
    }

    // Zod runtime validation
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Невалидные данные",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    // Fastify AJV schema validation
    if ((err as any).statusCode === 400 && (err as any).validation) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: err.message,
        issues: (err as any).validation,
      });
    }

    // Rate limit
    if ((err as any).statusCode === 429) {
      return reply.code(429).send({ error: "RATE_LIMIT", message: "Превышен лимит запросов" });
    }

    // Unexpected errors
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" });
  });
}
