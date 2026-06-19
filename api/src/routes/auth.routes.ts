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
  upsertUserDocumentSchema,
} from "../validators/auth.schema.js";
import {
  register,
  login,
  refresh,
  logout,
  updateLocale,
  updateMeProfile,
  cancelMyRegistration,
  upsertMyDocument,
  publicUser,
} from "../services/auth.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authenticated, withRateLimit } from "../lib/route-guards.js";
import { verifyCsrf } from "../middlewares/csrf.js";
import { parseTTLToSeconds, verifyRefreshToken } from "../lib/jwt.js";
import { env } from "../lib/env.js";
import { redis } from "../lib/redis.js";
import {
  sendEmail,
  passwordResetHtml,
  passwordResetSubject,
} from "../services/email.service.js";
import { prisma } from "../lib/prisma.js";
import { revokeAllUserTokens } from "../lib/refresh-store.js";
import { disconnectUserSockets } from "../sockets/io.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { readPrivateFile } from "../lib/storage.js";
import {
  setupTotp,
  verifyAndEnableTotp,
  disableTotp,
  getTotpStatus,
} from "../services/totp.service.js";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_TTL_SEC = parseTTLToSeconds(env.JWT_REFRESH_TTL);

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  // The production frontend and API are hosted on different sites
  // (Vercel + Render), so Lax cookies are not sent with API fetches.
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
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
      config: {
        rateLimit: {
          max: env.AUTH_LOGIN_RATE_LIMIT_MAX,
          timeWindow: "5 minutes",
        },
      },
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
      const { user, tokens, totpRequired } = await login(input);

      // 2FA: если включён — не выдаём токены, возвращаем challenge
      if (totpRequired) {
        // Сохраняем временный токен в Redis на 5 минут
        const challengeToken = crypto.randomBytes(24).toString("hex");
        await redis.set(`totp_challenge:${challengeToken}`, user.id, "EX", 300);
        // Отдаём 200 с флагом totpRequired (202 не поддерживается типами Fastify)
        return reply.send({
          totpRequired: true,
          challengeToken,
          message: "Введите 6-значный код из приложения аутентификатора",
        });
      }

      reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
      return reply.send({
        user: publicUser(user),
        accessToken: tokens.accessToken,
      });
    },
  );

  // ---- POST /2fa/challenge — завершение входа с TOTP-кодом ----
  app.post(
    "/2fa/challenge",
    { config: { rateLimit: { max: 5, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      const { challengeToken, code } = z
        .object({
          challengeToken: z.string().min(1),
          code: z.string().length(6).regex(/^\d+$/),
        })
        .parse(request.body);

      const userId = await redis.get(`totp_challenge:${challengeToken}`);
      if (!userId) {
        return reply.code(401).send({
          error: "CHALLENGE_EXPIRED",
          message: "Сессия истекла. Войдите снова.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          totpSecret: true,
          totpEnabled: true,
          email: true,
          role: true,
          clubId: true,
          isActive: true,
        },
      });
      if (!user || !user.totpEnabled || !user.totpSecret) {
        return reply
          .code(401)
          .send({ error: "INVALID_STATE", message: "Ошибка состояния 2FA" });
      }

      const { verifyTotpCode } = await import("../services/totp.service.js");
      const valid = verifyTotpCode(user.totpSecret, code);
      if (!valid) {
        return reply
          .code(401)
          .send({ error: "INVALID_TOTP", message: "Неверный код" });
      }

      // Код верный — выдаём токены
      await redis.del(`totp_challenge:${challengeToken}`);
      const { signAccessToken, signRefreshToken } =
        await import("../lib/jwt.js");
      const { storeRefreshToken } = await import("../lib/refresh-store.js");
      const { jti, token: refreshToken } = signRefreshToken(user.id);
      await storeRefreshToken(user.id, jti);
      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role as Parameters<typeof signAccessToken>[0]["role"],
      });

      reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOptions);
      return reply.send({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    },
  );

  // ---- GET  /2fa/status ----
  app.get("/2fa/status", authenticated, async (request) => {
    return getTotpStatus(request.user!.sub);
  });

  // ---- POST /2fa/setup — шаг 1: генерируем QR ----
  app.post(
    "/2fa/setup",
    withRateLimit(authenticated, { max: 5, timeWindow: "10 minutes" }),
    async (request) => {
      return setupTotp(request.user!.sub);
    },
  );

  // ---- POST /2fa/verify-setup — шаг 2: подтверждаем и включаем ----
  app.post(
    "/2fa/verify-setup",
    withRateLimit(authenticated, { max: 5, timeWindow: "5 minutes" }),
    async (request, reply) => {
      const { code } = z
        .object({ code: z.string().length(6).regex(/^\d+$/) })
        .parse(request.body);
      await verifyAndEnableTotp(request.user!.sub, code);
      return reply.send({ ok: true, message: "2FA успешно включён" });
    },
  );

  // ---- POST /2fa/disable — отключить (требует код) ----
  app.post(
    "/2fa/disable",
    withRateLimit(authenticated, { max: 3, timeWindow: "10 minutes" }),
    async (request, reply) => {
      const { code } = z
        .object({ code: z.string().length(6).regex(/^\d+$/) })
        .parse(request.body);
      await disableTotp(request.user!.sub, code);
      return reply.send({ ok: true, message: "2FA отключён" });
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
  app.post("/logout", { preHandler: [verifyCsrf] }, async (request, reply) => {
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
    { preHandler: [authenticate, verifyCsrf] },
    async (request, reply) => {
      await logout(request.user!.sub, null, true);
      disconnectUserSockets(request.user!.sub);
      reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return reply.code(204).send();
    },
  );

  // ---- GET /verify-email?token=xxx — подтвердить email по токену ----
  app.get("/verify-email", async (request, reply) => {
    const { verifyEmail } =
      await import("../services/email-verification.service.js");
    const { z } = await import("zod");
    const { token } = z
      .object({ token: z.string().min(1) })
      .parse(request.query);
    const result = await verifyEmail(token);
    // Редиректим на фронтенд с флагом успеха
    return reply.redirect(
      `${env.APP_URL}/email-verified?email=${encodeURIComponent(result.email)}`,
    );
  });

  // ---- POST /resend-verification — повторно отправить письмо верификации ----
  app.post(
    "/resend-verification",
    withRateLimit(authenticated, { max: 3, timeWindow: "10 minutes" }),
    async (request, reply) => {
      const { sendVerificationEmail } =
        await import("../services/email-verification.service.js");
      await sendVerificationEmail(request.user!.sub);
      return reply.code(204).send();
    },
  );

  // ---- DELETE /me — cancel fresh athlete/coach registration ----
  app.delete("/me", authenticated, async (request, reply) => {
    await cancelMyRegistration(request.user!.sub);
    reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return reply.code(204).send();
  });

  // ---- GET /me ----
  app.get("/me", authenticated, async (request, reply) => {
    const { prisma } = await import("../lib/prisma.js");
    const user = await prisma.user.findUnique({
      where: { id: request.user!.sub },
      include: { club: true, documents: { orderBy: { updatedAt: "desc" } } },
    });
    if (!user) return reply.code(404).send({ error: "USER_NOT_FOUND" });
    return reply.send({ user: publicUser(user) });
  });

  // ---- PATCH /me/locale ----
  app.patch("/me/locale", authenticated, async (request, reply) => {
    const { locale } = updateLocaleSchema.parse(request.body);
    await updateLocale(request.user!.sub, locale);
    return reply.send({ ok: true, locale });
  });

  // ---- PATCH /me/profile ----
  app.patch("/me/profile", authenticated, async (request, reply) => {
    const input = updateMeProfileSchema.parse(request.body);
    const user = await updateMeProfile(request.user!.sub, input);
    return reply.send({ user: publicUser(user) });
  });

  // ---- POST /me/change-password ----
  // Отдельный от profile endpoint — требует currentPassword для верификации.
  // Rate-limit 5/час: защита от брутфорса текущего пароля.
  app.post(
    "/me/change-password",
    withRateLimit(authenticated, { max: 5, timeWindow: "1 hour" }),
    async (request, reply) => {
      const { currentPassword, newPassword } = z
        .object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8).max(72),
        })
        .parse(request.body);

      const user = await prisma.user.findUnique({
        where: { id: request.user!.sub },
        select: { passwordHash: true },
      });
      if (!user) return reply.code(404).send({ error: "USER_NOT_FOUND" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.code(400).send({
          error: "WRONG_CURRENT_PASSWORD",
          message: "Ағымдағы құпиясөз дұрыс емес",
        });
      }

      const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id: request.user!.sub },
        data: { passwordHash: newHash },
      });

      // Инвалидировать все сессии (кроме текущей) — пользователь должен перелогиниться везде
      await revokeAllUserTokens(request.user!.sub);

      return reply.send({ ok: true });
    },
  );

  // ---- PUT /me/documents ----
  app.put("/me/documents", authenticated, async (request, reply) => {
    const input = upsertUserDocumentSchema.parse(request.body);
    const document = await upsertMyDocument(request.user!.sub, input);
    return reply.send({ document });
  });

  // ---- GET /documents/:id/download ----
  app.get<{ Params: { id: string } }>(
    "/documents/:id/download",
    authenticated,
    async (request, reply) => {
      const document = await prisma.userDocument.findUnique({
        where: { id: request.params.id },
      });
      if (!document) {
        return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
      }
      if (
        document.userId !== request.user!.sub &&
        request.user!.role !== "ADMIN"
      ) {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      try {
        const content = await readPrivateFile(document.url);
        const originalName = Array.from(
          document.originalName || `document-${document.id}`,
          (char) => {
            const code = char.charCodeAt(0);
            return code < 32 || code === 127 ? "_" : char;
          },
        )
          .join("")
          .slice(0, 180);
        const asciiName = originalName
          .normalize("NFKD")
          .replace(/[^\x20-\x7e]/g, "_")
          .replace(/["\\]/g, "_");
        const encodedName = encodeURIComponent(originalName).replace(
          /['()*]/g,
          (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
        );
        return reply
          .header(
            "Content-Type",
            document.mimeType || "application/octet-stream",
          )
          .header(
            "Content-Disposition",
            `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
          )
          .header("Cache-Control", "private, no-store")
          .header("X-Content-Type-Options", "nosniff")
          .send(content);
      } catch (error) {
        request.log.warn(
          { err: error, documentId: document.id },
          "document storage read failed",
        );
        return reply.code(404).send({ error: "DOCUMENT_FILE_NOT_FOUND" });
      }
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
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, preferredLocale: true },
      });
      // Always return 200 to avoid user enumeration
      if (!user) return reply.send({ ok: true });

      const token = crypto.randomBytes(32).toString("hex");
      await redis.set(`pwd_reset:${token}`, user.id, "EX", 3600);

      const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
      await sendEmail({
        to: email,
        subject: passwordResetSubject(user.preferredLocale),
        html: passwordResetHtml(resetUrl, user.preferredLocale),
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
      disconnectUserSockets(userId);

      return reply.send({ ok: true });
    },
  );
}
