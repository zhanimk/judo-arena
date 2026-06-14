/**
 * TanStack Query hooks для аутентификации.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UpdateProfileInput } from "@/lib/api-types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const authKeys = {
  me: ["auth", "me"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Текущий авторизованный пользователь. */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000, // 5 минут — пользователь не меняется часто
    retry: false, // Не ретраить 401 (неавторизован = неавторизован)
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileInput) => api.auth.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.auth.changePassword(data),
  });
}

export function useSetupTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.twofa.setup(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useVerifyTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.auth.twofa.verifySetup(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useDisableTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.auth.twofa.disable(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}
