/**
 * Сервис аутентификации — вся бизнес-логика регистрации, входа, обновления токенов.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
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
import type { RegisterInput, LoginInput, UpdateMeProfileInput } from "../validators/auth.schema.js";
import { ClubRole, UserRole, type User } from "@prisma/client";

// ============================================================
// Ошибки сервиса (выбрасываем — handler их ловит и преобразует в HTTP)
// ============================================================
export class AuthError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "AuthError";
  }
}

// ============================================================
// Регистрация
// ============================================================
export async function register(input: RegisterInput): Promise<{ user: User; tokens: TokenPair }> {
  // Проверка уникальности email
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError("EMAIL_TAKEN", "Email уже зарегистрирован", 409);
  }

  // Если указан clubId — проверить что клуб существует
  if (input.clubId) {
    const club = await prisma.club.findUnique({ where: { id: input.clubId } });
    if (!club) throw new AuthError("CLUB_NOT_FOUND", "Клуб не найден", 404);
    if (input.role === UserRole.COACH) {
      throw new AuthError("COACH_CLUB_REQUIRES_REQUEST", "Тренер должен отправить заявку на вступление в клуб", 400);
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
      clubRole: input.role === UserRole.COACH && input.clubId ? ClubRole.COACH : undefined,
    },
  });

  const tokens = await issueTokens(user);
  return { user, tokens };
}

// ============================================================
// Вход
// ============================================================
export async function login(input: LoginInput): Promise<{ user: User; tokens: TokenPair }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  if (!user) {
    // Не сообщаем что email не найден (защита от перебора)
    throw new AuthError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
  }
  if (!user.isActive) {
    throw new AuthError("USER_INACTIVE", "Аккаунт деактивирован", 403);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
  }

  const tokens = await issueTokens(user);
  return { user, tokens };
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
    throw new AuthError("REVOKED_REFRESH", "Refresh-токен отозван или истёк", 401);
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
export async function logout(userId: string, jti: string | null, allDevices = false): Promise<void> {
  if (allDevices) {
    await revokeAllUserTokens(userId);
  } else if (jti) {
    await revokeRefreshToken(userId, jti);
  }
}

// ============================================================
// Обновление локали
// ============================================================
export async function updateLocale(userId: string, locale: "ru" | "kk" | "en"): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { preferredLocale: locale } });
}

export async function updateMeProfile(userId: string, input: UpdateMeProfileInput): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.surname !== undefined && { surname: input.surname.trim() }),
      ...(input.nameLatin !== undefined && { nameLatin: input.nameLatin?.trim() || null }),
      ...(input.surnameLatin !== undefined && { surnameLatin: input.surnameLatin?.trim() || null }),
      ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      ...(input.preferredLocale !== undefined && { preferredLocale: input.preferredLocale }),
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
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refreshToken, jti } = signRefreshToken(user.id);
  await storeRefreshToken(user.id, jti);
  return { accessToken, refreshToken, refreshJti: jti };
}

/** Сериализация пользователя без секретов */
export function publicUser(user: User) {
  const { passwordHash: _drop, ...safe } = user;
  return safe;
}
