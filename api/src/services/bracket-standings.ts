import { createHash } from "node:crypto";
import type { Match } from "@prisma/client";
import { computeStandings } from "./bracket-engine/round-robin.js";
import { normalizeScore } from "./match-types.js";

export interface StandingDecision {
  order: string[];
  fingerprint: string;
  reason: string;
  actorUserId: string;
  decidedAt: string;
}
export type StandingsMetadata = Record<string, unknown> & {
  standingsDecisions?: Record<string, StandingDecision>;
};
export function standingsMetadata(value: unknown): StandingsMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as StandingsMetadata)
    : {};
}
export function sectionStandings(
  metadata: unknown,
  section: string,
  matches: Match[],
) {
  const items = matches.filter((m) => m.bracketSection === section);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        items
          .map((m) => ({
            id: m.id,
            version: m.version,
            status: m.status,
            winner: m.winnerId,
            red: m.redAthleteId,
            blue: m.blueAthleteId,
            score: m.scoreSnapshot,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
    )
    .digest("hex");
  const decision = standingsMetadata(metadata).standingsDecisions?.[section];
  const validDecision =
    decision?.fingerprint === fingerprint ? decision : undefined;
  const athleteIds = [
    ...new Set(
      items
        .flatMap((m) => [m.redAthleteId, m.blueAthleteId])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const rows = computeStandings(
    athleteIds,
    items
      .filter((m) => m.status === "COMPLETED")
      .map((m) => {
        const score = normalizeScore(m.scoreSnapshot);
        return {
          redAthleteId: m.redAthleteId!,
          blueAthleteId: m.blueAthleteId!,
          winnerId: m.winnerId,
          redScore: score.red,
          blueScore: score.blue,
        };
      }),
    validDecision?.order,
  );
  const pairs = new Set(
    items.map((m) => [m.redAthleteId, m.blueAthleteId].sort().join("|")),
  );
  const complete =
    athleteIds.length >= 2 &&
    items.length === (athleteIds.length * (athleteIds.length - 1)) / 2 &&
    pairs.size === items.length &&
    items.every(
      (m) =>
        m.status === "COMPLETED" &&
        m.redAthleteId &&
        m.blueAthleteId &&
        m.redAthleteId !== m.blueAthleteId,
    );
  return {
    section,
    complete,
    fingerprint,
    rows,
    decision: validDecision ?? null,
    needsDecision: complete && rows.some((row) => row.tied),
  };
}
export function bracketStandings(bracket: {
  format: string;
  metadata: unknown;
  matches: Match[];
}) {
  const sections =
    bracket.format === "ROUND_ROBIN"
      ? ["main"]
      : bracket.format === "MIXED"
        ? [
            ...new Set(
              bracket.matches
                .map((m) => m.bracketSection)
                .filter((s): s is string => Boolean(s?.startsWith("group_"))),
            ),
          ].sort()
        : [];
  return sections.map((section) => {
    const table = sectionStandings(bracket.metadata, section, bracket.matches);
    return {
      ...table,
      needsDecision:
        table.needsDecision &&
        (bracket.format === "ROUND_ROBIN" ||
          table.rows.some((row) => row.tied && row.place <= 2)),
    };
  });
}
