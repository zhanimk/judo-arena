import { describe, it, expect } from "vitest";
import { buildSingleElimination } from "../../src/services/bracket-engine/single-elimination.js";
import { buildMixedBracket } from "../../src/services/bracket-engine/mixed.js";
import { planDownstreamRollback } from "../../src/services/bracket-engine/rollback.js";

describe("downstream rollback", () => {
  const matches = buildSingleElimination(
    Array.from({ length: 8 }, (_, i) => `a${i}`),
  ).map((m, i) => ({ ...m, id: `m${i}` }));
  it("resetting a semifinal never clears its quarterfinals or the other semifinal", () => {
    const root = matches.find(
      (m) => m.bracketSection === "main" && m.round === 2 && m.position === 0,
    )!;
    const plan = planDownstreamRollback(matches, root, 8, "SE_IJF");
    expect(plan).toHaveLength(2);
    expect(plan).toEqual(
      expect.arrayContaining([
        {
          matchId: matches.find((m) => m.bracketSection === "final")!.id,
          slots: ["red"],
        },
        {
          matchId: matches.find((m) => m.bracketSection === "bronze2")!.id,
          slots: ["blue"],
        },
      ]),
    );
  });
  it("quarterfinal invalidates winner and loser paths, preserving unrelated slots", () => {
    const plan = planDownstreamRollback(matches, matches[0]!, 8, "SE_IJF");
    const sections = plan.map(
      (p) => matches.find((m) => m.id === p.matchId)!.bracketSection,
    );
    expect(sections.sort()).toEqual(
      ["bronze1", "bronze2", "final", "main", "repechage"].sort(),
    );
    const bronze = plan.find(
      (p) =>
        matches.find((m) => m.id === p.matchId)!.bracketSection === "bronze1",
    )!;
    expect(bronze.slots).toEqual(["red"]);
    const oppositeBronze = plan.find(
      (p) =>
        matches.find((m) => m.id === p.matchId)!.bracketSection === "bronze2",
    )!;
    expect(oppositeBronze.slots).toEqual(["blue"]);
    expect(plan.some((p) => p.matchId === matches[0]!.id)).toBe(false);
  });
  it("finals and round-robin matches have no downstream", () => {
    expect(
      planDownstreamRollback(
        matches,
        matches.find((m) => m.bracketSection === "final")!,
        8,
        "SE_IJF",
      ),
    ).toEqual([]);
    expect(
      planDownstreamRollback(matches, matches[0]!, 8, "ROUND_ROBIN"),
    ).toEqual([]);
  });
  it("mixed group corrections invalidate qualifiers and their playoff descendants only", () => {
    const mixed = buildMixedBracket(
      Array.from({ length: 8 }, (_, i) => `a${i}`),
    );
    const nodes = [...mixed.groupMatches, ...mixed.playoffMatches].map(
      (m, i) => ({ ...m, id: `m${i}` }),
    );
    const plan = planDownstreamRollback(
      nodes,
      nodes[0]!,
      mixed.playoffSize,
      "MIXED",
    );
    expect(plan).toHaveLength(3);
    expect(
      plan.every(
        (p) =>
          nodes.find((m) => m.id === p.matchId)!.bracketSection === "playoff",
      ),
    ).toBe(true);
    expect(
      plan
        .find((p) => nodes.find((m) => m.id === p.matchId)!.round === 2)!
        .slots.sort(),
    ).toEqual(["blue", "red"]);
  });
});
