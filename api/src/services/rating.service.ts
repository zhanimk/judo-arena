/**
 * Сервис рейтинга.
 *
 * При завершении турнира (статус COMPLETED) — автоматически или вручную
 * вызывается finalizeTournament(), который:
 *   1. По каждой сетке определяет места (1, 2, 3, 3, 5, 5, 7, 7).
 *   2. Создаёт RatingEntry для каждого спортсмена.
 *
 * Очки (берутся из SystemConfig.ratingPoints):
 *   1-е место  → 100
 *   2-е        → 80
 *   3-е        → 50 (двое)
 *   проигрыш за 3-е (полуфинал) → 30
 *   7-е (после Repechage)        → 15
 *   участие                      → 0
 */

import { prisma } from "../lib/prisma.js";
import {
  Prisma,
  BracketFormat,
  MatchStatus,
  TournamentStatus,
  UserRole,
} from "@prisma/client";
import { normalizeScore } from "./match-types.js";

/** Минимальный набор полей матча, нужных для подсчёта мест. */
interface RatedMatch {
  bracketSection: string | null;
  status: string;
  winnerId: string | null;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  round: number;
  position: number;
}
import { computeStandings } from "./bracket-engine/round-robin.js";
import { logAudit } from "./audit.service.js";

export class RatingError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "RatingError";
  }
}

interface RatingPoints {
  place1: number;
  place2: number;
  place3: number;
  place3Loss: number;
  place7Repechage: number;
  participation: number;
  ipponBonus?: number;
}

const DEFAULT_POINTS: RatingPoints = {
  place1: 100,
  place2: 80,
  place3: 50,
  place3Loss: 30,
  place7Repechage: 15,
  participation: 0,
};

async function getRatingPoints(): Promise<RatingPoints> {
  const cfg = await prisma.systemConfig.findUnique({
    where: { key: "ratingPoints" },
  });
  if (!cfg) return DEFAULT_POINTS;
  return cfg.value as unknown as RatingPoints;
}

function pointsForPlace(p: RatingPoints, place: number): number {
  if (place === 1) return p.place1;
  if (place === 2) return p.place2;
  if (place === 3) return p.place3;
  if (place === 4) return p.place3Loss;
  if (place === 5) return p.place3Loss;
  if (place === 7 || place === 8) return p.place7Repechage;
  return p.participation;
}

/**
 * Закрыть турнир, посчитать места и начислить рейтинг.
 * Меняет статус Tournament → COMPLETED.
 */
export async function finalizeTournament(
  actorUserId: string,
  tournamentId: string,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new RatingError(
      "FORBIDDEN",
      "Только админ может финализировать турнир",
      403,
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament)
    throw new RatingError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (tournament.status === TournamentStatus.COMPLETED) {
    throw new RatingError("ALREADY_COMPLETED", "Турнир уже завершён", 409);
  }

  const points = await getRatingPoints();
  const allBrackets = await prisma.bracket.findMany({
    where: { tournamentId },
    include: { matches: true, category: true },
  });
  if (allBrackets.length === 0) {
    throw new RatingError(
      "NO_BRACKETS",
      "Сначала подготовьте сетки турнира",
      409,
    );
  }

  const unfinishedPlayableMatches = await prisma.match.count({
    where: {
      tournamentId,
      redAthleteId: { not: null },
      blueAthleteId: { not: null },
      status: { not: MatchStatus.COMPLETED },
    },
  });
  if (unfinishedPlayableMatches > 0) {
    throw new RatingError(
      "MATCHES_NOT_COMPLETED",
      `Нельзя финализировать турнир: осталось ${unfinishedPlayableMatches} незавершённых матчей`,
      409,
    );
  }

  // Собираем все записи вне транзакции — чистая вычислительная логика
  const createdEntries: {
    athleteId: string;
    categoryId: string;
    place: number;
    points: number;
  }[] = [];

  for (const bracket of allBrackets) {
    if (bracket.format === BracketFormat.ROUND_ROBIN) {
      const matches = bracket.matches.filter(
        (m) => m.status === MatchStatus.COMPLETED,
      );
      const athleteIds = Array.from(
        new Set(
          matches.flatMap(
            (m) =>
              [m.redAthleteId, m.blueAthleteId].filter(Boolean) as string[],
          ),
        ),
      );
      const standings = computeStandings(
        athleteIds,
        matches.map((m) => ({
          redAthleteId: m.redAthleteId!,
          blueAthleteId: m.blueAthleteId!,
          winnerId: m.winnerId,
          redScore: normalizeScore(m.scoreSnapshot).red ?? {
            ippon: 0,
            wazaari: 0,
            shido: 0,
          },
          blueScore: normalizeScore(m.scoreSnapshot).blue ?? {
            ippon: 0,
            wazaari: 0,
            shido: 0,
          },
        })),
      );
      for (const s of standings) {
        createdEntries.push({
          athleteId: s.athleteId,
          categoryId: bracket.categoryId,
          place: s.place,
          points: pointsForPlace(points, s.place),
        });
      }
    } else if (bracket.format === BracketFormat.MIXED) {
      const places = computePlacesFromMixedMatches(bracket.matches);
      for (const [athleteId, place] of Object.entries(places)) {
        createdEntries.push({
          athleteId,
          categoryId: bracket.categoryId,
          place,
          points: pointsForPlace(points, place),
        });
      }
    } else {
      const places = computePlacesFromSEMatches(bracket.matches);
      for (const [athleteId, place] of Object.entries(places)) {
        createdEntries.push({
          athleteId,
          categoryId: bracket.categoryId,
          place,
          points: pointsForPlace(points, place),
        });
      }
    }
  }

  // Атомарно записываем все места и переводим турнир в COMPLETED
  const updated = await prisma.$transaction(
    async (tx) => {
      for (const entry of createdEntries) {
        await tx.ratingEntry.upsert({
          where: {
            athleteId_tournamentId_categoryId: {
              athleteId: entry.athleteId,
              tournamentId,
              categoryId: entry.categoryId,
            },
          },
          update: { place: entry.place, points: entry.points },
          create: {
            athleteId: entry.athleteId,
            tournamentId,
            categoryId: entry.categoryId,
            place: entry.place,
            points: entry.points,
          },
        });
      }
      return tx.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.COMPLETED },
      });
    },
    { timeout: 30_000 },
  );

  await logAudit({
    actorUserId,
    action: "tournament.finalize",
    targetEntity: "Tournament",
    targetId: tournamentId,
    after: { status: "COMPLETED", entriesCreated: createdEntries.length },
  });

  return {
    tournament: updated,
    entriesCount: createdEntries.length,
    entries: createdEntries,
  };
}

/**
 * Вычислить места из матчей Single Elimination + IJF Repechage:
 *   1 = победитель финала
 *   2 = проигравший финала
 *   3 = победители бронзовых матчей
 *   5 = проигравшие бронзовых матчей
 *   7 = проигравшие матчей репешажа
 *  99 = участие (все остальные)
 */
function computePlacesFromSEMatches(
  matches: RatedMatch[],
): Record<string, number> {
  const places: Record<string, number> = {};

  // 1-е и 2-е место — финал
  const final = matches.find(
    (m) => m.bracketSection === "final" && m.status === "COMPLETED",
  );
  if (final && final.winnerId) {
    places[final.winnerId] = 1;
    const loserId =
      final.redAthleteId === final.winnerId
        ? final.blueAthleteId
        : final.redAthleteId;
    if (loserId) places[loserId] = 2;
  }

  // 3-е и 5-е место — бронзовые матчи
  const bronzes = matches.filter(
    (m) =>
      (m.bracketSection === "bronze1" || m.bracketSection === "bronze2") &&
      m.status === "COMPLETED",
  );
  for (const b of bronzes) {
    if (b.winnerId) places[b.winnerId] = 3;
    const loserId =
      b.redAthleteId === b.winnerId ? b.blueAthleteId : b.redAthleteId;
    if (loserId && !(loserId in places)) places[loserId] = 5;
  }

  // 7-е место — проигравшие матчей репешажа (не дошли до бронзы)
  const repechages = matches.filter(
    (m) => m.bracketSection === "repechage" && m.status === "COMPLETED",
  );
  for (const r of repechages) {
    if (!r.winnerId) continue;
    const loserId =
      r.redAthleteId === r.winnerId ? r.blueAthleteId : r.redAthleteId;
    if (loserId && !(loserId in places)) places[loserId] = 7;
  }

  // Все остальные — участие
  for (const m of matches) {
    if (m.redAthleteId && !(m.redAthleteId in places))
      places[m.redAthleteId] = 99;
    if (m.blueAthleteId && !(m.blueAthleteId in places))
      places[m.blueAthleteId] = 99;
  }
  return places;
}

/**
 * Вычислить места из MIXED-формата (групповой этап → плей-офф).
 * Плей-офф матчи все имеют bracketSection = "playoff".
 *   1 = победитель последнего раунда плей-офф
 *   2 = проигравший последнего раунда
 *   3 = проигравшие полуфиналов (предпоследний раунд)
 *  99 = групповой этап + остальные
 */
function computePlacesFromMixedMatches(
  matches: RatedMatch[],
): Record<string, number> {
  const places: Record<string, number> = {};

  const playoffMatches = matches.filter(
    (m) => m.bracketSection === "playoff" && m.status === "COMPLETED",
  );

  if (playoffMatches.length === 0) {
    // Все групповые матчи — ничьего нет в плей-офф, всем участие
    for (const m of matches) {
      if (m.redAthleteId && !(m.redAthleteId in places))
        places[m.redAthleteId] = 99;
      if (m.blueAthleteId && !(m.blueAthleteId in places))
        places[m.blueAthleteId] = 99;
    }
    return places;
  }

  // Находим последний раунд плей-офф (финал)
  const maxRound = Math.max(...playoffMatches.map((m) => m.round));
  const finalMatch = playoffMatches.find((m) => m.round === maxRound);
  if (finalMatch?.winnerId) {
    places[finalMatch.winnerId] = 1;
    const loserId =
      finalMatch.redAthleteId === finalMatch.winnerId
        ? finalMatch.blueAthleteId
        : finalMatch.redAthleteId;
    if (loserId) places[loserId] = 2;
  }

  // Предпоследний раунд — полуфиналы, проигравшие → 3-е место
  if (maxRound >= 2) {
    const semiFinals = playoffMatches.filter((m) => m.round === maxRound - 1);
    for (const sf of semiFinals) {
      if (!sf.winnerId) continue;
      const loserId =
        sf.redAthleteId === sf.winnerId ? sf.blueAthleteId : sf.redAthleteId;
      if (loserId && !(loserId in places)) places[loserId] = 3;
    }
  }

  // Все остальные — участие
  for (const m of matches) {
    if (m.redAthleteId && !(m.redAthleteId in places))
      places[m.redAthleteId] = 99;
    if (m.blueAthleteId && !(m.blueAthleteId in places))
      places[m.blueAthleteId] = 99;
  }
  return places;
}

// ============================================================
// Leaderboards
// ============================================================

export async function getClubLeaderboard(options: { limit?: number } = {}) {
  const limit = Math.min(options.limit ?? 50, 200);

  // Один JOIN-запрос вместо трёх отдельных.
  // RatingEntry → User (athleteId=id, clubId NOT NULL) → Club
  // GROUP BY clubId, агрегируем SUM(points) и COUNT(DISTINCT athleteId).
  type ClubRow = {
    clubId: string;
    clubName: unknown; // Json { ru, kk, en }
    shortName: string | null;
    city: string;
    memberCount: bigint;
    totalPoints: number;
    athleteCount: bigint;
  };

  const rows = await prisma.$queryRaw<ClubRow[]>`
    SELECT
      c.id                                      AS "clubId",
      c.name                                    AS "clubName",
      c."shortName"                             AS "shortName",
      c.city                                    AS "city",
      (SELECT COUNT(*) FROM "User" m WHERE m."clubId" = c.id)
                                                AS "memberCount",
      COALESCE(SUM(re.points), 0)::float        AS "totalPoints",
      COUNT(DISTINCT re."athleteId")            AS "athleteCount"
    FROM "Club" c
    INNER JOIN "User" u   ON u."clubId" = c.id
    INNER JOIN "RatingEntry" re ON re."athleteId" = u.id
    GROUP BY c.id, c.name, c."shortName", c.city
    ORDER BY "totalPoints" DESC
    LIMIT ${limit}
  `;

  return rows.map((row, idx) => ({
    rank: idx + 1,
    club: {
      id: row.clubId,
      name: row.clubName,
      shortName: row.shortName,
      city: row.city,
      _count: { members: Number(row.memberCount) },
    },
    totalPoints: Number(row.totalPoints),
    athleteCount: Number(row.athleteCount),
  }));
}

/**
 * Полная статистика спортсмена.
 * Агрегирует данные из Match, MatchEvent и RatingEntry.
 */
export async function getAthleteStats(athleteId: string) {
  // 1. Все завершённые матчи где участвовал спортсмен
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      OR: [{ redAthleteId: athleteId }, { blueAthleteId: athleteId }],
      // Исключаем BYE-матчи (у них scoreSnapshot.bye = true, winnerId есть но фактически нет соперника)
      NOT: { AND: [{ redAthleteId: null }, { blueAthleteId: null }] },
    },
    select: {
      id: true,
      winnerId: true,
      redAthleteId: true,
      blueAthleteId: true,
      isGoldenScore: true,
      finishedAt: true,
      tournamentId: true,
      scoreSnapshot: true,
      bracket: {
        select: {
          categoryId: true,
          category: {
            select: { weightMin: true, weightMax: true, gender: true },
          },
        },
      },
      events: {
        where: { type: { in: ["IPPON", "WAZA_ARI", "HANSOKU_MAKE"] } },
        select: { type: true, side: true },
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
    },
  });

  // Фильтруем BYE: оба спортсмена должны быть заполнены
  const realMatches = matches.filter(
    (m) => m.redAthleteId !== null && m.blueAthleteId !== null,
  );

  const total = realMatches.length;
  const wins = realMatches.filter((m) => m.winnerId === athleteId).length;
  const losses = total - wins;
  const goldenScoreWins = realMatches.filter(
    (m) => m.winnerId === athleteId && m.isGoldenScore,
  ).length;

  // Подсчёт типов побед по последнему финальному событию
  let ipponWins = 0;
  let wazaariWins = 0;
  let hansokuWins = 0; // победа по дисквалификации соперника

  for (const m of realMatches) {
    if (m.winnerId !== athleteId) continue;
    const lastEvent = m.events[0];
    if (!lastEvent) continue;

    const winnerSide = m.winnerId === m.redAthleteId ? "RED" : "BLUE";
    if (lastEvent.type === "IPPON" && lastEvent.side === winnerSide)
      ipponWins++;
    else if (lastEvent.type === "WAZA_ARI" && lastEvent.side === winnerSide)
      wazaariWins++;
    else if (lastEvent.type === "HANSOKU_MAKE" && lastEvent.side !== winnerSide)
      hansokuWins++;
  }

  // Турниры где участвовал
  const tournamentIds = [...new Set(realMatches.map((m) => m.tournamentId))];

  // Рейтинговые записи
  const ratingEntries = await prisma.ratingEntry.findMany({
    where: { athleteId },
    include: {
      tournament: { select: { id: true, name: true, startDate: true } },
      category: { select: { gender: true, weightMin: true, weightMax: true } },
    },
    orderBy: { awardedAt: "asc" },
  });

  const totalPoints = ratingEntries.reduce((s, e) => s + Number(e.points), 0);
  const bestPlace =
    ratingEntries.length > 0
      ? Math.min(...ratingEntries.map((e) => e.place))
      : null;

  // Динамика рейтинга: накопленный итог по датам турниров
  const ratingHistory = ratingEntries.reduce<
    Array<{ date: string; points: number; tournamentName: string }>
  >((acc, e) => {
    const prev = acc.length > 0 ? acc[acc.length - 1]! : { points: 0 };
    const tName = e.tournament.name;
    const name =
      typeof tName === "object" && tName !== null
        ? ((tName as Record<string, string>)["kk"] ??
          (tName as Record<string, string>)["ru"] ??
          "—")
        : String(tName ?? "—");
    acc.push({
      date: e.tournament.startDate.toISOString().split("T")[0]!,
      points: prev.points + Number(e.points),
      tournamentName: name,
    });
    return acc;
  }, []);

  return {
    athleteId,
    matches: {
      total,
      wins,
      losses,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      goldenScoreWins,
      ipponWins,
      wazaariWins,
      hansokuWins,
      ipponWinRate: wins > 0 ? Math.round((ipponWins / wins) * 100) : 0,
    },
    tournaments: {
      total: tournamentIds.length,
      bestPlace,
    },
    rating: {
      totalPoints,
      entriesCount: ratingEntries.length,
      history: ratingHistory,
      recent: ratingEntries.slice(-5).reverse(),
    },
  };
}

export async function getAthleteRating(athleteId: string) {
  const entries = await prisma.ratingEntry.findMany({
    where: { athleteId },
    include: {
      tournament: { select: { id: true, name: true, startDate: true } },
      category: {
        select: {
          id: true,
          name: true,
          gender: true,
          weightMin: true,
          weightMax: true,
        },
      },
    },
    orderBy: { awardedAt: "desc" },
  });
  const total = entries.reduce((sum, e) => sum + Number(e.points), 0);
  return { athleteId, totalPoints: total, entries };
}

/**
 * Рейтинг по весовой категории — сквозной по всем турнирам.
 * Фильтрует RatingEntry по gender + weightMax категории (точное совпадение).
 * Позволяет сравнивать спортсменов одного веса вне зависимости от турнира.
 */
export async function getWeightClassLeaderboard(options: {
  gender: "MALE" | "FEMALE";
  weightMax: number;
  limit?: number;
}) {
  const limit = Math.min(options.limit ?? 50, 200);

  // Находим все категории с нужным gender + weightMax
  const categories = await prisma.category.findMany({
    where: { gender: options.gender, weightMax: options.weightMax },
    select: { id: true },
  });

  if (categories.length === 0) {
    return [];
  }

  const categoryIds = categories.map((c) => c.id);

  // Агрегируем сумму очков по атлету в этих категориях
  const grouped = await prisma.ratingEntry.groupBy({
    by: ["athleteId"],
    where: { categoryId: { in: categoryIds } },
    _sum: { points: true },
    _count: { tournamentId: true },
    _min: { place: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const athletes = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.athleteId) } },
    select: {
      id: true,
      name: true,
      surname: true,
      nameLatin: true,
      surnameLatin: true,
      gender: true,
      weightKg: true,
      beltRank: true,
      clubId: true,
      club: { select: { id: true, name: true, shortName: true, city: true } },
    },
  });

  const byId = new Map(athletes.map((a) => [a.id, a]));

  return grouped
    .filter((g) => byId.has(g.athleteId))
    .map((g, idx) => ({
      rank: idx + 1,
      athlete: byId.get(g.athleteId)!,
      totalPoints: Number(g._sum.points ?? 0),
      tournamentsCount: g._count.tournamentId,
      bestPlace: g._min.place,
    }));
}

/**
 * Список доступных весовых категорий (уникальные weightMax + gender).
 * Используется для фильтра на странице рейтинга.
 */
export async function getAvailableWeightClasses() {
  const cats = await prisma.category.findMany({
    select: { gender: true, weightMax: true, weightMin: true },
    distinct: ["gender", "weightMax"],
    orderBy: [{ gender: "asc" }, { weightMax: "asc" }],
  });
  return cats.map((c) => ({
    gender: c.gender,
    weightMax: c.weightMax,
    weightMin: c.weightMin,
    label: `${c.gender === "MALE" ? "Ер" : "Әйел"} ${c.weightMax >= 200 ? `+${c.weightMin}` : `-${c.weightMax}`} кг`,
  }));
}

export async function getLeaderboard(options: {
  categoryId?: string;
  clubId?: string;
  limit?: number;
}) {
  // Агрегируем сумму очков по атлету
  const where: Prisma.RatingEntryWhereInput = {};
  if (options.categoryId) where.categoryId = options.categoryId;

  const grouped = await prisma.ratingEntry.groupBy({
    by: ["athleteId"],
    where,
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: Math.min(options.limit ?? 50, 200),
  });

  // Подтягиваем данные спортсменов
  const athletes = await prisma.user.findMany({
    where: {
      id: { in: grouped.map((g) => g.athleteId) },
      ...(options.clubId ? { clubId: options.clubId } : {}),
    },
    select: {
      id: true,
      name: true,
      surname: true,
      gender: true,
      weightKg: true,
      beltRank: true,
      clubId: true,
      club: { select: { id: true, name: true, shortName: true, city: true } },
    },
  });
  const byId = new Map(athletes.map((a) => [a.id, a]));

  return grouped
    .filter((g) => byId.has(g.athleteId))
    .map((g, idx) => ({
      rank: idx + 1,
      athlete: byId.get(g.athleteId)!,
      totalPoints: Number(g._sum.points ?? 0),
    }));
}
