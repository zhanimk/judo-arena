/**
 * match-tatami.service.ts — управление очередью татами.
 *
 * Отвечает за назначение матчей на татами, переупорядочивание очереди
 * и получение текущей очереди матчей на конкретном татами.
 */

import { prisma } from "../lib/prisma.js";
import { MatchStatus, type Match } from "@prisma/client";
import { MatchError } from "./match-types.js";

// ============================================================
// ВНУТРЕННИЕ УТИЛИТЫ
// ============================================================

/**
 * Следующая позиция в очереди татами.
 * Экспортируется для использования в match-propagation.ts.
 */
export async function nextQueuePosition(
  tournamentId: string,
  tatamiNumber: number,
): Promise<number> {
  const last = await prisma.match.findFirst({
    where: { tournamentId, tatamiNumber },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  });
  return (last?.queuePosition ?? 0) + 1;
}

// ============================================================
// PUBLIC API
// ============================================================

/** Назначить матч на татами (или снять — передав null). */
export async function assignToTatami(
  matchId: string,
  tatamiNumber: number | null,
  queuePosition?: number,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);

  const nextPosition = tatamiNumber
    ? (queuePosition ??
      (match.tatamiNumber === tatamiNumber ? match.queuePosition : null) ??
      (await nextQueuePosition(match.tournamentId, tatamiNumber)))
    : null;

  return prisma.match.update({
    where: { id: matchId },
    data: { tatamiNumber, queuePosition: nextPosition },
  });
}

/** Переместить матч вверх/вниз в очереди татами. */
export async function reorderTatamiQueue(
  matchId: string,
  direction: "up" | "down",
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (!match.tatamiNumber) {
    throw new MatchError(
      "MATCH_NOT_ASSIGNED",
      "Матч не назначен на татами",
      409,
    );
  }
  if (match.status !== MatchStatus.PENDING) {
    throw new MatchError(
      "MATCH_NOT_PENDING",
      "Двигать можно только матч в ожидании",
      409,
    );
  }

  const queue = await prisma.match.findMany({
    where: {
      tournamentId: match.tournamentId,
      tatamiNumber: match.tatamiNumber,
      status: MatchStatus.PENDING,
    },
    orderBy: [{ queuePosition: "asc" }, { round: "asc" }, { position: "asc" }],
  });

  const index = queue.findIndex((item) => item.id === matchId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= queue.length) return match;

  // Нормализуем позиции всей очереди, затем свапаем нужные два
  await prisma.$transaction(
    queue.map((item, idx) =>
      prisma.match.update({
        where: { id: item.id },
        data: { queuePosition: idx + 1 },
      }),
    ),
  );

  const current = queue[index]!;
  const other = queue[swapIndex]!;
  await prisma.$transaction([
    prisma.match.update({
      where: { id: current.id },
      data: { queuePosition: swapIndex + 1 },
    }),
    prisma.match.update({
      where: { id: other.id },
      data: { queuePosition: index + 1 },
    }),
  ]);

  return prisma.match.findUniqueOrThrow({ where: { id: matchId } });
}

/** Текущая очередь матчей на татами (PENDING + IN_PROGRESS). */
export async function getTatamiQueue(
  tournamentId: string,
  tatamiNumber: number,
) {
  return prisma.match.findMany({
    where: {
      tournamentId,
      tatamiNumber,
      status: { in: [MatchStatus.PENDING, MatchStatus.IN_PROGRESS] },
    },
    orderBy: [
      { status: "desc" },
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
          avatarUrl: true,
          club: { select: { name: true, shortName: true, country: true } },
        },
      },
      blueAthlete: {
        select: {
          id: true,
          name: true,
          surname: true,
          avatarUrl: true,
          club: { select: { name: true, shortName: true, country: true } },
        },
      },
      bracket: { include: { category: true } },
    },
  });
}
