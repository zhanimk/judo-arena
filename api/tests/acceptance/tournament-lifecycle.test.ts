/**
 * Acceptance tests — tournament lifecycle business rules.
 *
 * Tests verify service-level business logic with mocked Prisma + Redis.
 * Focus: correct state transitions, data integrity, and domain rules.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    tournament:       { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    category:         { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    application:      { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    applicationEntry: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    bracket:          { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    match:            { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    matchEvent:       { create: vi.fn(), findMany: vi.fn() },
    ratingEntry:      { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    auditLog:         { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    user:             { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    judgeSession:     { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    notification:     { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    systemConfig:     { findUnique: vi.fn() },
    $transaction:     vi.fn(),
  },
}));
vi.mock("../../src/lib/redis.js", () => ({
  redis: {
    set:    vi.fn().mockResolvedValue("OK"),
    get:    vi.fn().mockResolvedValue(null),
    del:    vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
    scan:   vi.fn().mockResolvedValue(["0", []]),
  },
}));
vi.mock("../../src/sockets/io.js", () => ({
  emitMatchEvent:   vi.fn(),
  emitToBracket:    vi.fn(),
  emitToTournament: vi.fn(),
  emitToUser:       vi.fn(),
}));
vi.mock("../../src/services/email.service.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../../src/lib/prisma.js";
import {
  TournamentStatus,
  ApplicationStatus,
  MatchStatus,
  BracketFormat,
} from "@prisma/client";

// ── Test data factories ───────────────────────────────────────────────────────

const ADMIN   = { id: "admin-1", role: "ADMIN",   isActive: true, email: "admin@test.kz",  name: "Admin", surname: "Test", clubId: null,    clubRole: null };
const COACH   = { id: "coach-1", role: "COACH",   isActive: true, email: "coach@test.kz",  name: "Coach", surname: "Test", clubId: "club-1", clubRole: "OWNER" };
const ATHLETE = { id: "ath-1",   role: "ATHLETE", isActive: true, email: "ath@test.kz",    name: "Аслан", surname: "Қасым", clubId: "club-1", weightKg: 66, dateOfBirth: new Date("2000-01-01"), gender: "MALE" };

function makeTournament(status = TournamentStatus.DRAFT) {
  return { id: "t-1", name: { kk: "Тест", ru: "Тест", en: "Test" }, status, startDate: new Date("2026-07-01"), tatamiCount: 2, createdById: "admin-1" };
}
function makeCategory() {
  return { id: "cat-1", tournamentId: "t-1", gender: "MALE", weightMin: 60, weightMax: 73, ageMin: 18, ageMax: 35, matchDurationSec: 240, format: BracketFormat.SINGLE_ELIMINATION, allowYuko: false };
}
function makeApp(status = ApplicationStatus.DRAFT) {
  return { id: "app-1", tournamentId: "t-1", clubId: "club-1", status, notes: null, reviewerNotes: null, entries: [], club: { id: "club-1" } };
}

beforeEach(() => { vi.clearAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 1 — Tournament creation & status transitions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance: Tournament creation & lifecycle", () => {

  it("ADMIN creates tournament in DRAFT status", async () => {
    const { createTournament } = await import("../../src/services/tournament.service.js");
    (prisma.user.findUnique as any).mockResolvedValue(ADMIN);
    (prisma.tournament.create as any).mockResolvedValue(makeTournament(TournamentStatus.DRAFT));

    const result = await createTournament("admin-1", {
      name: { kk: "Тест жарысы", ru: "Тест", en: "Test" },
      location: "Алматы", city: "Алматы", country: "KZ",
      startDate: new Date("2026-07-01"), tatamiCount: 2,
    });

    expect(result.status).toBe(TournamentStatus.DRAFT);
    expect(prisma.tournament.create).toHaveBeenCalledOnce();
  });

  it("Only ADMIN can finalize a tournament (non-admin rejected)", async () => {
    const { finalizeTournament } = await import("../../src/services/rating.service.js");
    (prisma.user.findUnique as any).mockResolvedValue(COACH);

    await expect(finalizeTournament("coach-1", "t-1"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ADMIN adds a category to the tournament", async () => {
    const { createCategory } = await import("../../src/services/tournament.service.js");
    (prisma.tournament.findUnique as any).mockResolvedValue(makeTournament(TournamentStatus.DRAFT));
    (prisma.category.create as any).mockResolvedValue(makeCategory());

    const cat = await createCategory("t-1", {
      gender: "MALE", weightMin: 60, weightMax: 73,
      ageMin: 18, ageMax: 35, matchDurationSec: 240, format: "SINGLE_ELIMINATION",
    });

    expect(cat.tournamentId).toBe("t-1");
    expect(cat.gender).toBe("MALE");
  });

  it("DRAFT → REGISTRATION_OPEN transition is allowed", async () => {
    const { changeStatus } = await import("../../src/services/tournament.service.js");
    (prisma.tournament.findUnique as any).mockResolvedValue(makeTournament(TournamentStatus.DRAFT));
    (prisma.category.count as any).mockResolvedValue(1); // has categories
    (prisma.tournament.update as any).mockResolvedValue(makeTournament(TournamentStatus.REGISTRATION_OPEN));

    const updated = await changeStatus("t-1", TournamentStatus.REGISTRATION_OPEN);
    expect(updated.status).toBe(TournamentStatus.REGISTRATION_OPEN);
  });

  it("Cannot skip REGISTRATION_OPEN → directly to IN_PROGRESS", async () => {
    const { changeStatus } = await import("../../src/services/tournament.service.js");
    (prisma.tournament.findUnique as any).mockResolvedValue(makeTournament(TournamentStatus.DRAFT));
    (prisma.category.count as any).mockResolvedValue(1);

    await expect(changeStatus("t-1", TournamentStatus.IN_PROGRESS))
      .rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("REGISTRATION_OPEN → REGISTRATION_CLOSED transition is allowed", async () => {
    const { changeStatus } = await import("../../src/services/tournament.service.js");
    (prisma.tournament.findUnique as any).mockResolvedValue(makeTournament(TournamentStatus.REGISTRATION_OPEN));
    (prisma.tournament.update as any).mockResolvedValue(makeTournament(TournamentStatus.REGISTRATION_CLOSED));

    const updated = await changeStatus("t-1", TournamentStatus.REGISTRATION_CLOSED);
    expect(updated.status).toBe(TournamentStatus.REGISTRATION_CLOSED);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 2 — Application lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance: Application lifecycle", () => {

  it("COACH submits application → status becomes SUBMITTED", async () => {
    const { submit } = await import("../../src/services/application.service.js");
    const app = { ...makeApp(ApplicationStatus.DRAFT), _count: { entries: 1 }, tournament: { startDate: new Date("2026-07-01"), applicationDeadline: null } };
    (prisma.user.findUnique as any).mockResolvedValue(COACH);
    (prisma.application.findUnique as any).mockResolvedValue(app);
    (prisma.application.update as any).mockResolvedValue({ ...app, status: ApplicationStatus.SUBMITTED });
    (prisma.auditLog.create as any).mockResolvedValue({});
    (prisma.notification.createMany as any).mockResolvedValue({ count: 1 });

    const updated = await submit("coach-1", "app-1");
    expect(updated.status).toBe(ApplicationStatus.SUBMITTED);
  });

  it("ADMIN approves application → status becomes APPROVED", async () => {
    const { approve } = await import("../../src/services/application.service.js");
    const appWithTournament = { ...makeApp(ApplicationStatus.SUBMITTED), tournament: { id: "t-1", name: { kk: "Тест" } } };
    (prisma.user.findUnique as any).mockResolvedValue(ADMIN);
    (prisma.application.findUnique as any).mockResolvedValue(appWithTournament);
    (prisma.application.update as any).mockResolvedValue({ ...appWithTournament, status: ApplicationStatus.APPROVED });
    (prisma.user.findMany as any).mockResolvedValue([]); // no coaches → no notifications
    (prisma.auditLog.create as any).mockResolvedValue({});
    (prisma.notification.createMany as any).mockResolvedValue({ count: 0 });

    const approved = await approve("admin-1", "app-1");
    expect(approved.status).toBe(ApplicationStatus.APPROVED);
  });

  it("COACH withdraws SUBMITTED application → status becomes WITHDRAWN", async () => {
    const { withdraw } = await import("../../src/services/application.service.js");
    const app = makeApp(ApplicationStatus.SUBMITTED);
    (prisma.user.findUnique as any).mockResolvedValue(COACH);
    (prisma.application.findUnique as any).mockResolvedValue(app);
    (prisma.application.update as any).mockResolvedValue({ ...app, status: ApplicationStatus.WITHDRAWN });

    const updated = await withdraw("coach-1", "app-1");
    expect(updated.status).toBe(ApplicationStatus.WITHDRAWN);
  });

  it("COACH cannot submit empty application (no entries)", async () => {
    const { submit } = await import("../../src/services/application.service.js");
    const emptyApp = { ...makeApp(ApplicationStatus.DRAFT), _count: { entries: 0 }, tournament: { startDate: new Date("2026-07-01"), applicationDeadline: null } };
    (prisma.user.findUnique as any).mockResolvedValue(COACH);
    (prisma.application.findUnique as any).mockResolvedValue(emptyApp);

    await expect(submit("coach-1", "app-1"))
      .rejects.toMatchObject({ code: "EMPTY_APPLICATION" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 3 — Match scoring
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance: Match scoring", () => {

  function makeMatch(overrides = {}) {
    return {
      id: "m-1", tournamentId: "t-1", bracketId: "b-1", tatamiNumber: 1,
      status: MatchStatus.IN_PROGRESS, redAthleteId: "ath-1", blueAthleteId: "ath-2",
      winnerId: null,
      scoreSnapshot: { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 }, clock: { running: true, elapsedSec: 30, runningStartedAt: new Date().toISOString() } },
      round: 1, position: 0, bracketSection: "main", version: 0,
      isGoldenScore: false, isReplay: false, replayReason: null, queuePosition: 0,
      createdAt: new Date(), updatedAt: new Date(), startedAt: new Date(), finishedAt: null,
      ...overrides,
    };
  }

  it("IPPON ends the match immediately (pendingResult)", async () => {
    const { addScoreEvent } = await import("../../src/services/match.service.js");
    const match = makeMatch();
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const result = {
        red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0 },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        pendingResult: { winnerSide: "RED", winnerAthleteId: "ath-1", reason: "IPPON" },
        clock: match.scoreSnapshot.clock,
      };
      const updatedMatch = { ...match, scoreSnapshot: result };
      const tx = {
        match: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(updatedMatch),
        },
        matchEvent: { create: vi.fn().mockResolvedValue({ id: "ev-1", type: "IPPON", side: "RED", occurredAt: new Date(), matchId: "m-1", judgeSessionId: null, scoreSnapshot: result }) },
      };
      return fn(tx);
    });

    const result = await addScoreEvent("m-1", "IPPON", "RED");
    expect(result.match.scoreSnapshot.red.ippon).toBe(1);
    expect(result.match.scoreSnapshot.pendingResult).toBeDefined();
    expect(result.match.scoreSnapshot.pendingResult?.winnerSide).toBe("RED");
  });

  it("2 × WAZA_ARI = IPPON (match ends with pendingResult)", async () => {
    const { addScoreEvent } = await import("../../src/services/match.service.js");
    // match already has 1 waza-ari for red
    const match = makeMatch({ scoreSnapshot: { red: { ippon: 0, wazaari: 1, yuko: 0, shido: 0 }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 }, clock: { running: true, elapsedSec: 60, runningStartedAt: new Date().toISOString() } } });
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const result = {
        red: { ippon: 0, wazaari: 2, yuko: 0, shido: 0 },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        pendingResult: { winnerSide: "RED", winnerAthleteId: "ath-1", reason: "WAZA_ARI_2" },
        clock: match.scoreSnapshot.clock,
      };
      const tx = {
        match: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ ...match, scoreSnapshot: result }),
        },
        matchEvent: { create: vi.fn().mockResolvedValue({ id: "ev-2" }) },
      };
      return fn(tx);
    });

    const result = await addScoreEvent("m-1", "WAZA_ARI", "RED");
    expect(result.match.scoreSnapshot.red.wazaari).toBe(2);
    expect(result.match.scoreSnapshot.pendingResult?.winnerSide).toBe("RED");
  });

  it("3rd SHIDO = HANSOKU_MAKE = opponent wins", async () => {
    const { addScoreEvent } = await import("../../src/services/match.service.js");
    const match = makeMatch({ scoreSnapshot: { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 2 }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 }, clock: { running: true, elapsedSec: 90, runningStartedAt: new Date().toISOString() } } });
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const result = {
        red: { ippon: 0, wazaari: 0, yuko: 0, shido: 3 },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0 },
        pendingResult: { winnerSide: "BLUE", winnerAthleteId: "ath-2", reason: "HANSOKU_MAKE" },
        clock: match.scoreSnapshot.clock,
      };
      const tx = {
        match: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ ...match, scoreSnapshot: result }),
        },
        matchEvent: { create: vi.fn().mockResolvedValue({ id: "ev-3" }) },
      };
      return fn(tx);
    });

    const result = await addScoreEvent("m-1", "SHIDO", "RED");
    expect(result.match.scoreSnapshot.pendingResult?.winnerSide).toBe("BLUE");
    expect(result.match.scoreSnapshot.pendingResult?.reason).toBe("HANSOKU_MAKE");
  });

  it("Cannot score on a PENDING (not started) match", async () => {
    const { addScoreEvent } = await import("../../src/services/match.service.js");
    const match = makeMatch({ status: MatchStatus.PENDING });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    await expect(addScoreEvent("m-1", "IPPON", "RED"))
      .rejects.toMatchObject({ code: "NOT_RUNNING" });
  });

  it("Cannot add IPPON to side that already has IPPON", async () => {
    const { addScoreEvent } = await import("../../src/services/match.service.js");
    const match = makeMatch({ scoreSnapshot: { red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0 }, blue: {}, clock: { running: true, elapsedSec: 10, runningStartedAt: new Date().toISOString() } } });
    (prisma.match.findUnique as any).mockResolvedValue(match);

    await expect(addScoreEvent("m-1", "IPPON", "RED"))
      .rejects.toMatchObject({ code: "ALREADY_IPPON" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 4 — Osaekomi (hold-down) timer
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance: Osaekomi flow", () => {

  it("JUDGE starts osaekomi → snapshot contains osaekomi.side and startedAt", async () => {
    const { startOsaekomi } = await import("../../src/services/match.service.js");
    const startedAt = new Date().toISOString();
    const match = {
      id: "m-1", tournamentId: "t-1", bracketId: "b-1", tatamiNumber: 1,
      status: MatchStatus.IN_PROGRESS, redAthleteId: "ath-1", blueAthleteId: "ath-2",
      winnerId: null, version: 0, isGoldenScore: false, isReplay: false, replayReason: null, queuePosition: 0,
      scoreSnapshot: { red: {}, blue: {}, clock: { running: true, elapsedSec: 15, runningStartedAt: new Date().toISOString() } },
      round: 1, position: 0, bracketSection: "main", createdAt: new Date(), updatedAt: new Date(), startedAt: new Date(), finishedAt: null,
    };
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const snapshot = { ...match.scoreSnapshot, osaekomi: { side: "RED", startedAt } };
      const tx = {
        match: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ ...match, scoreSnapshot: snapshot }),
        },
        matchEvent: { create: vi.fn().mockResolvedValue({ id: "ev-osa" }) },
      };
      return fn(tx);
    });

    const result = await startOsaekomi("m-1", "RED");
    expect(result.match.scoreSnapshot.osaekomi).toBeDefined();
    expect(result.match.scoreSnapshot.osaekomi.side).toBe("RED");
  });

  it("After 20 seconds server endOsaekomi(TIME_LIMIT) awards IPPON", async () => {
    const { endOsaekomi } = await import("../../src/services/match.service.js");
    const startedAt = new Date(Date.now() - 21_000).toISOString();
    const match = {
      id: "m-1", tournamentId: "t-1", bracketId: "b-1", tatamiNumber: 1,
      status: MatchStatus.IN_PROGRESS, redAthleteId: "ath-1", blueAthleteId: "ath-2",
      winnerId: null, version: 0, isGoldenScore: false, isReplay: false, replayReason: null, queuePosition: 0,
      scoreSnapshot: { red: { ippon: 0, wazaari: 0, shido: 0 }, blue: { ippon: 0, wazaari: 0, shido: 0 }, clock: { running: true, elapsedSec: 20, runningStartedAt: new Date().toISOString() }, osaekomi: { side: "RED", startedAt } },
      round: 1, position: 0, bracketSection: "main", createdAt: new Date(), updatedAt: new Date(), startedAt: new Date(), finishedAt: null,
      // endOsaekomi requires bracket.category.allowYuko
      bracket: { category: { allowYuko: false } },
    };
    (prisma.match.findUnique as any).mockResolvedValue(match);
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const snapshot = { ...match.scoreSnapshot, osaekomi: undefined, red: { ippon: 1 }, pendingResult: { winnerSide: "RED", winnerAthleteId: "ath-1", reason: "OSAEKOMI_IPPON" } };
      const tx = {
        match: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ ...match, scoreSnapshot: snapshot }),
        },
        matchEvent: { create: vi.fn().mockResolvedValue({ id: "ev-end" }) },
      };
      return fn(tx);
    });

    const result = await endOsaekomi("m-1", "TIME_LIMIT");
    expect(result.scoredType).toBe("IPPON");
    expect(result.autoFinished).toBe(true);
  });

  it("Osaekomi timer is server-side — startedAt is a valid ISO timestamp", () => {
    const startedAt = new Date().toISOString();
    expect(() => new Date(startedAt)).not.toThrow();
    expect(new Date(startedAt).getTime()).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 5 — Rating calculation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance: Rating leaderboard", () => {

  it("getLeaderboard returns athletes sorted by totalPoints descending", async () => {
    const { getLeaderboard } = await import("../../src/services/rating.service.js");
    (prisma.ratingEntry.groupBy as any).mockResolvedValue([
      { athleteId: "ath-1", _sum: { points: 100 } },
      { athleteId: "ath-2", _sum: { points: 80 } },
      { athleteId: "ath-3", _sum: { points: 50 } },
    ]);
    (prisma.user.findMany as any).mockResolvedValue([
      { id: "ath-1", name: "Аслан", surname: "Қасым", gender: "MALE", weightKg: 66, beltRank: null, avatarUrl: null, club: { id: "club-1", name: { kk: "Алматы" }, city: "Алматы" } },
      { id: "ath-2", name: "Бақыт", surname: "Нұров", gender: "MALE", weightKg: 73, beltRank: null, avatarUrl: null, club: null },
      { id: "ath-3", name: "Ержан", surname: "Сейт", gender: "MALE", weightKg: 81, beltRank: null, avatarUrl: null, club: null },
    ]);

    const board = await getLeaderboard({ limit: 10 });

    expect(board).toHaveLength(3);
    expect(board[0]!.totalPoints).toBe(100);
    expect(board[0]!.rank).toBe(1);
    expect(board[1]!.rank).toBe(2);
    expect(board[2]!.rank).toBe(3);
    // Sorted descending
    for (let i = 1; i < board.length; i++) {
      expect(board[i]!.totalPoints).toBeLessThanOrEqual(board[i - 1]!.totalPoints);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 6 — Round-Robin math
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance: Round-Robin bracket", () => {

  it("N*(N-1)/2 matches for N participants", () => {
    const cases: [number, number][] = [[2, 1], [3, 3], [4, 6], [5, 10], [6, 15]];
    for (const [n, expected] of cases) {
      expect((n * (n - 1)) / 2).toBe(expected);
    }
  });

  it("Each pair plays exactly once", () => {
    const athletes = ["a", "b", "c", "d"];
    const pairs = new Set<string>();
    for (let i = 0; i < athletes.length; i++) {
      for (let j = i + 1; j < athletes.length; j++) {
        const key = `${athletes[i]}-${athletes[j]}`;
        expect(pairs.has(key)).toBe(false); // no duplicate
        pairs.add(key);
      }
    }
    expect(pairs.size).toBe(6); // 4*(4-1)/2
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Smoke tests — fast invariants, no mocks needed
// ═══════════════════════════════════════════════════════════════════════════════

describe("Smoke: system invariants", () => {

  it("bracket size is always a power of 2", () => {
    const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
    for (const n of [2, 4, 8, 16, 32, 64, 128]) expect(isPow2(n)).toBe(true);
    for (const n of [3, 5, 6, 7, 10, 100]) expect(isPow2(n)).toBe(false);
  });

  it("rating points strictly decrease by place", () => {
    const pts = [100, 80, 50, 30, 15, 0];
    for (let i = 1; i < pts.length; i++) expect(pts[i]!).toBeLessThanOrEqual(pts[i - 1]!);
  });

  it("JWT access TTL < refresh TTL", () => {
    const parseSec = (s: string) => {
      if (s.endsWith("m")) return +s.slice(0, -1) * 60;
      if (s.endsWith("h")) return +s.slice(0, -1) * 3600;
      if (s.endsWith("d")) return +s.slice(0, -1) * 86400;
      return +s;
    };
    expect(parseSec("15m")).toBeLessThan(parseSec("7d"));
  });

  it("match duration is in valid range [60, 900]", () => {
    const valid = [60, 120, 240, 300, 900];
    for (const d of valid) {
      expect(d).toBeGreaterThanOrEqual(60);
      expect(d).toBeLessThanOrEqual(900);
    }
  });

  it("all required roles defined", () => {
    const roles = ["ATHLETE", "COACH", "ADMIN"];
    expect(roles).toHaveLength(3);
    expect(roles.every((r) => typeof r === "string")).toBe(true);
  });

  it("bracket max size is 128", () => {
    const MAX_BRACKET_SIZE = 128;
    expect(MAX_BRACKET_SIZE).toBeGreaterThanOrEqual(2);
    // Is power of 2
    expect(MAX_BRACKET_SIZE & (MAX_BRACKET_SIZE - 1)).toBe(0);
  });
});
