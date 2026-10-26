import type { BracketFormat, Match } from "@prisma/client";
import { propagateResult, type SEMatch } from "./single-elimination.js";
import { playoffSlotForGroup } from "./mixed.js";

type Node = Pick<Match, "id" | "round" | "position" | "bracketSection">;
export interface RollbackTarget {
  matchId: string;
  slots: ("red" | "blue")[];
}

/** Follow bracket edges, never an athlete's previous appearances. */
export function planDownstreamRollback(
  matches: Node[],
  root: Node,
  size: number,
  format: BracketFormat,
): RollbackTarget[] {
  if (format === "ROUND_ROBIN") return [];
  const key = (section: string | null, round: number, position: number) =>
    `${section}:${round}:${position}`;
  const byPosition = new Map(
    matches.map((m) => [key(m.bracketSection, m.round, m.position), m]),
  );
  const targets = new Map<string, Set<"red" | "blue">>();
  const visited = new Set<string>([root.id]);
  const pending: Node[] = [];
  const add = (
    section: string,
    round: number,
    position: number,
    slot: "red" | "blue",
  ) => {
    const target = byPosition.get(key(section, round, position));
    if (!target || target.id === root.id) return;
    const slots = targets.get(target.id) ?? new Set<"red" | "blue">();
    slots.add(slot);
    targets.set(target.id, slots);
    if (!visited.has(target.id)) {
      visited.add(target.id);
      pending.push(target);
    }
  };
  const advance = (node: Node) => {
    if (format === "MIXED" && node.bracketSection?.startsWith("group_")) {
      const labels = [
        ...new Set(
          matches
            .map((m) => m.bracketSection)
            .filter((s): s is string => Boolean(s?.startsWith("group_"))),
        ),
      ].sort();
      const index = labels.indexOf(node.bracketSection);
      for (const place of [1, 2] as const) {
        const slot = playoffSlotForGroup(index, place, size);
        add("playoff", 1, slot.position, slot.slot);
      }
      return;
    }
    const playoff = node.bracketSection === "playoff";
    for (const edge of propagateResult(
      node.round,
      node.position,
      (playoff ? "main" : node.bracketSection) as SEMatch["bracketSection"],
      "winner",
      "loser",
      size,
    )) {
      if (playoff && edge.section !== "main" && edge.section !== "final")
        continue;
      add(
        playoff ? "playoff" : edge.section,
        edge.round,
        edge.position,
        edge.slot,
      );
    }
  };
  advance(root);
  while (pending.length) advance(pending.shift()!);
  return [...targets].map(([matchId, slots]) => ({
    matchId,
    slots: [...slots],
  }));
}
