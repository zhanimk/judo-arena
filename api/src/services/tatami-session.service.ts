/**
 * Сервис TatamiSession — сессия судьи на целый татами.
 *
 * Админ создаёт одну сессию на татами → судья получает URL `/tatami/:token`.
 * Через эту ссылку судья работает весь день: видит текущий матч, очередь,
 * и после завершения матча автоматически переходит к следующему.
 *
 * Токен действует 24 часа (по умолчанию), привязан к турниру + номер татами.
 * Автоматически считается истёкшим, если турнир завершился более 2 часов назад.
 */

import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { MatchStatus, UserRole } from "@prisma/client";

export class TatamiSessionError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "TatamiSessionError";
  }
}

export interface CreateTatamiSessionInput {
  tatamiNumber: number;
  judgeName?: string;
  ttlHours?: number;
}

/** Создать сессию на татами (только ADMIN). */
export async function createTatamiSession(
  actorUserId: string,
  tournamentId: string,
  input: CreateTatamiSessionInput,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new TatamiSessionError(
      "FORBIDDEN",
      "Создавать сессии может только админ",
      403,
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) {
    throw new TatamiSessionError(
      "TOURNAMENT_NOT_FOUND",
      "Турнир не найден",
      404,
    );
  }
  if (input.tatamiNumber < 1 || input.tatamiNumber > tournament.tatamiCount) {
    throw new TatamiSessionError(
      "INVALID_TATAMI",
      `Татами ${input.tatamiNumber} не существует (макс. ${tournament.tatamiCount})`,
    );
  }

  // Отзываем все предыдущие активные сессии на этом татами
  await prisma.tatamiSession.updateMany({
    where: {
      tournamentId,
      tatamiNumber: input.tatamiNumber,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    data: { isRevoked: true },
  });

  const token = nanoid(32);
  const ttlHours = input.ttlHours ?? 24; // 24 часа по умолчанию (один турнирный день)
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return prisma.tatamiSession.create({
    data: {
      token,
      tournamentId,
      tatamiNumber: input.tatamiNumber,
      judgeName: input.judgeName,
      createdById: actorUserId,
      expiresAt,
    },
  });
}

/** Валидировать токен татами-сессии и вернуть текущий матч + очередь. */
export async function getValidTatamiSession(token: string) {
  const session = await prisma.tatamiSession.findUnique({
    where: { token },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          tatamiCount: true,
          status: true,
          endDate: true,
        },
      },
    },
  });

  if (!session)
    throw new TatamiSessionError("INVALID_TOKEN", "Невалидный токен", 401);
  if (session.isRevoked)
    throw new TatamiSessionError("REVOKED", "Сессия отозвана", 403);
  if (session.expiresAt < new Date()) {
    throw new TatamiSessionError("EXPIRED", "Срок действия сессии истёк", 403);
  }

  // Auto-invalidate: турнир завершён более 2 часов назад → сессия больше не нужна
  if (session.tournament.status === "COMPLETED" && session.tournament.endDate) {
    const tournamentEndedMs = session.tournament.endDate.getTime();
    const gracePeriodMs = 2 * 60 * 60 * 1000; // 2 часа grace period
    if (Date.now() > tournamentEndedMs + gracePeriodMs) {
      // Отзываем сессию в фоне (не блокируем ответ)
      prisma.tatamiSession
        .update({ where: { id: session.id }, data: { isRevoked: true } })
        .catch(() => {});
      throw new TatamiSessionError(
        "TOURNAMENT_ENDED",
        "Турнир завершён — сессия судьи деактивирована",
        403,
      );
    }
  }

  // Текущий матч (IN_PROGRESS) или первый PENDING
  const currentMatch = await prisma.match.findFirst({
    where: {
      tournamentId: session.tournamentId,
      tatamiNumber: session.tatamiNumber,
      status: MatchStatus.IN_PROGRESS,
    },
    include: {
      redAthlete: {
        select: {
          id: true,
          name: true,
          surname: true,
          clubId: true,
          club: { select: { name: true, shortName: true } },
        },
      },
      blueAthlete: {
        select: {
          id: true,
          name: true,
          surname: true,
          clubId: true,
          club: { select: { name: true, shortName: true } },
        },
      },
      bracket: { include: { category: true } },
    },
  });

  // Если нет IN_PROGRESS — берём первый PENDING
  const nextMatch = currentMatch
    ? null
    : await prisma.match.findFirst({
        where: {
          tournamentId: session.tournamentId,
          tatamiNumber: session.tatamiNumber,
          status: MatchStatus.PENDING,
          // Только матчи с обоими спортсменами
          redAthleteId: { not: null },
          blueAthleteId: { not: null },
        },
        orderBy: [
          { queuePosition: "asc" },
          { round: "asc" },
          { position: "asc" },
        ],
        include: {
          redAthlete: {
            select: {
              id: true,
              name: true,
              surname: true,
              clubId: true,
              club: { select: { name: true, shortName: true } },
            },
          },
          blueAthlete: {
            select: {
              id: true,
              name: true,
              surname: true,
              clubId: true,
              club: { select: { name: true, shortName: true } },
            },
          },
          bracket: { include: { category: true } },
        },
      });

  // Очередь (следующие 10 PENDING матчей после текущего)
  const queue = await prisma.match.findMany({
    where: {
      tournamentId: session.tournamentId,
      tatamiNumber: session.tatamiNumber,
      status: MatchStatus.PENDING,
      redAthleteId: { not: null },
      blueAthleteId: { not: null },
      // Если есть текущий IN_PROGRESS — все PENDING; если нет — пропускаем первый (он nextMatch)
      ...(nextMatch ? { id: { not: nextMatch.id } } : {}),
    },
    orderBy: [{ queuePosition: "asc" }, { round: "asc" }, { position: "asc" }],
    take: 10,
    include: {
      redAthlete: { select: { id: true, name: true, surname: true } },
      blueAthlete: { select: { id: true, name: true, surname: true } },
      bracket: { include: { category: true } },
    },
  });

  // Статистика: сколько завершено / всего
  const [completedCount, totalCount] = await Promise.all([
    prisma.match.count({
      where: {
        tournamentId: session.tournamentId,
        tatamiNumber: session.tatamiNumber,
        status: MatchStatus.COMPLETED,
      },
    }),
    prisma.match.count({
      where: {
        tournamentId: session.tournamentId,
        tatamiNumber: session.tatamiNumber,
      },
    }),
  ]);

  return {
    session: {
      id: session.id,
      token: session.token,
      tournamentId: session.tournamentId,
      tatamiNumber: session.tatamiNumber,
      judgeName: session.judgeName,
      expiresAt: session.expiresAt,
    },
    tournament: session.tournament,
    currentMatch: currentMatch || nextMatch,
    queue,
    stats: {
      completed: completedCount,
      total: totalCount,
      remaining: totalCount - completedCount,
    },
  };
}

/** Отозвать сессию (ADMIN). */
export async function revokeTatamiSession(
  actorUserId: string,
  sessionId: string,
): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new TatamiSessionError(
      "FORBIDDEN",
      "Только админ может отзывать сессии",
      403,
    );
  }
  const session = await prisma.tatamiSession.findUnique({
    where: { id: sessionId },
  });
  if (!session)
    throw new TatamiSessionError("NOT_FOUND", "Сессия не найдена", 404);
  await prisma.tatamiSession.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });
}

/** Список активных сессий для турнира (ADMIN). */
export async function listTatamiSessions(tournamentId: string) {
  return prisma.tatamiSession.findMany({
    where: {
      tournamentId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { tatamiNumber: "asc" },
  });
}
