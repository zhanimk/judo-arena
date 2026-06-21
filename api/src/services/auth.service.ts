/**
 * Сервис аутентификации — вся бизнес-логика регистрации, входа, обновления токенов.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { env } from "../lib/env.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import {
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllUserTokens,
} from "../lib/refresh-store.js";
import type {
  RegisterInput,
  LoginInput,
  UpdateMeProfileInput,
  UpsertUserDocumentInput,
} from "../validators/auth.schema.js";
import { ClubRole, UserRole, type User } from "@prisma/client";
import { sendVerificationEmail } from "./email-verification.service.js";

// ============================================================
// Ошибки сервиса (выбрасываем — handler их ловит и преобразует в HTTP)
// ============================================================
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ============================================================
// Регистрация
// ============================================================
export async function register(
  input: RegisterInput,
): Promise<{ user: User; tokens: TokenPair }> {
  // Проверка уникальности email (нормализуем до lowercase — как и при сохранении)
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });
  if (existing) {
    throw new AuthError("EMAIL_TAKEN", "Email уже зарегистрирован", 409);
  }

  // Если указан clubId — проверить что клуб существует
  if (input.clubId) {
    const club = await prisma.club.findUnique({ where: { id: input.clubId } });
    if (!club) throw new AuthError("CLUB_NOT_FOUND", "Клуб не найден", 404);
    if (input.role === UserRole.COACH) {
      throw new AuthError(
        "COACH_CLUB_REQUIRES_REQUEST",
        "Тренер должен отправить заявку на вступление в клуб",
        400,
      );
    }
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role,
      name: input.name.trim(),
      surname: input.surname.trim(),
      nameLatin: input.nameLatin?.trim(),
      surnameLatin: input.surnameLatin?.trim(),
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      weightKg: input.weightKg,
      beltRank: input.beltRank,
      preferredLocale: input.preferredLocale,
      phone: input.phone,
      clubId: input.clubId,
      clubRole:
        input.role === UserRole.COACH && input.clubId
          ? ClubRole.COACH
          : undefined,
    },
  });

  const tokens = await issueTokens(user);

  // Отправляем письмо верификации в фоне (не блокируем ответ регистрации)
  // Ошибка отправки не должна ломать регистрацию
  sendVerificationEmail(user.id).catch((err) => {
    process.stderr.write(
      `[auth] Не удалось отправить письмо верификации для ${user.email}: ${err.message}\n`,
    );
  });

  return { user, tokens };
}

// ============================================================
// Вход
// ============================================================

const LOGIN_LOCKOUT_MAX = 10;
const LOGIN_LOCKOUT_WINDOW_SEC = 900; // 15 минут

function loginFailedKey(email: string): string {
  return `login_failed:${email}`;
}

export async function login(
  input: LoginInput,
): Promise<{ user: User; tokens: TokenPair; totpRequired: boolean }> {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Проверка блокировки аккаунта до запроса в БД (защита от timing-атак через enumerate)
  const failKey = loginFailedKey(normalizedEmail);
  const failCount = await redis.get(failKey).catch(() => null);
  if (failCount !== null && parseInt(failCount, 10) >= LOGIN_LOCKOUT_MAX) {
    throw new AuthError(
      "ACCOUNT_TEMPORARILY_LOCKED",
      "Слишком много неудачных попыток входа. Попробуйте через 15 минут.",
      429,
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Инкрементируем счётчик даже если email не найден — защита от enumerate
    const n = await redis.incr(failKey).catch(() => 0);
    if (n === 1)
      redis.expire(failKey, LOGIN_LOCKOUT_WINDOW_SEC).catch(() => {});
    // Не сообщаем что email не найден (защита от перебора)
    throw new AuthError(
      "INVALID_CREDENTIALS",
      "Неверный email или пароль",
      401,
    );
  }
  if (!user.isActive) {
    throw new AuthError("USER_INACTIVE", "Аккаунт деактивирован", 403);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const n = await redis.incr(failKey).catch(() => 0);
    if (n === 1)
      redis.expire(failKey, LOGIN_LOCKOUT_WINDOW_SEC).catch(() => {});
    throw new AuthError(
      "INVALID_CREDENTIALS",
      "Неверный email или пароль",
      401,
    );
  }

  // Успешный вход — сбрасываем счётчик
  redis.del(failKey).catch(() => {});

  // 2FA: если включён — сигнализируем route-handler, токены не выдаём
  if (user.totpEnabled) {
    return { user, tokens: {} as TokenPair, totpRequired: true };
  }

  const tokens = await issueTokens(user);
  return { user, tokens, totpRequired: false };
}

// ============================================================
// Refresh — ротация токенов
// ============================================================
export async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError("INVALID_REFRESH", "Невалидный refresh-токен", 401);
  }

  const valid = await isRefreshTokenValid(payload.sub, payload.jti);
  if (!valid) {
    throw new AuthError(
      "REVOKED_REFRESH",
      "Refresh-токен отозван или истёк",
      401,
    );
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new AuthError("USER_NOT_FOUND", "Пользователь не найден", 404);
  }

  // Ротация: инвалидируем старый, выдаём новый
  await revokeRefreshToken(payload.sub, payload.jti);
  return issueTokens(user);
}

// ============================================================
// Выход (текущий или все устройства)
// ============================================================
export async function logout(
  userId: string,
  jti: string | null,
  allDevices = false,
): Promise<void> {
  if (allDevices) {
    await revokeAllUserTokens(userId);
  } else if (jti) {
    await revokeRefreshToken(userId, jti);
  }
}

// ============================================================
// Обновление локали
// ============================================================
export async function updateLocale(
  userId: string,
  locale: "ru" | "kk" | "en",
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { preferredLocale: locale },
  });
}

export async function updateMeProfile(
  userId: string,
  input: UpdateMeProfileInput,
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.surname !== undefined && { surname: input.surname.trim() }),
      ...(input.nameLatin !== undefined && {
        nameLatin: input.nameLatin?.trim() || null,
      }),
      ...(input.surnameLatin !== undefined && {
        surnameLatin: input.surnameLatin?.trim() || null,
      }),
      ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      ...(input.preferredLocale !== undefined && {
        preferredLocale: input.preferredLocale,
      }),
      ...(input.city !== undefined && { city: input.city?.trim() || null }),
      ...(input.education !== undefined && {
        education: input.education?.trim() || null,
      }),
      ...(input.coachCategory !== undefined && {
        coachCategory: input.coachCategory?.trim() || null,
      }),
      ...(input.coachExperienceYears !== undefined && {
        coachExperienceYears: input.coachExperienceYears,
      }),
      ...(input.coachTitle !== undefined && {
        coachTitle: input.coachTitle?.trim() || null,
      }),
    },
  });
}

export async function cancelMyRegistration(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          applicationEntries: true,
          redmatches: true,
          bluematches: true,
          wonMatches: true,
          ratingEntries: true,
          createdClubs: true,
          createdTournaments: true,
          tatamiSessions: true,
        },
      },
    },
  });
  if (!user)
    throw new AuthError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (user.role === UserRole.ADMIN) {
    throw new AuthError(
      "ADMIN_CANNOT_CANCEL_REGISTRATION",
      "Админ аккаунтын бұлай жоюға болмайды",
      400,
    );
  }

  const used =
    user._count.applicationEntries +
    user._count.redmatches +
    user._count.bluematches +
    user._count.wonMatches +
    user._count.ratingEntries +
    user._count.createdClubs +
    user._count.createdTournaments +
    user._count.tatamiSessions;
  if (used > 0) {
    throw new AuthError(
      "ACCOUNT_ALREADY_USED",
      "Бұл аккаунт жүйеде қолданылып қойған. Оны жою үшін әкімшіге хабарласыңыз.",
      409,
    );
  }

  await revokeAllUserTokens(userId);
  await prisma.user.delete({ where: { id: userId } });
}

export async function upsertMyDocument(
  userId: string,
  input: UpsertUserDocumentInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user)
    throw new AuthError("USER_NOT_FOUND", "Пользователь не найден", 404);

  if (!input.url.startsWith(`private:documents/${userId}/`)) {
    throw new AuthError(
      "INVALID_DOCUMENT_REFERENCE",
      "Құжат сілтемесі осы пайдаланушыға тиесілі емес",
      400,
    );
  }

  if (input.type === "COACH_ID" && user.role !== UserRole.COACH) {
    throw new AuthError(
      "INVALID_DOCUMENT_TYPE",
      "Бұл құжат тек жаттықтырушыға арналған",
      400,
    );
  }
  if (input.type !== "COACH_ID" && user.role !== UserRole.ATHLETE) {
    throw new AuthError(
      "INVALID_DOCUMENT_TYPE",
      "Бұл құжат тек спортшыға арналған",
      400,
    );
  }

  return prisma.userDocument.upsert({
    where: { userId_type: { userId, type: input.type } },
    create: {
      userId,
      type: input.type,
      url: input.url,
      originalName: input.originalName?.trim() || null,
      mimeType: input.mimeType?.trim() || null,
      sizeBytes: input.sizeBytes ?? null,
      uploadedById: userId,
    },
    update: {
      url: input.url,
      originalName: input.originalName?.trim() || null,
      mimeType: input.mimeType?.trim() || null,
      sizeBytes: input.sizeBytes ?? null,
      uploadedById: userId,
    },
  });
}

// ============================================================
// Утилиты
// ============================================================
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
}

async function issueTokens(user: User): Promise<TokenPair> {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const { token: refreshToken, jti } = signRefreshToken(user.id);
  await storeRefreshToken(user.id, jti);
  return { accessToken, refreshToken, refreshJti: jti };
}

/** Сериализация пользователя без секретов */
export function publicUser(user: User) {
  const { passwordHash: _drop, ...safe } = user;
  return safe;
}
