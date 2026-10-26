import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  db,
  cleanup,
  closeConnections,
  makeAdmin,
  makeAthlete,
  makeCategory,
  makeTournament,
  requireDb,
  trackId,
} from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  startMatch,
  addScoreEvent,
  confirmMatchResult,
  resetMatch,
  pauseMatch,
  enterGoldenScore,
  undoLastScoreEvent,
} from "../../src/services/match.service.js";
import { normalizeScore } from "../../src/services/match-types.js";
import { buildMixedBracket } from "../../src/services/bracket-engine/mixed.js";
import { buildSingleElimination } from "../../src/services/bracket-engine/single-elimination.js";
vi.mock("../../src/services/notification.service.js", () => ({
  broadcast: vi.fn(),
}));
beforeAll(requireDb);
afterEach(cleanup);
afterAll(async () => {
  await prisma.$disconnect();
  await closeConnections();
});

async function fixture(count = 8, mixed = false) {
  const admin = await makeAdmin();
  const tournament = await makeTournament(admin.id, { status: "IN_PROGRESS" });
  const category = await makeCategory(tournament.id);
  const athletes = await Promise.all(
    Array.from({ length: count }, () => makeAthlete()),
  );
  const mixedPlan = mixed ? buildMixedBracket(athletes.map((a) => a.id)) : null;
  const bracket = await db.bracket.create({
    data: {
      tournamentId: tournament.id,
      categoryId: category.id,
      format: mixed ? "MIXED" : "SE_IJF",
      size: mixedPlan?.playoffSize ?? 8,
      ...(mixedPlan && { metadata: { groups: mixedPlan.groups } }),
    },
  });
  trackId("bracket", bracket.id);
  const matches = [];
  for (const planned of mixedPlan
    ? [...mixedPlan.groupMatches, ...mixedPlan.playoffMatches]
    : buildSingleElimination([
        ...athletes.map((a) => a.id),
        ...Array<string | null>(8 - count).fill(null),
      ])) {
    const match = await db.match.create({
      data: { ...planned, bracketId: bracket.id, tournamentId: tournament.id },
    });
    trackId("match", match.id);
    matches.push(match);
  }
  return { matches, athletes, admin };
}
async function win(id: string) {
  const match = await db.match.findUniqueOrThrow({ where: { id } });
  const side =
    match.bracketSection?.startsWith("group_") &&
    match.redAthleteId!.localeCompare(match.blueAthleteId!) > 0
      ? "BLUE"
      : "RED";
  await startMatch(id);
  await addScoreEvent(id, "IPPON", side);
  return confirmMatchResult(id);
}

describe("match engine against PostgreSQL", () => {
  it("assigns distinct queue positions to both propagated paths in one transaction", async () => {
    const { matches } = await fixture();
    await db.match.update({
      where: { id: matches[0]!.id },
      data: { tatamiNumber: 1, queuePosition: 4 },
    });
    await db.match.update({
      where: { id: matches[1]!.id },
      data: { tatamiNumber: 1, queuePosition: null },
    });
    await win(matches[0]!.id);
    const advanced = await db.match.findMany({
      where: { bracketId: matches[0]!.bracketId, round: 2, tatamiNumber: 1 },
      orderBy: { queuePosition: "asc" },
    });
    expect(advanced.map((m) => m.queuePosition)).toEqual([5, 6]);
  });
  it("advances completed pools into playoffs and invalidates only dependent results on reset", async () => {
    const { matches } = await fixture(8, true);
    const groups = matches.filter((m) =>
      m.bracketSection?.startsWith("group_"),
    );
    for (const match of groups) await win(match.id);
    const playoffs = await db.match.findMany({
      where: {
        bracketId: matches[0]!.bracketId,
        bracketSection: "playoff",
        round: 1,
      },
    });
    expect(playoffs).toHaveLength(2);
    expect(playoffs.every((m) => m.redAthleteId && m.blueAthleteId)).toBe(true);
    for (const match of playoffs) await win(match.id);
    const final = await db.match.findFirstOrThrow({
      where: {
        bracketId: matches[0]!.bracketId,
        bracketSection: "playoff",
        round: 2,
      },
    });
    await win(final.id);
    await resetMatch(groups[0]!.id);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: final.id } })).winnerId,
    ).toBeNull();
    for (const match of groups.slice(1))
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: match.id } })).status,
      ).toBe("COMPLETED");
    await win(groups[0]!.id);
    const refilled = await db.match.findMany({
      where: {
        bracketId: matches[0]!.bracketId,
        bracketSection: "playoff",
        round: 1,
      },
    });
    expect(refilled.every((m) => m.redAthleteId && m.blueAthleteId)).toBe(true);
  });
  it("override changes both winner and loser routes without clearing prior rounds", async () => {
    const { matches, admin } = await fixture();
    const quarters = matches.filter(
      (m) => m.round === 1 && m.bracketSection === "main",
    );
    for (const m of quarters) await win(m.id);
    const semifinal = matches.find(
      (m) => m.round === 2 && m.position === 0 && m.bracketSection === "main",
    )!;
    await win(semifinal.id);
    const before = await db.match.findUniqueOrThrow({
      where: { id: semifinal.id },
    });
    const { overrideMatchResult } =
      await import("../../src/services/admin-override.service.js");
    const result = await overrideMatchResult(
      admin.id,
      semifinal.id,
      "BLUE",
      "Corrected referee decision",
    );
    expect(result.updated.winnerId).toBe(before.blueAthleteId);
    const final = await db.match.findFirstOrThrow({
      where: { bracketId: semifinal.bracketId, bracketSection: "final" },
    });
    const bronze = await db.match.findFirstOrThrow({
      where: { bracketId: semifinal.bracketId, bracketSection: "bronze2" },
    });
    expect(final.redAthleteId).toBe(before.blueAthleteId);
    expect(bronze.blueAthleteId).toBe(before.redAthleteId);
    for (const m of quarters)
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: m.id } })).status,
      ).toBe("COMPLETED");
  });
  it("reset cannot change results after tournament finalization", async () => {
    const { matches } = await fixture();
    await win(matches[0]!.id);
    await db.tournament.update({
      where: { id: matches[0]!.tournamentId },
      data: { status: "COMPLETED" },
    });
    await expect(resetMatch(matches[0]!.id)).rejects.toMatchObject({
      code: "TOURNAMENT_FINALIZED",
    });
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: matches[0]!.id } }))
        .status,
    ).toBe("COMPLETED");
  });
  it("rolls back match confirmation when downstream storage fails", async () => {
    const { matches } = await fixture();
    const root = matches[0]!;
    const target = matches.find(
      (m) => m.round === 2 && m.position === 0 && m.bracketSection === "main",
    )!;
    await startMatch(root.id);
    await addScoreEvent(root.id, "IPPON", "RED");
    let failOnce = true;
    prisma.$use(async (params, next) => {
      if (
        failOnce &&
        params.model === "Match" &&
        params.action === "update" &&
        params.args.where.id === target.id
      ) {
        failOnce = false;
        throw new Error("simulated downstream storage failure");
      }
      return next(params);
    });
    try {
      await expect(confirmMatchResult(root.id)).rejects.toThrow(
        "simulated downstream storage failure",
      );
      const stored = await db.match.findUniqueOrThrow({
        where: { id: root.id },
      });
      expect(stored.status).toBe("IN_PROGRESS");
      expect(stored.winnerId).toBeNull();
      expect(normalizeScore(stored.scoreSnapshot).pendingResult).not.toBeNull();
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: target.id } }))
          .redAthleteId,
      ).toBeNull();
      await confirmMatchResult(root.id);
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: root.id } })).status,
      ).toBe("COMPLETED");
    } finally {
      failOnce = false;
    }
  });
  it("finishes an uneven bracket, including repechage and medal BYEs", async () => {
    const { matches } = await fixture(6);
    const { resolveAutomaticByes } =
      await import("../../src/services/match-propagation.js");
    await resolveAutomaticByes(matches[0]!.bracketId);
    for (let step = 0; step < 20; step++) {
      const playable = await db.match.findFirst({
        where: {
          bracketId: matches[0]!.bracketId,
          status: "PENDING",
          redAthleteId: { not: null },
          blueAthleteId: { not: null },
        },
      });
      if (!playable) break;
      await win(playable.id);
    }
    const medals = await db.match.findMany({
      where: {
        bracketId: matches[0]!.bracketId,
        bracketSection: { in: ["final", "bronze1", "bronze2"] },
      },
    });
    expect(medals).toHaveLength(3);
    expect(medals.every((m) => m.status === "COMPLETED" && m.winnerId)).toBe(
      true,
    );
    expect(
      await db.match.count({
        where: {
          bracketId: matches[0]!.bracketId,
          status: "PENDING",
          OR: [
            { redAthleteId: { not: null } },
            { blueAthleteId: { not: null } },
          ],
        },
      }),
    ).toBe(0);
  });

  it("conducts quarterfinals, semifinal and final; reset preserves earlier results", async () => {
    const { matches } = await fixture();
    const quarters = matches.filter(
      (m) => m.round === 1 && m.bracketSection === "main",
    );
    for (const m of quarters) await win(m.id);
    const semis = matches.filter(
      (m) => m.round === 2 && m.bracketSection === "main",
    );
    for (const m of semis) await win(m.id);
    const final = matches.find((m) => m.bracketSection === "final")!;
    await win(final.id);
    await resetMatch(semis[0]!.id);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: final.id } })).status,
    ).toBe("PENDING");
    for (const m of quarters)
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: m.id } })).status,
      ).toBe("COMPLETED");
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: semis[1]!.id } }))
        .status,
    ).toBe("COMPLETED");
    const reset = await db.match.findUniqueOrThrow({
      where: { id: semis[0]!.id },
    });
    expect(reset.redAthleteId).toBeTruthy();
    expect(reset.blueAthleteId).toBeTruthy();
  });
  it("concurrent commands at one version cannot overwrite each other", async () => {
    const { matches } = await fixture();
    const running = await startMatch(matches[0]!.id);
    const results = await Promise.allSettled([
      addScoreEvent(
        running.match.id,
        "WAZA_ARI",
        "RED",
        undefined,
        running.match.version,
      ),
      addScoreEvent(
        running.match.id,
        "WAZA_ARI",
        "BLUE",
        undefined,
        running.match.version,
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CONCURRENT_MODIFICATION" },
    });
    const persisted = await db.match.findUniqueOrThrow({
      where: { id: running.match.id },
    });
    const score = normalizeScore(persisted.scoreSnapshot);
    expect(score.red.wazaari + score.blue.wazaari).toBe(1);
    expect(
      await db.matchEvent.count({
        where: { matchId: running.match.id, type: "WAZA_ARI" },
      }),
    ).toBe(1);
  });
  it("cannot start two matches on the same tatami concurrently", async () => {
    const { matches } = await fixture();
    await db.match.updateMany({
      where: { id: { in: matches.slice(0, 2).map((m) => m.id) } },
      data: { tatamiNumber: 1 },
    });
    const results = await Promise.allSettled(
      matches.slice(0, 2).map((m) => startMatch(m.id)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.match.count({
        where: {
          tournamentId: matches[0]!.tournamentId,
          tatamiNumber: 1,
          status: "IN_PROGRESS",
        },
      }),
    ).toBe(1);
  });
  it("pause advances the version and rejects commands from the previous state", async () => {
    const { matches } = await fixture();
    const running = await startMatch(matches[0]!.id);
    const paused = await pauseMatch(running.match.id);
    expect(paused.match.version).toBe(running.match.version + 1);
    await expect(
      addScoreEvent(
        running.match.id,
        "IPPON",
        "RED",
        undefined,
        running.match.version,
      ),
    ).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });
  it("Golden Score only ends with the third shido; undo preserves the phase", async () => {
    const { matches } = await fixture();
    const id = matches[0]!.id;
    await startMatch(id);
    await enterGoldenScore(id);
    for (let i = 0; i < 2; i++)
      expect((await addScoreEvent(id, "SHIDO", "RED")).autoFinished).toBe(
        false,
      );
    expect((await addScoreEvent(id, "SHIDO", "RED")).winnerId).toBe(
      matches[0]!.blueAthleteId,
    );
    await undoLastScoreEvent(id);
    const stored = await db.match.findUniqueOrThrow({ where: { id } });
    expect(stored.isGoldenScore).toBe(true);
    expect(normalizeScore(stored.scoreSnapshot).red.shido).toBe(2);
    expect(normalizeScore(stored.scoreSnapshot).pendingResult).toBeNull();
  });
  it("a rejected reset rolls back downstream changes in the transaction", async () => {
    const { matches } = await fixture();
    await win(matches[0]!.id);
    const original = await db.match.findMany({
      where: { bracketId: matches[0]!.bracketId },
      orderBy: { id: "asc" },
    });
    await expect(
      db.$transaction(async (tx) => {
        const { clearDownstreamRecursive } =
          await import("../../src/services/match-propagation.js");
        await clearDownstreamRecursive(
          matches[0]!.bracketId,
          "",
          matches[0]!.id,
          tx,
        );
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    const after = await db.match.findMany({
      where: { bracketId: matches[0]!.bracketId },
      orderBy: { id: "asc" },
    });
    expect(after).toEqual(original);
  });
});
