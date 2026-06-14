/**
 * TanStack Query hooks для заявок на турнир.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tournamentKeys } from "./useTournaments";

// ── Query keys ────────────────────────────────────────────────────────────────

export const applicationKeys = {
  all: ["applications"] as const,
  detail: (id: string) => [...applicationKeys.all, "detail", id] as const,
  history: (id: string) => [...applicationKeys.all, "history", id] as const,
  myClub: () => [...applicationKeys.all, "my-club"] as const,
  myAthlete: () => [...applicationKeys.all, "my-athlete"] as const,
  adminAll: (params?: Record<string, unknown>) =>
    [...applicationKeys.all, "admin-all", params] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.detail(id!),
    queryFn: () => api.applications.get(id!),
    enabled: Boolean(id),
  });
}

export function useApplicationHistory(id: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.history(id!),
    queryFn: () => api.applications.history(id!),
    enabled: Boolean(id),
  });
}

export function useMyClubApplications() {
  return useQuery({
    queryKey: applicationKeys.myClub(),
    queryFn: () => api.applications.myClub(),
    staleTime: 30_000,
  });
}

export function useMyAthleteApplications() {
  return useQuery({
    queryKey: applicationKeys.myAthlete(),
    queryFn: () => api.applications.mineAsAthlete(),
    staleTime: 30_000,
  });
}

export function useAdminAllApplications(params?: {
  status?: string;
  tournamentId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: applicationKeys.adminAll(params),
    queryFn: () => api.admin.allApplications(params),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAddEntry(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { athleteId: string; categoryId: string }) =>
      api.applications.addEntry(applicationId, data.athleteId, data.categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
    },
  });
}

export function useRemoveEntry(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.applications.removeEntry(applicationId, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
    },
  });
}

export function useSubmitApplication(applicationId: string, tournamentId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.applications.submit(applicationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      qc.invalidateQueries({ queryKey: applicationKeys.myClub() });
      if (tournamentId) {
        qc.invalidateQueries({ queryKey: tournamentKeys.applications(tournamentId) });
      }
    },
  });
}

export function useWithdrawApplication(applicationId: string, tournamentId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.applications.withdraw(applicationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
      qc.invalidateQueries({ queryKey: applicationKeys.myClub() });
      if (tournamentId) {
        qc.invalidateQueries({ queryKey: tournamentKeys.applications(tournamentId) });
      }
    },
  });
}

export function useApproveApplication(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.applications.approve(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.applications(tournamentId) });
      qc.invalidateQueries({ queryKey: applicationKeys.adminAll() });
    },
  });
}

export function useRejectApplication(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.applications.reject(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.applications(tournamentId) });
      qc.invalidateQueries({ queryKey: applicationKeys.adminAll() });
    },
  });
}
