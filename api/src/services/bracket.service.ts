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
            : MatchStatus.PENDING, // BYE-победы можно обработать отдельным шагом
      })),
    });

    return created;
  });

  return getBracket(bracket.id);
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
