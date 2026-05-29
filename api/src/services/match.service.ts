/**
 * Сервис матчей — старт, пауза, очки, авто-завершение, продвижение по сетке.
 *
 * Правила автоматического определения победителя (IJF rules):
 *   • Ippon          → мгновенная победа
 *   • 2 × Waza-ari   → Ippon → победа
 *   • 3 × Shido      → Hansoku-make → поражение
 *   • Hansoku-make   → поражение
 *
 * После завершения матча — propagateResult() расставляет победителя
 * и проигравшего в следующие матчи (зависит от bracketSection).
 */

import { prisma } from "../lib/prisma.js";
import {
  Prisma,
  MatchStatus,
  MatchEventType,
  MatchSide,
  BracketFormat,
  type Match,
} from "@prisma/client";
import { propagateResult } from "./bracket-engine/single-elimination.js";
import {
  scheduleOsaekomiTimer,
  cancelOsaekomiTimer,
} from "./osaekomi-timer.service.js";

export class MatchError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "MatchError";
  }
}

// ============================================================
// ТИП ДЛЯ scoreSnapshot
// ============================================================
export interface ScoreSnapshot {
  red:  { ippon: number; wazaari: number; yuko: number; shido: number; hansoku: boolean };
  blue: { ippon: number; wazaari: number; yuko: number; shido: number; hansoku: boolean };
  isGoldenScore: boolean;
  /** Текущее удержание (osaekomi). null если никто не удерживает. */
  osaekomi: { side: "RED" | "BLUE"; startedAt: string } | null;
  /** Match clock state. elapsedSec is accumulated time before runningStartedAt. */
  clock: { running: boolean; elapsedSec: number; runningStartedAt: string | null };
  /** Result waiting for judge/admin confirmation before bracket propagation. */
  pendingResult: {
    winnerSide: "RED" | "BLUE";
    winnerId: string;
    reason: string;
    triggeredBy: string;
    createdAt: string;
  } | null;
}

function emptyScore(): ScoreSnapshot {
  return {
    red:  { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    isGoldenScore: false,
    osaekomi: null,
    clock: { running: false, elapsedSec: 0, runningStartedAt: null },
    pendingResult: null,
  };
}

function normalizeScore(value: unknown): ScoreSnapshot {
  const base = emptyScore();
  if (!value || typeof value !== "object") return base;
  const score = value as Partial<ScoreSnapshot>;
  return {
    red: { ...base.red, ...(score.red ?? {}) },
    blue: { ...base.blue, ...(score.blue ?? {}) },
    isGoldenScore: Boolean(score.isGoldenScore),
    osaekomi: score.osaekomi ?? null,
    pendingResult: score.pendingResult ?? null,
    clock: {
      running: Boolean(score.clock?.running),
      elapsedSec: Math.max(0, Number(score.clock?.elapsedSec ?? 0)),
      runningStartedAt: score.clock?.runningStartedAt ?? null,
    },
  };
}

function currentClockElapsedSec(score: ScoreSnapshot, now = new Date()): number {
  if (!score.clock.running || !score.clock.runningStartedAt) return score.clock.elapsedSec;
  const startedMs = new Date(score.clock.runningStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return score.clock.elapsedSec;
  return Math.max(0, score.clock.elapsedSec + Math.floor((now.getTime() - startedMs) / 1000));
}

function stopClock(score: ScoreSnapshot, now = new Date()): ScoreSnapshot {
  score.clock.elapsedSec = currentClockElapsedSec(score, now);
  score.clock.running = false;
  score.clock.runningStartedAt = null;
  return score;
}

function markPendingResult(
  score: ScoreSnapshot,
  winnerSide: "RED" | "BLUE",
  winnerId: string,
  reason: string,
  triggeredBy: string,
): ScoreSnapshot {
  stopClock(score);
  score.osaekomi = null;
  score.pendingResult = {
    winnerSide,
    winnerId,
    reason,
    triggeredBy,
    createdAt: new Date().toISOString(),
  };
  return score;
}

// Пороги времени удержания (IJF rules)
const OSAEKOMI_YUKO_SEC = 5;       // 5+ сек → Yuko (если включено в категории)
const OSAEKOMI_WAZAARI_SEC = 10;   // 10+ сек → Waza-ari
const OSAEKOMI_IPPON_SEC = 20;     // 20+ сек → Ippon (мгновенная победа)

/** По длительности удержания (сек) определить какой балл начисляется. */
export function osaekomiScore(durationSec: number, allowYuko: boolean):
  | { type: "IPPON" }
  | { type: "WAZA_ARI" }
  | { type: "YUKO" }
  | null {
  if (durationSec >= OSAEKOMI_IPPON_SEC) return { type: "IPPON" };
  if (durationSec >= OSAEKOMI_WAZAARI_SEC) return { type: "WAZA_ARI" };
  if (allowYuko && durationSec >= OSAEKOMI_YUKO_SEC) return { type: "YUKO" };
  return null;
}

// ============================================================
// READ
// ============================================================

export async function getMatch(matchId: string) {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      redAthlete: { select: { id: true, name: true, surname: true, clubId: true } },
      blueAthlete: { select: { id: true, name: true, surname: true, clubId: true } },
      winner: { select: { id: true, name: true, surname: true } },
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
    where.OR = [{ redAthleteId: query.athleteId }, { blueAthleteId: query.athleteId }];
  }
  if (query.tatamiNumber !== undefined) where.tatamiNumber = query.tatamiNumber;
  if (query.status) where.status = query.status;

  return prisma.match.findMany({
    where,
    take: query.limit,
    skip: query.offset,
    orderBy: [{ tatamiNumber: "asc" }, { queuePosition: "asc" }, { round: "asc" }, { position: "asc" }],
    include: {
      redAthlete: { select: { id: true, name: true, surname: true } },
      blueAthlete: { select: { id: true, name: true, surname: true } },
      bracket: { select: { id: true, format: true, categoryId: true, category: true } },
      tournament: { select: { id: true, name: true, status: true, startDate: true } },
    },
  });
}

// ============================================================
// КОНТРОЛ МАТЧА
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
    throw new MatchError("RESULT_PENDING", "Сначала утвердите или сбросьте результат схватки", 409);
  }
  if (match.status === MatchStatus.IN_PROGRESS && score.clock.running) {
    throw new MatchError("ALREADY_RUNNING", "Матч уже идёт", 409);
  }
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError("INCOMPLETE_PAIRING", "В матче не хватает участников", 409);
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
      throw new MatchError("TATAMI_BUSY", "На этом татами уже идёт схватка", 409);
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
    throw new MatchError("RESULT_PENDING", "Сначала утвердите или сбросьте результат схватки", 409);
  }
  if (!score.clock.running) {
    throw new MatchError("ALREADY_PAUSED", "Матч уже на паузе", 409);
  }
  stopClock(score);
  // Если было активное удержание — отменяем серверный таймер
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

export async function enterGoldenScore(matchId: string, judgeSessionId?: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }
  const score = normalizeScore(match.scoreSnapshot);
  if (score.pendingResult) {
    throw new MatchError("RESULT_PENDING", "Сначала утвердите или сбросьте результат схватки", 409);
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
// СУДЕЙСКИЕ ДЕЙСТВИЯ (очки)
// ============================================================

export async function addScoreEvent(
  matchId: string,
  type: "IPPON" | "WAZA_ARI" | "YUKO" | "SHIDO" | "HANSOKU_MAKE",
  side: "RED" | "BLUE",
  judgeSessionId?: string,
  expectedVersion?: number,
): Promise<{ match: Match; event: any; autoFinished: boolean; winnerId: string | null }> {
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
    throw new MatchError("RESULT_PENDING", "Сначала утвердите или сбросьте результат схватки", 409);
  }
  const sideKey = side === "RED" ? "red" : "blue";

  // Применяем эффект очка
  switch (type) {
    case "IPPON":
      // IPPON — чистая победа, не может быть 2 иппона у одного
      if (score[sideKey].ippon >= 1) {
        throw new MatchError("ALREADY_IPPON", "Ипон уже начислен", 409);
      }
      score[sideKey].ippon = 1;
      break;
    case "WAZA_ARI":
      // Waza-ari нельзя добавить если ипон уже есть (матч должен был завершиться)
      if (score[sideKey].ippon >= 1) {
        throw new MatchError("ALREADY_IPPON", "Ипон уже начислен — ваза-ари нельзя добавить", 409);
      }
      score[sideKey].wazaari += 1;
      // Два waza-ari = ippon (IJF rule)
      if (score[sideKey].wazaari >= 2) {
        score[sideKey].ippon = 1;
      }
      break;
    case "YUKO":
      score[sideKey].yuko += 1;
      break;
    case "SHIDO":
      score[sideKey].shido += 1;
      if (score[sideKey].shido >= 3) {
        score[sideKey].hansoku = true;
      }
      break;
    case "HANSOKU_MAKE":
      score[sideKey].hansoku = true;
      break;
  }

  // Определение победителя
  let winnerId: string | null = null;
  let autoFinished = false;
  const goldenScorePoint = score.isGoldenScore && (type === "IPPON" || type === "WAZA_ARI" || type === "YUKO");
  const redWon = score.red.ippon >= 1 || score.blue.hansoku || (goldenScorePoint && side === "RED");
  const blueWon = score.blue.ippon >= 1 || score.red.hansoku || (goldenScorePoint && side === "BLUE");

  if (redWon && !blueWon) {
    winnerId = match.redAthleteId;
    autoFinished = true;
  } else if (blueWon && !redWon) {
    winnerId = match.blueAthleteId;
    autoFinished = true;
  }

  const eventType: MatchEventType = type as MatchEventType;
  const matchSide: MatchSide = side === "RED" ? MatchSide.RED : MatchSide.BLUE;

  if (autoFinished && winnerId) {
    markPendingResult(
      score,
      winnerId === match.redAthleteId ? "RED" : "BLUE",
      winnerId,
      type,
      judgeSessionId ?? "system",
    );
  }

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
// OSAEKOMI (удержание) — таймер, серверная фиксация
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
    throw new MatchError("RESULT_PENDING", "Сначала утвердите или сбросьте результат схватки", 409);
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
      throw new MatchError("CONCURRENT_MODIFICATION", "Матч изменён другим судьёй. Обновите страницу.", 409);
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

  // Серверный таймер: через 20 с автоматически завершит osaekomi если судья не нажал TOKETA
  scheduleOsaekomiTimer(matchId, osaekomiStartedAt);

  return { match: updated, event };
}

/**
 * Завершить удержание (TOKETA или авто-окончание по времени).
 *
 * @param byTime  если true — это автоматическое окончание (на 20 секундах от старта).
 *                Используется чтобы зафиксировать Ippon когда судья не нажал TOKETA.
 */
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
    throw new MatchError("RESULT_PENDING", "Сначала утвердите или сбросьте результат схватки", 409);
  }
  if (!score.osaekomi) {
    throw new MatchError("NO_OSAEKOMI", "Удержание не активно", 409);
  }

  const startMs = new Date(score.osaekomi.startedAt).getTime();
  const durationSec = Math.floor((Date.now() - startMs) / 1000);
  const side = score.osaekomi.side;
  const allowYuko = match.bracket.category.allowYuko;

  // Определяем что начислить
  const scored = osaekomiScore(durationSec, allowYuko);
  let autoFinished = false;
  let winnerId: string | null = null;

  // Снимаем флаг удержания и отменяем серверный таймер
  score.osaekomi = null;
  cancelOsaekomiTimer(matchId);

  // Начисляем балл
  if (scored) {
    const sideKey = side === "RED" ? "red" : "blue";
    switch (scored.type) {
      case "IPPON":
        score[sideKey].ippon += 1;
        winnerId =
          side === "RED" ? match.redAthleteId : match.blueAthleteId;
        autoFinished = true;
        break;
      case "WAZA_ARI":
        score[sideKey].wazaari += 1;
        if (score[sideKey].wazaari >= 2) {
          score[sideKey].ippon = Math.max(score[sideKey].ippon, 1);
          winnerId =
            side === "RED" ? match.redAthleteId : match.blueAthleteId;
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
      throw new MatchError("CONCURRENT_MODIFICATION", "Матч изменён другим судьёй. Обновите страницу.", 409);
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

// ============================================================
// РУЧНОЕ ЗАВЕРШЕНИЕ (например, по решению судей в Golden Score)
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
  const winnerId = winnerSide === "RED" ? match.redAthleteId : match.blueAthleteId;
  const score = normalizeScore(match.scoreSnapshot);
  if (score.pendingResult) {
    throw new MatchError("RESULT_PENDING", "Результат уже ожидает утверждения", 409);
  }
  markPendingResult(score, winnerSide, winnerId, reason ?? "Судья шешімі", judgeSessionId ?? "system");

  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.match.updateMany({
      where: {
        id: matchId,
        ...(expectedVersion !== undefined && { version: expectedVersion }),
      },
      data: { scoreSnapshot: score as any, version: { increment: 1 } },
    });
    if (expectedVersion !== undefined && updateResult.count === 0) {
      throw new MatchError("CONCURRENT_MODIFICATION", "Матч изменён другим судьёй. Обновите страницу.", 409);
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

export async function confirmMatchResult(matchId: string, judgeSessionId?: string): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  cancelOsaekomiTimer(matchId);
  const score = stopClock(normalizeScore(match.scoreSnapshot));
  if (!score.pendingResult) {
    throw new MatchError("NO_PENDING_RESULT", "Нет результата для утверждения", 409);
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
// PROPAGATE — продвижение по сетке после завершения матча
// ============================================================

async function propagateWinner(match: Match, winnerId: string): Promise<void> {
  if (!match.bracketSection) return;
  const loserId =
    match.redAthleteId === winnerId ? match.blueAthleteId : match.redAthleteId;
  if (!loserId) return;

  const bracket = await prisma.bracket.findUnique({ where: { id: match.bracketId } });
  if (!bracket) return;

  // Для Round-Robin не нужно — там просто таблица очков
  if (bracket.format === BracketFormat.ROUND_ROBIN) return;

  const propagations = propagateResult(
    match.round,
    match.position,
    match.bracketSection as any,
    winnerId,
    loserId,
    bracket.size,
  );

  for (const p of propagations) {
    const target = await prisma.match.findFirst({
      where: {
        bracketId: bracket.id,
        round: p.round,
        position: p.position,
        bracketSection: p.section,
      },
    });
    if (!target) continue;

    const data: any = {};
    if (p.slot === "red") data.redAthleteId = p.athleteId;
    else data.blueAthleteId = p.athleteId;
    if (!target.tatamiNumber && match.tatamiNumber) {
      data.tatamiNumber = match.tatamiNumber;
      data.queuePosition = await nextQueuePosition(match.tournamentId, match.tatamiNumber);
    }

    const updated = await prisma.match.update({ where: { id: target.id }, data });

    // Каскадный BYE: если только что заполненный матч теперь имеет одного спортсмена,
    // а источник второго слота — мёртвый путь (null-null), автозавершить как BYE.
    if (p.section === "main" || p.section === "final") {
      await cascadeBye(updated, bracket.size);
    }
  }
}

/**
 * Проверяет, является ли поддерево, питающее матч (round, position) в раунде 1,
 * «мёртвым путём» — т.е. ни одного спортсмена во всём поддереве нет.
 *
 * Используется одним запросом к БД: ищет любой матч раунда 1 в нужном диапазоне позиций.
 */
async function isDeadPath(bracketId: string, round: number, position: number): Promise<boolean> {
  // Поддерево матча (round, position) в раунде 1 занимает позиции:
  //   [position * 2^(round-1) , (position+1) * 2^(round-1) )
  const spread = Math.pow(2, round - 1);
  const start  = position * spread;
  const end    = start + spread;

  const hasAthletes = await prisma.match.findFirst({
    where: {
      bracketId,
      round: 1,
      bracketSection: "main",
      position: { gte: start, lt: end },
      OR: [{ redAthleteId: { not: null } }, { blueAthleteId: { not: null } }],
    },
    select: { id: true },
  });

  return !hasAthletes; // нет ни одного спортсмена → мёртвый путь
}

/**
 * После того как в матч попал один спортсмен (результат propagateWinner),
 * проверяет: нет ли ситуации BYE, где второй слот питается от «мёртвого пути»?
 * Если да — автозавершает матч как BYE и рекурсивно продвигает победителя дальше.
 *
 * Это обрабатывает каскадные BYE, возникающие во время игры (не при генерации),
 * например когда 90 спортсменов в 128-слотовой сетке: раунд 1 не имеет одиночных
 * BYE при генерации, но они появляются в раундах 2+ по мере завершения реальных матчей.
 */
async function cascadeBye(target: Match, bracketSize: number): Promise<void> {
  // Только основная сетка и финал (repechage/bronze остаются пустыми если нет атлетов)
  if (target.bracketSection !== "main" && target.bracketSection !== "final") return;
  // BYE раунда 1 обрабатываются при генерации (advanceFirstRoundByes)
  if (target.round === 1) return;
  // Уже завершён — ничего не делаем
  if (target.status === MatchStatus.COMPLETED) return;

  const hasRed  = Boolean(target.redAthleteId);
  const hasBlue = Boolean(target.blueAthleteId);
  // Оба null или оба есть → не BYE
  if (hasRed === hasBlue) return;

  // Определяем источник null-слота в предыдущем раунде:
  //   Красный слот ← дочерний матч раунда-1 с позицией 2*P (чётная)
  //   Синий слот   ← дочерний матч раунда-1 с позицией 2*P+1 (нечётная)
  const nullIsRed = !hasRed;
  const srcPos    = nullIsRed ? target.position * 2 : target.position * 2 + 1;
  const srcRound  = target.round - 1;

  const dead = await isDeadPath(target.bracketId, srcRound, srcPos);
  if (!dead) return; // Живой путь — подождём реального матча

  // Мёртвый путь → автозавершаем как BYE
  const winnerId = (target.redAthleteId ?? target.blueAthleteId)!;
  await prisma.match.update({
    where: { id: target.id },
    data: {
      status: MatchStatus.COMPLETED,
      winnerId,
      finishedAt: new Date(),
      scoreSnapshot: { bye: true } as any,
    },
  });

  // Финал завершён — дальше распространять некуда
  if (target.bracketSection === "final") return;

  // Продвигаем победителя BYE в следующий раунд
  const totalRounds = Math.log2(bracketSize);
  const nextRound   = target.round + 1;
  const nextPos     = Math.floor(target.position / 2);
  const nextSection = nextRound === totalRounds ? "final" : "main";
  const nextSlot: "red" | "blue" = target.position % 2 === 0 ? "red" : "blue";

  const nextMatch = await prisma.match.findFirst({
    where: {
      bracketId: target.bracketId,
      round: nextRound,
      position: nextPos,
      bracketSection: nextSection,
    },
  });
  if (!nextMatch) return;

  const data: any = nextSlot === "red"
    ? { redAthleteId: winnerId }
    : { blueAthleteId: winnerId };

  const updated = await prisma.match.update({ where: { id: nextMatch.id }, data });

  // Рекурсивно проверяем следующий матч
  await cascadeBye(updated, bracketSize);
}

// ============================================================
// ОТМЕНА ОЖИДАЮЩЕГО РЕЗУЛЬТАТА (до подтверждения)
// ============================================================

/**
 * Сбросить pendingResult — судья ошибся и хочет отменить объявленную победу.
 * Матч остаётся IN_PROGRESS, часы остановлены; судья нажимает ХАДЖИМЕ чтобы продолжить.
 */
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
// ОТМЕНА ПОСЛЕДНЕГО ДЕЙСТВИЯ (undo)
// ============================================================

const UNDOABLE_TYPES = [
  MatchEventType.IPPON,
  MatchEventType.WAZA_ARI,
  MatchEventType.YUKO,
  MatchEventType.SHIDO,
  MatchEventType.HANSOKU_MAKE,
  MatchEventType.GOLDEN_SCORE,
] as const;

/**
 * Отменить последнее засчитанное очко / шидо / хансоку.
 * Восстанавливает score из события до него; текущее состояние таймера сохраняется.
 * Pendingresult всегда сбрасывается при undo.
 */
export async function undoLastScoreEvent(
  matchId: string,
  judgeSessionId?: string,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не IN_PROGRESS", 409);
  }

  // Все scoring-события этого матча по порядку
  const events = await prisma.matchEvent.findMany({
    where: { matchId, type: { in: UNDOABLE_TYPES as unknown as MatchEventType[] } },
    orderBy: { occurredAt: "asc" },
  });

  if (events.length === 0) {
    throw new MatchError("NO_EVENTS", "Нет действий для отмены", 409);
  }

  const lastEvent = events[events.length - 1]!;
  const prevEvent = events.length >= 2 ? events[events.length - 2] : null;

  // Базовый score: из события до последнего (или нулевой если первое)
  const prevScore = prevEvent ? normalizeScore(prevEvent.scoreSnapshot) : emptyScore();
  const currentScore = normalizeScore(match.scoreSnapshot);

  // Восстанавливаем очки, но сохраняем текущее состояние таймера и осаекоми
  const restored: ScoreSnapshot = {
    red:          prevScore.red,
    blue:         prevScore.blue,
    isGoldenScore: prevScore.isGoldenScore,
    pendingResult: null,
    clock:        currentScore.clock,
    osaekomi:     currentScore.osaekomi,
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
        meta: { undo: true, undoneType: lastEvent.type, undoneId: lastEvent.id },
      },
    }),
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: restored as any },
    }),
  ]);

  return updated;
}

// ============================================================
// ADMIN: RESTART / RESET МАТЧА
// ============================================================

/**
 * Рекурсивно очищает все downstream-матчи где играл athleteId.
 * Вызывается для winner и loser раздельно, чтобы покрыть repechage/bronze.
 * skipMatchId — id матча который сбрасываем (не трогаем его самого).
 */
async function clearDownstreamRecursive(
  bracketId: string,
  athleteId: string,
  skipMatchId: string,
): Promise<void> {
  const downstream = await prisma.match.findMany({
    where: {
      bracketId,
      OR: [{ redAthleteId: athleteId }, { blueAthleteId: athleteId }],
      NOT: { id: skipMatchId },
    },
  });

  for (const d of downstream) {
    // Сначала рекурсивно очищаем потомков этого матча
    if (d.status === MatchStatus.COMPLETED && d.winnerId) {
      await clearDownstreamRecursive(bracketId, d.winnerId, d.id);
      const dLoserId = d.redAthleteId === d.winnerId ? d.blueAthleteId : d.redAthleteId;
      if (dLoserId) {
        await clearDownstreamRecursive(bracketId, dLoserId, d.id);
      }
    }
    // Очищаем сам матч
    const data: any = {
      status: MatchStatus.PENDING,
      winnerId: null,
      finishedAt: null,
      startedAt: null,
      scoreSnapshot: null,
    };
    if (d.redAthleteId === athleteId) data.redAthleteId = null;
    if (d.blueAthleteId === athleteId) data.blueAthleteId = null;
    await prisma.match.update({ where: { id: d.id }, data });
    await prisma.matchEvent.deleteMany({ where: { matchId: d.id } });
  }
}

/**
 * Сбросить завершённый или текущий матч к PENDING.
 * Очищает score, events, winner; если winner уже был propagated —
 * откатываем downstream через rollback.
 *
 * Используется когда нужно переиграть матч с нуля.
 */
export async function resetMatch(matchId: string): Promise<Match> {
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

  // Если матч COMPLETED и winner propagated — откатим весь downstream рекурсивно
  if (match.status === MatchStatus.COMPLETED && match.winnerId && match.bracket.format !== BracketFormat.ROUND_ROBIN) {
    const loserId = match.redAthleteId === match.winnerId ? match.blueAthleteId : match.redAthleteId;
    await clearDownstreamRecursive(match.bracketId, match.winnerId, match.id);
    if (loserId) {
      await clearDownstreamRecursive(match.bracketId, loserId, match.id);
    }
  }

  // Сбросить сам матч
  await prisma.matchEvent.deleteMany({ where: { matchId } });
  const updated = await prisma.match.update({
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

  return updated;
}

// ============================================================
// ОЧЕРЕДЬ ТАТАМИ
// ============================================================

export async function assignToTatami(
  matchId: string,
  tatamiNumber: number | null,
  queuePosition?: number,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  const nextPosition = tatamiNumber
    ? queuePosition ?? (match.tatamiNumber === tatamiNumber ? match.queuePosition : null) ?? await nextQueuePosition(match.tournamentId, tatamiNumber)
    : null;
  return prisma.match.update({
    where: { id: matchId },
    data: { tatamiNumber, queuePosition: nextPosition },
  });
}

export async function reorderTatamiQueue(
  matchId: string,
  direction: "up" | "down",
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (!match.tatamiNumber) {
    throw new MatchError("MATCH_NOT_ASSIGNED", "Матч не назначен на татами", 409);
  }
  if (match.status !== MatchStatus.PENDING) {
    throw new MatchError("MATCH_NOT_PENDING", "Двигать можно только матч в ожидании", 409);
  }

  const queue = await prisma.match.findMany({
    where: {
      tournamentId: match.tournamentId,
      tatamiNumber: match.tatamiNumber,
      status: MatchStatus.PENDING,
    },
    orderBy: [
      { queuePosition: "asc" },
      { round: "asc" },
      { position: "asc" },
    ],
  });
  const index = queue.findIndex((item) => item.id === matchId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= queue.length) return match;

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
  const currentPosition = swapIndex + 1;
  const otherPosition = index + 1;

  await prisma.$transaction([
    prisma.match.update({ where: { id: current.id }, data: { queuePosition: currentPosition } }),
    prisma.match.update({ where: { id: other.id }, data: { queuePosition: otherPosition } }),
  ]);

  return prisma.match.findUniqueOrThrow({ where: { id: matchId } });
}

async function nextQueuePosition(tournamentId: string, tatamiNumber: number): Promise<number> {
  const last = await prisma.match.findFirst({
    where: { tournamentId, tatamiNumber },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  });
  return (last?.queuePosition ?? 0) + 1;
}

export async function getTatamiQueue(tournamentId: string, tatamiNumber: number) {
  return prisma.match.findMany({
    where: {
      tournamentId,
      tatamiNumber,
      status: { in: [MatchStatus.PENDING, MatchStatus.IN_PROGRESS] },
    },
    orderBy: [{ status: "desc" }, { queuePosition: "asc" }, { round: "asc" }, { position: "asc" }],
    include: {
      redAthlete: { select: { id: true, name: true, surname: true } },
      blueAthlete: { select: { id: true, name: true, surname: true } },
      bracket: { include: { category: true } },
    },
  });
}
