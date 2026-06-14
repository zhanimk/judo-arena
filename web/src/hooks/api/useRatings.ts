/**
 * TanStack Query hooks для рейтинга.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Query keys ────────────────────────────────────────────────────────────────

export const ratingKeys = {
  all: ["ratings"] as const,
  leaderboard: (params?: Record<string, unknown>) =>
    [...ratingKeys.all, "leaderboard", params] as const,
  clubLeaderboard: (params?: Record<string, unknown>) =>
    [...ratingKeys.all, "club-leaderboard", params] as const,
  athlete: (id: string) => [...ratingKeys.all, "athlete", id] as const,
  athleteStats: (id: string) => [...ratingKeys.all, "athlete-stats", id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useLeaderboard(params?: {
  gender?: string;
  weightClass?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ratingKeys.leaderboard(params),
    queryFn: () => api.ratings.leaderboard(params),
    staleTime: 120_000, // Рейтинг меняется редко — 2 мин
  });
}

export function useClubLeaderboard(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ratingKeys.clubLeaderboard(params),
    queryFn: () => api.ratings.clubLeaderboard(params),
    staleTime: 120_000,
  });
}

export function useAthleteRating(athleteId: string | undefined) {
  return useQuery({
    queryKey: ratingKeys.athlete(athleteId!),
    queryFn: () => api.ratings.athlete(athleteId!),
    enabled: Boolean(athleteId),
    staleTime: 60_000,
  });
}

export function useAthleteStats(athleteId: string | undefined) {
  return useQuery({
    queryKey: ratingKeys.athleteStats(athleteId!),
    queryFn: () => api.ratings.athleteStats(athleteId!),
    enabled: Boolean(athleteId),
    staleTime: 60_000,
  });
}
