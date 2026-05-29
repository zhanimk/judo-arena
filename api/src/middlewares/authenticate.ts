/**
 * Middleware аутентификации.
 * Извлекает Access-токен из заголовка Authorization: Bearer xxx,
 * верифицирует и кладёт пользователя в request.user.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

/** Кэшируем данные пользователя в Redis на 60 секунд.
 *  При деактивации аккаунта задержка не превышает 1 минуту — допустимо.
 */
const USER_CACHE_TTL = 60;

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload & {
      clubId: string | null;
      isActive: boolean;
    };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "MISSING_TOKEN", message: "Отсутствует Bearer токен" });
  }

  const token = auth.slice("Bearer ".length).trim();
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return reply.code(401).send({ error: "INVALID_TOKEN", message: "Невалидный или просроченный токен" });
  }

  // Подтягиваем актуальные данные пользователя (с кэшированием в Redis)
  type CachedUser = { id: string; email: string; role: string; clubId: string | null; isActive: boolean };

  const cacheKey = `user-cache:${payload.sub}`;
  let user: CachedUser | null = null;

  const cached = await redis.get(cacheKey);
  if (cached) {
    user = JSON.parse(cached) as CachedUser;
  } else {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, clubId: true, isActive: true },
    });
    if (dbUser) {
      user = dbUser;
      await redis.set(cacheKey, JSON.stringify(dbUser), "EX", USER_CACHE_TTL);
    }
  }

  if (!user) {
    return reply.code(401).send({ error: "USER_NOT_FOUND", message: "Пользователь не найден" });
  }
  if (!user.isActive) {
    // Немедленно инвалидируем кэш, чтобы деактивация применилась без задержки
    await redis.del(cacheKey);
    return reply.code(403).send({ error: "USER_INACTIVE", message: "Аккаунт деактивирован" });
  }

  request.user = {
    sub: user.id,
    email: user.email,
    role: user.role as AccessTokenPayload["role"],
    type: "access",
    clubId: user.clubId,
    isActive: user.isActive,
  };
}
