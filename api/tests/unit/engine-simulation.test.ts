import { describe, expect, it } from "vitest";
import type { Match, BracketFormat } from "@prisma/client";
import {
  buildSingleElimination,
  propagateResult,
  type SEMatch,
} from "../../src/services/bracket-engine/single-elimination.js";
import {
  seedAthletes,
  nextPowerOfTwo,
} from "../../src/services/bracket-engine/seeding.js";
import { findAutomaticBye } from "../../src/services/bracket-engine/byes.js";
import {
  buildMixedBracket,
  playoffSlotForGroup,
} from "../../src/services/bracket-engine/mixed.js";
import {
  buildRoundRobin,
  computeStandings,
} from "../../src/services/bracket-engine/round-robin.js";

type Node = Pick<
  Match,
  | "id"
  | "round"
  | "position"
  | "bracketSection"
  | "status"
  | "redAthleteId"
  | "blueAthleteId"
  | "winnerId"
>;
const nodes = (
  plan: {
    round: number;
    position: number;
    bracketSection: string;
    redAthleteId: string | null;
    blueAthleteId: string | null;
  }[],
): Node[] =>
  plan.map((m, i) => ({
    ...m,
    id: String(i),
    status: "PENDING",
    winnerId: null,
  }));
function finish(
  matches: Node[],
  match: Node,
  size: number,
  format: BracketFormat,
  winner: string,
) {
  const loser =
    match.redAthleteId === winner ? match.blueAthleteId : match.redAthleteId;
  match.status = "COMPLETED";
  match.winnerId = winner;
  const playoff = match.bracketSection === "playoff";
  for (const edge of propagateResult(
    match.round,
    match.position,
    (playoff ? "main" : match.bracketSection) as SEMatch["bracketSection"],
    winner,
    loser ?? "",
    size,
  )) {
    if (
      !edge.athleteId ||
      (playoff && !["main", "final"].includes(edge.section))
    )
      continue;
    const target = matches.find(
      (m) =>
        m.bracketSection === (playoff ? "playoff" : edge.section) &&
        m.round === edge.round &&
        m.position === edge.position,
    );
    expect(
      target,
      `missing feeder target ${JSON.stringify(edge)}`,
    ).toBeDefined();
    const field = edge.slot === "red" ? "redAthleteId" : "blueAthleteId";
    expect(target![field]).toBeNull();
    target![field] = edge.athleteId;
  }
}
function conduct(
  matches: Node[],
  size: number,
  format: BracketFormat,
  strength: string[],
) {
  const losses = new Map<string, number>();
  for (let guard = 0; guard < matches.length + 1; guard++) {
    const bye = findAutomaticBye(matches, size, format);
    const playable = matches.find(
      (m) =>
        m.status === "PENDING" &&
        m.redAthleteId &&
        m.blueAthleteId &&
        !m.bracketSection?.startsWith("group_"),
    );
    const match = bye ?? playable;
    if (!match) break;
    const participants = [match.redAthleteId, match.blueAthleteId].filter(
      (id): id is string => Boolean(id),
    );
    expect(new Set(participants).size).toBe(participants.length);
    expect(participants.every((id) => strength.includes(id))).toBe(true);
    const winner = participants.sort(
      (a, b) => strength.indexOf(a) - strength.indexOf(b),
    )[0]!;
    if (!bye) {
      for (const id of participants)
        expect(losses.get(id) ?? 0).toBeLessThan(format === "SE_IJF" ? 2 : 1);
      const loser = participants.find((id) => id !== winner)!;
      losses.set(loser, (losses.get(loser) ?? 0) + 1);
    }
    finish(matches, match, size, format, winner);
  }
  expect(
    matches.filter(
      (m) => m.status !== "COMPLETED" && (m.redAthleteId || m.blueAthleteId),
    ),
  ).toEqual([]);
  const final = matches.find(
    (m) =>
      m.round === Math.log2(size) &&
      m.bracketSection === (format === "MIXED" ? "playoff" : "final"),
  );
  expect(final?.winnerId).toBe(strength[0]);
  return losses;
}

describe("exhaustive engine simulation", () => {
  for (let count = 2; count <= 128; count++) {
    it(`SE: ${count} athletes, seeded BYEs, both loser routes and all medals`, () => {
      const athletes = Array.from({ length: count }, (_, i) => ({
        id: `a${i}`,
        clubId: `club${i % 7}`,
      }));
      for (const seed of [1, 41, 2026]) {
        const size = nextPowerOfTwo(count);
        const matches = nodes(
          buildSingleElimination(seedAthletes(athletes, size, seed)),
        );
        conduct(
          matches,
          size,
          "SE_IJF",
          athletes.map((a) => a.id),
        );
        const medals = matches
          .filter((m) =>
            ["final", "bronze1", "bronze2"].includes(m.bracketSection!),
          )
          .map((m) => m.winnerId)
          .filter(Boolean);
        expect(new Set(medals).size).toBe(medals.length);
        expect(medals).toHaveLength(size >= 8 ? 3 : size === 4 ? 2 : 1);
      }
    });
  }
  for (let count = 6; count <= 128; count++) {
    it(`MIXED: ${count} athletes, delayed group slots and playoff BYEs`, () => {
      const ids = Array.from({ length: count }, (_, i) => `a${i}`);
      const plan = buildMixedBracket(ids);
      const matches = nodes(
        plan.playoffMatches.concat(plan.groupMatches as any),
      );
      for (const [index, group] of plan.groups.entries()) {
        // Group winners are independently known by a strict strength order.
        for (const m of matches.filter(
          (m) => m.bracketSection === `group_${group.label}`,
        )) {
          m.status = "COMPLETED";
          m.winnerId = [m.redAthleteId!, m.blueAthleteId!].sort(
            (a, b) => ids.indexOf(a) - ids.indexOf(b),
          )[0]!;
        }
        for (const place of [1, 2] as const) {
          const slot = playoffSlotForGroup(index, place, plan.playoffSize);
          const target = matches.find(
            (m) =>
              m.bracketSection === "playoff" &&
              m.round === 1 &&
              m.position === slot.position,
          )!;
          target[slot.slot === "red" ? "redAthleteId" : "blueAthleteId"] =
            group.athleteIds[place - 1]!;
        }
        if (index < plan.groups.length - 1) {
          const bye = findAutomaticBye(matches, plan.playoffSize, "MIXED");
          if (bye) expect(bye.redAthleteId || bye.blueAthleteId).toBeTruthy();
        }
      }
      conduct(matches, plan.playoffSize, "MIXED", ids);
    });
  }
  for (let count = 2; count <= 8; count++) {
    it(`RR: ${count} athletes, every pair exactly once, no double booking in a round`, () => {
      const ids = Array.from({ length: count }, (_, i) => `a${i}`);
      const matches = buildRoundRobin(ids);
      expect(matches).toHaveLength((count * (count - 1)) / 2);
      expect(
        new Set(
          matches.map((m) =>
            [m.redAthleteId, m.blueAthleteId].sort().join("|"),
          ),
        ).size,
      ).toBe(matches.length);
      for (const round of new Set(matches.map((m) => m.round))) {
        const athletes = matches
          .filter((m) => m.round === round)
          .flatMap((m) => [m.redAthleteId, m.blueAthleteId]);
        expect(new Set(athletes).size).toBe(athletes.length);
      }
      const zero = { ippon: 0, wazaari: 0, shido: 0 };
      const results = matches.map((m) => ({
        ...m,
        winnerId:
          ids.indexOf(m.redAthleteId) < ids.indexOf(m.blueAthleteId)
            ? m.redAthleteId
            : m.blueAthleteId,
        redScore: zero,
        blueScore: zero,
      }));
      expect(
        computeStandings([...ids].reverse(), [...results].reverse()).map(
          (s) => s.athleteId,
        ),
      ).toEqual(ids);
    });
  }
});
