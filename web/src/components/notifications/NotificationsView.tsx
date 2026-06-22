import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";
import {
  Check,
  Loader2,
  Bell,
  CalendarDays,
  Megaphone,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Notification } from "@/lib/api-types";
import { DashboardShell, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import type { NavItem } from "@/components/dashboard/DashboardShell";

export function NotificationsView({
  roleLabel,
  navItems,
}: {
  roleLabel: string;
  navItems: NavItem[];
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const filterLabels: Record<string, string> = {
    all: t("notification.all", { defaultValue: "Все" }),
    unread: t("notification.unread", { defaultValue: "Непрочитанные" }),
    announcement: t("notification.types.announcement", { defaultValue: "Объявления" }),
    match_scheduled: t("notification.types.match_scheduled", { defaultValue: "Матчи" }),
  };

  const query = useQuery({
    queryKey: ["my-notifications", filter],
    queryFn: () => {
      if (filter === "unread") return api.notifications.list({ unreadOnly: true, limit: 50 });
      if (filter === "all") return api.notifications.list({ limit: 50 });
      return api.notifications.list({ type: filter, limit: 50 });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
      toast.success(t("notification.mark_all_read", { defaultValue: "Всё прочитано" }) + " ✓");
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
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const getDateLocale = () => {
    if (i18n.language === "ru") return ru;
    if (i18n.language === "kk") return kk;
    return enUS;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "match_scheduled":
        return <CalendarDays className="h-6 w-6 text-blue-400" />;
      case "application_approved":
        return <CheckCircle2 className="h-6 w-6 text-emerald-400" />;
      case "application_rejected":
        return <XCircle className="h-6 w-6 text-rose-400" />;
      case "announcement":
        return <Megaphone className="h-6 w-6 text-gold" />;
      default:
        return <Bell className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const items = query.data ?? [];
  const unreadCount = items.filter((n: Notification) => !n.read).length;

  return (
    <DashboardShell
      role={roleLabel}
      navItems={navItems}
      accentTitle={`${t("dashboard.notifications")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
    >
      <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.notifications")}</h1>
            <p className="text-muted-foreground">
              {t("notification.count_label", {
                count: items.length,
                defaultValue: `У вас ${items.length} уведомлений`,
              })}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gold/10 px-4 py-2 font-medium text-gold transition-colors hover:bg-gold/20 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {markAll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 transition-transform group-hover:scale-110" />
              )}
              {t("notification.mark_all_read", { defaultValue: "Прочитать всё" })}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pb-2">
          {Object.entries(filterLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                filter === key
                  ? "bg-gold text-gold-foreground shadow-lg shadow-gold/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
              {filter === key && (
                <div className="absolute inset-0 rounded-full ring-2 ring-gold ring-offset-2 ring-offset-background animate-in zoom-in duration-300" />
              )}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <div className="glass rounded-xl p-12">
            <LoadingState />
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-xl p-12">
            <EmptyState
              title={t("notification.empty", { defaultValue: "Нет уведомлений" })}
              hint={t("notification.empty_hint", {
                defaultValue: "Здесь будут появляться важные события",
              })}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((n: Notification, i: number) => (
              <div
                key={n.id}
                className={`group relative flex items-start gap-4 rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg ${
                  n.read
                    ? "border-border/50 bg-background/50 hover:border-border"
                    : "border-gold/30 bg-gold/5 shadow-gold/5 hover:border-gold/50"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {!n.read && (
                  <div className="absolute -left-[1px] top-4 h-8 w-[3px] rounded-r-full bg-gold" />
                )}

                <div
                  className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                    n.read
                      ? "bg-muted text-muted-foreground"
                      : "bg-background shadow-sm ring-1 ring-border"
                  }`}
                >
                  {getIcon(n.type)}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                    <h3
                      className={`text-base font-semibold leading-tight ${n.read ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {t(n.titleKey, { defaultValue: n.titleKey })}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: getDateLocale(),
                      })}
                    </div>
                  </div>

                  <p
                    className={`text-sm leading-relaxed ${n.read ? "text-muted-foreground/80" : "text-muted-foreground"}`}
                  >
                    {t(n.bodyKey, { defaultValue: n.bodyKey })}
                  </p>
                </div>

                {!n.read && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-100 sm:opacity-0 transition-all duration-300 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    title={t("notification.mark_read", { defaultValue: "Прочитать" })}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
