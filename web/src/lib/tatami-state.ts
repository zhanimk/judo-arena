export type MatchLike = {
  id: string;
  tournamentId?: string;
  tatamiNumber?: number | null;
  queuePosition?: number | null;
  round?: number | null;
  position?: number | null;
  status?: string;
  scoreSnapshot?: any;
};

export type TatamiState<T extends MatchLike = MatchLike> = {
  number: number;
  current: T | null;
  queue: T[];
  completed: T[];
  pendingResult: T | null;
};

export function hasPendingResult(match?: MatchLike | null): boolean {
  return Boolean(match?.scoreSnapshot?.pendingResult);
}

export function buildTatamiState<T extends MatchLike>(matches: T[], tatamiCount: number): TatamiState<T>[] {
  const sorted = [...matches].sort(matchOrder);
  return Array.from({ length: tatamiCount }, (_, index) => {
    const number = index + 1;
    const assigned = sorted.filter((m) => Number(m.tatamiNumber) === number);
    const active = assigned.filter((m) => m.status === "IN_PROGRESS");
    const pendingResult = active.find(hasPendingResult) ?? null;
    return {
      number,
      current: pendingResult ?? active[0] ?? null,
      pendingResult,
      queue: assigned.filter((m) => m.status === "PENDING"),
      completed: assigned.filter((m) => m.status === "COMPLETED"),
    };
  });
}

export function matchOrder(a: MatchLike, b: MatchLike) {
  const stateRank = (m: MatchLike) => {
    if (hasPendingResult(m)) return 0;
    if (m.status === "IN_PROGRESS") return 1;
    if (m.status === "PENDING") return 2;
    if (m.status === "COMPLETED") return 3;
    return 4;
  };
  return (
    stateRank(a) - stateRank(b) ||
    (a.queuePosition ?? 999999) - (b.queuePosition ?? 999999) ||
    (a.round ?? 0) - (b.round ?? 0) ||
    (a.position ?? 0) - (b.position ?? 0)
  );
}

export function sideLabel(side?: "RED" | "BLUE" | string | null) {
  return side === "BLUE" ? "КӨК" : "АҚ";
}
