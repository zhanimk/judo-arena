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

  // Собираем участников из утверждённых заявок
  const entries = await prisma.applicationEntry.findMany({
    where: {
      categoryId,
      application: { tournamentId, status: "APPROVED" },
    },
    include: { athlete: true },
  });
  const athletes = entries.map((e) => e.athlete);

  if (athletes.length < 2) {
    throw new BracketError(
      "NOT_ENOUGH_ATHLETES",
      `Минимум 2 утверждённых участника, найдено ${athletes.length}`,
      409,
    );
  }

  const seed = Math.floor(Math.random() * 1_000_000_000);

  // Генерируем сетку в зависимости от формата
  if (category.format === BracketFormat.ROUND_ROBIN) {
    return generateRoundRobinBracket(tournamentId, categoryId, athletes, seed);
  }
  // SE_IJF и MIXED (MIXED пока упрощается до SE)
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

async function advanceFirstRoundByes(
  tx: Prisma.TransactionClient,
  bracketId: string,
  bracketSize: number,
  matches: Match[],
) {
  const totalRounds = Math.log2(bracketSize);
  const byes = matches.filter((match) => {
    const hasRed = Boolean(match.redAthleteId);
    const hasBlue = Boolean(match.blueAthleteId);
    return match.bracketSection === "main" && match.round === 1 && hasRed !== hasBlue;
  });

  for (const bye of byes) {
    const winnerId = bye.redAthleteId ?? bye.blueAthleteId;
    if (!winnerId) continue;

    await tx.match.update({
      where: { id: bye.id },
      data: {
        status: MatchStatus.COMPLETED,
        winnerId,
        finishedAt: new Date(),
        scoreSnapshot: { bye: true },
      },
    });

    const nextRound = bye.round + 1;
    const target = matches.find((match) => {
      const section = nextRound === totalRounds ? "final" : "main";
      return (
        match.bracketId === bracketId &&
        match.round === nextRound &&
        match.position === Math.floor(bye.position / 2) &&
        match.bracketSection === section
      );
    });
    if (!target) continue;

    const data = bye.position % 2 === 0
      ? { redAthleteId: winnerId }
      : { blueAthleteId: winnerId };
    await tx.match.update({ where: { id: target.id }, data });
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
  const safeTatamiCount = Math.max(1, tatamiCount || 1);
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
          category: { select: { gender: true, ageMin: true, weightMin: true, weightMax: true } },
        },
      },
    },
  });

  const ordered = matches.sort((a, b) => {
    const aCat = a.bracket.category;
    const bCat = b.bracket.category;
    return (
      aCat.gender.localeCompare(bCat.gender) ||
      aCat.ageMin - bCat.ageMin ||
      aCat.weightMin - bCat.weightMin ||
      aCat.weightMax - bCat.weightMax ||
      sectionOrder(a.bracketSection) - sectionOrder(b.bracketSection) ||
      a.round - b.round ||
      a.position - b.position
    );
  });

  const loads = Array.from({ length: safeTatamiCount }, (_, idx) => ({
    tatamiNumber: idx + 1,
    matches: 0,
  }));

  await prisma.$transaction(
    ordered.map((match, index) => {
      const tatamiNumber = (index % safeTatamiCount) + 1;
      loads[tatamiNumber - 1]!.matches += 1;
      return prisma.match.update({
        where: { id: match.id },
        data: { tatamiNumber, queuePosition: loads[tatamiNumber - 1]!.matches },
      });
    }),
  );

  return { assigned: ordered.length, loads };
}

function sectionOrder(section: string | null): number {
  const order: Record<string, number> = {
    main: 1,
    repechage: 2,
    bronze1: 3,
    bronze2: 3,
    final: 4,
  };
  return section ? order[section] ?? 9 : 9;
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
