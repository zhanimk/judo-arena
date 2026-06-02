/**
 * match-score.service.ts — судейские действия (очки, osaekomi).
 *
 * Содержит:
 *   addScoreEvent  — начисление очков и нарушений
 *   startOsaekomi  — начало удержания
 *   endOsaekomi    — окончание удержания (токета или авто-таймер)
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
  normalizeScore,
  markPendingResult,
  osaekomiScore,
} from "./match-types.js";
import {
  scheduleOsaekomiTimer,
  cancelOsaekomiTimer,
} from "./osaekomi-timer.service.js";

// ============================================================
// НАЧИСЛЕНИЕ ОЧКОВ
// ============================================================

export async function addScoreEvent(
  matchId: string,
  type: "IPPON" | "WAZA_ARI" | "YUKO" | "SHIDO" | "HANSOKU_MAKE",
  side: "RED" | "BLUE",
  judgeSessionId?: string,
  expectedVersion?: number,
): Promise<{
  match: Match;
  event: any;
  autoFinished: boolean;
  winnerId: string | null;
}> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError("INCOMPLETE_PAIRING", "Нет участников", 409);
  }

  const score = normalizeScore(match.scoreSnapshot);
  if (score.pendingResult) {
    throw new MatchError(
      "RESULT_PENDING",
      "Сначала утвердите или сбросьте результат схватки",
      409,
    );
  }
  const sideKey = side === "RED" ? "red" : "blue";

  // ── Применяем очко ────────────────────────────────────────
  switch (type) {
    case "IPPON":
      if (score[sideKey].ippon >= 1) {
        throw new MatchError("ALREADY_IPPON", "Ипон уже начислен", 409);
      }
      score[sideKey].ippon = 1;
      break;
    case "WAZA_ARI":
      if (score[sideKey].ippon >= 1) {
        throw new MatchError(
          "ALREADY_IPPON",
          "Ипон уже начислен — ваза-ари нельзя добавить",
          409,
        );
      }
      score[sideKey].wazaari += 1;
      if (score[sideKey].wazaari >= 2) {
        score[sideKey].ippon = 1; // 2 × Waza-ari = Ippon (IJF rule)
      }
      break;
    case "YUKO":
      score[sideKey].yuko += 1;
      break;
    case "SHIDO":
      score[sideKey].shido += 1;
      if (score[sideKey].shido >= 3) score[sideKey].hansoku = true;
      break;
    case "HANSOKU_MAKE":
      score[sideKey].hansoku = true;
      break;
  }

  // ── Авто-определение победителя ───────────────────────────
  let winnerId: string | null = null;
  let autoFinished = false;
  const goldenScorePoint =
    score.isGoldenScore &&
    (type === "IPPON" || type === "WAZA_ARI" || type === "YUKO");
  const redWon =
    score.red.ippon >= 1 ||
    score.blue.hansoku ||
    (goldenScorePoint && side === "RED");
  const blueWon =
    score.blue.ippon >= 1 ||
    score.red.hansoku ||
    (goldenScorePoint && side === "BLUE");

  if (redWon && !blueWon) {
    winnerId = match.redAthleteId;
    autoFinished = true;
  } else if (blueWon && !redWon) {
    winnerId = match.blueAthleteId;
    autoFinished = true;
  }

  if (autoFinished && winnerId) {
    markPendingResult(
      score,
      winnerId === match.redAthleteId ? "RED" : "BLUE",
      winnerId,
      type,
      judgeSessionId ?? "system",
    );
  }

  const eventType: MatchEventType = type as MatchEventType;
  const matchSide: MatchSide = side === "RED" ? MatchSide.RED : MatchSide.BLUE;

  const { event, updated } = await prisma.$transaction(async (tx) => {
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
    const [updatedMatch, createdEvent] = await Promise.all([
      tx.match.findUniqueOrThrow({ where: { id: matchId } }),
      tx.matchEvent.create({
        data: {
          matchId,
          type: eventType,
          side: matchSide,
          actorJudgeSessionId: judgeSessionId,
          scoreSnapshot: score as any,
        },
      }),
    ]);
    return { event: createdEvent, updated: updatedMatch };
  });

  return { match: updated, event, autoFinished, winnerId };
}

// ============================================================
// OSAEKOMI — удержание
// ============================================================

export async function startOsaekomi(
  matchId: string,
  side: "RED" | "BLUE",
  judgeSessionId?: string,
  expectedVersion?: number,
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
  if (score.osaekomi) {
    throw new MatchError("OSAEKOMI_ALREADY", "Удержание уже идёт", 409);
  }

  const osaekomiStartedAt = new Date().toISOString();
  score.osaekomi = { side, startedAt: osaekomiStartedAt };
  const matchSide = side === "RED" ? MatchSide.RED : MatchSide.BLUE;

  const { updated, event } = await prisma.$transaction(async (tx) => {
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
    const [updatedMatch, createdEvent] = await Promise.all([
      tx.match.findUniqueOrThrow({ where: { id: matchId } }),
      tx.matchEvent.create({
        data: {
          matchId,
          type: MatchEventType.OSAEKOMI,
          side: matchSide,
          actorJudgeSessionId: judgeSessionId,
          scoreSnapshot: score as any,
        },
      }),
    ]);
    return { updated: updatedMatch, event: createdEvent };
  });

  // Серверный таймер: авто-завершит osaekomi через 20с если судья не нажал TOKETA
  scheduleOsaekomiTimer(matchId, osaekomiStartedAt);

  return { match: updated, event };
}

export async function endOsaekomi(
  matchId: string,
  reason: "TOKETA" | "TIME_LIMIT",
  judgeSessionId?: string,
  expectedVersion?: number,
): Promise<{
  match: Match;
  durationSec: number;
  scoredType: "IPPON" | "WAZA_ARI" | "YUKO" | null;
  autoFinished: boolean;
  winnerId: string | null;
}> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { bracket: { include: { category: true } } },
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
  if (!score.osaekomi) {
    throw new MatchError("NO_OSAEKOMI", "Удержание не активно", 409);
  }

  const startMs = new Date(score.osaekomi.startedAt).getTime();
  const durationSec = Math.floor((Date.now() - startMs) / 1000);
  const side = score.osaekomi.side;
  const allowYuko = match.bracket.category.allowYuko;

  const scored = osaekomiScore(durationSec, allowYuko);
  let autoFinished = false;
  let winnerId: string | null = null;

  score.osaekomi = null;
  cancelOsaekomiTimer(matchId);

  if (scored) {
    const sideKey = side === "RED" ? "red" : "blue";
    switch (scored.type) {
      case "IPPON":
        score[sideKey].ippon += 1;
        winnerId = side === "RED" ? match.redAthleteId : match.blueAthleteId;
        autoFinished = true;
        break;
      case "WAZA_ARI":
        score[sideKey].wazaari += 1;
        if (score[sideKey].wazaari >= 2) {
          score[sideKey].ippon = Math.max(score[sideKey].ippon, 1);
          winnerId = side === "RED" ? match.redAthleteId : match.blueAthleteId;
          autoFinished = true;
        }
        break;
      case "YUKO":
        score[sideKey].yuko += 1;
        break;
    }
  }

  if (autoFinished && winnerId) {
    markPendingResult(
      score,
      winnerId === match.redAthleteId ? "RED" : "BLUE",
      winnerId,
      scored?.type ?? reason,
      judgeSessionId ?? "system",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
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
        type: MatchEventType.TOKETA,
        side: side === "RED" ? MatchSide.RED : MatchSide.BLUE,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
        meta: { reason, durationSec, scored: scored?.type ?? null },
      },
    });
    return tx.match.findUniqueOrThrow({ where: { id: matchId } });
  });

  return {
    match: updated,
    durationSec,
    scoredType: scored?.type ?? null,
    autoFinished,
    winnerId,
  };
}
