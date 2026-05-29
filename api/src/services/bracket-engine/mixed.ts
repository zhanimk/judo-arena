/**
 * MIXED bracket engine: Group stage (Round-Robin) → Playoff (Single Elimination)
 *
 * Структура:
 *   • Athletes split into groups of 4–5
 *   • Each group plays round-robin (bracketSection = "group_A", "group_B", …)
 *   • Top 2 from each group advance to SE playoff (bracketSection = "playoff")
 *   • Playoff size = nextPowerOfTwo(numGroups * 2) — may include BYEs
 *
 * Naming:
 *   Group matches:   bracketSection = "group_A" | "group_B" | …
 *   Playoff matches: bracketSection = "playoff_<round>_<pos>" → simplified to "playoff"
 *                    round numbering restarts from 1 in playoff
 *
 * Advancement:
 *   After all matches in a group complete, computeGroupStandings() is called
 *   and the top-2 athletes are placed into their playoff slots.
 */

import { buildRoundRobin } from "./round-robin.js";
import { nextPowerOfTwo } from "./seeding.js";

export type GroupLabel = string; // "A", "B", "C", …

export interface MixedGroupMatch {
  round: number;
  position: number;
  bracketSection: string; // "group_A", "group_B", …
  redAthleteId: string;
  blueAthleteId: string;
}

export interface MixedPlayoffMatch {
  round: number;
  position: number;
  bracketSection: "playoff";
  // null = TBD — filled after groups complete
  redAthleteId: string | null;
  blueAthleteId: string | null;
}

export interface MixedBracketPlan {
  groups: { label: GroupLabel; athleteIds: string[] }[];
  groupMatches: MixedGroupMatch[];
  playoffMatches: MixedPlayoffMatch[];
  playoffSize: number;
}

/** How many groups for N athletes — aim for groups of 4–5 */
export function numGroups(n: number): number {
  if (n < 4) return 1; // fallback: single group (caller should use RR instead)
  return Math.max(2, Math.round(n / 4));
}

/**
 * Split an ordered athlete list into equal-ish groups.
 * Athletes are distributed round-robin across groups (snake seeding).
 */
function splitIntoGroups(athleteIds: string[], k: number): { label: GroupLabel; athleteIds: string[] }[] {
  const groups: { label: GroupLabel; athleteIds: string[] }[] = Array.from({ length: k }, (_, i) => ({
    label: String.fromCharCode(65 + i), // A, B, C, …
    athleteIds: [],
  }));

  // Snake seeding: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A, 7→A, …
  // Simple approach: distribute round-robin
  athleteIds.forEach((id, idx) => {
    groups[idx % k]!.athleteIds.push(id);
  });

  return groups;
}

/**
 * Build the full MIXED bracket plan.
 *
 * @param athleteIds  seeded athlete IDs (ordered by seeding)
 */
export function buildMixedBracket(athleteIds: string[]): MixedBracketPlan {
  const k = numGroups(athleteIds.length);
  const groups = splitIntoGroups(athleteIds, k);

  // Group matches
  const groupMatches: MixedGroupMatch[] = [];
  for (const group of groups) {
    const section = `group_${group.label}`;
    const rrMatches = buildRoundRobin(group.athleteIds);
    for (const m of rrMatches) {
      groupMatches.push({
        round: m.round,
        position: m.position,
        bracketSection: section,
        redAthleteId: m.redAthleteId,
        blueAthleteId: m.blueAthleteId,
      });
    }
  }

  // Playoff shell: top 2 per group → k*2 advancers
  const advancers = k * 2;
  const playoffSize = nextPowerOfTwo(advancers);
  const playoffMatches = buildPlayoffShell(playoffSize);

  return { groups, groupMatches, playoffMatches, playoffSize };
}

/**
 * Build a hollow SE bracket shell for the playoff stage.
 * All athlete slots are null — filled after groups complete.
 */
function buildPlayoffShell(size: number): MixedPlayoffMatch[] {
  const totalRounds = Math.log2(size);
  const matches: MixedPlayoffMatch[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const count = size / Math.pow(2, round);
    for (let pos = 0; pos < count; pos++) {
      matches.push({
        round,
        position: pos,
        bracketSection: "playoff",
        redAthleteId: null,
        blueAthleteId: null,
      });
    }
  }

  return matches;
}

// ============================================================
// Group standings for advancement
// ============================================================

export interface GroupMatchResult {
  redAthleteId: string;
  blueAthleteId: string;
  winnerId: string | null;
}

export interface GroupStanding {
  athleteId: string;
  wins: number;
  losses: number;
  place: number;
}

/**
 * Compute group standings from completed matches.
 * Returns athletes sorted by place (1 = best).
 */
export function computeGroupStandings(
  athleteIds: string[],
  results: GroupMatchResult[],
): GroupStanding[] {
  const stats = new Map<string, { wins: number; losses: number }>(
    athleteIds.map((id) => [id, { wins: 0, losses: 0 }]),
  );

  // Head-to-head results for tiebreaking
  const h2h = new Map<string, string>(); // "A_vs_B" → winnerId

  for (const r of results) {
    const red = stats.get(r.redAthleteId);
    const blue = stats.get(r.blueAthleteId);
    if (!red || !blue) continue;

    if (r.winnerId === r.redAthleteId) {
      red.wins++;
      blue.losses++;
    } else if (r.winnerId === r.blueAthleteId) {
      blue.wins++;
      red.losses++;
    }

    const key = [r.redAthleteId, r.blueAthleteId].sort().join("|");
    if (r.winnerId) h2h.set(key, r.winnerId);
  }

  const list: GroupStanding[] = Array.from(stats.entries()).map(([id, s]) => ({
    athleteId: id,
    ...s,
    place: 0,
  }));

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Head-to-head tiebreaker
    const key = [a.athleteId, b.athleteId].sort().join("|");
    const winner = h2h.get(key);
    if (winner === a.athleteId) return -1;
    if (winner === b.athleteId) return 1;
    // Stable fallback
    return a.athleteId.localeCompare(b.athleteId);
  });

  list.forEach((s, i) => (s.place = i + 1));
  return list;
}

/**
 * Given a group label ("A", "B", …) and a playoff slot index (0-based, top-2 per group),
 * return the position in the first round of the playoff SE bracket.
 *
 * Seeding pattern for k groups, 2 advancers each:
 *   Slot 0 = group winner   (place 1)
 *   Slot 1 = group runner-up (place 2)
 *
 * Placement strategy (avoids same-group rematch in R1):
 *   Group A: winner → pos 0 (red), runner-up → pos (size/2 - 1) (blue side)
 *   Group B: winner → pos (size/2), runner-up → pos 1
 *   etc.
 *
 * Returns { position, slot: "red" | "blue" } for round 1 playoff match.
 */
export function playoffSlotForGroup(
  groupIndex: number,   // 0-based (A=0, B=1, …)
  place: 1 | 2,
  playoffSize: number,
): { position: number; slot: "red" | "blue" } {
  // Simple balanced seeding: winners on top half, runners-up on bottom half
  // Winners:     A→0, B→1, C→2, D→3, …
  // Runners-up:  A→(size/2 - 1), B→(size/2 - 2), … (reversed to avoid R1 rematch)
  const halfSize = playoffSize / 2;

  if (place === 1) {
    const pos = groupIndex;
    const slot: "red" | "blue" = (pos % 2 === 0) ? "red" : "blue";
    const matchPos = Math.floor(pos / 2);
    return { position: matchPos, slot };
  } else {
    // Runners-up from bottom, reversed
    const reverseIdx = (halfSize - 1) - groupIndex;
    const slotIdx = halfSize + reverseIdx;
    const matchPos = Math.floor(slotIdx / 2);
    const slot: "red" | "blue" = (slotIdx % 2 === 0) ? "red" : "blue";
    return { position: matchPos, slot };
  }
}
