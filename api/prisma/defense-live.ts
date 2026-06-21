/**
 * defense-live.ts
 *
 * Turns the standard demo seed into a defense-ready live tournament:
 * - tournament is IN_PROGRESS and featured
 * - several matches are already completed with score events
 * - one match is live on every tatami, with visible scoreboard state
 * - upcoming queues are normalized per tatami
 * - judge links, notifications, audit logs and rating entries are present
 *
 * Run after the normal seed:
 *   cd api && npx tsx prisma/defense-live.ts
 */

import {
  MatchEventType,
  MatchSide,
  MatchStatus,
  PaymentStatus,
  PrismaClient,
  TournamentStatus,
  UserRole,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { propagateWinner } from "../src/services/match-propagation.js";

const prisma = new PrismaClient();

const TOURNAMENT_ID = "demo-complete-flow-2026";
const LIVE_STARTED_AT = new Date(Date.now() - 92_000);

const OUTCOMES = [
  {
    winner: "RED" as const,
    event: MatchEventType.IPPON,
    side: MatchSide.RED,
    red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 1, hansoku: false },
  },
  {
    winner: "BLUE" as const,
    event: MatchEventType.WAZA_ARI,
    side: MatchSide.BLUE,
    red: { ippon: 0, wazaari: 0, yuko: 0, shido: 1, hansoku: false },
    blue: { ippon: 0, wazaari: 2, yuko: 0, shido: 0, hansoku: false },
  },
  {
    winner: "RED" as const,
    event: MatchEventType.WAZA_ARI,
    side: MatchSide.RED,
    red: { ippon: 0, wazaari: 1, yuko: 0, shido: 0, hansoku: false },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 2, hansoku: false },
  },
  {
    winner: "BLUE" as const,
    event: MatchEventType.HANSOKU_MAKE,
    side: MatchSide.RED,
    red: { ippon: 0, wazaari: 0, yuko: 0, shido: 3, hansoku: true },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
  },
];

function completedScore(
  outcome: (typeof OUTCOMES)[number],
  elapsedSec: number,
) {
  return {
    red: outcome.red,
    blue: outcome.blue,
    isGoldenScore: false,
    osaekomi: null,
    clock: { running: false, elapsedSec, runningStartedAt: null },
    pendingResult: null,
  };
}

function liveScore(seed: number) {
  const redWazaari = seed % 2;
  const blueShido = (seed % 3) + 1;
  return {
    red: {
      ippon: 0,
      wazaari: redWazaari,
      yuko: 0,
      shido: seed % 2,
      hansoku: false,
    },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: blueShido, hansoku: false },
    isGoldenScore: false,
    osaekomi:
      seed % 2 === 0
        ? {
            side: "RED",
            startedAt: new Date(Date.now() - 11_000).toISOString(),
            elapsedBeforeSec: 0,
          }
        : null,
    clock: {
      running: true,
      elapsedSec: 92 + seed * 9,
      runningStartedAt: LIVE_STARTED_AT.toISOString(),
    },
    pendingResult: null,
  };
}

async function addEvent(
  matchId: string,
  type: MatchEventType,
  side: MatchSide,
  scoreSnapshot: unknown,
  offsetSec: number,
) {
  await prisma.matchEvent.create({
    data: {
      matchId,
      type,
      side,
      scoreSnapshot: scoreSnapshot as object,
      occurredAt: new Date(Date.now() - offsetSec * 1000),
    },
  });
}

async function completePlayableMatch(matchId: string, index: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || !match.redAthleteId || !match.blueAthleteId) return false;

  const outcome = OUTCOMES[index % OUTCOMES.length]!;
  const winnerId =
    outcome.winner === "RED" ? match.redAthleteId : match.blueAthleteId;
  const startedAt = new Date(Date.now() - (95 - index * 4) * 60_000);
  const finishedAt = new Date(startedAt.getTime() + (110 + index * 7) * 1000);
  const scoreSnapshot = completedScore(
    outcome,
    Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000),
  );

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.COMPLETED,
      winnerId,
      startedAt,
      finishedAt,
      scoreSnapshot: scoreSnapshot as object,
      version: { increment: 1 },
    },
  });

  await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });
  await addEvent(
    match.id,
    MatchEventType.HAJIME,
    MatchSide.SYSTEM,
    scoreSnapshot,
    7200 - index * 20,
  );
  await addEvent(
    match.id,
    outcome.event,
    outcome.side,
    scoreSnapshot,
    7100 - index * 20,
  );
  await addEvent(
    match.id,
    MatchEventType.SORE_MADE,
    MatchSide.SYSTEM,
    scoreSnapshot,
    7000 - index * 20,
  );

  await propagateWinner(updated, winnerId);
  return true;
}

async function resetLiveArtifacts() {
  await prisma.matchEvent.deleteMany({
    where: { match: { tournamentId: TOURNAMENT_ID } },
  });
  await prisma.judgeSession.deleteMany({
    where: { match: { tournamentId: TOURNAMENT_ID } },
  });
  await prisma.notification.deleteMany({
    where: {
      type: { in: ["defense_live_ready", "match_scheduled"] },
      payload: { path: ["tournamentId"], equals: TOURNAMENT_ID },
    },
  });
  await prisma.ratingEntry.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
}

async function completeFirstBlock() {
  let completed = 0;
  for (let i = 0; i < 18; i++) {
    const match = await prisma.match.findFirst({
      where: {
        tournamentId: TOURNAMENT_ID,
        status: MatchStatus.PENDING,
        redAthleteId: { not: null },
        blueAthleteId: { not: null },
      },
      orderBy: [{ round: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!match) break;
    if (await completePlayableMatch(match.id, i)) completed++;
  }
  return completed;
}

async function startLiveMatches(tatamiCount: number) {
  const liveMatches = [];

  for (let tatami = 1; tatami <= tatamiCount; tatami++) {
    const match = await prisma.match.findFirst({
      where: {
        tournamentId: TOURNAMENT_ID,
        tatamiNumber: tatami,
        status: MatchStatus.PENDING,
        redAthleteId: { not: null },
        blueAthleteId: { not: null },
      },
      orderBy: [
        { queuePosition: "asc" },
        { round: "asc" },
        { position: "asc" },
      ],
    });
    if (!match) continue;

    const scoreSnapshot = liveScore(tatami);
    const live = await prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.IN_PROGRESS,
        queuePosition: 1,
        startedAt: LIVE_STARTED_AT,
        scoreSnapshot: scoreSnapshot as object,
        version: { increment: 1 },
      },
      include: {
        redAthlete: { select: { id: true, name: true, surname: true } },
        blueAthlete: { select: { id: true, name: true, surname: true } },
      },
    });

    await prisma.matchEvent.createMany({
      data: [
        {
          matchId: live.id,
          type: MatchEventType.HAJIME,
          side: MatchSide.SYSTEM,
          scoreSnapshot: scoreSnapshot as object,
          occurredAt: LIVE_STARTED_AT,
        },
        {
          matchId: live.id,
          type:
            tatami % 2 === 0
              ? MatchEventType.OSAEKOMI
              : MatchEventType.WAZA_ARI,
          side: MatchSide.RED,
          scoreSnapshot: scoreSnapshot as object,
          occurredAt: new Date(Date.now() - 35_000),
        },
      ],
    });

    await prisma.judgeSession.create({
      data: {
        matchId: live.id,
        token: `defense-match-${tatami}-${nanoid(10)}`,
        judgeName: `Судья татами ${tatami}`,
        expiresAt: new Date(Date.now() + 14 * 60 * 60 * 1000),
        usedAt: LIVE_STARTED_AT,
      },
    });

    liveMatches.push(live);
  }

  return liveMatches;
}

async function normalizeQueues(tatamiCount: number) {
  for (let tatami = 1; tatami <= tatamiCount; tatami++) {
    const matches = await prisma.match.findMany({
      where: {
        tournamentId: TOURNAMENT_ID,
        tatamiNumber: tatami,
        status: { in: [MatchStatus.IN_PROGRESS, MatchStatus.PENDING] },
      },
      orderBy: [
        { status: "asc" },
        { queuePosition: "asc" },
        { round: "asc" },
        { position: "asc" },
      ],
    });

    const sorted = [
      ...matches.filter((m) => m.status === MatchStatus.IN_PROGRESS),
      ...matches.filter((m) => m.status === MatchStatus.PENDING),
    ];
    for (let i = 0; i < sorted.length; i++) {
      await prisma.match.update({
        where: { id: sorted[i]!.id },
        data: { queuePosition: i + 1 },
      });
    }
  }
}

async function createDefenseRatings() {
  const pointsByPlace = new Map([
    [1, 100],
    [2, 80],
    [3, 50],
    [5, 30],
    [7, 15],
  ]);

  const categories = await prisma.category.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    include: {
      applicationEntries: {
        where: { weighInStatus: "PASSED" },
        take: 8,
        include: { athlete: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  for (const category of categories) {
    const places = [1, 2, 3, 3, 5, 5, 7, 7];
    for (
      let i = 0;
      i < Math.min(category.applicationEntries.length, places.length);
      i++
    ) {
      const place = places[i]!;
      await prisma.ratingEntry.upsert({
        where: {
          athleteId_tournamentId_categoryId: {
            athleteId: category.applicationEntries[i]!.athleteId,
            tournamentId: TOURNAMENT_ID,
            categoryId: category.id,
          },
        },
        update: {
          place,
          points: pointsByPlace.get(place) ?? 0,
          awardedAt: new Date(Date.now() - (24 - i) * 60 * 60 * 1000),
        },
        create: {
          athleteId: category.applicationEntries[i]!.athleteId,
          tournamentId: TOURNAMENT_ID,
          categoryId: category.id,
          place,
          points: pointsByPlace.get(place) ?? 0,
          awardedAt: new Date(Date.now() - (24 - i) * 60 * 60 * 1000),
        },
      });
      created++;
    }
  }
  return created;
}

async function createFinishedTournament() {
  // Create a completely finished tournament
  const finishedId = "demo-finished-2026";
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  await prisma.tournament.upsert({
    where: { id: finishedId },
    update: {
      status: "COMPLETED",
      isFeatured: false,
    },
    create: {
      id: finishedId,
      name: {
        ru: "Весенний Кубок (Завершенный)",
        kk: "Көктемгі Кубок (Аяқталған)",
        en: "Spring Cup (Completed)",
      },
      description: {
        ru: "Пример полностью завершенного турнира с начисленным рейтингом.",
        kk: "Рейтинг есептелген толық аяқталған турнир мысалы.",
        en: "Example of a fully completed tournament with awarded ratings.",
      },
      location: "Judo Arena Demo Hall",
      city: "Астана",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      applicationDeadline: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      mapUrl: "https://www.google.com/maps",
      weighInLocation: "Зал B",
      weighInStart: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      weighInEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: "COMPLETED",
      tatamiCount: 3,
      primaryLocale: "ru",
      entryFeeKzt: 5000,
      isFeatured: false,
      createdById: admin?.id ?? "",
      posterUrl: "/uploads/demo/defense-tournament-poster.jpg",
    },
  });

  // Create a dummy category
  const cat = await prisma.category.upsert({
    where: { id: "cat-finished-1" },
    update: { tournamentId: finishedId },
    create: {
      id: "cat-finished-1",
      tournamentId: finishedId,
      name: { ru: "Юноши -60кг", kk: "Ұлдар -60кг", en: "Boys -60kg" },
      gender: "MALE",
      ageMin: 14,
      ageMax: 17,
      weightMin: 55,
      weightMax: 60,
      matchDurationSec: 240,
      format: "SE_IJF",
    },
  });

  // Get some athletes to give them ratings in this finished tournament
  const athletes = await prisma.user.findMany({
    where: { role: "ATHLETE" },
    take: 4,
  });

  if (athletes.length > 0) {
    const places = [1, 2, 3, 3];
    const pointsMap = [100, 80, 50, 50];

    for (let i = 0; i < athletes.length; i++) {
      await prisma.ratingEntry.upsert({
        where: {
          athleteId_tournamentId_categoryId: {
            athleteId: athletes[i]!.id,
            tournamentId: finishedId,
            categoryId: cat.id,
          },
        },
        update: {},
        create: {
          athleteId: athletes[i]!.id,
          tournamentId: finishedId,
          categoryId: cat.id,
          place: places[i],
          points: pointsMap[i] ?? 0,
          awardedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }
}

async function createNotifications(
  liveMatches: Awaited<ReturnType<typeof startLiveMatches>>,
) {
  const users = new Map<string, { id: string; locale: "ru" | "kk" | "en" }>();
  for (const match of liveMatches) {
    if (match.redAthlete)
      users.set(match.redAthlete.id, { id: match.redAthlete.id, locale: "ru" });
    if (match.blueAthlete)
      users.set(match.blueAthlete.id, {
        id: match.blueAthlete.id,
        locale: "ru",
      });
  }
  const coaches = await prisma.user.findMany({
    where: {
      role: UserRole.COACH,
      club: {
        applications: {
          some: {
            tournamentId: TOURNAMENT_ID,
            paymentStatus: PaymentStatus.PAID,
          },
        },
      },
    },
    select: { id: true, preferredLocale: true },
  });
  for (const coach of coaches) {
    users.set(coach.id, { id: coach.id, locale: coach.preferredLocale });
  }

  await prisma.notification.createMany({
    data: [...users.values()].map((user) => ({
      userId: user.id,
      type: "defense_live_ready",
      titleKey: "notifications.defense_live_title",
      bodyKey: "notifications.defense_live_body",
      payload: {
        tournamentId: TOURNAMENT_ID,
        liveWall: `/live-wall/${TOURNAMENT_ID}`,
      },
      locale: user.locale,
      read: false,
    })),
    skipDuplicates: true,
  });
}

async function main() {
  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    select: { id: true, tatamiCount: true },
  });
  if (!tournament) {
    throw new Error(
      `Tournament ${TOURNAMENT_ID} not found. Run "npm run prisma:seed -w api" first.`,
    );
  }

  await resetLiveArtifacts();

  await prisma.tournament.update({
    where: { id: TOURNAMENT_ID },
    data: {
      status: TournamentStatus.IN_PROGRESS,
      isFeatured: true,
      startDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 6 * 60 * 60 * 1000),
      applicationDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
      weighInStart: new Date(Date.now() - 4 * 60 * 60 * 1000),
      weighInEnd: new Date(Date.now() - 3 * 60 * 60 * 1000),
      youtubeUrls: [],
      posterUrl: "/uploads/demo/defense-tournament-poster.jpg",
      galleryUrls: [
        "/uploads/demo/gallery-1.jpg",
        "/uploads/demo/gallery-2.jpg",
        "/uploads/demo/gallery-3.jpg",
      ],
    },
  });

  const completed = await completeFirstBlock();
  const liveMatches = await startLiveMatches(tournament.tatamiCount);
  await normalizeQueues(tournament.tatamiCount);
  const ratings = await createDefenseRatings();
  await createFinishedTournament();
  await createNotifications(liveMatches);

  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: admin?.id,
      action: "demo.defenseLiveSeed",
      targetEntity: "Tournament",
      targetId: TOURNAMENT_ID,
      after: {
        completedMatches: completed,
        liveMatches: liveMatches.length,
        ratingEntries: ratings,
      },
    },
  });

  const [applications, entries, brackets, matches, pending, inProgress, done] =
    await prisma.$transaction([
      prisma.application.count({ where: { tournamentId: TOURNAMENT_ID } }),
      prisma.applicationEntry.count({
        where: { application: { tournamentId: TOURNAMENT_ID } },
      }),
      prisma.bracket.count({ where: { tournamentId: TOURNAMENT_ID } }),
      prisma.match.count({ where: { tournamentId: TOURNAMENT_ID } }),
      prisma.match.count({
        where: { tournamentId: TOURNAMENT_ID, status: MatchStatus.PENDING },
      }),
      prisma.match.count({
        where: { tournamentId: TOURNAMENT_ID, status: MatchStatus.IN_PROGRESS },
      }),
      prisma.match.count({
        where: { tournamentId: TOURNAMENT_ID, status: MatchStatus.COMPLETED },
      }),
    ]);

  console.log("\nDefense live tournament is ready.");
  console.log(`Tournament: ${TOURNAMENT_ID}`);
  console.log(`Applications: ${applications}`);
  console.log(`Entries / weighed athletes: ${entries}`);
  console.log(`Brackets: ${brackets}`);
  console.log(
    `Matches: ${matches} total | ${done} completed | ${inProgress} live | ${pending} pending`,
  );
  console.log(`Rating entries: ${ratings}`);
  console.log(`Live wall: /live-wall/${TOURNAMENT_ID}`);
  console.log(`Tatami 1 TV: /live-wall/${TOURNAMENT_ID}?tatami=1`);
  console.log("Admin login: admin@judo-arena.kz / JudoArenaAdmin2026!");
}

main()
  .catch((error) => {
    console.error("Defense live seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
