/**
 * email-verification.service.ts — верификация email после регистрации.
 *
 * Flow:
 *   1. register() → sendVerificationEmail(userId) → token в DB + письмо
 *   2. Пользователь кликает ссылку GET /api/auth/verify-email?token=xxx
 *   3. verifyEmail(token) → emailVerified = true, token стирается
 *
 * Политики:
 *   - Токен действует 24 часа
 *   - Повторная отправка не чаще раза в 2 минуты (rate limit)
 *   - Пользователь может войти без верификации, но получает предупреждение
 *     (не блокируем — слишком агрессивно для MVP)
 *   - ADMIN аккаунты автоматически помечаются verified (создаются вручную)
 */

import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "./email.service.js";
import { env } from "../lib/env.js";

export class EmailVerificationError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "EmailVerificationError";
  }
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 минуты между повторными отправками

/** Генерирует токен верификации и отправляет письмо. */
export async function sendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      preferredLocale: true,
      emailVerified: true,
      emailVerificationSentAt: true,
    },
  });

  if (!user)
    throw new EmailVerificationError(
      "USER_NOT_FOUND",
      "Пользователь не найден",
      404,
    );
  if (user.emailVerified) {
    throw new EmailVerificationError(
      "ALREADY_VERIFIED",
      "Email уже подтверждён",
      409,
    );
  }

  // Rate limit: не чаще раза в 2 минуты
  if (user.emailVerificationSentAt) {
    const elapsed = Date.now() - user.emailVerificationSentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new EmailVerificationError(
        "RATE_LIMITED",
        `Повторная отправка доступна через ${waitSec} секунд`,
        429,
      );
    }
  }

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: token,
      emailVerificationSentAt: new Date(),
    },
  });

  const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: verificationEmailSubject(user.preferredLocale),
    html: verificationEmailHtml(user.name, verifyUrl, user.preferredLocale),
  });
}

/** Подтверждает email по токену. */
export async function verifyEmail(token: string): Promise<{ email: string }> {
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerificationSentAt: true,
    },
  });

  if (!user) {
    throw new EmailVerificationError(
      "INVALID_TOKEN",
      "Недействительная или уже использованная ссылка подтверждения",
      400,
    );
  }

  if (user.emailVerified) {
    // Уже подтверждён — стираем токен и возвращаем успех
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: null },
    });
    return { email: user.email };
  }

  // Проверяем срок действия токена
  if (user.emailVerificationSentAt) {
    const age = Date.now() - user.emailVerificationSentAt.getTime();
    if (age > TOKEN_TTL_MS) {
      // Стираем истёкший токен
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: null },
      });
      throw new EmailVerificationError(
        "TOKEN_EXPIRED",
        "Ссылка подтверждения истекла. Запросите новую.",
        400,
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
    },
  });

  return { email: user.email };
}

// ============================================================
// HTML шаблон письма
// ============================================================

type EmailLocale = "kk" | "ru" | "en";

const verificationCopy: Record<
  EmailLocale,
  {
    lang: string;
    subject: string;
    title: string;
    greeting: (name: string) => string;
    instruction: string;
    button: string;
    fallback: string;
    expiry: string;
    country: string;
  }
> = {
  kk: {
    lang: "kk",
    subject: "Judo-Arena — email мекенжайыңызды растаңыз",
    title: "Email мекенжайыңызды растаңыз",
    greeting: (name) => `Сәлем, <strong>${escapeHtml(name)}</strong>!`,
    instruction: "Тіркелуді аяқтау үшін төмендегі батырманы басыңыз.",
    button: "Email-ды растау",
    fallback: "Егер батырма жұмыс істемесе, мына сілтемені көшіріңіз:",
    expiry:
      "Сілтеме 24 сағат бойы жарамды. Егер сіз тіркелмеген болсаңыз, бұл хатты елемеңіз.",
    country: "Қазақстан",
  },
  ru: {
    lang: "ru",
    subject: "Judo-Arena — подтвердите ваш email",
    title: "Подтвердите ваш email",
    greeting: (name) => `Здравствуйте, <strong>${escapeHtml(name)}</strong>!`,
    instruction: "Для завершения регистрации нажмите кнопку ниже.",
    button: "Подтвердить email",
    fallback: "Если кнопка не работает, скопируйте эту ссылку:",
    expiry:
      "Ссылка действительна 24 часа. Если вы не регистрировались, просто проигнорируйте это письмо.",
    country: "Казахстан",
  },
  en: {
    lang: "en",
    subject: "Judo-Arena — confirm your email",
    title: "Confirm your email",
    greeting: (name) => `Hello, <strong>${escapeHtml(name)}</strong>!`,
    instruction: "Click the button below to complete your registration.",
    button: "Confirm email",
    fallback: "If the button does not work, copy this link:",
    expiry:
      "The link is valid for 24 hours. If you did not register, simply ignore this email.",
    country: "Kazakhstan",
  },
};

function verificationEmailSubject(locale: EmailLocale): string {
  return verificationCopy[locale].subject;
}

function verificationEmailHtml(
  name: string,
  verifyUrl: string,
  locale: EmailLocale,
): string {
  const copy = verificationCopy[locale];
  return `
<!DOCTYPE html>
<html lang="${copy.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.title} — Judo-Arena</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:900;color:#fbbf24;letter-spacing:3px;">🥋 JUDO-ARENA</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111;">
                ${copy.title}
              </h2>
              <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
                ${copy.greeting(name)}<br>
                ${copy.instruction}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;background:#fbbf24;color:#111;font-weight:800;font-size:16px;
                              padding:14px 40px;border-radius:8px;text-decoration:none;letter-spacing:1px;">
                      ${copy.button}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#999;font-size:13px;margin:0 0 8px;">
                ${copy.fallback}
              </p>
              <p style="color:#6b7280;font-size:12px;word-break:break-all;background:#f9fafb;
                         padding:10px;border-radius:6px;margin:0 0 24px;">
                ${verifyUrl}
              </p>
              <p style="color:#bbb;font-size:12px;margin:0;">
                ${copy.expiry}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:18px 40px;text-align:center;">
              <p style="color:#bbb;font-size:12px;margin:0;">
                © ${new Date().getFullYear()} Judo-Arena · ${copy.country}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
