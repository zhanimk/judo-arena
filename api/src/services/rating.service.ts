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
  BracketFormat,
  MatchStatus,
  TournamentStatus,
  UserRole,
} from "@prisma/client";
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

  const createdEntries: {
    athleteId: string;
    categoryId: string;
    place: number;
    points: number;
  }[] = [];

  for (const bracket of allBrackets) {
    if (bracket.format === BracketFormat.ROUND_ROBIN) {
      // Места по таблице
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
          redScore: (m.scoreSnapshot as any)?.red ?? {
            ippon: 0,
            wazaari: 0,
            shido: 0,
          },
          blueScore: (m.scoreSnapshot as any)?.blue ?? {
            ippon: 0,
            wazaari: 0,
            shido: 0,
          },
        })),
      );
      for (const s of standings) {
        const pts = pointsForPlace(points, s.place);
        await prisma.ratingEntry.upsert({
          where: {
            athleteId_tournamentId_categoryId: {
              athleteId: s.athleteId,
              tournamentId,
              categoryId: bracket.categoryId,
            },
          },
          update: { place: s.place, points: pts },
          create: {
            athleteId: s.athleteId,
            tournamentId,
            categoryId: bracket.categoryId,
            place: s.place,
            points: pts,
          },
        });
        createdEntries.push({
          athleteId: s.athleteId,
          categoryId: bracket.categoryId,
          place: s.place,
          points: pts,
        });
      }
    } else if (bracket.format === BracketFormat.MIXED) {
      // MIXED: групповой этап → плей-офф (все playoff матчи в bracketSection="playoff")
      const places = computePlacesFromMixedMatches(bracket.matches);
      for (const [athleteId, place] of Object.entries(places)) {
        const pts = pointsForPlace(points, place);
        await prisma.ratingEntry.upsert({
          where: {
            athleteId_tournamentId_categoryId: {
              athleteId,
              tournamentId,
              categoryId: bracket.categoryId,
            },
          },
          update: { place, points: pts },
          create: {
            athleteId,
            tournamentId,
            categoryId: bracket.categoryId,
            place,
            points: pts,
          },
        });
        createdEntries.push({
          athleteId,
          categoryId: bracket.categoryId,
          place,
          points: pts,
        });
      }
    } else {
      // Single Elimination + IJF Repechage
      const places = computePlacesFromSEMatches(bracket.matches);
      for (const [athleteId, place] of Object.entries(places)) {
        const pts = pointsForPlace(points, place);
        await prisma.ratingEntry.upsert({
          where: {
            athleteId_tournamentId_categoryId: {
              athleteId,
              tournamentId,
              categoryId: bracket.categoryId,
            },
          },
          update: { place, points: pts },
          create: {
            athleteId,
            tournamentId,
            categoryId: bracket.categoryId,
            place,
            points: pts,
          },
        });
        createdEntries.push({
          athleteId,
          categoryId: bracket.categoryId,
          place,
          points: pts,
        });
      }
    }
  }

  // Перевести турнир в COMPLETED
  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: TournamentStatus.COMPLETED },
  });

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
function computePlacesFromSEMatches(matches: any[]): Record<string, number> {
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
function computePlacesFromMixedMatches(matches: any[]): Record<string, number> {
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
  const maxRound = Math.max(...playoffMatches.map((m: any) => m.round));
  const finalMatch = playoffMatches.find((m: any) => m.round === maxRound);
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
    const semiFinals = playoffMatches.filter(
      (m: any) => m.round === maxRound - 1,
    );
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

  // Сумма очков по спортсменам
  const athletePoints = await prisma.ratingEntry.groupBy({
    by: ["athleteId"],
    _sum: { points: true },
  });

  if (athletePoints.length === 0) return [];

  // Клубы спортсменов
  const athletes = await prisma.user.findMany({
    where: {
      id: { in: athletePoints.map((e) => e.athleteId) },
      clubId: { not: null },
    },
    select: { id: true, clubId: true },
  });
  const clubOfAthlete = new Map(athletes.map((a) => [a.id, a.clubId!]));

  // Группируем по клубу в памяти
  const clubPoints = new Map<string, { total: number; athletes: number }>();
  for (const entry of athletePoints) {
    const clubId = clubOfAthlete.get(entry.athleteId);
    if (!clubId) continue;
    const pts = Number(entry._sum.points ?? 0);
    const prev = clubPoints.get(clubId) ?? { total: 0, athletes: 0 };
    clubPoints.set(clubId, {
      total: prev.total + pts,
      athletes: prev.athletes + 1,
    });
  }

  const sorted = [...clubPoints.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit);

  const clubs = await prisma.club.findMany({
    where: { id: { in: sorted.map(([id]) => id) } },
    select: {
      id: true,
      name: true,
      shortName: true,
      city: true,
      _count: { select: { members: true } },
    },
  });
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  return sorted
    .filter(([id]) => clubById.has(id))
    .map(([id, { total, athletes }], idx) => ({
      rank: idx + 1,
      club: clubById.get(id)!,
      totalPoints: total,
      athleteCount: athletes,
    }));
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

export async function getLeaderboard(options: {
  categoryId?: string;
  clubId?: string;
  limit?: number;
}) {
  // Агрегируем сумму очков по атлету
  const where: any = {};
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
