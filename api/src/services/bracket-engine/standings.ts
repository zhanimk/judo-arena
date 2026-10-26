export interface StandingResult {
  redAthleteId: string;
  blueAthleteId: string;
  winnerId: string | null;
}

/** Partition first, compare second: pairwise head-to-head sorting is cyclic for A>B>C>A. */
export function rankStandings<
  T extends { athleteId: string; wins: number; place: number },
>(
  rows: T[],
  results: StandingResult[],
  metrics: ((row: T) => number)[],
  decisionOrder?: string[],
): (T & { tied: boolean })[] {
  const partition = (items: T[], metric: (row: T) => number): T[][] => {
    const buckets = new Map<number, T[]>();
    for (const row of items) {
      const key = metric(row);
      buckets.set(key, [...(buckets.get(key) ?? []), row]);
    }
    return [...buckets].sort(([a], [b]) => b - a).map(([, group]) => group);
  };
  const resolve = (items: T[], index: number): T[][] => {
    if (items.length < 2) return [items];
    if (items.length === 2) {
      const [a, b] = items;
      const direct = results.filter(
        (m) =>
          (m.redAthleteId === a!.athleteId &&
            m.blueAthleteId === b!.athleteId) ||
          (m.redAthleteId === b!.athleteId && m.blueAthleteId === a!.athleteId),
      );
      if (direct.length === 1 && direct[0]!.winnerId) {
        const winner = items.find(
          (row) => row.athleteId === direct[0]!.winnerId,
        );
        if (winner) return [[winner], [items.find((row) => row !== winner)!]];
      }
    }
    if (index < metrics.length) {
      return partition(items, metrics[index]!).flatMap((group) =>
        resolve(group, index + 1),
      );
    }
    return [items];
  };
  const groups = partition(rows, (row) => row.wins).flatMap((group) =>
    resolve(group, 0),
  );
  const ranks = new Map(decisionOrder?.map((id, index) => [id, index]));
  let place = 1;
  return groups.flatMap((group) => {
    const decided =
      group.length > 1 && group.every((row) => ranks.has(row.athleteId));
    const ordered = [...group].sort((a, b) =>
      decided
        ? ranks.get(a.athleteId)! - ranks.get(b.athleteId)!
        : a.athleteId.localeCompare(b.athleteId),
    );
    const start = place;
    place += group.length;
    return ordered.map((row, index) => ({
      ...row,
      place: start + (decided ? index : 0),
      tied: group.length > 1 && !decided,
    }));
  });
}
