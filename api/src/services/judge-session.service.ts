/**
 * Сервис JudgeSession — одноразовые судейские сессии без аккаунта.
 *
 * Админ создаёт сессию для конкретного матча → получает URL `/judge/:token`.
 * Судья открывает этот URL на телефоне → панель с кнопками IJF.
 * Токен действует ~12 часов, привязан к одному матчу.
 */

import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { UserRole } from "@prisma/client";
import type { CreateJudgeSessionInput } from "../validators/match.schema.js";

export class JudgeSessionError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "JudgeSessionError";
  }
}

export async function createJudgeSession(
  actorUserId: string,
  matchId: string,
  input: CreateJudgeSessionInput,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new JudgeSessionError("FORBIDDEN", "Создавать судейские сессии может только админ", 403);
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new JudgeSessionError("MATCH_NOT_FOUND", "Матч не найден", 404);

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? 12) * 60 * 60 * 1000);

  return prisma.judgeSession.create({
    data: {
      matchId,
      token,
      judgeName: input.judgeName,
      expiresAt,
    },
  });
}

/** Найти валидную сессию по токену (без auth). */
export async function getValidSession(token: string) {
  const session = await prisma.judgeSession.findUnique({
    where: { token },
    include: {
      match: {
        include: {
          redAthlete: { select: { id: true, name: true, surname: true, clubId: true } },
          blueAthlete: { select: { id: true, name: true, surname: true, clubId: true } },
          bracket: { include: { category: true } },
          tournament: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!session) throw new JudgeSessionError("INVALID_TOKEN", "Невалидный токен", 401);
  if (session.isRevoked) throw new JudgeSessionError("REVOKED", "Сессия отозвана", 403);
  if (session.expiresAt < new Date()) {
    throw new JudgeSessionError("EXPIRED", "Срок действия токена истёк", 403);
  }
  return session;
}

export async function revokeSession(actorUserId: string, sessionId: string): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new JudgeSessionError("FORBIDDEN", "Только админ может отзывать сессии", 403);
  }
  await prisma.judgeSession.update({ where: { id: sessionId }, data: { isRevoked: true } });
}
