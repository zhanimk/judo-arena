import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { Check, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Notification } from "@/lib/api-types";
import { ProtectedRoute } from "@/lib/protected-route";
import { toast } from "sonner";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/athlete/notifications")({
  head: () => ({ meta: [{ title: "Хабарландырулар — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteNotifications />
    </ProtectedRoute>
  ),
});

function AthleteNotifications() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const filterLabels: Record<string, string> = {
    all: t("notification.all"),
    unread: t("notification.unread"),
    application_approved: t("notification.types.application_approved"),
    match_scheduled: t("notification.types.match_scheduled"),
    tournament_update: t("notification.types.tournament_update"),
    announcement: t("notification.types.announcement"),
  };

  const query = useQuery({
    queryKey: ["my-notifications", filter],
    queryFn: () => {
      if (filter === "unread") return api.notifications.list({ unreadOnly: true });
      if (filter === "all") return api.notifications.list();
      return api.notifications.list({ type: filter });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
      toast.success(t("notification.mark_all_read") + " ✓");
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : t("error.generic")),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["my-notifications", filter] });
      const previous = qc.getQueryData<Notification[]>(["my-notifications", filter]) ?? [];
      qc.setQueryData(["my-notifications", filter], (old: Notification[]) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["my-notifications", filter], ctx.previous);
      toast.error(t("error.generic"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const items = query.data ?? [];
  const unread = items.filter((n: Notification) => !n.read).length;

  return (
    <DashboardShell
      role={t("athlete.role_label")}
      navItems={nav}
      accentTitle={`${t("dashboard.notifications")}${unread > 0 ? ` (${unread})` : ""}`}
    >
      <Panel
        title={t("notification.count_label", {
          count: items.length,
          defaultValue: `${items.length} ${t("dashboard.notifications").toLowerCase()}`,
        })}
        action={
          unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-sm text-gold hover:underline inline-flex items-center gap-1"
            >
              {markAll.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("notification.mark_all_read")}
            </button>
          )
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(filterLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                filter === key
                  ? "bg-gold/15 text-gold border-gold/40"
                  : "glass border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState title={t("notification.empty")} hint={t("notification.empty_hint")} />
        ) : (
          <ul className="space-y-2">
            {items.map((n: Notification) => (
              <li
                key={n.id}
                className={`glass rounded-md p-4 flex justify-between items-start gap-3 ${n.read ? "opacity-60" : "border-gold/30"}`}
              >
                <div>
                  <div className="font-medium text-sm">{t(n.titleKey, n.titleKey)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t(n.bodyKey, n.bodyKey)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    className="text-xs text-gold hover:bg-gold/10 px-2 py-1 rounded inline-flex items-center gap-1 shrink-0"
                  >
                    <Check className="h-3 w-3" /> {t("notification.mark_read")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </DashboardShell>
  );
}
