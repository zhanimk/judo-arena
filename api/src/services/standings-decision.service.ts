import { Prisma } from "@prisma/client";
import { sectionStandings, standingsMetadata } from "./bracket-standings.js";
import { computeStandings } from "./bracket-engine/round-robin.js";
import { normalizeScore } from "./match-types.js";
import { withSerializableMatchTransaction } from "./match-transaction.js";
import { emitToBracket, emitToTournament } from "../sockets/io.js";

export class StandingsError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 409,
  ) {
    super(message);
  }
}
export async function decideStandings(
  actorUserId: string,
  bracketId: string,
  section: string,
  order: string[],
  reason: string,
  fingerprint: string,
) {
  if (reason.trim().length < 5 || reason.length > 2000)
    throw new StandingsError(
      "REASON_REQUIRED",
      "Укажите обоснование решения (5–2000 символов)",
      400,
    );
  const result = await withSerializableMatchTransaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorUserId } });
    if (!actor || actor.role !== "ADMIN" || !actor.isActive)
      throw new StandingsError(
        "FORBIDDEN",
        "Только администратор может утвердить порядок мест",
        403,
      );
    const bracket = await tx.bracket.findUnique({
      where: { id: bracketId },
      include: { matches: true, tournament: true },
    });
    if (!bracket)
      throw new StandingsError("BRACKET_NOT_FOUND", "Сетка не найдена", 404);
    if (["COMPLETED", "CANCELLED"].includes(bracket.tournament.status))
      throw new StandingsError(
        "TOURNAMENT_FINALIZED",
        "Турнир завершён или отменён",
      );
    if (
      !(bracket.format === "ROUND_ROBIN" && section === "main") &&
      !(bracket.format === "MIXED" && section.startsWith("group_"))
    )
      throw new StandingsError(
        "INVALID_SECTION",
        "В этом разделе нет круговой таблицы",
        400,
      );
    const table = sectionStandings(bracket.metadata, section, bracket.matches);
    if (!table.complete)
      throw new StandingsError(
        "GROUP_NOT_COMPLETE",
        "Сначала завершите все матчи группы",
      );
    if (!table.needsDecision)
      throw new StandingsError(
        "NO_UNRESOLVED_TIE",
        "В этой группе нет неразрешённой ничьей",
      );
    if (table.fingerprint !== fingerprint)
      throw new StandingsError(
        "CONCURRENT_MODIFICATION",
        "Результаты изменились. Обновите таблицу",
      );
    if (
      new Set(order).size !== order.length ||
      order.length !== table.rows.length ||
      table.rows.some((row) => !order.includes(row.athleteId))
    )
      throw new StandingsError(
        "INVALID_ORDER",
        "Укажите всех участников группы без повторов",
        400,
      );
    const items = bracket.matches.filter((m) => m.bracketSection === section);
    const resolved = computeStandings(
      order,
      items.map((m) => {
        const score = normalizeScore(m.scoreSnapshot);
        return {
          redAthleteId: m.redAthleteId!,
          blueAthleteId: m.blueAthleteId!,
          winnerId: m.winnerId,
          redScore: score.red,
          blueScore: score.blue,
        };
      }),
      order,
    );
    if (resolved.some((row, index) => row.athleteId !== order[index]))
      throw new StandingsError(
        "INVALID_ORDER",
        "Можно менять только порядок участников с неразрешённой ничьей",
        400,
      );
    if (
      bracket.format === "MIXED" &&
      bracket.matches.some(
        (m) =>
          m.bracketSection === "playoff" &&
          m.status !== "PENDING" &&
          !(
            m.status === "COMPLETED" &&
            (m.scoreSnapshot as { bye?: boolean } | null)?.bye
          ),
      )
    )
      throw new StandingsError(
        "PLAYOFF_STARTED",
        "После начала плей-офф исправьте групповой результат через сброс матча",
      );
    const metadata = standingsMetadata(bracket.metadata);
    const decision = {
      order,
      reason: reason.trim(),
      fingerprint,
      actorUserId,
      decidedAt: new Date().toISOString(),
    };
    await tx.bracket.update({
      where: { id: bracketId },
      data: {
        metadata: {
          ...metadata,
          standingsDecisions: {
            ...metadata.standingsDecisions,
            [section]: decision,
          },
        } as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "bracket.standings_decision",
        targetEntity: "Bracket",
        targetId: bracketId,
        before: table.decision
          ? (table.decision as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        after: decision,
        metadata: { section },
      },
    });
    if (bracket.format === "MIXED") {
      const { advanceGroupWinnersIfComplete } =
        await import("./bracket.service.js");
      await advanceGroupWinnersIfComplete(bracketId, section, tx);
    }
    return { ok: true, bracketId, tournamentId: bracket.tournamentId };
  });
  emitToBracket(bracketId, "bracket:update", { bracketId });
  emitToTournament(result.tournamentId, "bracket:update", { bracketId });
  return result;
}
