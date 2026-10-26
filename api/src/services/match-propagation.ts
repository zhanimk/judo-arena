/**
 * match-propagation.ts — продвижение по сетке после завершения матча.
 *
 * Содержит:
 *   - propagateWinner()          — записывает победителя/проигравшего в следующие матчи
 *   - resolveAutomaticByes()     — автозавершение BYE, включая утешительные и бронзу
 *   - clearDownstreamRecursive() — откат downstream при сбросе матча (используется resetMatch)
 */

import { prisma } from "../lib/prisma.js";
import { Prisma, BracketFormat, MatchStatus, type Match } from "@prisma/client";
import { propagateResult } from "./bracket-engine/single-elimination.js";
import type { SEMatch } from "./bracket-engine/single-elimination.js";
import { findAutomaticBye } from "./bracket-engine/byes.js";
import { planDownstreamRollback } from "./bracket-engine/rollback.js";
import { BYE_SNAPSHOT } from "./match-types.js";
import { nextQueuePosition } from "./match-tatami.service.js";

type SectionType = SEMatch["bracketSection"];

// ============================================================
// PUBLIC: продвижение победителя по сетке
// ============================================================

export async function propagateWinner(
  match: Match,
  winnerId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!tx)
    return prisma.$transaction((client) =>
      propagateWinner(match, winnerId, client),
    );
  if (!match.bracketSection) return;
  const loserId =
    match.redAthleteId === winnerId ? match.blueAthleteId : match.redAthleteId;

  const bracket = await tx.bracket.findUnique({
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
    await advanceGroupWinnersIfComplete(bracket.id, match.bracketSection, tx);
    await resolveAutomaticByes(bracket.id, tx);
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
      "main" as SectionType,
      winnerId,
      loserId ?? "",
      bracket.size,
    ).map((p) => ({
      ...p,
      section:
        p.section === "main" || p.section === "final" ? "playoff" : p.section,
    }));

    // Атомарно: ищем целевые матчи и обновляем их в одной транзакции.
    // Без транзакции два одновременных победителя могут перезаписать один слот.
    {
      for (const p of playoffPropagations) {
        if (!p.athleteId) continue;
        const target = await tx.match.findFirst({
          where: {
            bracketId: bracket.id,
            round: p.round,
            position: p.position,
            bracketSection: p.section,
          },
        });
        if (!target) continue;
        const data: Prisma.MatchUncheckedUpdateInput =
          p.slot === "red"
            ? { redAthleteId: p.athleteId }
            : { blueAthleteId: p.athleteId };
        data.version = { increment: 1 };
        await tx.match.update({ where: { id: target.id }, data });
      }
    }
    await resolveAutomaticByes(bracket.id, tx);
    return;
  }

  // Стандартная SE-сетка (включая repechage, bronze)
  const propagations = propagateResult(
    match.round,
    match.position,
    match.bracketSection as SectionType,
    winnerId,
    loserId ?? "",
    bracket.size,
  );

  // Атомарно продвигаем победителя по всем слотам SE-сетки.
  // Транзакция предотвращает race condition при параллельных судейских сессиях.
  {
    for (const p of propagations) {
      if (!p.athleteId) continue;
      const target = await tx.match.findFirst({
        where: {
          bracketId: bracket.id,
          round: p.round,
          position: p.position,
          bracketSection: p.section,
        },
      });
      if (!target) continue;

      const data: Prisma.MatchUncheckedUpdateInput =
        p.slot === "red"
          ? { redAthleteId: p.athleteId }
          : { blueAthleteId: p.athleteId };

      // Наследуем татами победителя если следующий матч ещё не назначен
      if (!target.tatamiNumber && match.tatamiNumber) {
        data.tatamiNumber = match.tatamiNumber;
        data.queuePosition = await nextQueuePosition(
          match.tournamentId,
          match.tatamiNumber,
          tx,
        );
      }

      data.version = { increment: 1 };
      await tx.match.update({ where: { id: target.id }, data });
    }
  }

  await resolveAutomaticByes(bracket.id, tx);
}

/** Resolve dead winner and loser paths, including repechage and medals. */
export async function resolveAutomaticByes(
  bracketId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!tx)
    return prisma.$transaction((client) =>
      resolveAutomaticByes(bracketId, client),
    );
  {
    const bracket = await tx.bracket.findUniqueOrThrow({
      where: { id: bracketId },
    });
    const matches = await tx.match.findMany({ where: { bracketId } });
    while (true) {
      const bye = findAutomaticBye(matches, bracket.size, bracket.format);
      if (!bye) break;
      const source = matches.find((m) => m.id === bye.id)!;
      const winnerId = (source.redAthleteId ?? source.blueAthleteId)!;
      const updated = await tx.match.update({
        where: {
          id: source.id,
          version: source.version,
          status: MatchStatus.PENDING,
        },
        data: {
          status: MatchStatus.COMPLETED,
          winnerId,
          finishedAt: new Date(),
          scoreSnapshot: BYE_SNAPSHOT,
          version: { increment: 1 },
        },
      });
      Object.assign(source, updated);
      const playoff = source.bracketSection === "playoff";
      for (const edge of propagateResult(
        source.round,
        source.position,
        (playoff ? "main" : source.bracketSection) as SectionType,
        winnerId,
        "",
        bracket.size,
      )) {
        if (
          !edge.athleteId ||
          (playoff && edge.section !== "main" && edge.section !== "final")
        )
          continue;
        const target = matches.find(
          (m) =>
            m.round === edge.round &&
            m.position === edge.position &&
            m.bracketSection === (playoff ? "playoff" : edge.section),
        );
        if (!target) continue;
        const result = await tx.match.update({
          where: { id: target.id, version: target.version },
          data: {
            ...(edge.slot === "red"
              ? { redAthleteId: winnerId }
              : { blueAthleteId: winnerId }),
            version: { increment: 1 },
          },
        });
        Object.assign(target, result);
      }
    }
  }
}

// ============================================================
// PUBLIC: откат downstream при сбросе матча
// ============================================================

/** Clear only structurally dependent slots; caller can include this in its transaction. */
export async function clearDownstreamRecursive(
  bracketId: string,
  _athleteId: string,
  rootMatchId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Match[]> {
  const bracket = await tx.bracket.findUniqueOrThrow({
    where: { id: bracketId },
  });
  const matches = await tx.match.findMany({ where: { bracketId } });
  const root = matches.find((m) => m.id === rootMatchId);
  if (!root) return [];
  const plan = planDownstreamRollback(
    matches,
    root,
    bracket.size,
    bracket.format,
  );
  const updated: Match[] = [];
  for (const target of plan) {
    updated.push(
      await tx.match.update({
        where: { id: target.matchId },
        data: {
          status: MatchStatus.PENDING,
          winnerId: null,
          finishedAt: null,
          startedAt: null,
          goldenScoreStartedAt: null,
          isGoldenScore: false,
          scoreSnapshot: Prisma.JsonNull,
          version: { increment: 1 },
          ...(target.slots.includes("red") && { redAthleteId: null }),
          ...(target.slots.includes("blue") && { blueAthleteId: null }),
        },
      }),
    );
    await tx.matchEvent.deleteMany({ where: { matchId: target.matchId } });
  }
  return updated;
}
