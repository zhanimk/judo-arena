/**
 * TanStack Query hooks для клубов и их участников.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AddAthleteInput,
  CreateGroupInput,
  UpdateGroupInput,
} from "@/lib/api-types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const clubKeys = {
  all: ["clubs"] as const,
  lists: () => [...clubKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) => [...clubKeys.lists(), params] as const,
  detail: (id: string) => [...clubKeys.all, "detail", id] as const,
  members: (id: string) => [...clubKeys.detail(id), "members"] as const,
  groups: (id: string) => [...clubKeys.detail(id), "groups"] as const,
  joinRequests: (id: string) => [...clubKeys.detail(id), "join-requests"] as const,
  coachJoinRequests: (id: string) => [...clubKeys.detail(id), "coach-join-requests"] as const,
  // Тренерские запросы (со стороны тренера)
  myCoachJoinRequests: () => [...clubKeys.all, "my-coach-join-requests"] as const,
  myJoinRequests: () => [...clubKeys.all, "my-join-requests"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useClubsList(params?: { city?: string; search?: string; limit?: number }) {
  return useQuery({
    queryKey: clubKeys.list(params),
    queryFn: () => api.clubs.list(params),
    staleTime: 60_000,
  });
}

export function useClub(id: string | undefined) {
  return useQuery({
    queryKey: clubKeys.detail(id!),
    queryFn: () => api.clubs.get(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useClubMembers(clubId: string | undefined) {
  return useQuery({
    queryKey: clubKeys.members(clubId!),
    queryFn: () => api.clubs.members(clubId!),
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });
}

export function useClubGroups(clubId: string | undefined) {
  return useQuery({
    queryKey: clubKeys.groups(clubId!),
    queryFn: () => api.clubs.groups(clubId!),
    enabled: Boolean(clubId),
    staleTime: 60_000,
  });
}

export function useMyJoinRequests() {
  return useQuery({
    queryKey: clubKeys.myJoinRequests(),
    queryFn: () => api.joinRequests.myList(),
  });
}

export function useMyCoachJoinRequests() {
  return useQuery({
    queryKey: clubKeys.myCoachJoinRequests(),
    queryFn: () => api.coachClubRequests.myList(),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateGroup(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) => api.clubs.createGroup(clubId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.groups(clubId) });
    },
  });
}

export function useUpdateGroup(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupInput }) =>
      api.clubs.updateGroup(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.groups(clubId) });
    },
  });
}

export function useDeleteGroup(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.clubs.deleteGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.groups(clubId) });
    },
  });
}

export function useJoinClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) => api.clubs.joinRequest(clubId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.myJoinRequests() });
    },
  });
}

export function useCoachJoinClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) => api.clubs.coachJoinRequest(clubId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.myCoachJoinRequests() });
    },
  });
}

export function useAddAthlete(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddAthleteInput) => api.clubs.addAthlete(clubId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.members(clubId) });
    },
  });
}
