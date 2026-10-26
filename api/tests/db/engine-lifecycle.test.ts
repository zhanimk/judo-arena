import { randomUUID } from "node:crypto";
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
  makeCategory,
  makeTournament,
  requireDb,
  trackId,
} from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import { buildSingleElimination } from "../../src/services/bracket-engine/single-elimination.js";
import {
  seedAthletes,
  nextPowerOfTwo,
} from "../../src/services/bracket-engine/seeding.js";
import { buildMixedBracket } from "../../src/services/bracket-engine/mixed.js";
import { buildRoundRobin } from "../../src/services/bracket-engine/round-robin.js";
import { resolveAutomaticByes } from "../../src/services/match-propagation.js";
import {
  startMatch,
  addScoreEvent,
  confirmMatchResult,
  resetMatch,
  startOsaekomi,
  scoreToJson,
  normalizeScore,
} from "../../src/services/match.service.js";
import { finalizeTournament } from "../../src/services/rating.service.js";
import { getBracket } from "../../src/services/bracket.service.js";
import { decideStandings } from "../../src/services/standings-decision.service.js";
import { overrideMatchResult } from "../../src/services/admin-override.service.js";
import {
  restoreActiveTimers,
  cancelOsaekomiTimer,
} from "../../src/services/osaekomi-timer.service.js";
vi.mock("../../src/services/notification.service.js", () => ({
  broadcast: vi.fn(),
}));
beforeAll(requireDb);
const tournaments: string[] = [];
afterEach(async () => {
  await db.ratingEntry.deleteMany({
    where: { tournamentId: { in: tournaments } },
  });
  tournaments.length = 0;
  await cleanup();
});
afterAll(async () => {
  await prisma.$disconnect();
  await closeConnections();
});
async function fixture(
  count: number,
  format: "SE_IJF" | "MIXED" | "ROUND_ROBIN",
) {
  const admin = await makeAdmin();
  const tournament = await makeTournament(admin.id, { status: "IN_PROGRESS" });
  tournaments.push(tournament.id);
  const category = await makeCategory(tournament.id);
  const ids = Array.from({ length: count }, () => randomUUID());
  for (const id of ids) trackId("user", id);
  await db.user.createMany({
    data: ids.map((id, i) => ({
      id,
      email: `engine-${id}@judo-arena.test`,
      name: `Athlete${i}`,
      surname: "Engine",
      passwordHash: "fixture-no-login",
      role: "ATHLETE",
      dateOfBirth: new Date("2000-01-01"),
      gender: "MALE",
      weightKg: 65,
    })),
  });
  const mixed = format === "MIXED" ? buildMixedBracket(ids) : null;
  const size =
    mixed?.playoffSize ??
    (format === "ROUND_ROBIN" ? count : nextPowerOfTwo(count));
  const bracket = await db.bracket.create({
    data: {
      tournamentId: tournament.id,
      categoryId: category.id,
      format,
      size,
      ...(mixed && { metadata: { groups: mixed.groups } }),
    },
  });
  trackId("bracket", bracket.id);
  const plan = mixed
    ? [...mixed.groupMatches, ...mixed.playoffMatches]
    : format === "ROUND_ROBIN"
      ? buildRoundRobin(ids)
      : buildSingleElimination(
          seedAthletes(
            ids.map((id) => ({ id, clubId: null })),
            size,
            41,
          ),
        );
  await db.match.createMany({
    data: plan.map((m) => ({
      ...m,
      bracketId: bracket.id,
      tournamentId: tournament.id,
    })),
  });
  const matches = await db.match.findMany({ where: { bracketId: bracket.id } });
  for (const m of matches) trackId("match", m.id);
  await resolveAutomaticByes(bracket.id);
  return { admin, tournament, category, bracket, ids, matches };
}
async function win(id: string, winner: string) {
  const m = await db.match.findUniqueOrThrow({ where: { id } });
  await startMatch(id);
  await addScoreEvent(id, "IPPON", m.redAthleteId === winner ? "RED" : "BLUE");
  return confirmMatchResult(id);
}
async function conduct(f: Awaited<ReturnType<typeof fixture>>) {
  let played = 0;
  while (true) {
    const match = await db.match.findFirst({
      where: {
        bracketId: f.bracket.id,
        status: "PENDING",
        redAthleteId: { not: null },
        blueAthleteId: { not: null },
      },
      orderBy: [{ round: "asc" }, { position: "asc" }],
    });
    if (!match) break;
    const winner =
      f.ids.indexOf(match.redAthleteId!) < f.ids.indexOf(match.blueAthleteId!)
        ? match.redAthleteId!
        : match.blueAthleteId!;
    await win(match.id, winner);
    if (++played > f.matches.length) throw new Error("engine did not converge");
  }
  return played;
}

describe("full production services through final ratings", () => {
  for (const format of ["SE_IJF", "MIXED", "ROUND_ROBIN"] as const) {
    for (const count of format === "ROUND_ROBIN"
      ? [2, 3, 5, 8]
      : format === "MIXED"
        ? [6, 11, 21, 41, 81, 128]
        : [2, 6, 9, 17, 33, 65, 128]) {
      it(`${format} with ${count}: every match, final, rating and immutable finalized result`, async () => {
        const f = await fixture(count, format);
        const played = await conduct(f);
        const result = await finalizeTournament(f.admin.id, f.tournament.id);
        expect(result.entriesCount).toBe(count);
        const entries = await db.ratingEntry.findMany({
          where: { tournamentId: f.tournament.id },
        });
        expect(
          entries.filter((r) => r.place === 1).map((r) => r.athleteId),
        ).toEqual([f.ids[0]]);
        expect(entries.filter((r) => r.place === 2)).toHaveLength(1);
        expect(new Set(entries.map((r) => r.athleteId)).size).toBe(count);
        expect(played).toBeGreaterThan(0);
        const real = await db.match.findFirstOrThrow({
          where: {
            bracketId: f.bracket.id,
            redAthleteId: { not: null },
            blueAthleteId: { not: null },
            status: "COMPLETED",
          },
        });
        await expect(resetMatch(real.id)).rejects.toMatchObject({
          code: "TOURNAMENT_FINALIZED",
        });
        await expect(
          finalizeTournament(f.admin.id, f.tournament.id),
        ).rejects.toMatchObject({ code: "ALREADY_COMPLETED" });
      }, 120_000);
    }
  }
});

async function cycle(f: Awaited<ReturnType<typeof fixture>>, section = "main") {
  const items = f.matches.filter((m) => m.bracketSection === section);
  const ids = [
    ...new Set(items.flatMap((m) => [m.redAthleteId!, m.blueAthleteId!])),
  ];
  expect(ids).toHaveLength(3);
  for (const m of items) {
    const i = ids.indexOf(m.redAthleteId!);
    const j = ids.indexOf(m.blueAthleteId!);
    await win(m.id, (i + 1) % 3 === j ? m.redAthleteId! : m.blueAthleteId!);
  }
  return ids;
}
it("RR cycle: blocks arbitrary medals; authorizes, validates, audits a decision; invalidates it after reset", async () => {
  const f = await fixture(3, "ROUND_ROBIN");
  const ids = await cycle(f);
  let table = (await getBracket(f.bracket.id)).standings[0]!;
  expect(table.rows.map((r) => r.place)).toEqual([1, 1, 1]);
  expect(table.needsDecision).toBe(true);
  const { changeStatus } =
    await import("../../src/services/tournament.service.js");
  await expect(
    changeStatus(f.tournament.id, "COMPLETED", f.admin.id),
  ).rejects.toMatchObject({ code: "STANDINGS_UNRESOLVED" });
  await expect(
    finalizeTournament(f.admin.id, f.tournament.id),
  ).rejects.toMatchObject({ code: "STANDINGS_UNRESOLVED" });
  await expect(
    decideStandings(
      f.ids[0]!,
      f.bracket.id,
      "main",
      ids,
      "Chief referee decision",
      table.fingerprint,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    decideStandings(
      f.admin.id,
      f.bracket.id,
      "main",
      [ids[0]!, ids[0]!, ids[1]!],
      "Chief referee decision",
      table.fingerprint,
    ),
  ).rejects.toMatchObject({ code: "INVALID_ORDER" });
  await expect(
    decideStandings(
      f.admin.id,
      f.bracket.id,
      "main",
      ids,
      "Chief referee decision",
      "stale",
    ),
  ).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  await decideStandings(
    f.admin.id,
    f.bracket.id,
    "main",
    [...ids].reverse(),
    "Chief referee recorded draw",
    table.fingerprint,
  );
  table = (await getBracket(f.bracket.id)).standings[0]!;
  expect(table.rows.map((r) => r.athleteId)).toEqual([...ids].reverse());
  expect(table.needsDecision).toBe(false);
  expect(
    await db.auditLog.count({
      where: { targetId: f.bracket.id, action: "bracket.standings_decision" },
    }),
  ).toBe(1);
  const root = f.matches[0]!;
  const stored = await db.match.findUniqueOrThrow({ where: { id: root.id } });
  await resetMatch(root.id);
  await win(root.id, stored.winnerId!);
  table = (await getBracket(f.bracket.id)).standings[0]!;
  expect(table.decision).toBeNull();
  expect(table.needsDecision).toBe(true);
  await decideStandings(
    f.admin.id,
    f.bracket.id,
    "main",
    ids,
    "Reconfirmed draw after correction",
    table.fingerprint,
  );
  const final = await finalizeTournament(f.admin.id, f.tournament.id);
  expect(final.entries.find((r) => r.place === 1)?.athleteId).toBe(ids[0]);
});
it("MIXED cycle never grants a BYE to the other pool; decision fills qualifiers; completed playoffs protect the decision", async () => {
  const f = await fixture(6, "MIXED");
  const a = await cycle(f, "group_A");
  await cycle(f, "group_B");
  for (const m of await db.match.findMany({
    where: { bracketId: f.bracket.id, bracketSection: "playoff" },
  })) {
    expect(m.status).toBe("PENDING");
    expect(m.winnerId).toBeNull();
  }
  await expect(
    finalizeTournament(f.admin.id, f.tournament.id),
  ).rejects.toMatchObject({ code: "STANDINGS_UNRESOLVED" });
  for (const table of (await getBracket(f.bracket.id)).standings) {
    await decideStandings(
      f.admin.id,
      f.bracket.id,
      table.section,
      table.rows.map((r) => r.athleteId),
      "Chief referee resolves pool draw",
      table.fingerprint,
    );
  }
  await conduct(f);
  const before = await db.match.findMany({
    where: { bracketId: f.bracket.id, bracketSection: "playoff" },
  });
  const root = f.matches.find((m) => m.bracketSection === "group_A")!;
  const stored = await db.match.findUniqueOrThrow({ where: { id: root.id } });
  await resetMatch(root.id);
  expect(
    (await getBracket(f.bracket.id)).standings.find(
      (s) => s.section === "group_A",
    )?.decision,
  ).toBeNull();
  const other = await db.match.findMany({
    where: { bracketId: f.bracket.id, bracketSection: "group_B" },
  });
  expect(other.every((m) => m.status === "COMPLETED")).toBe(true);
  await win(root.id, stored.winnerId!);
  const table = (await getBracket(f.bracket.id)).standings.find(
    (s) => s.section === "group_A",
  )!;
  expect(table.needsDecision).toBe(true);
  await decideStandings(
    f.admin.id,
    f.bracket.id,
    "group_A",
    a,
    "Reconfirmed pool A draw",
    table.fingerprint,
  );
  await conduct(f);
  expect(before.some((m) => m.status === "COMPLETED")).toBe(true);
  await finalizeTournament(f.admin.id, f.tournament.id);
});
it("rejects an unfinished hollow playoff even when there are no playable pairs", async () => {
  const f = await fixture(6, "MIXED");
  // Simulate interrupted/corrupt advancement: valid group results, empty playoff shell.
  for (const match of f.matches.filter((m) =>
    m.bracketSection?.startsWith("group_"),
  )) {
    const winnerId =
      f.ids.indexOf(match.redAthleteId!) < f.ids.indexOf(match.blueAthleteId!)
        ? match.redAthleteId
        : match.blueAthleteId;
    await db.match.update({
      where: { id: match.id },
      data: { status: "COMPLETED", winnerId },
    });
  }
  await expect(
    finalizeTournament(f.admin.id, f.tournament.id),
  ).rejects.toMatchObject({ code: "MATCHES_NOT_COMPLETED" });
  expect(
    await db.ratingEntry.count({ where: { tournamentId: f.tournament.id } }),
  ).toBe(0);
});
it("two concurrent finalizations write one coherent rating set", async () => {
  const f = await fixture(3, "ROUND_ROBIN");
  await conduct(f);
  const results = await Promise.allSettled([
    finalizeTournament(f.admin.id, f.tournament.id),
    finalizeTournament(f.admin.id, f.tournament.id),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    await db.ratingEntry.count({ where: { tournamentId: f.tournament.id } }),
  ).toBe(3);
});
it("finalization racing with an override cannot leave stale ratings", async () => {
  const f = await fixture(2, "SE_IJF");
  await conduct(f);
  const final = await db.match.findFirstOrThrow({
    where: { bracketId: f.bracket.id, bracketSection: "final" },
  });
  const side = final.winnerId === final.redAthleteId ? "BLUE" : "RED";
  await Promise.allSettled([
    finalizeTournament(f.admin.id, f.tournament.id),
    overrideMatchResult(
      f.admin.id,
      final.id,
      side,
      "Corrected decision during finalization",
    ),
  ]);
  const stored = await db.match.findUniqueOrThrow({ where: { id: final.id } });
  const winner = await db.ratingEntry.findFirstOrThrow({
    where: { tournamentId: f.tournament.id, place: 1 },
  });
  expect(winner.athleteId).toBe(stored.winnerId);
});
it("restores an overdue hold after process restart and awards its result once", async () => {
  const f = await fixture(2, "ROUND_ROBIN");
  const match = f.matches[0]!;
  await startMatch(match.id);
  await startOsaekomi(match.id, "RED");
  cancelOsaekomiTimer(match.id);
  const stored = await db.match.findUniqueOrThrow({ where: { id: match.id } });
  const score = normalizeScore(stored.scoreSnapshot);
  score.osaekomi!.startedAt = new Date(Date.now() - 21_000).toISOString();
  await db.match.update({
    where: { id: match.id },
    data: { scoreSnapshot: scoreToJson(score) },
  });
  try {
    await restoreActiveTimers();
    await expect
      .poll(
        async () =>
          normalizeScore(
            (await db.match.findUniqueOrThrow({ where: { id: match.id } }))
              .scoreSnapshot,
          ).pendingResult?.winnerId,
        { timeout: 5000 },
      )
      .toBe(match.redAthleteId);
    await confirmMatchResult(match.id);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: match.id } })).winnerId,
    ).toBe(match.redAthleteId);
    expect(
      await db.matchEvent.count({
        where: { matchId: match.id, type: "IPPON" },
      }),
    ).toBeLessThanOrEqual(1);
  } finally {
    cancelOsaekomiTimer(match.id);
  }
});

it("a cancelled tournament rejects starting, scoring and confirming matches", async () => {
  const f = await fixture(3, "ROUND_ROBIN");
  const first = f.matches[0]!;
  await startMatch(first.id);
  await addScoreEvent(first.id, "IPPON", "RED");
  await db.tournament.update({
    where: { id: f.tournament.id },
    data: { status: "CANCELLED" },
  });
  await expect(confirmMatchResult(first.id)).rejects.toMatchObject({
    code: "TOURNAMENT_FINALIZED",
  });
  await expect(startMatch(f.matches[1]!.id)).rejects.toMatchObject({
    code: "TOURNAMENT_FINALIZED",
  });
  await db.tournament.update({
    where: { id: f.tournament.id },
    data: { status: "IN_PROGRESS" },
  });
  await startMatch(f.matches[1]!.id);
  await db.tournament.update({
    where: { id: f.tournament.id },
    data: { status: "CANCELLED" },
  });
  await expect(
    addScoreEvent(f.matches[1]!.id, "IPPON", "RED"),
  ).rejects.toMatchObject({ code: "TOURNAMENT_FINALIZED" });
  expect(
    await db.match.count({
      where: { bracketId: f.bracket.id, status: "COMPLETED" },
    }),
  ).toBe(0);
});

it("cannot skip another admitted category when finalizing the tournament", async () => {
  const f = await fixture(2, "ROUND_ROBIN");
  await conduct(f);
  const category = await makeCategory(f.tournament.id);
  const application = await db.application.create({
    data: {
      tournamentId: f.tournament.id,
      source: "ADMIN",
      applicantId: f.ids[0],
      status: "APPROVED",
      entries: {
        create: f.ids.map((athleteId) => ({
          athleteId,
          categoryId: category.id,
          weighInStatus: "PASSED",
        })),
      },
    },
    include: { entries: true },
  });
  trackId("application", application.id);
  for (const entry of application.entries)
    trackId("applicationEntry", entry.id);
  await expect(
    finalizeTournament(f.admin.id, f.tournament.id),
  ).rejects.toMatchObject({ code: "MISSING_BRACKET" });
  expect(
    await db.ratingEntry.count({ where: { tournamentId: f.tournament.id } }),
  ).toBe(0);
});
it("a late quarterfinal override in a completed 33-athlete bracket rebuilds both medal paths only", async () => {
  const f = await fixture(33, "SE_IJF");
  await conduct(f);
  const root = await db.match.findFirstOrThrow({
    where: {
      bracketId: f.bracket.id,
      bracketSection: "main",
      round: Math.log2(f.bracket.size) - 2,
      winnerId: f.ids[0],
    },
  });
  const before = await db.match.findMany({
    where: { bracketId: f.bracket.id },
  });
  const { planDownstreamRollback } =
    await import("../../src/services/bracket-engine/rollback.js");
  const dependent = new Set(
    planDownstreamRollback(before, root, f.bracket.size, "SE_IJF").map(
      (m) => m.matchId,
    ),
  );
  const side = root.winnerId === root.redAthleteId ? "BLUE" : "RED";
  await overrideMatchResult(
    f.admin.id,
    root.id,
    side,
    "Quarterfinal decision corrected by chief referee",
  );
  const after = await db.match.findMany({ where: { bracketId: f.bracket.id } });
  for (const match of before.filter(
    (m) => m.id !== root.id && !dependent.has(m.id),
  ))
    expect(after.find((m) => m.id === match.id)).toEqual(match);
  await conduct(f);
  const finalized = await finalizeTournament(f.admin.id, f.tournament.id);
  expect(finalized.entries.find((r) => r.place === 1)?.athleteId).not.toBe(
    f.ids[0],
  );
  expect(finalized.entries.find((r) => r.athleteId === f.ids[0])?.place).toBe(
    3,
  );
  expect(finalized.entries).toHaveLength(33);
});

for (const count of [6, 8, 9])
  it(`registration-to-draw honors explicit RR for ${count} admitted athletes or rejects its limit`, async () => {
    const f = await fixture(count, "SE_IJF");
    await db.bracket.delete({ where: { id: f.bracket.id } });
    await db.category.update({
      where: { id: f.category.id },
      data: { format: "ROUND_ROBIN" },
    });
    const application = await db.application.create({
      data: {
        tournamentId: f.tournament.id,
        source: "ADMIN",
        applicantId: f.ids[0],
        status: "APPROVED",
        entries: {
          create: f.ids.map((athleteId) => ({
            athleteId,
            categoryId: f.category.id,
            weighInStatus: "PASSED",
          })),
        },
      },
      include: { entries: true },
    });
    trackId("application", application.id);
    for (const entry of application.entries)
      trackId("applicationEntry", entry.id);
    const { generateBracket } =
      await import("../../src/services/bracket.service.js");
    if (count > 8) {
      await expect(
        generateBracket(f.admin.id, f.tournament.id, f.category.id),
      ).rejects.toMatchObject({ code: "ROUND_ROBIN_TOO_LARGE" });
      expect(
        await db.bracket.count({ where: { categoryId: f.category.id } }),
      ).toBe(0);
    } else {
      const generated = await generateBracket(
        f.admin.id,
        f.tournament.id,
        f.category.id,
      );
      trackId("bracket", generated.id);
      for (const m of generated.matches) trackId("match", m.id);
      expect(generated.format).toBe("ROUND_ROBIN");
      expect(generated.matches).toHaveLength((count * (count - 1)) / 2);
      expect(
        new Set(
          generated.matches.flatMap((m) => [m.redAthleteId, m.blueAthleteId]),
        ),
      ).toEqual(new Set(f.ids));
    }
  });
it("draw admission excludes missing gender, out-of-age and failed weigh-in entries", async () => {
  const f = await fixture(6, "SE_IJF");
  await db.bracket.delete({ where: { id: f.bracket.id } });
  await db.user.update({ where: { id: f.ids[0] }, data: { gender: null } });
  await db.user.update({
    where: { id: f.ids[1] },
    data: { dateOfBirth: new Date("2018-01-01") },
  });
  const application = await db.application.create({
    data: {
      tournamentId: f.tournament.id,
      source: "ADMIN",
      applicantId: f.ids[0],
      status: "APPROVED",
      entries: {
        create: f.ids.map((athleteId, index) => ({
          athleteId,
          categoryId: f.category.id,
          weighInStatus: index === 2 ? "PENDING" : "PASSED",
        })),
      },
    },
    include: { entries: true },
  });
  trackId("application", application.id);
  for (const entry of application.entries)
    trackId("applicationEntry", entry.id);
  const { generateBracket } =
    await import("../../src/services/bracket.service.js");
  const generated = await generateBracket(
    f.admin.id,
    f.tournament.id,
    f.category.id,
  );
  trackId("bracket", generated.id);
  for (const m of generated.matches) trackId("match", m.id);
  expect(
    new Set(
      generated.matches.flatMap((m) => [m.redAthleteId, m.blueAthleteId]),
    ),
  ).toEqual(new Set(f.ids.slice(3)));
});
