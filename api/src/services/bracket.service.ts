/**
 * Сервис генерации турнирных сеток.
 *
 * Принципы:
 *   • Сетка генерируется ОДИН раз для пары (tournamentId, categoryId).
 *   • Перегенерация — через DELETE + POST (с проверкой что нет начатых матчей).
 *   • Источник участников — ApplicationEntry, чья родительская Application в статусе APPROVED
 *     и чей статус взвешивания PASSED.
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
import { buildMixedBracket } from "./bracket-engine/mixed.js";
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
      weighInStatus: "PASSED",
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
      `Минимум 2 допущенных после взвешивания участника, найдено ${athletes.length}`,
      409,
    );
  }

  const seed = Math.floor(Math.random() * 1_000_000_000);

  // MIXED = группы (≤8 в группе, Round-Robin) + плей-офф SE
  if (category.format === BracketFormat.MIXED) {
    if (athletes.length < 4) {
      throw new BracketError(
        "NOT_ENOUGH_FOR_MIXED",
        `MIXED требует минимум 4 участника, найдено ${athletes.length}`,
        409,
      );
    }
    return generateMixedBracket(tournamentId, categoryId, athletes, seed);
  }

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
// MIXED
// ============================================================

async function generateMixedBracket(
  tournamentId: string,
  categoryId: string,
  athletes: { id: string; clubId: string | null }[],
  seed: number,
) {
  const seeded = seedAthletes(athletes, athletes.length, seed);
  // seeded may contain null slots — filter them out
  const seededIds = seeded.filter(Boolean) as string[];

  const plan = buildMixedBracket(seededIds);

  const bracket = await prisma.$transaction(async (tx) => {
    const created = await tx.bracket.create({
      data: {
        tournamentId,
        categoryId,
        format: BracketFormat.MIXED,
        size: plan.playoffSize,
        // Store group metadata as JSON for UI rendering and advancement logic
        metadata: {
          groups: plan.groups,
        } as any,
      },
    });

    // Create group-stage matches
    await tx.match.createMany({
      data: plan.groupMatches.map((m) => ({
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

    // Create playoff shell (empty athlete slots)
    await tx.match.createMany({
      data: plan.playoffMatches.map((m) => ({
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

/**
 * Called from match.service when a group match completes.
 * Checks if all matches in the group are done; if so, computes standings
 * and fills the playoff bracket slots for top-2 advancers.
 *
 * Exported so match.service can call it without circular dependency.
 */
export async function advanceGroupWinnersIfComplete(
  bracketId: string,
  groupSection: string, // e.g. "group_A"
): Promise<void> {
  // Load all matches in this group
  const groupMatches = await prisma.match.findMany({
    where: { bracketId, bracketSection: groupSection },
  });

  // Not all done yet
  if (groupMatches.some((m) => m.status !== MatchStatus.COMPLETED)) return;

  // Load bracket metadata to get group athlete lists
  const bracket = await prisma.bracket.findUnique({ where: { id: bracketId } });
  if (!bracket || bracket.format !== BracketFormat.MIXED) return;

  const metadata = bracket.metadata as { groups: { label: string; athleteIds: string[] }[] } | null;
  if (!metadata?.groups) return;

  const groupLabel = groupSection.replace("group_", ""); // "A"
  const groupIdx = groupLabel.charCodeAt(0) - 65; // A=0, B=1, …
  const group = metadata.groups[groupIdx];
  if (!group) return;

  // Compute standings
  const { computeGroupStandings } = await import("./bracket-engine/mixed.js");
  const results = groupMatches
    .filter((m) => m.redAthleteId && m.blueAthleteId)
    .map((m) => ({
      redAthleteId: m.redAthleteId!,
      blueAthleteId: m.blueAthleteId!,
      winnerId: m.winnerId,
    }));

  const standings = computeGroupStandings(group.athleteIds, results);
  const top2 = standings.slice(0, 2);

  if (top2.length < 2) return;

  // Place top-2 into playoff round-1 slots
  const { playoffSlotForGroup } = await import("./bracket-engine/mixed.js");
  const _numGroups = metadata.groups.length;
  // playoffSize is the bracket size (stored in bracket.size)
  const _playoffSize = bracket.size;

  for (const standing of top2) {
    const place = standing.place as 1 | 2;
    const { position, slot } = playoffSlotForGroup(groupIdx, place, _playoffSize);

    const playoffMatch = await prisma.match.findFirst({
      where: { bracketId, bracketSection: "playoff", round: 1, position },
    });
    if (!playoffMatch) continue;

    const data: any = {};
    if (slot === "red") data.redAthleteId = standing.athleteId;
    else data.blueAthleteId = standing.athleteId;

    await prisma.match.update({ where: { id: playoffMatch.id }, data });
  }

  // After filling slots, check for BYEs in playoff round 1
  // (if advancers < playoffSize some slots remain null)
  await resolvePlayoffByes(bracketId, metadata.groups.length * 2, _playoffSize);
}

/** Auto-complete playoff round-1 matches that have exactly 1 athlete (BYE). */
async function resolvePlayoffByes(
  bracketId: string,
  _totalAdvancers: number,
  _playoffSize: number,
): Promise<void> {
  // We need ALL groups done before processing BYEs (some slots still TBD)
  const bracket = await prisma.bracket.findUnique({ where: { id: bracketId } });
  const metadata = bracket?.metadata as { groups: { label: string; athleteIds: string[] }[] } | null;
  if (!metadata?.groups) return;

  // Check all groups are complete
  for (const g of metadata.groups) {
    const section = `group_${g.label}`;
    const incomplete = await prisma.match.count({
      where: { bracketId, bracketSection: section, status: { not: MatchStatus.COMPLETED } },
    });
    if (incomplete > 0) return; // still waiting
  }

  // All groups done — find playoff R1 BYEs
  const r1Matches = await prisma.match.findMany({
    where: { bracketId, bracketSection: "playoff", round: 1 },
  });

  for (const m of r1Matches) {
    if (m.status === MatchStatus.COMPLETED) continue;
    const hasRed = Boolean(m.redAthleteId);
    const hasBlue = Boolean(m.blueAthleteId);
    if (hasRed === hasBlue) continue; // both null (skip) or both filled (play normally)

    // One athlete, no opponent — BYE
    const winnerId = (m.redAthleteId ?? m.blueAthleteId)!;
    const _updated = await prisma.match.update({
      where: { id: m.id },
      data: {
        status: MatchStatus.COMPLETED,
        winnerId,
        finishedAt: new Date(),
        scoreSnapshot: { bye: true } as any,
      },
    });

    // Advance winner to round 2
    const nextPos = Math.floor(m.position / 2);
    const nextMatch = await prisma.match.findFirst({
      where: { bracketId, bracketSection: "playoff", round: 2, position: nextPos },
    });
    if (nextMatch) {
      const slot = m.position % 2 === 0 ? "red" : "blue";
      await prisma.match.update({
        where: { id: nextMatch.id },
        data: slot === "red" ? { redAthleteId: winnerId } : { blueAthleteId: winnerId },
      });
    }
  }
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
        weighInStatus: "PASSED",
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
        message: "Минимум 2 допущенных после взвешивания участника",
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
