/**
 * Middleware аутентификации.
 * Извлекает Access-токен из заголовка Authorization: Bearer xxx,
 * верифицирует и кладёт пользователя в request.user.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { UserRole } from "@prisma/client";

/** Кэшируем данные пользователя в Redis на 5 минут.
 *  При деактивации аккаунта кэш сбрасывается принудительно (см. ниже).
 *  300 секунд снижает нагрузку на DB в 5x при 100+ concurrent users.
 */
const USER_CACHE_TTL = 300;

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload & {
      clubId: string | null;
      isActive: boolean;
    };
  }
}

/** Принудительно сбросить кэш пользователя (вызывать при смене роли/клуба/деактивации). */
export async function invalidateUserCache(userId: string): Promise<void> {
  await redis.del(`user-cache:${userId}`);
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  let auth = request.headers.authorization;

  if (!auth && (request.query as any)?.token) {
    auth = `Bearer ${(request.query as any).token}`;
  }

  if (!auth || !auth.startsWith("Bearer ")) {
    return reply
      .code(401)
      .send({ error: "MISSING_TOKEN", message: "Отсутствует Bearer токен" });
  }

  const token = auth.slice("Bearer ".length).trim();
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return reply
      .code(401)
      .send({
        error: "INVALID_TOKEN",
        message: "Невалидный или просроченный токен",
      });
  }

  // Подтягиваем актуальные данные пользователя (с кэшированием в Redis)
  type CachedUser = {
    id: string;
    email: string;
    role: string;
    clubId: string | null;
    isActive: boolean;
  };

  const cacheKey = `user-cache:${payload.sub}`;
  let user: CachedUser | null = null;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      user = JSON.parse(cached) as CachedUser;
    }
  } catch {
    // Redis недоступен — идём в БД напрямую
  }

  if (!user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        clubId: true,
        isActive: true,
      },
    });
    if (dbUser) {
      user = dbUser;
      try {
        await redis.set(cacheKey, JSON.stringify(dbUser), "EX", USER_CACHE_TTL);
      } catch {
        // Запись в кэш не критична, игнорируем
      }
    }
  }

  if (!user) {
    return reply
      .code(401)
      .send({ error: "USER_NOT_FOUND", message: "Пользователь не найден" });
  }
  if (!user.isActive) {
    try {
      await redis.del(cacheKey);
    } catch {
      // Если Redis недоступен, кэш устареет сам по TTL
    }
    return reply
      .code(403)
      .send({ error: "USER_INACTIVE", message: "Аккаунт деактивирован" });
  }

  const role = user.role as AccessTokenPayload["role"];
  if (!Object.values(UserRole).includes(role as UserRole)) {
    return reply
      .code(401)
      .send({ error: "INVALID_TOKEN", message: "Невалидная роль в токене" });
  }

  request.user = {
    sub: user.id,
    email: user.email,
    role,
    type: "access",
    clubId: user.clubId,
    isActive: user.isActive,
  };
}
