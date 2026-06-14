/**
 * TanStack Query hooks для уведомлений.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Query keys ────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  my: () => [...notificationKeys.all, "my"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useMyNotifications() {
  return useQuery({
    queryKey: notificationKeys.my(),
    queryFn: () => api.notifications.list(),
    staleTime: 30_000,
    refetchInterval: 60_000, // Фоновая проверка раз в минуту
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => api.notifications.unreadCount(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.my() });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.my() });
      qc.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}
