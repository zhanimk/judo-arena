/**
 * match-lifecycle.service.ts — жизненный цикл матча.
 *
 * Содержит:
 *   startMatch, pauseMatch, enterGoldenScore,
 *   finishMatchManually, confirmMatchResult,
 *   cancelPendingResult, undoLastScoreEvent
 */

import { prisma } from "../lib/prisma.js";
import {
  MatchStatus,
  MatchEventType,
  MatchSide,
  type Match,
} from "@prisma/client";
import {
  MatchError,
  ScoreSnapshot,
  normalizeScore,
  stopClock,
  markPendingResult,
  emptyScore,
  UNDOABLE_TYPES,
} from "./match-types.js";
import { cancelOsaekomiTimer } from "./osaekomi-timer.service.js";
import { propagateWinner } from "./match-propagation.js";

// ============================================================
// СТАРТ / ПАУЗА / ЗОЛОТОЙ СЧЁТ
// ============================================================

export async function startMatch(
  matchId: string,
  judgeSessionId?: string,
): Promise<{ match: Match; event: any }> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  const now = new Date();
  const score = normalizeScore(match.scoreSnapshot);

  if (score.pendingResult) {
    throw new MatchError(
      "RESULT_PENDING",
      "Сначала утвердите или сбросьте результат схватки",
      409,
    );
  }
  if (match.status === MatchStatus.IN_PROGRESS && score.clock.running) {
    throw new MatchError("ALREADY_RUNNING", "Матч уже идёт", 409);
  }
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError(
      "INCOMPLETE_PAIRING",
      "В матче не хватает участников",
      409,
    );
  }
  if (match.tatamiNumber) {
    const activeOnTatami = await prisma.match.findFirst({
      where: {
        id: { not: match.id },
        tournamentId: match.tournamentId,
        tatamiNumber: match.tatamiNumber,
        status: MatchStatus.IN_PROGRESS,
      },
      select: { id: true, queuePosition: true },
    });
    if (activeOnTatami) {
      throw new MatchError(
        "TATAMI_BUSY",
        "На этом татами уже идёт схватка",
        409,
      );
    }
  }

  score.clock.running = true;
  score.clock.runningStartedAt = now.toISOString();

  const [updated, event] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: match.startedAt ?? now,
        scoreSnapshot: score as any,
      },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.HAJIME,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
      },
    }),
  ]);

  return { match: updated, event };
}

export async function pauseMatch(matchId: string, judgeSessionId?: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }
  const score = normalizeScore(match.scoreSnapshot);
  if (score.pendingResult) {
    throw new MatchError(
      "RESULT_PENDING",
      "Сначала утвердите или сбросьте результат схватки",
      409,
    );
  }
  if (!score.clock.running) {
    throw new MatchError("ALREADY_PAUSED", "Матч уже на паузе", 409);
  }
  stopClock(score);
  if (score.osaekomi) {
    cancelOsaekomiTimer(matchId);
    score.osaekomi = null;
  }

  const [updated, event] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: score as any },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.MATE,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
      },
    }),
  ]);
  return { match: updated, event };
}

export async function enterGoldenScore(
  matchId: string,
  judgeSessionId?: string,
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }
  const score = normalizeScore(match.scoreSnapshot);
  if (score.pendingResult) {
    throw new MatchError(
      "RESULT_PENDING",
      "Сначала утвердите или сбросьте результат схватки",
      409,
    );
  }
  score.isGoldenScore = true;

  const [updated, event] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { isGoldenScore: true, scoreSnapshot: score as any },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.GOLDEN_SCORE,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
      },
    }),
  ]);
  return { match: updated, event };
}

// ============================================================
// ЗАВЕРШЕНИЕ МАТЧА
// ============================================================

export async function finishMatchManually(
  matchId: string,
  winnerSide: "RED" | "BLUE",
  reason?: string,
  judgeSessionId?: string,
  expectedVersion?: number,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError("INCOMPLETE_PAIRING", "Нет участников", 409);
  }
  const winnerId =
    winnerSide === "RED" ? match.redAthleteId : match.blueAthleteId;
  const score = normalizeScore(match.scoreSnapshot);
  if (score.pendingResult) {
    throw new MatchError(
      "RESULT_PENDING",
      "Результат уже ожидает утверждения",
      409,
    );
  }
  markPendingResult(
    score,
    winnerSide,
    winnerId,
    reason ?? "Судья шешімі",
    judgeSessionId ?? "system",
  );

  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.match.updateMany({
      where: {
        id: matchId,
        ...(expectedVersion !== undefined && { version: expectedVersion }),
      },
      data: { scoreSnapshot: score as any, version: { increment: 1 } },
    });
    if (expectedVersion !== undefined && updateResult.count === 0) {
      throw new MatchError(
        "CONCURRENT_MODIFICATION",
        "Матч изменён другим судьёй. Обновите страницу.",
        409,
      );
    }
    await tx.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.SORE_MADE,
        side: winnerSide === "RED" ? MatchSide.RED : MatchSide.BLUE,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
        meta: reason ? { reason } : undefined,
      },
    });
    return tx.match.findUniqueOrThrow({ where: { id: matchId } });
  });
}

export async function confirmMatchResult(
  matchId: string,
  judgeSessionId?: string,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  cancelOsaekomiTimer(matchId);
  const score = stopClock(normalizeScore(match.scoreSnapshot));
  if (!score.pendingResult) {
    throw new MatchError(
      "NO_PENDING_RESULT",
      "Нет результата для утверждения",
      409,
    );
  }
  const winnerId = score.pendingResult.winnerId;
  const winnerSide = score.pendingResult.winnerSide;
  const pendingSnapshot = { ...score.pendingResult };
  score.pendingResult = null;

  const [, updated] = await prisma.$transaction([
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.SORE_MADE,
        side: winnerSide === "RED" ? MatchSide.RED : MatchSide.BLUE,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
        meta: { confirmed: true, pendingResult: pendingSnapshot },
      },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        winnerId,
        finishedAt: new Date(),
        scoreSnapshot: score as any,
      },
    }),
  ]);

  await propagateWinner(updated, winnerId);
  return updated;
}

// ============================================================
// ОТМЕНА ОЖИДАЮЩЕГО РЕЗУЛЬТАТА
// ============================================================

export async function cancelPendingResult(
  matchId: string,
  judgeSessionId?: string,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не IN_PROGRESS", 409);
  }
  const score = normalizeScore(match.scoreSnapshot);
  if (!score.pendingResult) {
    throw new MatchError("NO_PENDING_RESULT", "Нет ожидающего результата", 409);
  }
  score.pendingResult = null;

  const [, updated] = await prisma.$transaction([
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.MATE,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
        meta: { cancelledPendingResult: true },
      },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: score as any },
    }),
  ]);
  return updated;
}

// ============================================================
// UNDO ПОСЛЕДНЕГО ДЕЙСТВИЯ
// ============================================================

export async function undoLastScoreEvent(
  matchId: string,
  judgeSessionId?: string,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не IN_PROGRESS", 409);
  }

  const events = await prisma.matchEvent.findMany({
    where: {
      matchId,
      type: { in: UNDOABLE_TYPES as unknown as MatchEventType[] },
    },
    orderBy: { occurredAt: "asc" },
  });

  if (events.length === 0) {
    throw new MatchError("NO_EVENTS", "Нет действий для отмены", 409);
  }

  const lastEvent = events[events.length - 1]!;
  const prevEvent = events.length >= 2 ? events[events.length - 2] : null;

  const prevScore = prevEvent
    ? normalizeScore(prevEvent.scoreSnapshot)
    : emptyScore();
  const currentScore = normalizeScore(match.scoreSnapshot);

  const restored: ScoreSnapshot = {
    red: prevScore.red,
    blue: prevScore.blue,
    isGoldenScore: prevScore.isGoldenScore,
    pendingResult: null,
    clock: currentScore.clock,
    osaekomi: currentScore.osaekomi,
  };

  const [, , updated] = await prisma.$transaction([
    prisma.matchEvent.delete({ where: { id: lastEvent.id } }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.MATE,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: restored as any,
        meta: {
          undo: true,
          undoneType: lastEvent.type,
          undoneId: lastEvent.id,
        },
      },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: restored as any },
    }),
  ]);

  return updated;
}
