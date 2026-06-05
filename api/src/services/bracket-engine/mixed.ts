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

export interface MixedSeedable {
  id: string;
  clubId: string | null;
}

/** How many groups for N athletes — official-friendly pools of 4-5 athletes. */
export function numGroups(n: number): number {
  if (n <= 5) return 1;
  if (n <= 10) return 2;
  if (n <= 20) return 4;
  return Math.ceil(n / 5);
}

/**
 * Split an ordered athlete list into equal-ish groups.
 * Athletes are distributed round-robin across groups (snake seeding).
 */
function splitIntoGroups(
  athleteIds: string[],
  k: number,
): { label: GroupLabel; athleteIds: string[] }[] {
  const groups: { label: GroupLabel; athleteIds: string[] }[] = Array.from(
    { length: k },
    (_, i) => ({
      label: String.fromCharCode(65 + i), // A, B, C, …
      athleteIds: [],
    }),
  );

  // Snake seeding: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A, 7→A, …
  // Simple approach: distribute round-robin
  athleteIds.forEach((id, idx) => {
    groups[idx % k]!.athleteIds.push(id);
  });

  return groups;
}

function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Split athletes into balanced pools while separating same-club athletes first.
 * Groups are capped around 4-5 athletes whenever possible.
 */
function splitSeedablesIntoGroups(
  athletes: MixedSeedable[],
  k: number,
  seed: number,
): { label: GroupLabel; athleteIds: string[] }[] {
  const rng = createRng(seed);
  const groups = Array.from({ length: k }, (_, i) => ({
    label: String.fromCharCode(65 + i),
    athleteIds: [] as string[],
    clubCounts: new Map<string, number>(),
  }));
  const maxGroupSize = Math.ceil(athletes.length / k);

  const byClub = new Map<string, MixedSeedable[]>();
  for (const athlete of athletes) {
    const key = athlete.clubId ?? `no-club:${athlete.id}`;
    byClub.set(key, [...(byClub.get(key) ?? []), athlete]);
  }

  const buckets = Array.from(byClub.entries())
    .map(([clubId, bucket]) => [clubId, shuffle(bucket, rng)] as const)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  for (const [clubId, bucket] of buckets) {
    for (const athlete of bucket) {
      const candidates = groups
        .filter((group) => group.athleteIds.length < maxGroupSize)
        .sort((a, b) => {
          const sameClubDiff =
            (a.clubCounts.get(clubId) ?? 0) - (b.clubCounts.get(clubId) ?? 0);
          if (sameClubDiff !== 0) return sameClubDiff;
          return (
            a.athleteIds.length - b.athleteIds.length ||
            a.label.localeCompare(b.label)
          );
        });
      const group =
        candidates[0] ??
        groups.sort((a, b) => a.athleteIds.length - b.athleteIds.length)[0]!;
      group.athleteIds.push(athlete.id);
      group.clubCounts.set(clubId, (group.clubCounts.get(clubId) ?? 0) + 1);
    }
  }

  return groups.map(({ label, athleteIds }) => ({ label, athleteIds }));
}

/**
 * Build the full MIXED bracket plan.
 *
 * @param athleteIds  seeded athlete IDs (ordered by seeding)
 */
export function buildMixedBracket(athleteIds: string[]): MixedBracketPlan {
  const k = numGroups(athleteIds.length);
  const groups = splitIntoGroups(athleteIds, k);
  return buildMixedBracketFromGroups(groups);
}

export function buildMixedBracketFromAthletes(
  athletes: MixedSeedable[],
  seed: number,
): MixedBracketPlan {
  const k = numGroups(athletes.length);
  const groups = splitSeedablesIntoGroups(athletes, k, seed);
  return buildMixedBracketFromGroups(groups);
}

function buildMixedBracketFromGroups(
  groups: { label: GroupLabel; athleteIds: string[] }[],
): MixedBracketPlan {
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
  const advancers = groups.length * 2;
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
 *   Winners are placed on even slots: A1→0, B1→2, C1→4...
 *   Runners-up are mirrored from the bottom: A2→last, B2→last-2...
 *   So with two pools: A1-B2 and B1-A2.
 *
 * Returns { position, slot: "red" | "blue" } for round 1 playoff match.
 */
export function playoffSlotForGroup(
  groupIndex: number, // 0-based (A=0, B=1, …)
  place: 1 | 2,
  playoffSize: number,
): { position: number; slot: "red" | "blue" } {
  const winnerSlot = groupIndex * 2;
  const runnerUpSlot = playoffSize - 1 - groupIndex * 2;
  const slotIndex = place === 1 ? winnerSlot : runnerUpSlot;
  return {
    position: Math.floor(slotIndex / 2),
    slot: slotIndex % 2 === 0 ? "red" : "blue",
  };
}
