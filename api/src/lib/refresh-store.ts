/**
 * Хранилище активных refresh-токенов в Redis.
 *
 * Ключ:    refresh:{userId}:{jti}
 * Значение: "1" (просто маркер)
 * TTL:     совпадает с TTL refresh-токена
 *
 * При logout — удаляем все токены пользователя (опционально) или конкретный jti.
 * При refresh — проверяем наличие, удаляем старый, создаём новый.
 */

import { redis } from "./redis.js";
import { parseTTLToSeconds } from "./jwt.js";
import { env } from "./env.js";

const REFRESH_TTL_SEC = parseTTLToSeconds(env.JWT_REFRESH_TTL);

function key(userId: string, jti: string): string {
  return `refresh:${userId}:${jti}`;
}

export class RefreshStoreError extends Error {
  readonly code = "AUTH_STORE_UNAVAILABLE";
  readonly httpStatus = 503;
  constructor() {
    super("Хранилище сессий недоступно. Повторите позже.");
  }
}

export async function storeRefreshToken(
  userId: string,
  jti: string,
): Promise<void> {
  try {
    await redis.set(key(userId, jti), "1", "EX", REFRESH_TTL_SEC);
  } catch {
    throw new RefreshStoreError();
  }
}

/** GETDEL makes refresh rotation single-use even across parallel requests. */
export async function consumeRefreshToken(
  userId: string,
  jti: string,
): Promise<boolean> {
  try {
    return (await redis.getdel(key(userId, jti))) === "1";
  } catch {
    throw new RefreshStoreError();
  }
}

export async function revokeRefreshToken(
  userId: string,
  jti: string,
): Promise<void> {
  try {
    await redis.del(key(userId, jti));
  } catch {
    throw new RefreshStoreError();
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  try {
    const pattern = `refresh:${userId}:*`;
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    throw new RefreshStoreError();
  }
}
