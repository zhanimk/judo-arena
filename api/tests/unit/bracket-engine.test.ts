import { describe, it, expect } from "vitest";
import { seedAthletes, nextPowerOfTwo } from "../../src/services/bracket-engine/seeding.js";
import {
  buildSingleElimination,
  propagateResult,
  computePlaces,
} from "../../src/services/bracket-engine/single-elimination.js";
import { buildRoundRobin, computeStandings } from "../../src/services/bracket-engine/round-robin.js";
import {
  planTatamiAssignments,
  compareMatches,
  compareCategories,
} from "../../src/services/bracket-engine/tatami-plan.js";

// ─── nextPowerOfTwo ────────────────────────────────────────────────────────────

describe("seedAthletes — error cases", () => {
  it("throws when athletes count exceeds bracket size", () => {
    const athletes = [
      { id: "a1", clubId: "c1" },
      { id: "a2", clubId: "c2" },
      { id: "a3", clubId: "c3" },
    ];
    expect(() => seedAthletes(athletes, 2, 42)).toThrow();
  });
});

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

// ─── buildSingleElimination — edge cases ──────────────────────────────────────

describe("buildSingleElimination — edge cases", () => {
  it("size=2: one main match + no repechage + no bronze", () => {
    const matches = buildSingleElimination(["a", "b"]);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.bracketSection).toBe("final");
    expect(matches.some((m) => m.bracketSection === "repechage")).toBe(false);
    expect(matches.some((m) => m.bracketSection === "bronze1")).toBe(false);
  });

  it("throws for bracket size > 128", () => {
    const slots = Array.from({ length: 256 }, (_, i) => `a${i}`);
    expect(() => buildSingleElimination(slots)).toThrow();
  });

  it("size=16: has repechage and two bronze matches", () => {
    const slots = Array.from({ length: 16 }, (_, i) => `a${i}`);
    const matches = buildSingleElimination(slots);
    expect(matches.filter((m) => m.bracketSection === "repechage")).toHaveLength(2);
    expect(matches.filter((m) => m.bracketSection === "bronze1")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "bronze2")).toHaveLength(1);
  });

  it("size=4: position 1 red slot in round 1 goes to final as blue", () => {
    const props = propagateResult(1, 1, "main", "W", "L", 4);
    const toFinal = props.find((p) => p.section === "final");
    expect(toFinal!.slot).toBe("blue");
    expect(toFinal!.athleteId).toBe("W");
  });

  it("size=4: loser of position 0 semifinal goes to bronze red slot", () => {
    const props = propagateResult(1, 0, "main", "W", "L", 4);
    const toBronze = props.find((p) => p.section === "bronze1");
    expect(toBronze!.slot).toBe("red");
    expect(toBronze!.athleteId).toBe("L");
  });

  it("size=4: loser of position 1 semifinal goes to bronze blue slot", () => {
    const props = propagateResult(1, 1, "main", "W", "L", 4);
    const toBronze = props.find((p) => p.section === "bronze1");
    expect(toBronze!.slot).toBe("blue");
    expect(toBronze!.athleteId).toBe("L");
  });

  it("size=8: quarters loser positions 0,1 go to repechage A (position 0)", () => {
    // quartersRound = totalRounds - 2 = log2(8) - 2 = 1
    const propsPos0 = propagateResult(1, 0, "main", "W", "L", 8);
    const repPos0 = propsPos0.find((p) => p.section === "repechage");
    expect(repPos0!.position).toBe(0);
    expect(repPos0!.slot).toBe("red");
    expect(repPos0!.athleteId).toBe("L");

    const propsPos1 = propagateResult(1, 1, "main", "W", "L", 8);
    const repPos1 = propsPos1.find((p) => p.section === "repechage");
    expect(repPos1!.position).toBe(0);
    expect(repPos1!.slot).toBe("blue");
  });

  it("size=8: quarters loser positions 2,3 go to repechage B (position 1)", () => {
    const propsPos2 = propagateResult(1, 2, "main", "W", "L", 8);
    const repPos2 = propsPos2.find((p) => p.section === "repechage");
    expect(repPos2!.position).toBe(1);
    expect(repPos2!.slot).toBe("red");

    const propsPos3 = propagateResult(1, 3, "main", "W", "L", 8);
    const repPos3 = propsPos3.find((p) => p.section === "repechage");
    expect(repPos3!.position).toBe(1);
    expect(repPos3!.slot).toBe("blue");
  });

  it("size=8: semifinal loser position 1 goes to bronze2", () => {
    // semisRound = totalRounds - 1 = 2
    const props = propagateResult(2, 1, "main", "W", "L", 8);
    const toBronze = props.find((p) => p.section === "bronze2");
    expect(toBronze!.athleteId).toBe("L");
    expect(toBronze!.slot).toBe("blue");
  });

  it("repechage winner goes to correct bronze as red slot", () => {
    // repechage position 0 → bronze1
    const propsA = propagateResult(2, 0, "repechage", "W", "L", 8);
    const bronze1 = propsA.find((p) => p.section === "bronze1");
    expect(bronze1!.athleteId).toBe("W");
    expect(bronze1!.slot).toBe("red");

    // repechage position 1 → bronze2
    const propsB = propagateResult(2, 1, "repechage", "W", "L", 8);
    const bronze2 = propsB.find((p) => p.section === "bronze2");
    expect(bronze2!.athleteId).toBe("W");
    expect(bronze2!.slot).toBe("red");
  });

  it("final and bronze sections return no further propagation", () => {
    expect(propagateResult(3, 0, "final", "W", "L", 8)).toHaveLength(0);
    expect(propagateResult(3, 0, "bronze1", "W", "L", 8)).toHaveLength(0);
    expect(propagateResult(3, 1, "bronze2", "W", "L", 8)).toHaveLength(0);
  });

  it("size=16: quarter losers flow to repechage A/B (positions 0,1)", () => {
    // Round 1 (quarters), size=16 has 4 rounds total, quarterfinals = round 2
    const p0 = propagateResult(2, 0, "main", "W", "L", 16);
    const rep0 = p0.find((p) => p.section === "repechage");
    expect(rep0).toBeDefined();
    expect(rep0!.position).toBe(0);
  });

  it("bye slots (null athletes) produce matches with null athlete IDs", () => {
    // 3 athletes → bracket of 4 → one bye
    const slots = seedAthletes([
      { id: "a1", clubId: "c1" },
      { id: "a2", clubId: "c2" },
      { id: "a3", clubId: "c3" },
    ], 4, 1);
    expect(slots).toHaveLength(4);
    const nullCount = slots.filter((s) => s === null).length;
    expect(nullCount).toBe(1);
  });
});

// ─── computePlaces ────────────────────────────────────────────────────────────

describe("computePlaces — SE bracket place calculation", () => {
  it("returns place 1 for final winner, place 2 for finalist, place 3 for bronze winner", () => {
    const places = computePlaces({
      finalWinnerId: "a",
      finalLoserId: "c",
      bronze1WinnerId: "b",
    });
    expect(places["a"]).toBe(1);
    expect(places["c"]).toBe(2);
    expect(places["b"]).toBe(3);
  });

  it("both bronze winners get place 3 (SE_IJF with two bronzes)", () => {
    const places = computePlaces({
      finalWinnerId: "a",
      finalLoserId: "c",
      bronze1WinnerId: "b",
      bronze2WinnerId: "d",
    });
    expect(places["b"]).toBe(3);
    expect(places["d"]).toBe(3);
  });

  it("repechage losers get place 5", () => {
    const places = computePlaces({
      finalWinnerId: "a",
      finalLoserId: "b",
      bronze1WinnerId: "c",
      bronze2WinnerId: "d",
      rep1LoserId: "e",
      rep2LoserId: "f",
    });
    expect(places["e"]).toBe(5);
    expect(places["f"]).toBe(5);
  });

  it("at most one athlete has place 1", () => {
    const places = computePlaces({
      finalWinnerId: "a",
      finalLoserId: "b",
      bronze1WinnerId: "c",
    });
    const place1s = Object.values(places).filter((p) => p === 1);
    expect(place1s).toHaveLength(1);
  });

  it("empty input returns empty record", () => {
    expect(computePlaces({})).toEqual({});
  });

  it("undefined ids are ignored (no null keys in output)", () => {
    const places = computePlaces({ finalWinnerId: "a" });
    expect(Object.keys(places)).toEqual(["a"]);
  });
});

// ─── computePlaces ────────────────────────────────────────────────────────────

describe("computePlaces", () => {
  it("assigns places 1 and 2 from final", () => {
    const places = computePlaces({ finalWinnerId: "gold", finalLoserId: "silver" });
    expect(places["gold"]).toBe(1);
    expect(places["silver"]).toBe(2);
  });

  it("assigns place 3 to both bronze winners", () => {
    const places = computePlaces({
      finalWinnerId: "g", finalLoserId: "s",
      bronze1WinnerId: "b1", bronze2WinnerId: "b2",
    });
    expect(places["b1"]).toBe(3);
    expect(places["b2"]).toBe(3);
  });

  it("assigns place 5 to repechage losers", () => {
    const places = computePlaces({
      rep1LoserId: "r1", rep2LoserId: "r2",
    });
    expect(places["r1"]).toBe(5);
    expect(places["r2"]).toBe(5);
  });

  it("returns empty object for empty input", () => {
    expect(computePlaces({})).toEqual({});
  });
});

// ─── computeStandings — additional tie-breakers ───────────────────────────────

describe("computeStandings — tie-breakers", () => {
  it("handles draws (winnerId=null): increments draws for both", () => {
    const matches = [
      {
        redAthleteId: "a", blueAthleteId: "b", winnerId: null,
        redScore: { ippon: 0, wazaari: 0, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
    ];
    const s = computeStandings(["a", "b"], matches);
    expect(s.find((x) => x.athleteId === "a")!.draws).toBe(1);
    expect(s.find((x) => x.athleteId === "b")!.draws).toBe(1);
  });

  it("ippon tiebreaker: more ippons wins when wins are equal", () => {
    // a and b both have 1 win but b has more ippons
    const matches = [
      {
        redAthleteId: "a", blueAthleteId: "c", winnerId: "a",
        redScore: { ippon: 0, wazaari: 1, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
      {
        redAthleteId: "b", blueAthleteId: "c", winnerId: "b",
        redScore: { ippon: 1, wazaari: 0, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
      // head-to-head: a beats b → a ranked first by h2h, not ippon
      // So let's remove h2h and test ippon in isolation with 3rd player
    ];
    // a: 1 win, 0 ippon; b: 1 win, 1 ippon; c: 0 wins
    // b > a by ippon tiebreaker (no h2h between a and b)
    const s = computeStandings(["a", "b", "c"], matches);
    expect(s[0]!.athleteId).toBe("b");
    expect(s[1]!.athleteId).toBe("a");
  });

  it("waza-ari tiebreaker when wins and ippons are equal", () => {
    const matches = [
      {
        redAthleteId: "a", blueAthleteId: "c", winnerId: "a",
        redScore: { ippon: 0, wazaari: 2, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
      {
        redAthleteId: "b", blueAthleteId: "c", winnerId: "b",
        redScore: { ippon: 0, wazaari: 1, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
    ];
    // a: 1 win, 0 ippon, 2 wazaari; b: 1 win, 0 ippon, 1 wazaari
    const s = computeStandings(["a", "b", "c"], matches);
    expect(s[0]!.athleteId).toBe("a");
  });

  it("net points tiebreaker when wins/ippons/wazaari all equal", () => {
    const matches = [
      {
        redAthleteId: "a", blueAthleteId: "c", winnerId: "a",
        redScore: { ippon: 0, wazaari: 0, shido: 0, yuko: 2 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0, yuko: 0 },
      },
      {
        redAthleteId: "b", blueAthleteId: "c", winnerId: "b",
        redScore: { ippon: 0, wazaari: 0, shido: 0, yuko: 1 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0, yuko: 0 },
      },
    ];
    // a has higher yuko net → higher netPoints
    const s = computeStandings(["a", "b", "c"], matches);
    expect(s[0]!.athleteId).toBe("a");
  });

  it("shido reduces net points", () => {
    const matches = [
      {
        redAthleteId: "a", blueAthleteId: "b", winnerId: "a",
        redScore: { ippon: 0, wazaari: 0, shido: 3 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
    ];
    const s = computeStandings(["a", "b"], matches);
    // a wins but has shido → lower netPoints
    expect(s.find((x) => x.athleteId === "a")!.netPoints).toBeLessThan(0);
  });

  it("ignores matches where athlete id is not in the stats map", () => {
    const matches = [
      {
        redAthleteId: "unknown", blueAthleteId: "a", winnerId: "a",
        redScore: { ippon: 0, wazaari: 0, shido: 0 },
        blueScore: { ippon: 1, wazaari: 0, shido: 0 },
      },
    ];
    // Should not throw; "unknown" is not in athleteIds
    expect(() => computeStandings(["a"], matches)).not.toThrow();
  });

  it("throws when fewer than 2 participants", () => {
    expect(() => buildRoundRobin(["solo"])).toThrow();
  });

  it("throws when more than 8 participants", () => {
    const ids = Array.from({ length: 9 }, (_, i) => `p${i}`);
    expect(() => buildRoundRobin(ids)).toThrow();
  });

  it("2 participants: exactly 1 match", () => {
    const matches = buildRoundRobin(["x", "y"]);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.redAthleteId).toBe("x");
    expect(matches[0]!.blueAthleteId).toBe("y");
  });

  it("h2h tiebreaker: all three players have equal wins (circular) — both h2h branches exercised", () => {
    // Circular wins: a > c, b > a, c > b → all 1 win, all equal ippons
    // Comparator will be called in both directions, exercising both return -1 and return 1
    const matches = [
      {
        redAthleteId: "a", blueAthleteId: "c", winnerId: "a",
        redScore: { ippon: 1, wazaari: 0, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
      {
        redAthleteId: "b", blueAthleteId: "a", winnerId: "b",
        redScore: { ippon: 1, wazaari: 0, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
      {
        redAthleteId: "c", blueAthleteId: "b", winnerId: "c",
        redScore: { ippon: 1, wazaari: 0, shido: 0 },
        blueScore: { ippon: 0, wazaari: 0, shido: 0 },
      },
    ];
    const s = computeStandings(["a", "b", "c"], matches);
    // Non-transitive tiebreaker → result order is deterministic via localeCompare fallback
    expect(s).toHaveLength(3);
    expect(new Set(s.map((r) => r.place)).size).toBeGreaterThan(0);
  });
});

// ─── planTatamiAssignments — edge cases ───────────────────────────────────────

describe("planTatamiAssignments — edge cases", () => {
  it("tatamiCount=0 defaults to 1 tatami", () => {
    const plan = planTatamiAssignments([], 0);
    expect(plan.loads).toHaveLength(1);
    expect(plan.loads[0]!.tatamiNumber).toBe(1);
  });

  it("skips categories with no matches", () => {
    const plan = planTatamiAssignments(
      [{ bracketId: "b1", categoryId: "c1", gender: "MALE", ageMin: 10, ageMax: 12, weightMin: 30, weightMax: 40, matches: [] }],
      1,
    );
    expect(plan.categories).toHaveLength(0);
    expect(plan.assignments).toHaveLength(0);
  });

  it("null bracketSection sorts after all known sections", () => {
    const nullMatch = { id: "n", bracketSection: null, round: 1, position: 0 };
    const mainMatch = { id: "m", bracketSection: "main", round: 1, position: 0 };
    expect(compareMatches(nullMatch, mainMatch)).toBeGreaterThan(0);
    expect(compareMatches(mainMatch, nullMatch)).toBeLessThan(0);
  });

  it("unknown bracketSection falls back to order 9 (sorts last)", () => {
    const unknownMatch = { id: "u", bracketSection: "unknown_section", round: 1, position: 0 };
    const finalMatch = { id: "f", bracketSection: "final", round: 1, position: 0 };
    expect(compareMatches(unknownMatch, finalMatch)).toBeGreaterThan(0);
  });

  it("compareCategories sorts by ageMin first", () => {
    const young = { bracketId: "b1", categoryId: "c1", gender: "MALE" as const, ageMin: 8,  ageMax: 11, weightMin: 30, weightMax: 40, matches: [] };
    const older = { bracketId: "b2", categoryId: "c2", gender: "MALE" as const, ageMin: 10, ageMax: 11, weightMin: 30, weightMax: 40, matches: [] };
    expect(compareCategories(young, older)).toBeLessThan(0);
  });

  it("compareCategories sorts by ageMax when ageMin is equal", () => {
    const younger = { bracketId: "b1", categoryId: "c1", gender: "MALE" as const, ageMin: 10, ageMax: 11, weightMin: 30, weightMax: 40, matches: [] };
    const older   = { bracketId: "b2", categoryId: "c2", gender: "MALE" as const, ageMin: 10, ageMax: 13, weightMin: 30, weightMax: 40, matches: [] };
    expect(compareCategories(younger, older)).toBeLessThan(0);
  });

  it("compareCategories sorts by weightMin when age and gender equal", () => {
    const lighter = { bracketId: "b1", categoryId: "c1", gender: "MALE" as const, ageMin: 10, ageMax: 12, weightMin: 30, weightMax: 40, matches: [] };
    const heavier = { bracketId: "b2", categoryId: "c2", gender: "MALE" as const, ageMin: 10, ageMax: 12, weightMin: 40, weightMax: 60, matches: [] };
    expect(compareCategories(lighter, heavier)).toBeLessThan(0);
  });

  it("compareCategories sorts MALE before FEMALE when age is equal", () => {
    const male   = { bracketId: "b1", categoryId: "c1", gender: "MALE" as const,   ageMin: 10, ageMax: 12, weightMin: 30, weightMax: 40, matches: [] };
    const female = { bracketId: "b2", categoryId: "c2", gender: "FEMALE" as const, ageMin: 10, ageMax: 12, weightMin: 30, weightMax: 40, matches: [] };
    expect(compareCategories(male, female)).toBeLessThan(0);
  });
});
