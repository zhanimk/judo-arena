import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { match: { findUnique: vi.fn() } },
}));
vi.mock("../../src/sockets/io.js", () => ({ emitMatchEvent: vi.fn() }));
vi.mock("../../src/services/match.service.js", () => ({
  endOsaekomi: vi.fn(),
}));
vi.mock("../../src/services/match-lifecycle.service.js", () => ({
  pauseMatch: vi.fn(),
}));
import { prisma } from "../../src/lib/prisma.js";
import { endOsaekomi } from "../../src/services/match.service.js";
import { pauseMatch } from "../../src/services/match-lifecycle.service.js";
import { scheduleOsaekomiTimer } from "../../src/services/osaekomi-timer.service.js";
import { scheduleGoldenScoreTimer } from "../../src/services/golden-score-timer.service.js";
import {
  emptyScore,
  osaekomiWinThreshold,
} from "../../src/services/match-types.js";
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("winning hold timer", () => {
  it("uses 20 seconds normally, 10 after waza-ari, and 5 for Golden Score with yuko", () => {
    const score = emptyScore();
    expect(osaekomiWinThreshold(score, "RED", true)).toBe(20);
    score.red.wazaari = 1;
    expect(osaekomiWinThreshold(score, "RED", true)).toBe(10);
    expect(osaekomiWinThreshold(score, "BLUE", true)).toBe(20);
    score.isGoldenScore = true;
    expect(osaekomiWinThreshold(score, "BLUE", true)).toBe(5);
    expect(osaekomiWinThreshold(score, "BLUE", false)).toBe(10);
  });
  it("fires at the winning threshold and binds delivery to the read version", async () => {
    const startedAt = new Date().toISOString();
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      version: 7,
      scoreSnapshot: { osaekomi: { side: "RED", startedAt } },
    } as never);
    vi.mocked(endOsaekomi).mockResolvedValue({
      match: {},
      autoFinished: true,
    } as never);
    scheduleOsaekomiTimer("m", startedAt, 5);
    await vi.advanceTimersByTimeAsync(4999);
    expect(endOsaekomi).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(endOsaekomi).toHaveBeenCalledWith("m", "TIME_LIMIT", undefined, 7);
  });
  it("ignores a stale callback when a different hold is active", async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      scoreSnapshot: { osaekomi: { side: "BLUE", startedAt: "new-hold" } },
    } as never);
    scheduleOsaekomiTimer("m", new Date().toISOString(), 5);
    await vi.advanceTimersByTimeAsync(5000);
    expect(endOsaekomi).not.toHaveBeenCalled();
  });
});
describe("limited Golden Score", () => {
  it("stops for a judge decision instead of disqualifying on fewer shido", async () => {
    const score = emptyScore();
    score.isGoldenScore = true;
    score.red.shido = 1;
    score.clock.running = true;
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      status: "IN_PROGRESS",
      redAthleteId: "r",
      blueAthleteId: "b",
      scoreSnapshot: score,
    } as never);
    vi.mocked(pauseMatch).mockResolvedValue({ match: {} } as never);
    scheduleGoldenScoreTimer("m", 10, new Date().toISOString());
    await vi.advanceTimersByTimeAsync(10000);
    expect(pauseMatch).toHaveBeenCalledWith("m", undefined, undefined);
  });
});
