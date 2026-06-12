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
  type MatchEvent,
} from "@prisma/client";
import {
  MatchError,
  ScoreSnapshot,
  normalizeScore,
  stopClock,
  markPendingResult,
  emptyScore,
  UNDOABLE_TYPES,
  scoreToJson,
} from "./match-types.js";
import { cancelOsaekomiTimer } from "./osaekomi-timer.service.js";
import {
  scheduleGoldenScoreTimer,
  cancelGoldenScoreTimer,
} from "./golden-score-timer.service.js";
import { propagateWinner } from "./match-propagation.js";

// ============================================================
// СТАРТ / ПАУЗА / ЗОЛОТОЙ СЧЁТ
// ============================================================

export async function startMatch(
  matchId: string,
  judgeSessionId?: string,
): Promise<{ match: Match; event: MatchEvent }> {
  // Вся логика внутри транзакции — гарантирует атомарность проверки татами и старта.
  // Без этого два арбитра могут пройти проверку одновременно и запустить два матча на одном татами.
  const { match: updated, event } = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
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
      const activeOnTatami = await tx.match.findFirst({
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

    const [updatedMatch, createdEvent] = await Promise.all([
      tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.IN_PROGRESS,
          startedAt: match.startedAt ?? now,
          scoreSnapshot: scoreToJson(score),
        },
      }),
      tx.matchEvent.create({
        data: {
          matchId,
          type: MatchEventType.HAJIME,
          side: MatchSide.SYSTEM,
          actorJudgeSessionId: judgeSessionId,
          scoreSnapshot: scoreToJson(score),
        },
      }),
    ]);

    return { match: updatedMatch, event: createdEvent };
  });

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
      data: { scoreSnapshot: scoreToJson(score) },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.MATE,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: scoreToJson(score),
      },
    }),
  ]);
  return { match: updated, event };
}

export async function enterGoldenScore(
  matchId: string,
  judgeSessionId?: string,
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      bracket: { include: { category: { select: { goldenScoreSec: true } } } },
    },
  });
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
  const goldenScoreStartedAt = new Date().toISOString();

  const [updated, event] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        isGoldenScore: true,
        goldenScoreStartedAt: new Date(),
        scoreSnapshot: scoreToJson(score),
      },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.GOLDEN_SCORE,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: scoreToJson(score),
      },
    }),
  ]);

  // Запускаем серверный таймер — если категория задаёт лимит golden score
  const goldenScoreSec = match.bracket.category.goldenScoreSec;
  if (goldenScoreSec > 0) {
    scheduleGoldenScoreTimer(matchId, goldenScoreSec, goldenScoreStartedAt);
  }

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
  if (match.status === MatchStatus.PENDING) {
    throw new MatchError("MATCH_NOT_STARTED", "Матч ещё не начат", 409);
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
      data: { scoreSnapshot: scoreToJson(score), version: { increment: 1 } },
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
        scoreSnapshot: scoreToJson(score),
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
  // ⚠️ Читаем и обновляем ВНУТРИ одной транзакции с атомарной проверкой статуса.
  // updateMany с WHERE status ≠ COMPLETED гарантирует: если два запроса придут
  // одновременно, только первый успешно обновит (count=1), второй получит count=0
  // и выбросит ошибку — race condition невозможен.
  const updated = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
    if (match.status === MatchStatus.COMPLETED) {
      throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
    }

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

    // Атомарно: обновляем только если статус ещё не COMPLETED
    const updateResult = await tx.match.updateMany({
      where: { id: matchId, status: { not: MatchStatus.COMPLETED } },
      data: {
        status: MatchStatus.COMPLETED,
        winnerId,
        finishedAt: new Date(),
        scoreSnapshot: scoreToJson(score),
      },
    });

    if (updateResult.count === 0) {
      throw new MatchError(
        "ALREADY_COMPLETED",
        "Матч уже завершён другим судьёй",
        409,
      );
    }

    await tx.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.SORE_MADE,
        side: winnerSide === "RED" ? MatchSide.RED : MatchSide.BLUE,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: scoreToJson(score),
        meta: { confirmed: true, pendingResult: pendingSnapshot },
      },
    });

    return tx.match.findUniqueOrThrow({ where: { id: matchId } });
  });

  cancelOsaekomiTimer(matchId);
  cancelGoldenScoreTimer(matchId);
  await propagateWinner(updated, updated.winnerId!);
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
        scoreSnapshot: scoreToJson(score),
        meta: { cancelledPendingResult: true },
      },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: scoreToJson(score) },
    }),
  ]);
  return updated;
}

// ============================================================
// FORFEIT / NO-SHOW
// ============================================================

/**
 * Засчитывает победу сопернику когда один из спортсменов не явился или отказался.
 * Матч не обязательно должен быть IN_PROGRESS — достаточно PENDING.
 * Причина записывается в scoreSnapshot.pendingResult.reason и в MatchEvent.
 */
export async function forfeitMatch(
  matchId: string,
  forfeitSide: "RED" | "BLUE",
  reason: "NO_SHOW" | "INJURY" | "DISQUALIFIED" | "WITHDREW",
  judgeSessionId?: string,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError(
      "INCOMPLETE_PAIRING",
      "В матче нет обоих участников",
      409,
    );
  }

  // Победитель — соперник проигравшего
  const winnerId =
    forfeitSide === "RED" ? match.blueAthleteId : match.redAthleteId;
  const winnerSide = forfeitSide === "RED" ? "BLUE" : "RED";

  const score = normalizeScore(match.scoreSnapshot);
  stopClock(score);
  score.osaekomi = null;
  score.pendingResult = null;

  const now = new Date();

  // Атомарная проверка: обновляем только если ещё не COMPLETED
  const updated = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.match.updateMany({
      where: { id: matchId, status: { not: MatchStatus.COMPLETED } },
      data: {
        status: MatchStatus.COMPLETED,
        winnerId,
        finishedAt: now,
        startedAt: match.startedAt ?? now,
        scoreSnapshot: scoreToJson(score),
      },
    });

    if (updateResult.count === 0) {
      throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
    }

    await tx.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.SORE_MADE,
        side: winnerSide === "RED" ? MatchSide.RED : MatchSide.BLUE,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: scoreToJson(score),
        meta: { forfeit: true, forfeitSide, reason },
      },
    });

    return tx.match.findUniqueOrThrow({ where: { id: matchId } });
  });

  cancelGoldenScoreTimer(matchId);
  await propagateWinner(updated, winnerId);
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
        scoreSnapshot: scoreToJson(restored),
        meta: {
          undo: true,
          undoneType: lastEvent.type,
          undoneId: lastEvent.id,
        },
      },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: scoreToJson(restored) },
    }),
  ]);

  return updated;
}
