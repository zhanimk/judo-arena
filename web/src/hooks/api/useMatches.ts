/**
 * TanStack Query hooks для матчей.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Query keys ────────────────────────────────────────────────────────────────

export const matchKeys = {
  all: ["matches"] as const,
  lists: () => [...matchKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) => [...matchKeys.lists(), params] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
  tatamiQueue: (tournamentId: string, tatami: number) =>
    [...matchKeys.all, "tatami-queue", tournamentId, tatami] as const,
  tatamiSessions: (tournamentId: string) =>
    [...matchKeys.all, "tatami-sessions", tournamentId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useMatches(params?: {
  tournamentId?: string;
  status?: string;
  tatamiNumber?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: matchKeys.list(params),
    queryFn: () => api.matches.list(params),
    enabled: Boolean(params?.tournamentId),
    staleTime: 5_000,
  });
}

/** Polling-версия для live-экранов — обновляется каждые 2.5 сек. */
export function useMatchesLive(
  tournamentId: string | undefined,
  opts?: { tatamiNumber?: number; limit?: number },
) {
  return useQuery({
    queryKey: matchKeys.list({ tournamentId, ...opts }),
    queryFn: () => api.matches.list({ tournamentId, ...opts, limit: opts?.limit ?? 500 }),
    enabled: Boolean(tournamentId),
    refetchInterval: 2_500,
  });
}

export function useMatch(id: string | undefined) {
  return useQuery({
    queryKey: matchKeys.detail(id!),
    queryFn: () => api.matches.get(id!),
    enabled: Boolean(id),
    staleTime: 3_000,
  });
}

export function useTatamiSessions(tournamentId: string | undefined) {
  return useQuery({
    queryKey: matchKeys.tatamiSessions(tournamentId!),
    queryFn: () => api.tatamiSession.list(tournamentId!),
    enabled: Boolean(tournamentId),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function useMatchMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  invalidateKeys: (vars: TVars) => ReadonlyArray<readonly unknown[]>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      invalidateKeys(vars).forEach((key) => qc.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useAssignTatami(tournamentId: string) {
  return useMatchMutation(
    ({ matchId, tatamiNumber }: { matchId: string; tatamiNumber: number }) =>
      api.matches.assignTatami(matchId, tatamiNumber),
    () => [matchKeys.list({ tournamentId })],
  );
}

export function useReorderTatamiQueue(tournamentId: string) {
  return useMatchMutation(
    ({ matchId, direction }: { matchId: string; direction: "up" | "down" }) =>
      api.matches.reorderQueue(matchId, direction),
    () => [matchKeys.list({ tournamentId })],
  );
}

export function useResetMatch(tournamentId: string) {
  return useMatchMutation(
    (matchId: string) => api.matches.reset(matchId),
    () => [matchKeys.list({ tournamentId })],
  );
}

export function useOverrideMatch(tournamentId: string) {
  return useMatchMutation(
    ({ matchId, winnerSide, reason }: { matchId: string; winnerSide: "RED" | "BLUE"; reason: string }) =>
      api.admin.override(matchId, winnerSide, reason),
    () => [matchKeys.list({ tournamentId })],
  );
}

export function useCreateTatamiSession(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tatamiNumber, judgeName }: { tatamiNumber: number; judgeName?: string }) =>
      api.tatamiSession.create(tournamentId, tatamiNumber, judgeName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.tatamiSessions(tournamentId) });
    },
  });
}

export function useRevokeTatamiSession(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.tatamiSession.revoke(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.tatamiSessions(tournamentId) });
    },
  });
}
