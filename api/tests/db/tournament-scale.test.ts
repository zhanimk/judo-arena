import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  db,
  cleanup,
  closeConnections,
  makeAdmin,
  makeCategory,
  makeTournament,
  requireDb,
  trackId,
} from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import { buildSingleElimination } from "../../src/services/bracket-engine/single-elimination.js";
import { seedAthletes } from "../../src/services/bracket-engine/seeding.js";
import { resolveAutomaticByes } from "../../src/services/match-propagation.js";
import {
  startMatch,
  addScoreEvent,
  confirmMatchResult,
} from "../../src/services/match.service.js";
import { finalizeTournament } from "../../src/services/rating.service.js";
vi.mock("../../src/services/notification.service.js", () => ({
  broadcast: vi.fn(),
}));
beforeAll(requireDb);
afterEach(cleanup);
afterAll(async () => {
  await prisma.$disconnect();
  await closeConnections();
});

it("conducts 300 athletes across 12 categories and four concurrent tatamis through final ratings", async () => {
  const admin = await makeAdmin();
  const tournament = await makeTournament(admin.id, { status: "IN_PROGRESS" });
  const ids = Array.from({ length: 300 }, () => randomUUID());
  for (const id of ids) trackId("user", id);
  await db.user.createMany({
    data: ids.map((id) => ({
      id,
      email: `scale-${id}@judo-arena.test`,
      name: "Scale",
      surname: "Athlete",
      passwordHash: "test-fixture-no-login",
      role: "ATHLETE" as const,
    })),
  });
  const brackets: string[] = [];
  for (let categoryIndex = 0; categoryIndex < 12; categoryIndex++) {
    const category = await makeCategory(tournament.id);
    const athletes = ids
      .slice(categoryIndex * 25, (categoryIndex + 1) * 25)
      .map((id) => ({ id, clubId: null }));
    const bracket = await db.bracket.create({
      data: {
        tournamentId: tournament.id,
        categoryId: category.id,
        format: "SE_IJF",
        size: 32,
      },
    });
    trackId("bracket", bracket.id);
    brackets.push(bracket.id);
    await db.match.createMany({
      data: buildSingleElimination(
        seedAthletes(athletes, 32, categoryIndex + 1),
      ).map((match, index) => ({
        ...match,
        tournamentId: tournament.id,
        bracketId: bracket.id,
        tatamiNumber: (categoryIndex % 4) + 1,
        queuePosition: categoryIndex * 100 + index,
      })),
    });
    for (const match of await db.match.findMany({
      where: { bracketId: bracket.id },
    }))
      trackId("match", match.id);
    await resolveAutomaticByes(bracket.id);
  }
  let completed = 0;
  const started = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, async (_, tatami) => {
      for (const bracketId of brackets.filter(
        (_, index) => index % 4 === tatami,
      )) {
        while (true) {
          const match = await db.match.findFirst({
            where: {
              bracketId,
              status: "PENDING",
              redAthleteId: { not: null },
              blueAthleteId: { not: null },
            },
            orderBy: [{ round: "asc" }, { position: "asc" }],
          });
          if (!match) break;
          await startMatch(match.id);
          await addScoreEvent(match.id, "IPPON", "RED");
          await confirmMatchResult(match.id);
          completed++;
        }
        const medals = await db.match.findMany({
          where: {
            bracketId,
            bracketSection: { in: ["final", "bronze1", "bronze2"] },
          },
        });
        expect(medals).toHaveLength(3);
        expect(
          medals.every((m) => m.status === "COMPLETED" && m.winnerId),
        ).toBe(true);
      }
    }),
  );
  try {
    expect(results.filter((result) => result.status === "rejected")).toEqual(
      [],
    );
    expect(completed).toBe(336);
    const finalized = await finalizeTournament(admin.id, tournament.id);
    expect(finalized.entriesCount).toBe(300);
    expect(
      await db.ratingEntry.count({
        where: { tournamentId: tournament.id, place: 1 },
      }),
    ).toBe(12);
    expect(
      await db.ratingEntry.count({
        where: { tournamentId: tournament.id, place: 3 },
      }),
    ).toBe(24);
    console.info(
      `[scale] 300 athletes, 12 categories, 4 tatamis, ${completed} scored matches, ${Date.now() - started}ms; local service benchmark, not venue capacity certification`,
    );
  } finally {
    await db.ratingEntry.deleteMany({ where: { tournamentId: tournament.id } });
  }
}, 120_000);
