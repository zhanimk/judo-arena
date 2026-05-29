/**
 * Admin Override + Rollback.
 *
 * Сценарий: после завершения матча обнаружилась ошибка судей.
 * Админ может:
 *   1. Изменить результат уже завершённого матча.
 *   2. Полностью откатить downstream-цепочку (если победитель уже играл дальше).
 *
 * Алгоритм rollback:
 *   1. Найти все downstream-матчи где играет старый winner.
 *   2. Если они COMPLETED — каскадно откатить и их.
 *   3. Если IN_PROGRESS — отменить (CANCELLED).
 *   4. Очистить redAthleteId/blueAthleteId если они = старый winner.
 *   5. Установить нового winner в текущем матче.
 *   6. Propagate нового winner вперёд.
 *   7. AuditLog каждого шага.
 */

import { prisma } from "../lib/prisma.js";
import { MatchStatus, BracketFormat, UserRole, type Match } from "@prisma/client";
import { propagateResult } from "./bracket-engine/single-elimination.js";
import { logAudit } from "./audit.service.js";
import { emitMatchEvent, emitToBracket, emitToTournament } from "../sockets/io.js";

export class OverrideError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "OverrideError";
  }
}

export async function overrideMatchResult(
  actorUserId: string,
  matchId: string,
  newWinnerSide: "RED" | "BLUE",
  reason: string,
): Promise<{ updated: Match; rolledBack: Match[] }> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new OverrideError("FORBIDDEN", "Только админ может делать override", 403);
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { bracket: true },
  });
  if (!match) throw new OverrideError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.COMPLETED) {
    throw new OverrideError("NOT_COMPLETED", "Override доступен только для завершённых матчей", 409);
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new OverrideError("INCOMPLETE_PAIRING", "У матча нет двух участников", 409);
  }

  const oldWinnerId = match.winnerId;
  const newWinnerId = newWinnerSide === "RED" ? match.redAthleteId : match.blueAthleteId;

  if (oldWinnerId === newWinnerId) {
    throw new OverrideError("SAME_WINNER", "Новый победитель совпадает со старым", 400);
  }

  // ---- Каскадный rollback ----
  const rolledBack: Match[] = [];
  if (oldWinnerId) {
    await rollbackDownstream(match, oldWinnerId, rolledBack, actorUserId);
  }

  // ---- Установка нового winner ----
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      winnerId: newWinnerId,
      isReplay: true,
      replayReason: reason,
    },
  });

  // ---- Propagate нового winner вперёд ----
  if (match.bracket.format !== BracketFormat.ROUND_ROBIN && match.bracketSection) {
    const loserId = newWinnerId === match.redAthleteId ? match.blueAthleteId : match.redAthleteId;
    const propagations = propagateResult(
      match.round,
      match.position,
      match.bracketSection as any,
      newWinnerId,
      loserId!,
      match.bracket.size,
    );
    for (const p of propagations) {
      const target = await prisma.match.findFirst({
        where: {
          bracketId: match.bracketId,
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

  // ---- Audit ----
  await logAudit({
    actorUserId,
    action: "match.override",
    targetEntity: "Match",
    targetId: matchId,
    before: { winnerId: oldWinnerId, status: match.status },
    after: { winnerId: newWinnerId, isReplay: true, replayReason: reason },
    metadata: { rolledBackCount: rolledBack.length, reason },
  });

  // ---- Реалтайм: обновить табло и сетку у всех подключённых клиентов ----
  emitMatchEvent(updated, "match:finished", {
    matchId: updated.id,
    winnerId: newWinnerId,
    overridden: true,
    reason,
  });
  emitToBracket(match.bracketId, "bracket:update", {
    bracketId: match.bracketId,
    overriddenMatchId: matchId,
  });
  emitToTournament(match.tournamentId, "bracket:update", {
    bracketId: match.bracketId,
    overriddenMatchId: matchId,
  });
  // Если матч был на татами — обновить очередь
  if (match.tatamiNumber !== null) {
    emitMatchEvent(updated, "tatami:queueUpdate", {
      matchId: updated.id,
      tatamiNumber: match.tatamiNumber,
    });
  }

  return { updated, rolledBack };
}

/** Рекурсивный откат всех матчей вниз по сетке где играл oldWinner. */
async function rollbackDownstream(
  rootMatch: Match & { bracket?: { format: BracketFormat } | null },
  oldWinnerId: string,
  collected: Match[],
  actorUserId: string,
): Promise<void> {
  if (rootMatch.bracket?.format === BracketFormat.ROUND_ROBIN) {
    return; // В Round-Robin нет downstream
  }

  // Найти все матчи в этой сетке где этот человек играет
  const downstream = await prisma.match.findMany({
    where: {
      bracketId: rootMatch.bracketId,
      OR: [{ redAthleteId: oldWinnerId }, { blueAthleteId: oldWinnerId }],
      NOT: { id: rootMatch.id },
    },
  });

  for (const d of downstream) {
    const beforeState = {
      status: d.status,
      winnerId: d.winnerId,
      redAthleteId: d.redAthleteId,
      blueAthleteId: d.blueAthleteId,
    };

    // Если завершён — каскадим вниз сначала
    if (d.status === MatchStatus.COMPLETED && d.winnerId) {
      await rollbackDownstream(d, d.winnerId, collected, actorUserId);
    }

    // Очистим слот, сбросим winner и статус
    const data: any = { winnerId: null, finishedAt: null, scoreSnapshot: null };
    if (d.redAthleteId === oldWinnerId) data.redAthleteId = null;
    if (d.blueAthleteId === oldWinnerId) data.blueAthleteId = null;
    if (d.status !== MatchStatus.PENDING) {
      data.status = MatchStatus.PENDING;
      data.startedAt = null;
    }

    const updated = await prisma.match.update({ where: { id: d.id }, data });
    collected.push(updated);

    await logAudit({
      actorUserId,
      action: "match.rollback",
      targetEntity: "Match",
      targetId: d.id,
      before: beforeState,
      after: { status: data.status ?? d.status, winnerId: null },
      metadata: { cascadeFromMatch: rootMatch.id },
    });
  }
}
