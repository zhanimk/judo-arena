import { describe, it, expect } from "vitest";
import { seedAthletes, nextPowerOfTwo } from "../../src/services/bracket-engine/seeding.js";
import { buildSingleElimination, propagateResult } from "../../src/services/bracket-engine/single-elimination.js";
import { buildRoundRobin, computeStandings } from "../../src/services/bracket-engine/round-robin.js";
import { planTatamiAssignments } from "../../src/services/bracket-engine/tatami-plan.js";

// ─── nextPowerOfTwo ────────────────────────────────────────────────────────────

describe("nextPowerOfTwo", () => {
  it("returns 2 for 0, 1, 2", () => {
    expect(nextPowerOfTwo(0)).toBe(2);
    expect(nextPowerOfTwo(1)).toBe(2);
    expect(nextPowerOfTwo(2)).toBe(2);
  });

  it("rounds up to nearest power", () => {
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
    expect(nextPowerOfTwo(33)).toBe(64);
  });
});

// ─── seedAthletes ─────────────────────────────────────────────────────────────

describe("seedAthletes", () => {
  it("returns array of correct length with BYE slots", () => {
    const athletes = [
      { id: "a1", clubId: "c1" },
      { id: "a2", clubId: "c2" },
      { id: "a3", clubId: "c1" },
    ];
    const slots = seedAthletes(athletes, 4, 42);
    expect(slots).toHaveLength(4);
    expect(slots.filter((s) => s !== null)).toHaveLength(3);
    expect(slots.filter((s) => s === null)).toHaveLength(1);
  });

  it("separates club-mates into different quarters", () => {
    const sameClub = Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, clubId: "A" }));
    const otherClub = Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, clubId: "B" }));
    const slots = seedAthletes([...sameClub, ...otherClub], 8, 100);

    for (let q = 0; q < 4; q++) {
      const quarter = slots.slice(q * 2, q * 2 + 2).filter(Boolean);
      const clubs = new Set(quarter.map((id) => (id!.startsWith("a") ? "A" : "B")));
      expect(quarter.length <= 1 || clubs.size === quarter.length).toBe(true);
    }
  });

  it("is deterministic for the same seed", () => {
    const ath = [
      { id: "a", clubId: "1" },
      { id: "b", clubId: "2" },
      { id: "c", clubId: "1" },
      { id: "d", clubId: "2" },
    ];
    expect(seedAthletes(ath, 4, 12345)).toEqual(seedAthletes(ath, 4, 12345));
  });
});

// ─── buildSingleElimination ───────────────────────────────────────────────────

describe("buildSingleElimination", () => {
  it("creates correct match count for bracket of 4", () => {
    const matches = buildSingleElimination(["a", "b", "c", "d"]);
    expect(matches).toHaveLength(4);
    expect(matches.filter((m) => m.bracketSection === "main")).toHaveLength(2);
    expect(matches.filter((m) => m.bracketSection === "final")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "bronze1")).toHaveLength(1);
  });

  it("creates correct match count for bracket of 8 with repechage", () => {
    const matches = buildSingleElimination(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(matches.filter((m) => m.bracketSection === "main")).toHaveLength(6);
    expect(matches.filter((m) => m.bracketSection === "final")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "repechage")).toHaveLength(2);
    expect(matches.filter((m) => m.bracketSection === "bronze1")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "bronze2")).toHaveLength(1);
  });

  it("fills round 1 with athletes, leaves later rounds empty", () => {
    const matches = buildSingleElimination(["a", "b", "c", "d"]);
    const round1 = matches.filter((m) => m.bracketSection === "main");
    expect(round1[0]!.redAthleteId).toBe("a");
    expect(round1[0]!.blueAthleteId).toBe("b");
    const final = matches.find((m) => m.bracketSection === "final");
    expect(final!.redAthleteId).toBeNull();
    expect(final!.blueAthleteId).toBeNull();
  });

  it("throws on non-power-of-two input", () => {
    expect(() => buildSingleElimination(["a", "b", "c"])).toThrow();
  });
});

// ─── propagateResult ──────────────────────────────────────────────────────────

describe("propagateResult", () => {
  it("sends winner to the next match", () => {
    const props = propagateResult(1, 0, "main", "winner-id", "loser-id", 4);
    const toFinal = props.find((p) => p.section === "final");
    expect(toFinal).toBeDefined();
    expect(toFinal!.athleteId).toBe("winner-id");
    expect(toFinal!.slot).toBe("red");
  });

  it("routes semifinal loser to bronze (size=8)", () => {
    const props = propagateResult(2, 0, "main", "winner-id", "loser-id", 8);
    const toFinal = props.find((p) => p.section === "final");
    const toBronze = props.find((p) => p.section === "bronze1");
    expect(toFinal!.athleteId).toBe("winner-id");
    expect(toBronze!.athleteId).toBe("loser-id");
  });
});

// ─── buildRoundRobin ──────────────────────────────────────────────────────────

describe("buildRoundRobin", () => {
  it("ensures every athlete plays every other athlete exactly once", () => {
    const matches = buildRoundRobin(["a", "b", "c", "d"]);
    expect(matches).toHaveLength(6); // N*(N-1)/2

    const pairs = new Set<string>();
    for (const m of matches) {
      const key = [m.redAthleteId, m.blueAthleteId].sort().join(",");
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
  });

  it("handles odd participant count (3)", () => {
    expect(buildRoundRobin(["x", "y", "z"])).toHaveLength(3);
  });

  it("throws with only 1 participant", () => {
    expect(() => buildRoundRobin(["only-one"])).toThrow();
  });
});

// ─── computeStandings ─────────────────────────────────────────────────────────

describe("computeStandings", () => {
  it("ranks athletes by wins", () => {
    const matches = [
      { redAthleteId: "a", blueAthleteId: "b", winnerId: "a",
        redScore: { ippon: 1, wazaari: 0, shido: 0 }, blueScore: { ippon: 0, wazaari: 0, shido: 0 } },
      { redAthleteId: "a", blueAthleteId: "c", winnerId: "a",
        redScore: { ippon: 0, wazaari: 1, shido: 0 }, blueScore: { ippon: 0, wazaari: 0, shido: 0 } },
      { redAthleteId: "b", blueAthleteId: "c", winnerId: "b",
        redScore: { ippon: 0, wazaari: 1, shido: 0 }, blueScore: { ippon: 0, wazaari: 0, shido: 0 } },
    ];
    const standings = computeStandings(["a", "b", "c"], matches);
    expect(standings[0]!.athleteId).toBe("a");
    expect(standings[0]!.place).toBe(1);
    expect(standings[1]!.athleteId).toBe("b");
    expect(standings[2]!.athleteId).toBe("c");
  });

  it("applies head-to-head tiebreaker", () => {
    const matches = [
      { redAthleteId: "a", blueAthleteId: "b", winnerId: "b",
        redScore: { ippon: 0, wazaari: 0, shido: 0 }, blueScore: { ippon: 1, wazaari: 0, shido: 0 } },
    ];
    const s = computeStandings(["a", "b"], matches);
    expect(s[0]!.athleteId).toBe("b");
    expect(s[1]!.athleteId).toBe("a");
  });
});

// ─── planTatamiAssignments ────────────────────────────────────────────────────

describe("planTatamiAssignments", () => {
  it("keeps every category on one tatami and balances load", () => {
    const plan = planTatamiAssignments([
      {
        bracketId: "b1", categoryId: "u12-34", gender: "FEMALE",
        ageMin: 10, ageMax: 11, weightMin: 30, weightMax: 34,
        matches: [
          { id: "m1", bracketSection: "main", round: 1, position: 0 },
          { id: "m2", bracketSection: "final", round: 2, position: 0 },
        ],
      },
      {
        bracketId: "b2", categoryId: "u12-38", gender: "MALE",
        ageMin: 10, ageMax: 11, weightMin: 34, weightMax: 38,
        matches: [
          { id: "m3", bracketSection: "main", round: 1, position: 0 },
          { id: "m4", bracketSection: "main", round: 1, position: 1 },
        ],
      },
    ], 2);

    const b1Tatamis = new Set(plan.assignments.filter((a) => ["m1", "m2"].includes(a.matchId)).map((a) => a.tatamiNumber));
    const b2Tatamis = new Set(plan.assignments.filter((a) => ["m3", "m4"].includes(a.matchId)).map((a) => a.tatamiNumber));
    expect(b1Tatamis.size).toBe(1);
    expect(b2Tatamis.size).toBe(1);
    expect(plan.loads.map((l) => l.matches).sort()).toEqual([2, 2]);
  });

  it("orders matches as: main → repechage → bronze → final", () => {
    const plan = planTatamiAssignments([
      {
        bracketId: "b1", categoryId: "u14-50", gender: "MALE",
        ageMin: 12, ageMax: 13, weightMin: 46, weightMax: 50,
        matches: [
          { id: "final",  bracketSection: "final",     round: 3, position: 0 },
          { id: "bronze", bracketSection: "bronze1",   round: 3, position: 0 },
          { id: "rep",    bracketSection: "repechage", round: 2, position: 0 },
          { id: "main2",  bracketSection: "main",      round: 2, position: 0 },
          { id: "main1",  bracketSection: "main",      round: 1, position: 0 },
        ],
      },
    ], 1);

    expect(plan.assignments.map((a) => a.matchId)).toEqual(["main1", "main2", "rep", "bronze", "final"]);
    expect(plan.assignments.map((a) => a.queuePosition)).toEqual([1, 2, 3, 4, 5]);
  });
});
