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
import { z } from "zod";
import { attachErrorHandler } from "../lib/error-handler.js";
import { zodToJsonSchema } from "zod-to-json-schema";

// Convert draft-07 boolean exclusiveMinimum/Maximum to numeric form (AJV 8 compatible)
function toSchema(
  s: Parameters<typeof zodToJsonSchema>[0],
): Record<string, unknown> {
  function fix(node: unknown): unknown {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(fix);
    const obj = { ...(node as Record<string, unknown>) };
    for (const k of Object.keys(obj)) obj[k] = fix(obj[k]);
    if (obj["exclusiveMinimum"] === true && "minimum" in obj) {
      obj["exclusiveMinimum"] = obj["minimum"];
      delete obj["minimum"];
    }
    if (obj["exclusiveMaximum"] === true && "maximum" in obj) {
      obj["exclusiveMaximum"] = obj["maximum"];
      delete obj["maximum"];
    }
    return obj;
  }
  return fix(zodToJsonSchema(s, { target: "openApi3" })) as Record<
    string,
    unknown
  >;
}
import {
  registerSchema,
  loginSchema,
  updateLocaleSchema,
  updateMeProfileSchema,
} from "../validators/auth.schema.js";
import {
  register,
  login,
  refresh,
  logout,
  updateLocale,
  updateMeProfile,
  publicUser,
} from "../services/auth.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { parseTTLToSeconds, verifyRefreshToken } from "../lib/jwt.js";
import { env } from "../lib/env.js";
import { redis } from "../lib/redis.js";
import { sendEmail, passwordResetHtml } from "../services/email.service.js";
import { prisma } from "../lib/prisma.js";
import { revokeAllUserTokens } from "../lib/refresh-store.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

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
  attachErrorHandler(app);

  // ---- POST /register — 5 попыток / 15 минут на IP ----
  app.post(
    "/register",
    {
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        tags: ["auth"],
        summary: "Регистрация нового пользователя (ATHLETE или COACH)",
        body: toSchema(registerSchema),
        response: {
          201: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              user: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const { user, tokens } = await register(input);
      reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
      return reply.code(201).send({
        user: publicUser(user),
        accessToken: tokens.accessToken,
      });
    },
  );

  // ---- POST /login — strict brute-force protection per IP ----
  app.post(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "5 minutes" } },
      schema: {
        tags: ["auth"],
        summary: "Вход по email + пароль",
        body: toSchema(loginSchema),
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              user: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const { user, tokens } = await login(input);
      reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
      return reply.send({
        user: publicUser(user),
        accessToken: tokens.accessToken,
      });
    },
  );

  // ---- POST /refresh ----
  app.post(
    "/refresh",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const refreshToken = (
        request.cookies as Record<string, string | undefined>
      )[REFRESH_COOKIE];
      if (!refreshToken) {
        return reply.code(401).send({
          error: "MISSING_REFRESH",
          message: "Отсутствует refresh-токен",
        });
      }
      const tokens = await refresh(refreshToken);
      reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
      return reply.send({ accessToken: tokens.accessToken });
    },
  );

  // ---- POST /logout ----
  app.post("/logout", async (request, reply) => {
    const refreshToken = (
      request.cookies as Record<string, string | undefined>
    )[REFRESH_COOKIE];
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
  app.patch(
    "/me/locale",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { locale } = updateLocaleSchema.parse(request.body);
      await updateLocale(request.user!.sub, locale);
      return reply.send({ ok: true, locale });
    },
  );

  // ---- PATCH /me/profile ----
  app.patch(
    "/me/profile",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const input = updateMeProfileSchema.parse(request.body);
      const user = await updateMeProfile(request.user!.sub, input);
      return reply.send({ user: publicUser(user) });
    },
  );

  // ---- POST /forgot-password — 3 попытки / час на IP ----
  app.post(
    "/forgot-password",
    { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const { email } = z
        .object({ email: z.string().email() })
        .parse(request.body);
      const user = await prisma.user.findUnique({ where: { email } });
      // Always return 200 to avoid user enumeration
      if (!user) return reply.send({ ok: true });

      const token = crypto.randomBytes(32).toString("hex");
      await redis.set(`pwd_reset:${token}`, user.id, "EX", 3600);

      const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
      await sendEmail({
        to: email,
        subject: "Judo-Arena: Құпиясөзді қалпына келтіру",
        html: passwordResetHtml(resetUrl),
      });

      return reply.send({ ok: true });
    },
  );

  // ---- POST /reset-password — 5 попыток / час на IP ----
  app.post(
    "/reset-password",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const { token, password } = z
        .object({
          token: z.string().min(1),
          password: z
            .string()
            .min(8, "Құпиясөз кемінде 8 таңба болуы керек")
            .max(128)
            .regex(/[A-Z]/, "Кем дегенде бір бас әріп болуы керек")
            .regex(/[a-z]/, "Кем дегенде бір кіші әріп болуы керек")
            .regex(/[0-9]/, "Кем дегенде бір цифр болуы керек"),
        })
        .parse(request.body);

      const userId = await redis.get(`pwd_reset:${token}`);
      if (!userId) {
        return reply.code(400).send({
          error: "INVALID_TOKEN",
          message: "Сілтеме жарамсыз немесе мерзімі өткен",
        });
      }

      const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await redis.del(`pwd_reset:${token}`);
      // Invalidate all active sessions so old tokens cannot be reused after password change
      await revokeAllUserTokens(userId);

      return reply.send({ ok: true });
    },
  );
}
