/**
 * TanStack Query hooks для турниров.
 *
 * Централизованные query keys и fetchers — один источник правды.
 * Все роуты импортируют из этого файла вместо inline useQuery.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateTournamentInput,
  UpdateTournamentInput,
} from "@/lib/api-types";

// ── Query keys ────────────────────────────────────────────────────────────────
// Объект вместо raw строк — позволяет invalidateQueries({ queryKey: tournamentKeys.detail(id) })
// и автоматически инвалидирует дочерние ключи при invalidateQueries({ queryKey: tournamentKeys.all })

export const tournamentKeys = {
  all: ["tournaments"] as const,
  lists: () => [...tournamentKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) => [...tournamentKeys.lists(), params] as const,
  details: () => [...tournamentKeys.all, "detail"] as const,
  detail: (id: string) => [...tournamentKeys.details(), id] as const,
  categories: (id: string) => [...tournamentKeys.detail(id), "categories"] as const,
  applications: (id: string) => [...tournamentKeys.detail(id), "applications"] as const,
  brackets: (id: string) => [...tournamentKeys.detail(id), "brackets"] as const,
  participants: (id: string) => [...tournamentKeys.detail(id), "participants"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useTournamentsList(params?: {
  status?: string;
  city?: string;
  search?: string;
  upcoming?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: tournamentKeys.list(params),
    queryFn: () => api.tournaments.list(params),
    staleTime: 30_000, // 30 сек — список меняется нечасто
  });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.detail(id!),
    queryFn: () => api.tournaments.get(id!),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useTournamentCategories(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.categories(tournamentId!),
    queryFn: () => api.tournaments.categories(tournamentId!),
    enabled: Boolean(tournamentId),
    staleTime: 60_000, // Категории меняются редко
  });
}

export function useTournamentBrackets(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.brackets(tournamentId!),
    queryFn: () => api.brackets.forTournament(tournamentId!),
    enabled: Boolean(tournamentId),
    staleTime: 10_000,
  });
}

export function useTournamentApplications(tournamentId: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.applications(tournamentId!),
    queryFn: () => api.tournaments.applications(tournamentId!),
    enabled: Boolean(tournamentId),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTournamentInput) => api.tournaments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useUpdateTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTournamentInput) => api.tournaments.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useChangeTournamentStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => api.tournaments.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tournaments.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useBulkApproveApplications(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => api.tournaments.bulkApprove(tournamentId, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.applications(tournamentId) });
    },
  });
}

export function usePrepareBrackets(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.brackets.prepareTournament(tournamentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.brackets(tournamentId) });
    },
  });
}
