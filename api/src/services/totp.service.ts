/**
 * TOTP (Time-based One-Time Password) сервис для 2FA.
 *
 * Использует библиотеку otplib (RFC 6238 совместима с Google Authenticator, Authy и др.).
 *
 * Флоу:
 *   1. ADMIN нажимает "Включить 2FA" → POST /auth/2fa/setup
 *      → возвращает QR-код (dataURL) + otpauth URI
 *   2. Вводит 6-значный код из приложения → POST /auth/2fa/verify-setup
 *      → сохраняет secretHash в БД, устанавливает totpEnabled = true
 *   3. При следующем входе (если totpEnabled): после успешного пароля
 *      → POST /auth/2fa/verify с code → возвращает токены
 *   4. Отключить → POST /auth/2fa/disable (нужен действующий код)
 */

import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

/** Шифрование TOTP-секрета в БД: AES-256-GCM с ключом из JWT_ACCESS_SECRET */
const ENCRYPT_KEY = crypto
  .createHash("sha256")
  .update(env.JWT_ACCESS_SECRET)
  .digest();

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(".");
  if (!ivHex || !tagHex || !encHex) throw new Error("Invalid encrypted TOTP secret");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    ENCRYPT_KEY,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
}

export class TotpError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "TotpError";
  }
}

/** Шаг 1: Сгенерировать секрет и QR-код для настройки. Не сохраняет в БД. */
export async function setupTotp(userId: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabled: true },
  });
  if (!user) throw new TotpError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (user.totpEnabled) {
    throw new TotpError("ALREADY_ENABLED", "2FA уже включён. Сначала отключите его.", 409);
  }

  const secret = generateSecret(); // 20 байт = 32 base32 символа
  const otpauthUrl = generateURI({ label: user.email, secret, issuer: "Judo-Arena" });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 256, margin: 2 });

  // Временно сохраняем зашифрованный секрет в БД (totpEnabled остаётся false)
  // Пользователь должен подтвердить кодом → тогда totpEnabled = true
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encrypt(secret) },
  });

  return { secret, otpauthUrl, qrDataUrl };
}

/** Шаг 2: Подтвердить код и активировать 2FA. */
export async function verifyAndEnableTotp(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user) throw new TotpError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (!user.totpSecret) {
    throw new TotpError("SETUP_REQUIRED", "Сначала выполните POST /auth/2fa/setup", 400);
  }
  if (user.totpEnabled) {
    throw new TotpError("ALREADY_ENABLED", "2FA уже включён", 409);
  }

  const secret = decrypt(user.totpSecret);
  const result = verifySync({ token: code, secret });
  const isValid = result.valid;
  if (!isValid) {
    throw new TotpError("INVALID_CODE", "Неверный код. Проверьте время на устройстве.", 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true },
  });
}

/** Проверить TOTP-код при входе (когда totpEnabled = true). */
export function verifyTotpCode(storedSecret: string, code: string): boolean {
  try {
    const secret = decrypt(storedSecret);
    return verifySync({ token: code, secret }).valid;
  } catch {
    return false;
  }
}

/** Отключить 2FA (требует действующий код для подтверждения). */
export async function disableTotp(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user) throw new TotpError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (!user.totpEnabled || !user.totpSecret) {
    throw new TotpError("NOT_ENABLED", "2FA не включён", 400);
  }

  const isValid = verifyTotpCode(user.totpSecret, code);
  if (!isValid) {
    throw new TotpError("INVALID_CODE", "Неверный код — 2FA не отключён", 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false },
  });
}

/** Проверить статус 2FA пользователя. */
export async function getTotpStatus(userId: string): Promise<{ enabled: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true },
  });
  return { enabled: user?.totpEnabled ?? false };
}
