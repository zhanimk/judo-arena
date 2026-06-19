/**
 * csrf.ts — Double-Submit Cookie CSRF защита.
 *
 * Схема работы:
 *   1. GET /api/auth/csrf-token — сервер устанавливает httpOnly cookie "csrf_token"
 *      и возвращает то же значение в теле ответа JSON { csrfToken }.
 *   2. Клиент сохраняет значение из тела в памяти и передаёт в заголовке
 *      "x-csrf-token" при каждом POST / PATCH / PUT / DELETE запросе.
 *   3. Middleware `verifyCsrf` сравнивает заголовок с cookie — если не совпадает,
 *      возвращает 403.
 *
 * Почему это работает:
 *   Cookie httpOnly=true — JS не может его прочитать. Атакующий сайт не знает
 *   токен и не может подставить правильный заголовок (Synchronizer Token Pattern).
 *
 * Исключения (в verifyCsrf):
 *   - Запросы без Origin/Referer (server-to-server, curl, Postman) — пропускаем
 *     в development; в production требуем явный заголовок.
 *   - Публичные GET/HEAD/OPTIONS — всегда пропускаем.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";
import { env } from "../lib/env.js";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Генерирует новый CSRF токен и устанавливает cookie. */
export function issueCsrfToken(reply: FastifyReply): string {
  const token = randomBytes(32).toString("hex");
  reply.setCookie(CSRF_COOKIE, token, {
    httpOnly: true, // JS не читает cookie — клиент берёт токен из тела ответа
    // Production UI and API use different sites, therefore this cookie must
    // be explicitly allowed on credentialed cross-site requests.
    sameSite: env.NODE_ENV === "production" ? "none" : "strict",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 часа
  });
  return token;
}

/** Middleware: проверяет CSRF токен на state-changing запросах. */
export async function verifyCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Безопасные методы не требуют проверки
  if (SAFE_METHODS.has(request.method)) return;

  const cookieToken = (request.cookies as Record<string, string | undefined>)[
    CSRF_COOKIE
  ];
  const headerToken = request.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    reply.code(403).send({
      error: "CSRF_INVALID",
      message: "Недействительный CSRF токен. Обновите страницу.",
    });
    return;
  }
}
