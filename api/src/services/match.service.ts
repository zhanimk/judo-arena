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
  MatchStatus,
  MatchEventType,
  MatchSide,
  BracketFormat,
  type Match,
} from "@prisma/client";
import { propagateResult } from "./bracket-engine/single-elimination.js";

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
}

function emptyScore(): ScoreSnapshot {
  return {
    red:  { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    isGoldenScore: false,
    osaekomi: null,
  };
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
  tatamiNumber?: number;
  status?: MatchStatus;
  limit: number;
  offset: number;
}) {
  const where: any = {};
  if (query.tournamentId) where.tournamentId = query.tournamentId;
  if (query.bracketId) where.bracketId = query.bracketId;
  if (query.tatamiNumber !== undefined) where.tatamiNumber = query.tatamiNumber;
  if (query.status) where.status = query.status;

  return prisma.match.findMany({
    where,
    take: query.limit,
    skip: query.offset,
    orderBy: [{ tatamiNumber: "asc" }, { round: "asc" }, { position: "asc" }],
    include: {
      redAthlete: { select: { id: true, name: true, surname: true } },
      blueAthlete: { select: { id: true, name: true, surname: true } },
      bracket: { select: { id: true, format: true, categoryId: true } },
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
  if (match.status === MatchStatus.IN_PROGRESS) {
    throw new MatchError("ALREADY_RUNNING", "Матч уже идёт", 409);
  }
  if (match.status === MatchStatus.COMPLETED) {
    throw new MatchError("ALREADY_COMPLETED", "Матч уже завершён", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError("INCOMPLETE_PAIRING", "В матче не хватает участников", 409);
  }

  const [updated, event] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: match.startedAt ?? new Date(),
        scoreSnapshot: emptyScore() as any,
      },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: MatchEventType.HAJIME,
        side: MatchSide.SYSTEM,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: emptyScore() as any,
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
  const event = await prisma.matchEvent.create({
    data: {
      matchId,
      type: MatchEventType.MATE,
      side: MatchSide.SYSTEM,
      actorJudgeSessionId: judgeSessionId,
      scoreSnapshot: match.scoreSnapshot as any,
    },
  });
  return { match, event };
}

export async function enterGoldenScore(matchId: string, judgeSessionId?: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }
  const score = (match.scoreSnapshot as unknown as ScoreSnapshot) ?? emptyScore();
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
): Promise<{ match: Match; event: any; autoFinished: boolean; winnerId: string | null }> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new MatchError("INCOMPLETE_PAIRING", "Нет участников", 409);
  }

  const score = ((match.scoreSnapshot as unknown as ScoreSnapshot) ?? emptyScore());
  if (!score.red) Object.assign(score, emptyScore());
  const sideKey = side === "RED" ? "red" : "blue";

  // Применяем эффект очка
  switch (type) {
    case "IPPON":
      score[sideKey].ippon += 1;
      break;
    case "WAZA_ARI":
      score[sideKey].wazaari += 1;
      // Два waza-ari = ippon (IJF rule)
      if (score[sideKey].wazaari >= 2) {
        score[sideKey].ippon = Math.max(score[sideKey].ippon, 1);
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
  const redWon = score.red.ippon >= 1 || score.blue.hansoku;
  const blueWon = score.blue.ippon >= 1 || score.red.hansoku;

  if (redWon && !blueWon) {
    winnerId = match.redAthleteId;
    autoFinished = true;
  } else if (blueWon && !redWon) {
    winnerId = match.blueAthleteId;
    autoFinished = true;
  }

  const eventType: MatchEventType = type as MatchEventType;
  const matchSide: MatchSide = side === "RED" ? MatchSide.RED : MatchSide.BLUE;

  const event = await prisma.matchEvent.create({
    data: {
      matchId,
      type: eventType,
      side: matchSide,
      actorJudgeSessionId: judgeSessionId,
      scoreSnapshot: score as any,
    },
  });

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreSnapshot: score as any,
      ...(autoFinished && {
        status: MatchStatus.COMPLETED,
        winnerId,
        finishedAt: new Date(),
      }),
    },
  });

  // Если матч завершился — продвигаем победителя в следующий матч
  if (autoFinished && winnerId) {
    await propagateWinner(updated, winnerId);
  }

  return { match: updated, event, autoFinished, winnerId };
}

// ============================================================
// OSAEKOMI (удержание) — таймер, серверная фиксация
// ============================================================

export async function startOsaekomi(
  matchId: string,
  side: "RED" | "BLUE",
  judgeSessionId?: string,
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new MatchError("NOT_RUNNING", "Матч не запущен", 409);
  }

  const score = ((match.scoreSnapshot as unknown as ScoreSnapshot) ?? emptyScore());
  if (!score.red) Object.assign(score, emptyScore());
  if (score.osaekomi) {
    throw new MatchError("OSAEKOMI_ALREADY", "Удержание уже идёт", 409);
  }

  score.osaekomi = { side, startedAt: new Date().toISOString() };

  const [updated, event] = await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: { scoreSnapshot: score as any },
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type: "OSAEKOMI" as MatchEventType,  // см. ниже про enum
        side: side === "RED" ? MatchSide.RED : MatchSide.BLUE,
        actorJudgeSessionId: judgeSessionId,
        scoreSnapshot: score as any,
      },
    }).catch(async () => {
      // Если enum OSAEKOMI отсутствует в Prisma (старая миграция) — используем MATE как fallback с meta
      return prisma.matchEvent.create({
        data: {
          matchId,
          type: MatchEventType.MATE,
          side: side === "RED" ? MatchSide.RED : MatchSide.BLUE,
          actorJudgeSessionId: judgeSessionId,
          scoreSnapshot: score as any,
          meta: { osaekomiStart: true },
        },
      });
    }),
  ]);

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

  const score = ((match.scoreSnapshot as unknown as ScoreSnapshot) ?? emptyScore());
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

  // Снимаем флаг удержания
  score.osaekomi = null;

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

  // Записываем событие TOKETA с meta
  await prisma.matchEvent.create({
    data: {
      matchId,
      type: MatchEventType.MATE,
      side: side === "RED" ? MatchSide.RED : MatchSide.BLUE,
      actorJudgeSessionId: judgeSessionId,
      scoreSnapshot: score as any,
      meta: {
        toketa: true,
        reason,
        durationSec,
        scored: scored?.type ?? null,
      },
    },
  });

  // Обновляем матч
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreSnapshot: score as any,
      ...(autoFinished &&
        winnerId && {
          status: MatchStatus.COMPLETED,
          winnerId,
          finishedAt: new Date(),
        }),
    },
  });

  if (autoFinished && winnerId) {
    await propagateWinner(updated, winnerId);
  }

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

  await prisma.matchEvent.create({
    data: {
      matchId,
      type: MatchEventType.SORE_MADE,
      side: winnerSide === "RED" ? MatchSide.RED : MatchSide.BLUE,
      actorJudgeSessionId: judgeSessionId,
      scoreSnapshot: match.scoreSnapshot as any,
      meta: reason ? { reason } : undefined,
    },
  });

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      status: MatchStatus.COMPLETED,
      winnerId,
      finishedAt: new Date(),
    },
  });

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

    await prisma.match.update({ where: { id: target.id }, data });
  }
}

// ============================================================
// ОЧЕРЕДЬ ТАТАМИ
// ============================================================

export async function assignToTatami(
  matchId: string,
  tatamiNumber: number | null,
): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new MatchError("MATCH_NOT_FOUND", "Матч не найден", 404);
  return prisma.match.update({
    where: { id: matchId },
    data: { tatamiNumber },
  });
}

export async function getTatamiQueue(tournamentId: string, tatamiNumber: number) {
  return prisma.match.findMany({
    where: {
      tournamentId,
      tatamiNumber,
      status: { in: [MatchStatus.PENDING, MatchStatus.IN_PROGRESS] },
    },
    orderBy: [{ status: "desc" }, { round: "asc" }, { position: "asc" }],
    include: {
      redAthlete: { select: { id: true, name: true, surname: true } },
      blueAthlete: { select: { id: true, name: true, surname: true } },
      bracket: { include: { category: true } },
    },
  });
}
