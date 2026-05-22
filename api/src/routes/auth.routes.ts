/**
 * Маршруты аутентификации: /api/auth/*
 *
 *   POST   /register      — регистрация ATHLETE или COACH
 *   POST   /login         — вход
 *   POST   /refresh       — обновление токенов
 *   POST   /logout        — выход (текущая сессия)
 *   POST   /logout-all    — выход со всех устройств
 *   GET    /me            — текущий пользователь
 *   PATCH  /me/locale     — смена языка интерфейса
 */

import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  registerSchema,
  loginSchema,
  updateLocaleSchema,
} from "../validators/auth.schema.js";
import {
  register,
  login,
  refresh,
  logout,
  updateLocale,
  publicUser,
  AuthError,
} from "../services/auth.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { parseTTLToSeconds, verifyRefreshToken } from "../lib/jwt.js";
import { env } from "../lib/env.js";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_TTL_SEC = parseTTLToSeconds(env.JWT_REFRESH_TTL);

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: REFRESH_COOKIE_TTL_SEC,
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Универсальный error handler для AuthError и ZodError
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AuthError) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Невалидные данные",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if ((err as any).statusCode === 429) return reply.code(429).send({ error: "RATE_LIMIT", message: "Превышен лимит запросов" });
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" });
  });

  // ---- POST /register ----
  app.post("/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const { user, tokens } = await register(input);
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    return reply.code(201).send({
      user: publicUser(user),
      accessToken: tokens.accessToken,
    });
  });

  // ---- POST /login ----
  app.post("/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const { user, tokens } = await login(input);
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    return reply.send({
      user: publicUser(user),
      accessToken: tokens.accessToken,
    });
  });

  // ---- POST /refresh ----
  app.post("/refresh", async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!refreshToken) {
      return reply.code(401).send({ error: "MISSING_REFRESH", message: "Отсутствует refresh-токен" });
    }
    const tokens = await refresh(refreshToken);
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    return reply.send({ accessToken: tokens.accessToken });
  });

  // ---- POST /logout ----
  app.post("/logout", async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await logout(payload.sub, payload.jti);
      } catch {
        // Молчим — даже если токен невалиден, просто чистим cookie
      }
    }
    reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return reply.code(204).send();
  });

  // ---- POST /logout-all ----
  app.post(
    "/logout-all",
    { preHandler: [authenticate] },
    async (request, reply) => {
      await logout(request.user!.sub, null, true);
      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(204).send();
    },
  );

  // ---- GET /me ----
  app.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const { prisma } = await import("../lib/prisma.js");
    const user = await prisma.user.findUnique({
      where: { id: request.user!.sub },
      include: { club: true },
    });
    if (!user) return reply.code(404).send({ error: "USER_NOT_FOUND" });
    return reply.send({ user: publicUser(user) });
  });

  // ---- PATCH /me/locale ----
  app.patch("/me/locale", { preHandler: [authenticate] }, async (request, reply) => {
    const { locale } = updateLocaleSchema.parse(request.body);
    await updateLocale(request.user!.sub, locale);
    return reply.send({ ok: true, locale });
  });
}
