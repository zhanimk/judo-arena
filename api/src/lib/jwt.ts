/**
 * JWT-утилиты: подпись и верификация Access/Refresh токенов.
 * Refresh-токены хранятся в Redis (см. lib/refresh-store.ts) для возможности отзыва.
 */

import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { env } from "./env.js";
import type { UserRole } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;          // user.id
  email: string;
  role: UserRole;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;          // user.id
  jti: string;          // уникальный ID токена (для отзыва через Redis)
  type: "refresh";
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(sub: string): { token: string; jti: string } {
  const jti = nanoid(24);
  const token = jwt.sign({ sub, jti, type: "refresh" } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
  }) as AccessTokenPayload;
  if (decoded.type !== "access") {
    throw new Error("Invalid token type");
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"],
  }) as RefreshTokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return decoded;
}

/** Парсинг TTL вида "15m", "7d" → секунды (для Redis) */
export function parseTTLToSeconds(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 0;
  const value = parseInt(m[1]!, 10);
  const unit = m[2]!;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 0);
}
