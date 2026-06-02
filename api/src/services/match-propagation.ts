/**
 * match-propagation.ts — продвижение по сетке после завершения матча.
 *
 * Содержит:
 *   - propagateWinner()          — записывает победителя/проигравшего в следующие матчи
 *   - isDeadPath()               — проверяет является ли поддерево «мёртвым»
 *   - cascadeBye()               — автозавершение BYE при мёртвом пути
 *   - clearDownstreamRecursive() — откат downstream при сбросе матча (используется resetMatch)
 */

import { prisma } from "../lib/prisma.js";
import { BracketFormat, MatchStatus, type Match } from "@prisma/client";
import { propagateResult } from "./bracket-engine/single-elimination.js";
import { nextQueuePosition } from "./match-tatami.service.js";

// ============================================================
// PUBLIC: продвижение победителя по сетке
// ============================================================

export async function propagateWinner(
  match: Match,
  winnerId: string,
): Promise<void> {
  if (!match.bracketSection) return;
  const loserId =
    match.redAthleteId === winnerId ? match.blueAthleteId : match.redAthleteId;
  if (!loserId) return;

  const bracket = await prisma.bracket.findUnique({
    where: { id: match.bracketId },
  });
  if (!bracket) return;

  // Round-Robin: не нужно — там считается таблица очков
  if (bracket.format === BracketFormat.ROUND_ROBIN) return;

  // MIXED: групповой матч → пытаемся продвинуть топ-2 в плей-офф
  if (
    bracket.format === BracketFormat.MIXED &&
    match.bracketSection?.startsWith("group_")
  ) {
    const { advanceGroupWinnersIfComplete } =
      await import("./bracket.service.js");
    await advanceGroupWinnersIfComplete(bracket.id, match.bracketSection);
    return;
  }

  // MIXED: плей-офф матч → используем SE-логику с remapping секций
  if (
    bracket.format === BracketFormat.MIXED &&
    match.bracketSection === "playoff"
  ) {
    const playoffPropagations = propagateResult(
      match.round,
      match.position,
      "main" as any,
      winnerId,
      loserId,
      bracket.size,
    ).map((p) => ({
      ...p,
      section:
        p.section === "main" || p.section === "final" ? "playoff" : p.section,
    }));

    for (const p of playoffPropagations) {
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
    return;
  }

  // Стандартная SE-сетка (включая repechage, bronze)
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

    // Наследуем татами победителя если следующий матч ещё не назначен
    if (!target.tatamiNumber && match.tatamiNumber) {
      data.tatamiNumber = match.tatamiNumber;
      data.queuePosition = await nextQueuePosition(
        match.tournamentId,
        match.tatamiNumber,
      );
    }

    const updated = await prisma.match.update({
      where: { id: target.id },
      data,
    });

    // Каскадный BYE: если второй слот питается от мёртвого пути — автозавершаем
    if (p.section === "main" || p.section === "final") {
      await cascadeBye(updated, bracket.size);
    }
  }
}

// ============================================================
// PRIVATE: вспомогательные функции
// ============================================================

/**
 * Проверяет является ли поддерево, питающее матч (round, position),
 * «мёртвым путём» — т.е. ни одного спортсмена во всём поддереве нет.
 */
async function isDeadPath(
  bracketId: string,
  round: number,
  position: number,
): Promise<boolean> {
  const spread = Math.pow(2, round - 1);
  const start = position * spread;
  const end = start + spread;

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

  return !hasAthletes;
}

/**
 * После того как в матч попал один спортсмен — проверяем не является ли
 * второй слот мёртвым путём. Если да — автозавершаем матч как BYE
 * и рекурсивно продвигаем победителя.
 */
async function cascadeBye(target: Match, bracketSize: number): Promise<void> {
  if (target.bracketSection !== "main" && target.bracketSection !== "final")
    return;
  if (target.round === 1) return; // BYE раунда 1 обрабатываются при генерации
  if (target.status === MatchStatus.COMPLETED) return;

  const hasRed = Boolean(target.redAthleteId);
  const hasBlue = Boolean(target.blueAthleteId);
  if (hasRed === hasBlue) return; // Оба null или оба есть → не BYE

  const nullIsRed = !hasRed;
  const srcPos = nullIsRed ? target.position * 2 : target.position * 2 + 1;
  const srcRound = target.round - 1;

  const dead = await isDeadPath(target.bracketId, srcRound, srcPos);
  if (!dead) return;

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

  if (target.bracketSection === "final") return;

  // Продвигаем победителя BYE в следующий раунд
  const totalRounds = Math.log2(bracketSize);
  const nextRound = target.round + 1;
  const nextPos = Math.floor(target.position / 2);
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

  const data: any =
    nextSlot === "red"
      ? { redAthleteId: winnerId }
      : { blueAthleteId: winnerId };

  const updated = await prisma.match.update({
    where: { id: nextMatch.id },
    data,
  });
  await cascadeBye(updated, bracketSize); // Рекурсия
}

// ============================================================
// PUBLIC: откат downstream при сбросе матча
// ============================================================

/**
 * Рекурсивно очищает все downstream-матчи где играл athleteId.
 * Используется в resetMatch() для отката результатов.
 */
export async function clearDownstreamRecursive(
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
    // Сначала рекурсивно очищаем потомков
    if (d.status === MatchStatus.COMPLETED && d.winnerId) {
      await clearDownstreamRecursive(bracketId, d.winnerId, d.id);
      const dLoserId =
        d.redAthleteId === d.winnerId ? d.blueAthleteId : d.redAthleteId;
      if (dLoserId) {
        await clearDownstreamRecursive(bracketId, dLoserId, d.id);
      }
    }
    // Очищаем матч
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
