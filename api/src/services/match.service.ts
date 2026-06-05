/**
 * match.service.ts — barrel re-export + read-only запросы.
 *
 * Весь код матчей разбит по модулям для удобства навигации и тестирования:
 *
 *   match-types.ts            — ScoreSnapshot, MatchError, pure helpers
 *   match-lifecycle.service.ts — startMatch, pauseMatch, enterGoldenScore,
 *                                finishMatchManually, confirmMatchResult,
 *                                cancelPendingResult, undoLastScoreEvent
 *   match-score.service.ts     — addScoreEvent, startOsaekomi, endOsaekomi
 *   match-propagation.ts       — propagateWinner, clearDownstreamRecursive
 *   match-tatami.service.ts    — assignToTatami, reorderTatamiQueue, getTatamiQueue
 *
 * Этот файл экспортирует всё из модулей (backward-compatible barrel).
 * Внешний код продолжает импортировать из "match.service.js" без изменений.
 */

import { prisma } from "../lib/prisma.js";
import { MatchStatus } from "@prisma/client";
import { Prisma, BracketFormat } from "@prisma/client";
import { MatchError } from "./match-types.js";
import { clearDownstreamRecursive } from "./match-propagation.js";

// ── Re-exports ────────────────────────────────────────────────────────────────
export * from "./match-types.js";
export * from "./match-lifecycle.service.js";
export * from "./match-score.service.js";
export * from "./match-tatami.service.js";
// propagateWinner и clearDownstreamRecursive — внутренние; не реэкспортируем

// ============================================================
// READ — запросы (остаются здесь как точка входа)
// ============================================================

export async function getMatch(matchId: string) {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      redAthlete: {
        select: {
          id: true,
          name: true,
          surname: true,
          clubId: true,
          avatarUrl: true,
          club: { select: { name: true, shortName: true, country: true } },
        },
      },
      blueAthlete: {
        select: {
          id: true,
          name: true,
          surname: true,
          clubId: true,
          avatarUrl: true,
          club: { select: { name: true, shortName: true, country: true } },
        },
      },
      winner: {
        select: { id: true, name: true, surname: true, avatarUrl: true },
      },
      bracket: { include: { category: true } },
      tournament: { select: { id: true, name: true, status: true } },
      events: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!m) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  return m;
}

export async function listMatches(query: {
  tournamentId?: string;
  bracketId?: string;
  athleteId?: string;
  tatamiNumber?: number;
  status?: MatchStatus;
  limit: number;
  offset: number;
}) {
  const where: any = {};
  if (query.tournamentId) where.tournamentId = query.tournamentId;
  if (query.bracketId) where.bracketId = query.bracketId;
  if (query.athleteId) {
    where.OR = [
      { redAthleteId: query.athleteId },
      { blueAthleteId: query.athleteId },
    ];
  }
  if (query.tatamiNumber !== undefined) where.tatamiNumber = query.tatamiNumber;
  if (query.status) where.status = query.status;

  return prisma.match.findMany({
    where,
    take: query.limit,
    skip: query.offset,
    orderBy: [
      { tatamiNumber: "asc" },
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
      bracket: {
        select: { id: true, format: true, categoryId: true, category: true },
      },
      tournament: {
        select: { id: true, name: true, status: true, startDate: true },
      },
    },
  });
}

// ============================================================
// ADMIN: RESET МАТЧА
// ============================================================

/**
 * Сбросить матч к PENDING.
 * Очищает score, events, winner; если winner propagated — откатываем downstream.
 */
export async function resetMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { bracket: true },
  });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status === MatchStatus.PENDING) {
    throw new MatchError("ALREADY_PENDING", "Матч уже в ожидании", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError("INCOMPLETE_PAIRING", "Нет участников", 409);
  }

  if (
    match.status === MatchStatus.COMPLETED &&
    match.winnerId &&
    match.bracket.format !== BracketFormat.ROUND_ROBIN
  ) {
    const loserId =
      match.redAthleteId === match.winnerId
        ? match.blueAthleteId
        : match.redAthleteId;
    await clearDownstreamRecursive(match.bracketId, match.winnerId, match.id);
    if (loserId) {
      await clearDownstreamRecursive(match.bracketId, loserId, match.id);
    }
  }

  await prisma.matchEvent.deleteMany({ where: { matchId } });
  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: MatchStatus.PENDING,
      winnerId: null,
      scoreSnapshot: Prisma.JsonNull,
      startedAt: null,
      finishedAt: null,
      isGoldenScore: false,
      isReplay: true,
      replayReason: "Матч қайта басталды",
    },
  });
}
