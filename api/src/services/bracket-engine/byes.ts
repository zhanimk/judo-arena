import type { BracketFormat, Match } from "@prisma/client";
import { playoffSlotForGroup } from "./mixed.js";
import { propagateResult, type SEMatch } from "./single-elimination.js";

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

/** A missing slot is a BYE only when its feeder cannot produce an athlete. */
export function findAutomaticBye(
  matches: Node[],
  size: number,
  format: BracketFormat,
): Node | undefined {
  if (format === "ROUND_ROBIN") return;
  const key = (section: string | null, round: number, position: number) =>
    `${section}:${round}:${position}`;
  const incoming = new Map<string, { source: Node; loser: boolean }>();
  for (const source of matches) {
    if (source.bracketSection?.startsWith("group_")) continue;
    const playoff = source.bracketSection === "playoff";
    for (const edge of propagateResult(
      source.round,
      source.position,
      (playoff ? "main" : source.bracketSection) as SEMatch["bracketSection"],
      "winner",
      "loser",
      size,
    )) {
      if (playoff && edge.section !== "main" && edge.section !== "final")
        continue;
      incoming.set(
        `${key(playoff ? "playoff" : edge.section, edge.round, edge.position)}:${edge.slot}`,
        { source, loser: edge.athleteId === "loser" },
      );
    }
  }
  // An unresolved pool still owns its playoff slots even after every group match is completed.
  const groupSections = [
    ...new Set(
      matches
        .map((m) => m.bracketSection)
        .filter((section): section is string =>
          Boolean(section?.startsWith("group_")),
        ),
    ),
  ].sort();
  const reservedSlots = new Set(
    groupSections.flatMap((_, index) =>
      ([1, 2] as const).map((place) => {
        const slot = playoffSlotForGroup(index, place, size);
        return `${slot.position}:${slot.slot}`;
      }),
    ),
  );
  const memo = new Map<string, boolean>();
  const slotPossible = (node: Node, slot: "red" | "blue"): boolean => {
    if (node[slot === "red" ? "redAthleteId" : "blueAthleteId"]) return true;
    const feeder = incoming.get(
      `${key(node.bracketSection, node.round, node.position)}:${slot}`,
    );
    if (!feeder)
      return (
        node.bracketSection === "playoff" &&
        node.round === 1 &&
        reservedSlots.has(`${node.position}:${slot}`)
      );
    return possible(feeder.source, feeder.loser);
  };
  const possible = (node: Node, loser: boolean): boolean => {
    const cacheKey = `${node.id}:${loser}`;
    if (memo.has(cacheKey)) return memo.get(cacheKey)!;
    // Fail closed on a malformed cyclic graph.
    memo.set(cacheKey, true);
    const result =
      node.status === "COMPLETED"
        ? loser
          ? Boolean(node.winnerId && node.redAthleteId && node.blueAthleteId)
          : Boolean(node.winnerId)
        : loser
          ? slotPossible(node, "red") && slotPossible(node, "blue")
          : slotPossible(node, "red") || slotPossible(node, "blue");
    memo.set(cacheKey, result);
    return result;
  };
  return matches.find(
    (m) =>
      m.status === "PENDING" &&
      !m.bracketSection?.startsWith("group_") &&
      Boolean(m.redAthleteId) !== Boolean(m.blueAthleteId) &&
      !slotPossible(m, m.redAthleteId ? "blue" : "red"),
  );
}
