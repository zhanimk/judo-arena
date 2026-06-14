/**
 * HTTP кэш-заголовки для публичных GET-эндпоинтов.
 *
 * Использование:
 *   reply.header("Cache-Control", PUBLIC_SHORT);          // список турниров — 30 сек
 *   reply.header("Cache-Control", PUBLIC_LONG);           // статичные данные — 5 мин
 *   reply.header("Cache-Control", PRIVATE_NO_STORE);      // приватные данные
 *   reply.header("Cache-Control", NO_CACHE);              // live данные (матчи, очередь)
 *
 * Почему важно:
 *   Без заголовков браузер и CDN (Cloudflare) не кэшируют ответы API,
 *   и каждый посетитель публичной страницы вызывает новый DB-запрос.
 *   Правильные заголовки снижают нагрузку на DB в 5–20× при пиковой нагрузке.
 */

import type { FastifyReply } from "fastify";

// ── Константы ─────────────────────────────────────────────────────────────────

/** Публичные данные, меняющиеся редко (список турниров, список клубов) — 30 сек. */
export const CACHE_PUBLIC_SHORT = "public, max-age=30, s-maxage=30, stale-while-revalidate=60";

/** Публичные данные с долгим TTL (рейтинг, категории) — 5 минут. */
export const CACHE_PUBLIC_LONG = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

/** Приватные данные (заявки, профиль пользователя) — не кэшировать на CDN. */
export const CACHE_PRIVATE = "private, max-age=0, must-revalidate";

/**
 * Live-данные (матчи IN_PROGRESS, очередь татами).
 * no-store = браузер не кэширует вообще, данные всегда свежие.
 */
export const CACHE_NO_STORE = "no-store";

// ── Утилиты ───────────────────────────────────────────────────────────────────

/** Добавить Cache-Control и ETag к публичному ответу. */
export function setCacheHeaders(
  reply: FastifyReply,
  directive: string,
  etag?: string,
): void {
  reply.header("Cache-Control", directive);
  if (etag) {
    reply.header("ETag", `"${etag}"`);
  }
}

/** Генерация ETag на основе updatedAt + id. Позволяет 304 Not Modified. */
export function makeEtag(id: string, updatedAt: Date | string): string {
  const ts = typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString();
  return `${id}-${ts}`;
}

/**
 * Проверить If-None-Match заголовок клиента.
 * Если ETag совпадает → вернуть 304 (true). Иначе — false.
 *
 * Использование:
 *   const etag = makeEtag(tournament.id, tournament.updatedAt);
 *   if (checkEtag(request, reply, etag)) return; // 304 отправлен
 *   reply.header("ETag", `"${etag}"`);
 *   return tournament;
 */
export function checkEtag(
  request: { headers: Record<string, string | string[] | undefined> },
  reply: FastifyReply,
  etag: string,
): boolean {
  const clientEtag = request.headers["if-none-match"];
  if (clientEtag && clientEtag === `"${etag}"`) {
    reply.code(304).send();
    return true;
  }
  return false;
}
