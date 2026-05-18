/**
 * Middleware аутентификации.
 * Извлекает Access-токен из заголовка Authorization: Bearer xxx,
 * верифицирует и кладёт пользователя в request.user.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

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

  // Подтягиваем актуальные данные пользователя (на случай если его деактивировали)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, clubId: true, isActive: true },
  });

  if (!user) {
    return reply.code(401).send({ error: "USER_NOT_FOUND", message: "Пользователь не найден" });
  }
  if (!user.isActive) {
    return reply.code(403).send({ error: "USER_INACTIVE", message: "Аккаунт деактивирован" });
  }

  request.user = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: "access",
    clubId: user.clubId,
    isActive: user.isActive,
  };
}
