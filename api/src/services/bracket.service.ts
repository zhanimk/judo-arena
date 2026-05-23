/**
 * Сервис генерации турнирных сеток.
 *
 * Принципы:
 *   • Сетка генерируется ОДИН раз для пары (tournamentId, categoryId).
 *   • Перегенерация — через DELETE + POST (с проверкой что нет начатых матчей).
 *   • Источник участников — ApplicationEntry, чья родительская Application в статусе APPROVED.
 *   • Турнир должен быть в REGISTRATION_CLOSED или IN_PROGRESS.
 */

import { prisma } from "../lib/prisma.js";
import {
  BracketFormat,
  MatchStatus,
  TournamentStatus,
  UserRole,
  type Match,
  type Prisma,
} from "@prisma/client";
import { seedAthletes, nextPowerOfTwo } from "./bracket-engine/seeding.js";
import { buildSingleElimination } from "./bracket-engine/single-elimination.js";
import { buildRoundRobin } from "./bracket-engine/round-robin.js";
import { planTatamiAssignments, type TatamiPlanCategory } from "./bracket-engine/tatami-plan.js";

export class BracketError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "BracketError";
  }
}

/** Сгенерировать сетку для категории. */
export async function generateBracket(
  actorUserId: string,
  tournamentId: string,
  categoryId: string,
) {
  await assertAdmin(actorUserId);

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new BracketError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (
    tournament.status !== TournamentStatus.REGISTRATION_CLOSED &&
    tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new BracketError(
      "INVALID_STATUS",
      "Генерировать сетки можно только после REGISTRATION_CLOSED",
      409,
    );
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.tournamentId !== tournamentId) {
    throw new BracketError("CATEGORY_MISMATCH", "Категория не принадлежит этому турниру", 404);
  }

  // Проверим что нет уже сгенерированной сетки
  const existing = await prisma.bracket.findUnique({
    where: { tournamentId_categoryId: { tournamentId, categoryId } },
  });
  if (existing) {
    throw new BracketError(
      "ALREADY_EXISTS",
      "Сетка уже сгенерирована для этой категории. Удалите её, чтобы перегенерировать.",
      409,
    );
  }

  // Собираем участников из утверждённых заявок (дедупликация по athleteId)
  const entries = await prisma.applicationEntry.findMany({
    where: {
      categoryId,
      application: { tournamentId, status: "APPROVED" },
    },
    include: { athlete: true },
  });
  const seen = new Set<string>();
  const athletes: typeof entries[number]["athlete"][] = [];
  for (const e of entries) {
    if (!seen.has(e.athlete.id)) {
      seen.add(e.athlete.id);
      athletes.push(e.athlete);
    }
  }

  if (athletes.length < 2) {
    throw new BracketError(
      "NOT_ENOUGH_ATHLETES",
      `Минимум 2 утверждённых участника, найдено ${athletes.length}`,
      409,
    );
  }

  const seed = Math.floor(Math.random() * 1_000_000_000);

  // Автовыбор формата: ≤4 участника → круговая, иначе SE
  const effectiveFormat =
    category.format === BracketFormat.ROUND_ROBIN
      ? BracketFormat.ROUND_ROBIN
      : athletes.length <= 4
        ? BracketFormat.ROUND_ROBIN
        : BracketFormat.SE_IJF;

  if (effectiveFormat === BracketFormat.ROUND_ROBIN) {
    return generateRoundRobinBracket(tournamentId, categoryId, athletes, seed);
  }
  return generateSingleEliminationBracket(tournamentId, categoryId, athletes, seed);
}

// ============================================================
// Single Elimination
// ============================================================

async function generateSingleEliminationBracket(
  tournamentId: string,
  categoryId: string,
  athletes: { id: string; clubId: string | null }[],
  seed: number,
) {
  const size = nextPowerOfTwo(athletes.length);
  const slots = seedAthletes(athletes, size, seed);
  const matches = buildSingleElimination(slots);

  const bracket = await prisma.$transaction(async (tx) => {
    const created = await tx.bracket.create({
      data: {
        tournamentId,
        categoryId,
        format: BracketFormat.SE_IJF,
        size,
      },
    });

    await tx.match.createMany({
      data: matches.map((m) => ({
        tournamentId,
        bracketId: created.id,
        round: m.round,
        position: m.position,
        bracketSection: m.bracketSection,
        redAthleteId: m.redAthleteId,
        blueAthleteId: m.blueAthleteId,
        status:
          m.redAthleteId && m.blueAthleteId
            ? MatchStatus.PENDING
            : MatchStatus.PENDING,
      })),
    });

    const createdMatches = await tx.match.findMany({
      where: { bracketId: created.id },
    });
    await advanceFirstRoundByes(tx, created.id, size, createdMatches);

    return created;
  });

  return getBracket(bracket.id);
}

/**
 * После генерации сетки — продвинуть одиночных спортсменов (BYE) через все раунды
 * основной ветки (main + final).
 *
 * Проблема: при большом числе null-слотов могут появиться null-null пары в раунде 1,
 * что создаёт BYE-ситуации в раундах 2+.
 * Алгоритм идёт раунд за раундом: обнаружил BYE → завершаем матч → продвигаем победителя.
 *
 * Repechage/bronze BYEs (появляющиеся во время игры) обрабатываются в propagateWinner.
 */
async function advanceFirstRoundByes(
  tx: Prisma.TransactionClient,
  bracketId: string,
  bracketSize: number,
  matches: Match[],
) {
  const totalRounds = Math.log2(bracketSize);

  // Map для быстрого поиска матча по (round:position:section)
  const matchMap = new Map<string, Match>();
  for (const m of matches) {
    matchMap.set(`${m.round}:${m.position}:${m.bracketSection}`, m);
  }

  // In-memory слоты, обновляются по мере обработки BYE
  const memSlots = new Map<string, { red: string | null; blue: string | null }>();
  for (const m of matches) {
    memSlots.set(m.id, { red: m.redAthleteId, blue: m.blueAthleteId });
  }

  for (let round = 1; round <= totalRounds; round++) {
    const section = round === totalRounds ? "final" : "main";
    const matchesInRound = bracketSize / Math.pow(2, round);

    for (let position = 0; position < matchesInRound; position++) {
      const match = matchMap.get(`${round}:${position}:${section}`);
      if (!match) continue;

      const s = memSlots.get(match.id)!;
      const hasRed = Boolean(s.red), hasBlue = Boolean(s.blue);
      if (hasRed === hasBlue) continue; // оба null или оба есть → пропускаем

      // КЛЮЧЕВАЯ ПРОВЕРКА: источник null-слота должен быть «мёртвой веткой» (нет спортсменов).
      // Если источник содержит атлетов, значит он ещё не доиграл — не трогаем матч.
      if (round > 1) {
        const nullSlotIsRed = !hasRed;
        // Дочерняя позиция в предыдущем раунде, которая должна была заполнить null-слот
        const srcChildPos   = nullSlotIsRed ? position * 2 : position * 2 + 1;
        const srcRound      = round - 1;
        const srcSection    = srcRound === totalRounds ? "final" : "main";
        const srcMatch      = matchMap.get(`${srcRound}:${srcChildPos}:${srcSection}`);
        if (srcMatch) {
          const srcS = memSlots.get(srcMatch.id)!;
          // Источник имеет атлетов → он доиграется и заполнит слот → НЕ трогать
          if (Boolean(srcS.red) || Boolean(srcS.blue)) continue;
        }
      }

      const winnerId = (s.red ?? s.blue)!;

      // Завершаем BYE-матч
      await tx.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.COMPLETED, winnerId, finishedAt: new Date(), scoreSnapshot: { bye: true } },
      });

      // Двигаем победителя в следующий раунд
      if (round < totalRounds) {
        const nextRound   = round + 1;
        const nextPos     = Math.floor(position / 2);
        const nextSection = nextRound === totalRounds ? "final" : "main";
        const nextMatch   = matchMap.get(`${nextRound}:${nextPos}:${nextSection}`);
        if (nextMatch) {
          const slot = position % 2 === 0 ? "red" : "blue";
          const data = slot === "red" ? { redAthleteId: winnerId } : { blueAthleteId: winnerId };
          await tx.match.update({ where: { id: nextMatch.id }, data });
          const ns = memSlots.get(nextMatch.id)!;
          if (slot === "red") ns.red = winnerId; else ns.blue = winnerId;
        }
      }
    }
  }
}

// ============================================================
// Round-Robin
// ============================================================

async function generateRoundRobinBracket(
  tournamentId: string,
  categoryId: string,
  athletes: { id: string; clubId: string | null }[],
  _seed: number,
) {
  const athleteIds = athletes.map((a) => a.id);
  const matches = buildRoundRobin(athleteIds);

  const bracket = await prisma.$transaction(async (tx) => {
    const created = await tx.bracket.create({
      data: {
        tournamentId,
        categoryId,
        format: BracketFormat.ROUND_ROBIN,
        size: athleteIds.length,
      },
    });

    await tx.match.createMany({
      data: matches.map((m) => ({
        tournamentId,
        bracketId: created.id,
        round: m.round,
        position: m.position,
        bracketSection: m.bracketSection,
        redAthleteId: m.redAthleteId,
        blueAthleteId: m.blueAthleteId,
        status: MatchStatus.PENDING,
      })),
    });

    return created;
  });

  return getBracket(bracket.id);
}

// ============================================================
// READ
// ============================================================

export async function getBracket(bracketId: string) {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    include: {
      tournament: { select: { id: true, name: true, status: true } },
      category: true,
      matches: {
        orderBy: [{ bracketSection: "asc" }, { round: "asc" }, { position: "asc" }],
        include: {
          redAthlete: { select: { id: true, name: true, surname: true, clubId: true } },
          blueAthlete: { select: { id: true, name: true, surname: true, clubId: true } },
        },
      },
    },
  });
  if (!bracket) throw new BracketError("BRACKET_NOT_FOUND", "Сетка не найдена", 404);
  return bracket;
}

export async function getBracketByCategory(tournamentId: string, categoryId: string) {
  const bracket = await prisma.bracket.findUnique({
    where: { tournamentId_categoryId: { tournamentId, categoryId } },
  });
  if (!bracket) throw new BracketError("BRACKET_NOT_FOUND", "Сетка для категории не найдена", 404);
  return getBracket(bracket.id);
}

export async function listBracketsForTournament(tournamentId: string) {
  return prisma.bracket.findMany({
    where: { tournamentId },
    include: {
      category: { select: { id: true, name: true, gender: true, weightMin: true, weightMax: true, format: true } },
      _count: { select: { matches: true } },
    },
    orderBy: { generatedAt: "asc" },
  });
}

export async function prepareTournamentDraw(actorUserId: string, tournamentId: string) {
  await assertAdmin(actorUserId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      categories: {
        orderBy: [{ gender: "asc" }, { weightMin: "asc" }],
      },
    },
  });
  if (!tournament) throw new BracketError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (
    tournament.status !== TournamentStatus.REGISTRATION_CLOSED &&
    tournament.status !== TournamentStatus.IN_PROGRESS
  ) {
    throw new BracketError(
      "INVALID_STATUS",
      "Полную подготовку можно запускать после закрытия регистрации",
      409,
    );
  }

  const categoryReports: Array<{
    categoryId: string;
    status: "created" | "exists" | "skipped";
    participants: number;
    matches: number;
    message?: string;
  }> = [];

  for (const category of tournament.categories) {
    const participants = await prisma.applicationEntry.count({
      where: {
        categoryId: category.id,
        application: { tournamentId, status: "APPROVED" },
      },
    });
    const existing = await prisma.bracket.findUnique({
      where: { tournamentId_categoryId: { tournamentId, categoryId: category.id } },
      include: { _count: { select: { matches: true } } },
    });

    if (existing) {
      categoryReports.push({
        categoryId: category.id,
        status: "exists",
        participants,
        matches: existing._count.matches,
      });
      continue;
    }

    if (participants < 2) {
      categoryReports.push({
        categoryId: category.id,
        status: "skipped",
        participants,
        matches: 0,
        message: "Минимум 2 утверждённых участника",
      });
      continue;
    }

    const bracket = await generateBracket(actorUserId, tournamentId, category.id);
    categoryReports.push({
      categoryId: category.id,
      status: "created",
      participants,
      matches: bracket.matches?.length ?? 0,
    });
  }

  const tatami = await distributeTournamentTatami(tournamentId, tournament.tatamiCount);
  const totals = {
    categories: tournament.categories.length,
    bracketsCreated: categoryReports.filter((c) => c.status === "created").length,
    bracketsExisting: categoryReports.filter((c) => c.status === "exists").length,
    skipped: categoryReports.filter((c) => c.status === "skipped").length,
    playableMatches: tatami.assigned,
  };

  return { totals, categories: categoryReports, tatami };
}

async function distributeTournamentTatami(tournamentId: string, tatamiCount: number) {
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: MatchStatus.PENDING,
      redAthleteId: { not: null },
      blueAthleteId: { not: null },
    },
    include: {
      bracket: {
        include: {
          category: { select: { id: true, gender: true, ageMin: true, ageMax: true, weightMin: true, weightMax: true } },
        },
      },
    },
  });

  const categoriesByBracket = new Map<string, TatamiPlanCategory>();
  for (const match of matches) {
    const category = match.bracket.category;
    const current = categoriesByBracket.get(match.bracketId) ?? {
      bracketId: match.bracketId,
      categoryId: category.id,
      gender: category.gender,
      ageMin: category.ageMin,
      ageMax: category.ageMax,
      weightMin: category.weightMin,
      weightMax: category.weightMax,
      matches: [],
    };
    current.matches.push({
      id: match.id,
      bracketSection: match.bracketSection,
      round: match.round,
      position: match.position,
    });
    categoriesByBracket.set(match.bracketId, current);
  }

  const plan = planTatamiAssignments([...categoriesByBracket.values()], tatamiCount);

  await prisma.$transaction(
    plan.assignments.map((assignment) =>
      prisma.match.update({
        where: { id: assignment.matchId },
        data: {
          tatamiNumber: assignment.tatamiNumber,
          queuePosition: assignment.queuePosition,
        },
      }),
    ),
  );

  return { assigned: plan.assignments.length, loads: plan.loads, categories: plan.categories };
}

// ============================================================
// DELETE
// ============================================================

export async function deleteBracket(actorUserId: string, bracketId: string) {
  await assertAdmin(actorUserId);
  const bracket = await prisma.bracket.findUnique({ where: { id: bracketId } });
  if (!bracket) throw new BracketError("BRACKET_NOT_FOUND", "Сетка не найдена", 404);

  // Нельзя удалить если уже есть начатые/завершённые матчи
  const startedMatches = await prisma.match.count({
    where: {
      bracketId,
      status: { in: [MatchStatus.IN_PROGRESS, MatchStatus.COMPLETED] },
    },
  });
  if (startedMatches > 0) {
    throw new BracketError(
      "BRACKET_IN_USE",
      `Нельзя удалить — уже есть ${startedMatches} начатых/завершённых матчей`,
      409,
    );
  }

  await prisma.bracket.delete({ where: { id: bracketId } });
}

// ============================================================
// УТИЛИТЫ
// ============================================================

async function assertAdmin(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== UserRole.ADMIN) {
    throw new BracketError("FORBIDDEN", "Только администратор может работать с сетками", 403);
  }
}
