import { describe, expect, it } from "vitest";
import {
  computeStandings,
  type RRMatchResult,
} from "../../src/services/bracket-engine/round-robin.js";
import {
  buildMixedBracket,
  buildMixedBracketFromAthletes,
  computeGroupStandings,
} from "../../src/services/bracket-engine/mixed.js";
import { buildSingleElimination } from "../../src/services/bracket-engine/single-elimination.js";
import { findAutomaticBye } from "../../src/services/bracket-engine/byes.js";
import {
  seedAthletes,
  nextPowerOfTwo,
} from "../../src/services/bracket-engine/seeding.js";
const zero = { ippon: 0, wazaari: 0, shido: 0 };
const match = (red: string, blue: string, winner: string): RRMatchResult => ({
  redAthleteId: red,
  blueAthleteId: blue,
  winnerId: winner,
  redScore: { ...zero, ippon: winner === red ? 1 : 0 },
  blueScore: { ...zero, ippon: winner === blue ? 1 : 0 },
});
const results = [
  match("a", "b", "a"),
  match("b", "c", "b"),
  match("c", "a", "c"),
];
const permutations = <T>(items: T[]): T[][] =>
  items.length < 2
    ? [items]
    : items.flatMap((item, index) =>
        permutations(items.filter((_, i) => i !== index)).map((tail) => [
          item,
          ...tail,
        ]),
      );
describe("consistent standings and explicit unresolved ties", () => {
  it("a three-way cycle has one shared place for every input permutation", () => {
    for (const ids of permutations(["a", "b", "c"]))
      for (const matches of permutations(results)) {
        expect(
          computeStandings(ids, matches).map((row) => ({
            id: row.athleteId,
            place: row.place,
            tied: row.tied,
          })),
        ).toEqual([
          { id: "a", place: 1, tied: true },
          { id: "b", place: 1, tied: true },
          { id: "c", place: 1, tied: true },
        ]);
        expect(
          computeGroupStandings(ids, matches).map((row) => row.place),
        ).toEqual([1, 1, 1]);
      }
  });
  it("uses aggregate criteria for a larger equal-wins group without a cyclic comparator", () => {
    const items = results.map((m) => ({ ...m, redScore: { ...m.redScore } }));
    items[0]!.redScore.yuko = 1;
    for (const ids of permutations(["a", "b", "c"])) {
      const rows = computeStandings(ids, items);
      expect(rows[0]!.athleteId).toBe("a");
      expect(rows.map((r) => r.place)).toEqual([1, 2, 3]);
    }
  });
  it("accepts a decision only as a final tiebreaker and preserves proven wins", () => {
    expect(
      computeStandings(["a", "b", "c"], results, ["c", "b", "a"]).map(
        (s) => s.athleteId,
      ),
    ).toEqual(["c", "b", "a"]);
    const strict = [
      match("a", "b", "a"),
      match("a", "c", "a"),
      match("b", "c", "b"),
    ];
    expect(
      computeStandings(["a", "b", "c"], strict, ["c", "b", "a"]).map(
        (s) => s.athleteId,
      ),
    ).toEqual(["a", "b", "c"]);
    expect(
      computeStandings(["a", "b", "c"], results, ["a"]).every((s) => s.tied),
    ).toBe(true);
  });
  it("reserves all MIXED qualifier slots when completed pools remain unresolved", () => {
    const nodes = [
      {
        id: "a",
        bracketSection: "group_A",
        round: 1,
        position: 0,
        status: "COMPLETED" as const,
        redAthleteId: "a1",
        blueAthleteId: "a2",
        winnerId: "a1",
      },
      {
        id: "b",
        bracketSection: "group_B",
        round: 1,
        position: 0,
        status: "COMPLETED" as const,
        redAthleteId: "b1",
        blueAthleteId: "b2",
        winnerId: "b1",
      },
      {
        id: "p0",
        bracketSection: "playoff",
        round: 1,
        position: 0,
        status: "PENDING" as const,
        redAthleteId: "a1",
        blueAthleteId: null,
        winnerId: null,
      },
      {
        id: "p1",
        bracketSection: "playoff",
        round: 1,
        position: 1,
        status: "PENDING" as const,
        redAthleteId: null,
        blueAthleteId: "a2",
        winnerId: null,
      },
    ];
    expect(findAutomaticBye(nodes, 4, "MIXED")).toBeUndefined();
  });
  it("discards results naming an unrelated winner", () => {
    const rows = computeStandings(["a", "b"], [match("a", "b", "outsider")]);
    expect(rows.every((s) => s.wins === 0 && s.losses === 0)).toBe(true);
  });
});
describe("engine input boundaries", () => {
  it("a two-athlete seed contains exactly two slots", () => {
    expect(
      seedAthletes(
        [
          { id: "a", clubId: null },
          { id: "b", clubId: null },
        ],
        2,
        41,
      ).sort(),
    ).toEqual(["a", "b"]);
  });
  it("rejects duplicate athletes, invalid sizes and non-finite counts", () => {
    expect(() =>
      seedAthletes(
        [
          { id: "a", clubId: null },
          { id: "a", clubId: null },
        ],
        2,
        1,
      ),
    ).toThrow();
    expect(() => seedAthletes([], 3, 1)).toThrow();
    expect(() => buildSingleElimination(["a", "a"])).toThrow();
    for (const n of [Infinity, NaN, -1, 1.5])
      expect(() => nextPowerOfTwo(n)).toThrow();
  });
});

it("club-aware MIXED seeding is reproducible, balanced and preserves every athlete", () => {
  for (let count = 6; count <= 128; count++) {
    const athletes = Array.from({ length: count }, (_, i) => ({
      id: `athlete-${i}`,
      clubId: i % 9 === 0 ? null : `club-${i % 6}`,
    }));
    const first = buildMixedBracketFromAthletes(athletes, 41);
    expect(first).toEqual(buildMixedBracketFromAthletes(athletes, 41));
    const sizes = first.groups.map((g) => g.athleteIds.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(first.groups.flatMap((g) => g.athleteIds).sort()).toEqual(
      athletes.map((a) => a.id).sort(),
    );
  }
});
it("MIXED rejects missing, duplicate and unsupported athlete counts", () => {
  for (const ids of [
    [],
    ["a"],
    ["a", "a"],
    Array.from({ length: 129 }, (_, i) => String(i)),
  ]) {
    expect(() => buildMixedBracket(ids)).toThrow();
  }
});
