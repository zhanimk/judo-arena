import { withSerializableMatchTransaction } from "./match-transaction.js";
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
import {
  MatchStatus,
  TournamentStatus,
  UserRole,
  type Match,
} from "@prisma/client";
import {
  clearDownstreamRecursive,
  propagateWinner,
} from "./match-propagation.js";
import { rethrowMatchWriteConflict } from "./match-types.js";
import { logAudit } from "./audit.service.js";
import {
  emitMatchEvent,
  emitToBracket,
  emitToTournament,
} from "../sockets/io.js";

export class OverrideError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
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
    throw new OverrideError(
      "FORBIDDEN",
      "Только админ может делать override",
      403,
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { bracket: true, tournament: { select: { status: true } } },
  });
  if (!match) throw new OverrideError("MATCH_NOT_FOUND", "Матч не найден", 404);
  if (match.status !== MatchStatus.COMPLETED) {
    throw new OverrideError(
      "NOT_COMPLETED",
      "Override доступен только для завершённых матчей",
      409,
    );
  }
  if (match.tournament.status === TournamentStatus.COMPLETED) {
    throw new OverrideError(
      "TOURNAMENT_FINALIZED",
      "Нельзя изменить результат после финализации турнира — рейтинги уже начислены",
      409,
    );
  }
  if (!match.redAthleteId || !match.blueAthleteId) {
    throw new OverrideError(
      "INCOMPLETE_PAIRING",
      "У матча нет двух участников",
      409,
    );
  }

  const oldWinnerId = match.winnerId;
  const newWinnerId =
    newWinnerSide === "RED" ? match.redAthleteId : match.blueAthleteId;

  if (oldWinnerId === newWinnerId) {
    throw new OverrideError(
      "SAME_WINNER",
      "Новый победитель совпадает со старым",
      400,
    );
  }

  // Rollback and replacement are one transaction; traverse both winner and loser edges.
  const { updated, rolledBack } = await withSerializableMatchTransaction(
    async (tx) => {
      const currentTournament = await tx.tournament.findUnique({
        where: { id: match.tournamentId },
        select: { status: true },
      });
      if (
        !currentTournament ||
        currentTournament.status === "COMPLETED" ||
        currentTournament.status === "CANCELLED"
      )
        throw new OverrideError(
          "TOURNAMENT_FINALIZED",
          "Турнир завершён или отменён",
          409,
        );
      const rolledBack = await clearDownstreamRecursive(
        match.bracketId,
        oldWinnerId ?? "",
        match.id,
        tx,
      );
      const updated = await tx.match.update({
        where: { id: matchId, version: match.version },
        data: {
          winnerId: newWinnerId,
          isReplay: true,
          replayReason: reason,
          version: { increment: 1 },
        },
      });
      await propagateWinner(updated, newWinnerId, tx);
      return { updated, rolledBack };
    },
  ).catch(rethrowMatchWriteConflict);
  for (const downstream of rolledBack) {
    await logAudit({
      actorUserId,
      action: "match.rollback",
      targetEntity: "Match",
      targetId: downstream.id,
      after: { status: downstream.status, winnerId: null },
      metadata: { cascadeFromMatch: matchId },
    });
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
