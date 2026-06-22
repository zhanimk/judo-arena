/**
 * Integration tests for the Match service — tournament conduction flow.
 *
 * Tests the full JudoTV-style scoring lifecycle at the service layer.
 * Prisma is mocked — no database required.
 *
 * Scenarios covered:
 *   • startMatch / pauseMatch / enterGoldenScore
 *   • addScoreEvent: IPPON, WAZA_ARI×2, SHIDO×3, HANSOKU_MAKE, YUKO
 *   • finishMatchManually (judge override)
 *   • confirmMatchResult → COMPLETED + propagation skipped via bracketSection=null
 *   • cancelPendingResult (judge error correction)
 *   • undoLastScoreEvent (scoreboard undo)
 *   • startOsaekomi / endOsaekomi with TOKETA scoring
 *   • Error guards: NOT_RUNNING, RESULT_PENDING, ALREADY_COMPLETED, etc.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies BEFORE importing the service ────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    matchEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    bracket: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// bracket-engine propagation is out of scope for these tests
vi.mock("../../src/services/bracket-engine/single-elimination.js", () => ({
  propagateResult: vi.fn().mockReturnValue([]),
}));

// ── Imports after mocks ────────────────────────────────────────────────────────

import { prisma } from "../../src/lib/prisma.js";
import {
  startMatch,
  pauseMatch,
  enterGoldenScore,
  addScoreEvent,
  startOsaekomi,
  endOsaekomi,
  finishMatchManually,
  confirmMatchResult,
  cancelPendingResult,
  undoLastScoreEvent,
} from "../../src/services/match.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Base match that is PENDING (not yet started) */
function makePendingMatch(overrides: Record<string, any> = {}) {
  return {
    id: "match-1",
    tournamentId: "t-1",
    bracketId: "b-1",
    bracketSection: null, // null → propagateWinner returns early (no DB needed)
    round: 1,
    position: 0,
    status: "PENDING",
    redAthleteId: "red-id",
    blueAthleteId: "blue-id",
    tatamiNumber: null, // null → skip tatami-busy check
    queuePosition: null,
    scoreSnapshot: null,
    winnerId: null,
    startedAt: null,
    finishedAt: null,
    isGoldenScore: false,
    isReplay: false,
    replayReason: null,
    bracket: {
      category: {
        goldenScoreSec: 0,
        allowYuko: true, // разрешаем Юко в тестовых фикстурах
      },
    },
    ...overrides,
  };
}

/** Base match that is IN_PROGRESS with clock running */
function makeRunningMatch(overrides: Record<string, any> = {}) {
  return makePendingMatch({
    status: "IN_PROGRESS",
    startedAt: new Date(),
    scoreSnapshot: {
      red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
      blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
      isGoldenScore: false,
      osaekomi: null,
      clock: {
        running: true,
        elapsedSec: 30,
        runningStartedAt: new Date().toISOString(),
      },
      pendingResult: null,
    },
    ...overrides,
  });
}

/** IN_PROGRESS match with a pendingResult already set */
function makeMatchWithPending(winnerSide: "RED" | "BLUE" = "RED") {
  return makeRunningMatch({
    scoreSnapshot: {
      red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
      blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
      isGoldenScore: false,
      osaekomi: null,
      clock: { running: false, elapsedSec: 45, runningStartedAt: null },
      pendingResult: {
        winnerSide,
        winnerId: winnerSide === "RED" ? "red-id" : "blue-id",
        reason: "IPPON",
        triggeredBy: "judge-session-1",
        createdAt: new Date().toISOString(),
      },
    },
  });
}

/** Stub event object returned by prisma.matchEvent.create */
const stubEvent = { id: "evt-1", type: "HAJIME", side: "SYSTEM" };

/** Updated match returned by prisma.match.update */
function makeUpdatedMatch(extra: Record<string, any> = {}) {
  return { ...makeRunningMatch(), ...extra };
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // $transaction: just execute all ops in parallel (array-form only used here)
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return ops(prisma);
  });

  // Default safe return values — override per-test with mockResolvedValueOnce
  vi.mocked(prisma.match.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.matchEvent.create).mockResolvedValue(stubEvent as any);
  vi.mocked(prisma.match.update).mockResolvedValue(makeUpdatedMatch() as any);
  vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.match.findUniqueOrThrow).mockResolvedValue(
    makeUpdatedMatch() as any,
  );
  vi.mocked(prisma.match.findMany).mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// startMatch()
// ─────────────────────────────────────────────────────────────────────────────

describe("startMatch()", () => {
  it("starts a PENDING match — returns IN_PROGRESS match with HAJIME event", async () => {
    const pending = makePendingMatch();
    vi.mocked(prisma.match.findUnique).mockResolvedValue(pending as any);

    const updatedMatch = makeUpdatedMatch({ status: "IN_PROGRESS" });
    vi.mocked(prisma.match.update).mockResolvedValue(updatedMatch as any);

    const result = await startMatch("match-1", "judge-session-1");

    expect(result.match.status).toBe("IN_PROGRESS");
    expect(prisma.match.update).toHaveBeenCalledOnce();
    expect(prisma.matchEvent.create).toHaveBeenCalledOnce();

    // Check that HAJIME event was created
    const createCall = vi.mocked(prisma.matchEvent.create).mock
      .calls[0]![0] as any;
    expect(createCall.data.type).toBe("HAJIME");
    expect(createCall.data.matchId).toBe("match-1");
  });

  it("resumes a paused IN_PROGRESS match (clock stopped → restart)", async () => {
    const paused = makeRunningMatch({
      scoreSnapshot: {
        red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        isGoldenScore: false,
        osaekomi: null,
        clock: { running: false, elapsedSec: 45, runningStartedAt: null }, // paused
        pendingResult: null,
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(paused as any);

    await startMatch("match-1");
    expect(prisma.match.update).toHaveBeenCalledOnce();
  });

  it("throws ALREADY_RUNNING when clock is already running", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await expect(startMatch("match-1")).rejects.toMatchObject({
      code: "ALREADY_RUNNING",
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("throws ALREADY_COMPLETED when match is done", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch({ status: "COMPLETED" }) as any,
    );

    await expect(startMatch("match-1")).rejects.toMatchObject({
      code: "ALREADY_COMPLETED",
    });
  });

  it("throws INCOMPLETE_PAIRING when red athlete is missing", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch({ redAthleteId: null }) as any,
    );

    await expect(startMatch("match-1")).rejects.toMatchObject({
      code: "INCOMPLETE_PAIRING",
    });
  });

  it("throws RESULT_PENDING if a result is awaiting confirmation", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithPending() as any,
    );

    await expect(startMatch("match-1")).rejects.toMatchObject({
      code: "RESULT_PENDING",
    });
  });

  it("throws MATCH_NOT_FOUND for unknown matchId", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(null);

    await expect(startMatch("unknown")).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pauseMatch()
// ─────────────────────────────────────────────────────────────────────────────

describe("pauseMatch()", () => {
  it("pauses a running match — emits MATE event", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await pauseMatch("match-1", "judge-1");

    expect(prisma.match.update).toHaveBeenCalledOnce();
    const createCall = vi.mocked(prisma.matchEvent.create).mock
      .calls[0]![0] as any;
    expect(createCall.data.type).toBe("MATE");
  });

  it("throws NOT_RUNNING when match is not IN_PROGRESS", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch() as any,
    );

    await expect(pauseMatch("match-1")).rejects.toMatchObject({
      code: "NOT_RUNNING",
    });
  });

  it("throws ALREADY_PAUSED when clock is not running", async () => {
    const paused = makeRunningMatch({
      scoreSnapshot: {
        red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        isGoldenScore: false,
        osaekomi: null,
        clock: { running: false, elapsedSec: 30, runningStartedAt: null },
        pendingResult: null,
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(paused as any);

    await expect(pauseMatch("match-1")).rejects.toMatchObject({
      code: "ALREADY_PAUSED",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enterGoldenScore()
// ─────────────────────────────────────────────────────────────────────────────

describe("enterGoldenScore()", () => {
  it("sets isGoldenScore=true and emits GOLDEN_SCORE event", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await enterGoldenScore("match-1", "judge-1");

    const createCall = vi.mocked(prisma.matchEvent.create).mock
      .calls[0]![0] as any;
    expect(createCall.data.type).toBe("GOLDEN_SCORE");

    const updateCall = vi.mocked(prisma.match.update).mock.calls[0]![0] as any;
    expect(updateCall.data.isGoldenScore).toBe(true);
  });

  it("throws NOT_RUNNING when match is PENDING", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch() as any,
    );
    await expect(enterGoldenScore("match-1")).rejects.toMatchObject({
      code: "NOT_RUNNING",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addScoreEvent() — IJF scoring rules
// ─────────────────────────────────────────────────────────────────────────────

describe("addScoreEvent() — IJF scoring rules", () => {
  // ── IPPON → immediate win ─────────────────────────────────────────────────

  it("IPPON for RED → autoFinished=true, winnerId=redAthleteId, pendingResult set", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    const result = await addScoreEvent("match-1", "IPPON", "RED", "judge-1");

    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("red-id");

    // scoreSnapshot passed to updateMany must contain red.ippon=1 and pendingResult
    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.red.ippon).toBe(1);
    expect(updateCall.data.scoreSnapshot.pendingResult).not.toBeNull();
    expect(updateCall.data.scoreSnapshot.pendingResult.winnerSide).toBe("RED");
  });

  it("IPPON for BLUE → autoFinished=true, winnerId=blueAthleteId", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    const result = await addScoreEvent("match-1", "IPPON", "BLUE");

    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("blue-id");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.blue.ippon).toBe(1);
    expect(updateCall.data.scoreSnapshot.pendingResult.winnerSide).toBe("BLUE");
  });

  // ── 2 × WAZA_ARI = IPPON ──────────────────────────────────────────────────

  it("second WAZA_ARI triggers auto-Ippon for RED → autoFinished=true", async () => {
    // First WAZA_ARI already in score
    const matchWithOneWazaAri = makeRunningMatch({
      scoreSnapshot: {
        red: { ippon: 0, wazaari: 1, yuko: 0, shido: 0, hansoku: false },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        isGoldenScore: false,
        osaekomi: null,
        clock: {
          running: true,
          elapsedSec: 60,
          runningStartedAt: new Date().toISOString(),
        },
        pendingResult: null,
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      matchWithOneWazaAri as any,
    );

    const result = await addScoreEvent("match-1", "WAZA_ARI", "RED");

    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("red-id");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    const snap = updateCall.data.scoreSnapshot;
    expect(snap.red.wazaari).toBe(2);
    expect(snap.red.ippon).toBe(1); // upgraded to IPPON
    expect(snap.pendingResult.reason).toBe("WAZA_ARI");
  });

  it("first WAZA_ARI alone does NOT finish the match", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    const result = await addScoreEvent("match-1", "WAZA_ARI", "RED");

    expect(result.autoFinished).toBe(false);
    expect(result.winnerId).toBeNull();

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.pendingResult).toBeNull();
  });

  // ── YUKO ─────────────────────────────────────────────────────────────────

  it("YUKO increments counter but does NOT auto-finish the match", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    const result = await addScoreEvent("match-1", "YUKO", "RED");

    expect(result.autoFinished).toBe(false);
    expect(result.winnerId).toBeNull();

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.red.yuko).toBe(1);
    expect(updateCall.data.scoreSnapshot.pendingResult).toBeNull();
  });

  // ── SHIDO × 3 = Hansoku-make → opponent wins ──────────────────────────────

  it("third SHIDO for RED triggers Hansoku-make → BLUE wins", async () => {
    const matchWithTwoShido = makeRunningMatch({
      scoreSnapshot: {
        red: { ippon: 0, wazaari: 0, yuko: 0, shido: 2, hansoku: false },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        isGoldenScore: false,
        osaekomi: null,
        clock: {
          running: true,
          elapsedSec: 90,
          runningStartedAt: new Date().toISOString(),
        },
        pendingResult: null,
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      matchWithTwoShido as any,
    );

    const result = await addScoreEvent("match-1", "SHIDO", "RED");

    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("blue-id"); // opponent wins

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    const snap = updateCall.data.scoreSnapshot;
    expect(snap.red.shido).toBe(3);
    expect(snap.red.hansoku).toBe(true);
    expect(snap.pendingResult.winnerSide).toBe("BLUE");
  });

  it("two SHIDO do NOT cause auto-finish", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    const result = await addScoreEvent("match-1", "SHIDO", "RED");
    expect(result.autoFinished).toBe(false);
    const result2 = await addScoreEvent("match-1", "SHIDO", "RED");
    expect(result2.autoFinished).toBe(false);
  });

  // ── HANSOKU_MAKE — direct disqualification ─────────────────────────────────

  it("HANSOKU_MAKE for RED → BLUE wins immediately", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    const result = await addScoreEvent("match-1", "HANSOKU_MAKE", "RED");

    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("blue-id");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.red.hansoku).toBe(true);
    expect(updateCall.data.scoreSnapshot.pendingResult.winnerSide).toBe("BLUE");
  });

  // ── Error guards ─────────────────────────────────────────────────────────

  it("throws NOT_RUNNING when match is PENDING", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch() as any,
    );

    await expect(
      addScoreEvent("match-1", "IPPON", "RED"),
    ).rejects.toMatchObject({
      code: "NOT_RUNNING",
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("throws RESULT_PENDING when a result already awaits confirmation", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithPending() as any,
    );

    await expect(
      addScoreEvent("match-1", "WAZA_ARI", "BLUE"),
    ).rejects.toMatchObject({
      code: "RESULT_PENDING",
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("throws ALREADY_IPPON when trying to add WAZA_ARI after IPPON was scored", async () => {
    const matchWithIppon = makeRunningMatch({
      scoreSnapshot: {
        red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        isGoldenScore: false,
        osaekomi: null,
        clock: { running: false, elapsedSec: 50, runningStartedAt: null },
        pendingResult: null, // pendingResult was cleared to simulate edge case
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(matchWithIppon as any);

    await expect(
      addScoreEvent("match-1", "WAZA_ARI", "RED"),
    ).rejects.toMatchObject({
      code: "ALREADY_IPPON",
    });
  });

  it("throws MATCH_NOT_FOUND for unknown id", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(null);

    await expect(
      addScoreEvent("unknown", "IPPON", "RED"),
    ).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// finishMatchManually()
// ─────────────────────────────────────────────────────────────────────────────

describe("finishMatchManually()", () => {
  it("sets pendingResult for RED winning side and stops the clock", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await finishMatchManually("match-1", "RED", "Судья шешімі", "judge-1");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    const snap = updateCall.data.scoreSnapshot;
    expect(snap.pendingResult).not.toBeNull();
    expect(snap.pendingResult.winnerSide).toBe("RED");
    expect(snap.pendingResult.winnerId).toBe("red-id");
    expect(snap.clock.running).toBe(false); // clock stopped
  });

  it("sets pendingResult for BLUE winning side", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await finishMatchManually("match-1", "BLUE");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.pendingResult.winnerSide).toBe("BLUE");
    expect(updateCall.data.scoreSnapshot.pendingResult.winnerId).toBe(
      "blue-id",
    );
  });

  it("throws ALREADY_COMPLETED if match is done", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch({ status: "COMPLETED" }) as any,
    );

    await expect(finishMatchManually("match-1", "RED")).rejects.toMatchObject({
      code: "ALREADY_COMPLETED",
    });
  });

  it("throws RESULT_PENDING when a result is already pending", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithPending() as any,
    );

    await expect(finishMatchManually("match-1", "BLUE")).rejects.toMatchObject({
      code: "RESULT_PENDING",
    });
  });

  it("throws INCOMPLETE_PAIRING when athletes are missing", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch({ blueAthleteId: null }) as any,
    );

    await expect(finishMatchManually("match-1", "RED")).rejects.toMatchObject({
      code: "INCOMPLETE_PAIRING",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmMatchResult()
// ─────────────────────────────────────────────────────────────────────────────

describe("confirmMatchResult()", () => {
  it("confirms result → sets status=COMPLETED, winnerId, clears pendingResult", async () => {
    const matchWithPending = makeMatchWithPending("RED");
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      matchWithPending as any,
    );
    // Atomic confirmation returns the refreshed row after updateMany.
    vi.mocked(prisma.match.findUniqueOrThrow).mockResolvedValue(
      makePendingMatch({
        status: "COMPLETED",
        bracketSection: null,
        winnerId: "red-id",
        finishedAt: new Date(),
      }) as any,
    );

    const updated = await confirmMatchResult("match-1", "judge-1");

    expect(updated.status).toBe("COMPLETED");
    expect(updated.winnerId).toBe("red-id");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.status).toBe("COMPLETED");
    expect(updateCall.data.winnerId).toBe("red-id");
    expect(updateCall.data.scoreSnapshot.pendingResult).toBeNull();
  });

  it("throws NO_PENDING_RESULT when there is nothing to confirm", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await expect(confirmMatchResult("match-1")).rejects.toMatchObject({
      code: "NO_PENDING_RESULT",
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("throws ALREADY_COMPLETED if match is already done", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch({ status: "COMPLETED" }) as any,
    );

    await expect(confirmMatchResult("match-1")).rejects.toMatchObject({
      code: "ALREADY_COMPLETED",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelPendingResult()
// ─────────────────────────────────────────────────────────────────────────────

describe("cancelPendingResult()", () => {
  it("clears pendingResult — match stays IN_PROGRESS for judge correction", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithPending() as any,
    );
    vi.mocked(prisma.match.update).mockResolvedValue(makeUpdatedMatch() as any);

    await cancelPendingResult("match-1", "judge-1");

    const updateCall = vi.mocked(prisma.match.update).mock.calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.pendingResult).toBeNull();

    // The MATE event that marks cancellation
    const createCall = vi.mocked(prisma.matchEvent.create).mock
      .calls[0]![0] as any;
    expect(createCall.data.type).toBe("MATE");
    expect(createCall.data.meta.cancelledPendingResult).toBe(true);
  });

  it("throws NO_PENDING_RESULT when nothing to cancel", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await expect(cancelPendingResult("match-1")).rejects.toMatchObject({
      code: "NO_PENDING_RESULT",
    });
  });

  it("throws NOT_RUNNING when match is not IN_PROGRESS", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch() as any,
    );

    await expect(cancelPendingResult("match-1")).rejects.toMatchObject({
      code: "NOT_RUNNING",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// undoLastScoreEvent()
// ─────────────────────────────────────────────────────────────────────────────

describe("undoLastScoreEvent()", () => {
  it("restores score from previous event snapshot — removes last event", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    // Two scoring events; undo should revert to first event's snapshot
    const prevSnapshot = {
      red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
      blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
      isGoldenScore: false,
      osaekomi: null,
      clock: { running: true, elapsedSec: 20, runningStartedAt: null },
      pendingResult: null,
    };
    const lastSnapshot = {
      ...prevSnapshot,
      red: { ...prevSnapshot.red, wazaari: 1 },
    };

    vi.mocked(prisma.matchEvent.findMany).mockResolvedValue([
      {
        id: "evt-prev",
        type: "WAZA_ARI",
        side: "RED",
        scoreSnapshot: prevSnapshot,
        occurredAt: new Date(Date.now() - 10000),
      },
      {
        id: "evt-last",
        type: "WAZA_ARI",
        side: "RED",
        scoreSnapshot: lastSnapshot,
        occurredAt: new Date(),
      },
    ] as any);

    vi.mocked(prisma.matchEvent.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.matchEvent.create).mockResolvedValue(stubEvent as any);
    vi.mocked(prisma.match.update).mockResolvedValue(makeUpdatedMatch() as any);

    await undoLastScoreEvent("match-1", "judge-1");

    // Should have deleted the last event
    const deleteCall = vi.mocked(prisma.matchEvent.delete).mock
      .calls[0]![0] as any;
    expect(deleteCall.where.id).toBe("evt-last");

    // Should have restored score to prevSnapshot (wazaari back to 0)
    const updateCall = vi.mocked(prisma.match.update).mock.calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.red.wazaari).toBe(0);
    expect(updateCall.data.scoreSnapshot.pendingResult).toBeNull(); // always cleared on undo
  });

  it("reverts to empty score when undoing the very first scoring event", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    vi.mocked(prisma.matchEvent.findMany).mockResolvedValue([
      {
        id: "evt-only",
        type: "SHIDO",
        side: "RED",
        scoreSnapshot: {
          red: { ippon: 0, wazaari: 0, yuko: 0, shido: 1, hansoku: false },
          blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        },
        occurredAt: new Date(),
      },
    ] as any);

    vi.mocked(prisma.matchEvent.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.matchEvent.create).mockResolvedValue(stubEvent as any);
    vi.mocked(prisma.match.update).mockResolvedValue(makeUpdatedMatch() as any);

    await undoLastScoreEvent("match-1");

    const updateCall = vi.mocked(prisma.match.update).mock.calls[0]![0] as any;
    // restored to empty score (shido back to 0)
    expect(updateCall.data.scoreSnapshot.red.shido).toBe(0);
    expect(updateCall.data.scoreSnapshot.red.ippon).toBe(0);
  });

  it("throws NO_EVENTS when there are no undoable scoring events", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );
    vi.mocked(prisma.matchEvent.findMany).mockResolvedValue([]);

    await expect(undoLastScoreEvent("match-1")).rejects.toMatchObject({
      code: "NO_EVENTS",
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("throws NOT_RUNNING when match is not IN_PROGRESS", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch() as any,
    );

    await expect(undoLastScoreEvent("match-1")).rejects.toMatchObject({
      code: "NOT_RUNNING",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startOsaekomi() / endOsaekomi()
// ─────────────────────────────────────────────────────────────────────────────

describe("startOsaekomi()", () => {
  it("records osaekomi start for RED — emits OSAEKOMI event", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await startOsaekomi("match-1", "RED", "judge-1");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.osaekomi).not.toBeNull();
    expect(updateCall.data.scoreSnapshot.osaekomi.side).toBe("RED");

    const createCall = vi.mocked(prisma.matchEvent.create).mock
      .calls[0]![0] as any;
    expect(createCall.data.type).toBe("OSAEKOMI");
    expect(createCall.data.side).toBe("RED");
  });

  it("throws OSAEKOMI_ALREADY when hold-down is already active", async () => {
    const matchWithOsaekomi = makeRunningMatch({
      scoreSnapshot: {
        ...(makeRunningMatch().scoreSnapshot as any),
        osaekomi: { side: "BLUE", startedAt: new Date().toISOString() },
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      matchWithOsaekomi as any,
    );

    await expect(startOsaekomi("match-1", "RED")).rejects.toMatchObject({
      code: "OSAEKOMI_ALREADY",
    });
  });

  it("throws NOT_RUNNING when match is not IN_PROGRESS", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makePendingMatch() as any,
    );

    await expect(startOsaekomi("match-1", "RED")).rejects.toMatchObject({
      code: "NOT_RUNNING",
    });
  });
});

describe("endOsaekomi()", () => {
  /** Build a running match that has an active osaekomi started N seconds ago. */
  function makeMatchWithOsaekomi(
    side: "RED" | "BLUE",
    startedSecondsAgo: number,
  ) {
    const startedAt = new Date(
      Date.now() - startedSecondsAgo * 1000,
    ).toISOString();
    return {
      ...makeRunningMatch({
        scoreSnapshot: {
          red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
          blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
          isGoldenScore: false,
          osaekomi: { side, startedAt },
          clock: {
            running: true,
            elapsedSec: 30,
            runningStartedAt: new Date().toISOString(),
          },
          pendingResult: null,
        },
      }),
      // Include bracket+category for endOsaekomi's allowYuko lookup
      bracket: { category: { allowYuko: false } },
    };
  }

  it("TOKETA after 12 s → awards WAZA_ARI, no auto-finish", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithOsaekomi("RED", 12) as any,
    );

    const result = await endOsaekomi("match-1", "TOKETA", "judge-1");

    expect(result.scoredType).toBe("WAZA_ARI");
    expect(result.autoFinished).toBe(false);

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.red.wazaari).toBe(1);
    expect(updateCall.data.scoreSnapshot.osaekomi).toBeNull();
  });

  it("TOKETA after 22 s → awards IPPON → autoFinished=true", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithOsaekomi("BLUE", 22) as any,
    );

    const result = await endOsaekomi("match-1", "TOKETA");

    expect(result.scoredType).toBe("IPPON");
    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("blue-id");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.scoreSnapshot.blue.ippon).toBe(1);
    expect(updateCall.data.scoreSnapshot.pendingResult.winnerSide).toBe("BLUE");
  });

  it("TOKETA after 3 s → no score awarded", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeMatchWithOsaekomi("RED", 3) as any,
    );

    const result = await endOsaekomi("match-1", "TOKETA");

    expect(result.scoredType).toBeNull();
    expect(result.autoFinished).toBe(false);
  });

  it("throws NO_OSAEKOMI when hold-down is not active", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await expect(endOsaekomi("match-1", "TOKETA")).rejects.toMatchObject({
      code: "NO_OSAEKOMI",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Optimistic locking — CONCURRENT_MODIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Optimistic locking — CONCURRENT_MODIFICATION", () => {
  it("addScoreEvent with stale version → throws CONCURRENT_MODIFICATION (409)", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );
    // Simulate another judge already updated the match (version mismatch → count=0)
    vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 0 } as any);

    await expect(
      addScoreEvent("match-1", "IPPON", "RED", "judge-1", 0),
    ).rejects.toMatchObject({
      code: "CONCURRENT_MODIFICATION",
      httpStatus: 409,
    });
  });

  it("addScoreEvent without expectedVersion → never throws CONCURRENT_MODIFICATION", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );
    vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 0 } as any);

    // No expectedVersion passed — count=0 is silently ignored
    const result = await addScoreEvent("match-1", "IPPON", "RED", "judge-1");
    expect(result.autoFinished).toBe(true);
  });

  it("finishMatchManually with stale version → throws CONCURRENT_MODIFICATION", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );
    vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 0 } as any);

    await expect(
      finishMatchManually("match-1", "RED", "override", "judge-1", 5),
    ).rejects.toMatchObject({
      code: "CONCURRENT_MODIFICATION",
      httpStatus: 409,
    });
  });

  it("startOsaekomi with stale version → throws CONCURRENT_MODIFICATION", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );
    vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 0 } as any);

    await expect(
      startOsaekomi("match-1", "RED", "judge-1", 2),
    ).rejects.toMatchObject({
      code: "CONCURRENT_MODIFICATION",
      httpStatus: 409,
    });
  });

  it("version increments: updateMany called with version: { increment: 1 }", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue(
      makeRunningMatch() as any,
    );

    await addScoreEvent("match-1", "YUKO", "RED");

    const updateCall = vi.mocked(prisma.match.updateMany).mock
      .calls[0]![0] as any;
    expect(updateCall.data.version).toEqual({ increment: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full match flow: start → score → pending → confirm
// ─────────────────────────────────────────────────────────────────────────────

describe("Full match flow: HAJIME → IPPON → SOREMADE", () => {
  it("start → addScoreEvent(IPPON) → confirmMatchResult", async () => {
    // 1. Start
    const pendingMatch = makePendingMatch();
    vi.mocked(prisma.match.findUnique)
      .mockResolvedValueOnce(pendingMatch as any) // startMatch lookup
      .mockResolvedValueOnce(
        // addScoreEvent lookup
        makeRunningMatch({ status: "IN_PROGRESS" }) as any,
      )
      .mockResolvedValueOnce(makeMatchWithPending("RED") as any); // confirmMatchResult lookup

    vi.mocked(prisma.match.update).mockResolvedValueOnce(
      makeUpdatedMatch({ status: "IN_PROGRESS" }) as any,
    );
    vi.mocked(prisma.match.findUniqueOrThrow).mockResolvedValue(
      makePendingMatch({
        status: "COMPLETED",
        bracketSection: null,
        winnerId: "red-id",
      }) as any,
    );

    const started = await startMatch("match-1", "judge-1");
    expect(started.match.status).toBe("IN_PROGRESS");

    const scored = await addScoreEvent("match-1", "IPPON", "RED", "judge-1");
    expect(scored.autoFinished).toBe(true);
    expect(scored.winnerId).toBe("red-id");

    const confirmed = await confirmMatchResult("match-1", "judge-1");
    expect(confirmed.status).toBe("COMPLETED");
    expect(confirmed.winnerId).toBe("red-id");
  });

  it("IJF rule: SHIDO in Golden Score → opponent wins immediately (не ждём 3 штрафа)", async () => {
    // Матч в Golden Score, у RED 0 штрафов — первое же SHIDO для RED → BLUE выигрывает
    const gsMatch = makeRunningMatch({
      isGoldenScore: true,
      // scoreSnapshot.isGoldenScore тоже должен быть true — именно его читает normalizeScore()
      scoreSnapshot: {
        red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
        isGoldenScore: true,
        osaekomi: null,
        clock: {
          running: true,
          elapsedSec: 240,
          runningStartedAt: new Date().toISOString(),
        },
        pendingResult: null,
      },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(gsMatch as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        match: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue(
              makeUpdatedMatch({
                status: "IN_PROGRESS",
                isGoldenScore: true,
              }) as any,
            ),
        },
        matchEvent: { create: vi.fn().mockResolvedValue({ id: "ev-gs" }) },
      } as any),
    );

    const result = await addScoreEvent("match-1", "SHIDO", "RED");
    // SHIDO дан RED → BLUE должен победить немедленно
    expect(result.autoFinished).toBe(true);
    expect(result.winnerId).toBe("blue-id");
  });

  it("IJF rule: YUKO недопустимо когда allowYuko=false", async () => {
    const strictMatch = makeRunningMatch({
      bracket: { category: { goldenScoreSec: 0, allowYuko: false } },
    });
    vi.mocked(prisma.match.findUnique).mockResolvedValue(strictMatch as any);

    // MatchError.message содержит русский текст; проверяем по коду через свойство
    await expect(addScoreEvent("match-1", "YUKO", "RED")).rejects.toThrow(
      "Оценка Юко не разрешена в этой категории",
    );
  });

  it("start → addScoreEvent(IPPON) → cancelPendingResult → addScoreEvent(IPPON)", async () => {
    // Judge presses IPPON by mistake, cancels, then re-scores correctly for BLUE
    vi.mocked(prisma.match.findUnique)
      .mockResolvedValueOnce(makeRunningMatch() as any) // addScoreEvent #1
      .mockResolvedValueOnce(makeMatchWithPending("RED") as any) // cancelPendingResult
      .mockResolvedValueOnce(makeRunningMatch() as any); // addScoreEvent #2 (after cancel)

    vi.mocked(prisma.match.update).mockResolvedValue(makeUpdatedMatch() as any);

    // Score IPPON for RED (mistake)
    const wrongScore = await addScoreEvent(
      "match-1",
      "IPPON",
      "RED",
      "judge-1",
    );
    expect(wrongScore.autoFinished).toBe(true);

    // Cancel the pending result
    await cancelPendingResult("match-1", "judge-1");
    const cancelCall = vi
      .mocked(prisma.matchEvent.create)
      .mock.calls.find(
        (c) => (c[0].data.meta as any)?.cancelledPendingResult === true,
      );
    expect(cancelCall).toBeDefined();

    // Score correct IPPON for BLUE
    const correctScore = await addScoreEvent(
      "match-1",
      "IPPON",
      "BLUE",
      "judge-1",
    );
    expect(correctScore.autoFinished).toBe(true);
    expect(correctScore.winnerId).toBe("blue-id");
  });
});
