import { useState } from "react";
import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Megaphone, Trash2, Clock, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";
import type {
  NotificationBroadcast,
  BroadcastNotificationInput,
  LocalizedName,
} from "@/lib/api-types";

function localizeName(value: LocalizedName | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  // Here we assume global language state or just return ru for now
  return value.ru || value.kk || value.en || "";
}

export const Route = createFileRoute("/admin/broadcasts")({
  head: () => ({ meta: [{ title: "Рассылка — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminBroadcasts />
    </ProtectedRoute>
  ),
});

function AdminBroadcasts() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"history" | "new">("history");

  const query = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: () => api.notifications.broadcastHistory(),
  });

  const deleteBroadcast = useMutation({
    mutationFn: (id: string) => api.notifications.deleteBroadcast(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
      toast.success(t("admin.broadcast_deleted", { defaultValue: "Рассылка удалена" }));
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const getDateLocale = () => {
    if (i18n.language === "ru") return ru;
    if (i18n.language === "kk") return kk;
    return enUS;
  };

  const getTargetLabel = (target: any) => {
    switch (target.kind) {
      case "all":
        return "Всем пользователям";
      case "role":
        return `Роль: ${target.role}`;
      case "club":
        return `Клуб: ${target.clubId}`;
      case "tournament":
        return `Турнир: ${target.tournamentId}`;
      case "user":
        return `Пользователь: ${target.userId}`;
      default:
        return "Неизвестно";
    }
  };

  const history = query.data ?? [];

  return (
    <DashboardShell
      role={t("admin.role_label", { defaultValue: "Администратор" })}
      navItems={nav}
      accentTitle={t("dashboard.broadcasts", { defaultValue: "Рассылка" })}
    >
      <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {t("dashboard.broadcasts", { defaultValue: "Рассылки" })}
            </h1>
            <p className="text-muted-foreground">
              {t("admin.broadcasts_desc", { defaultValue: "Управление системными уведомлениями" })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-muted/30 rounded-lg w-fit border border-border/50">
          <button
            onClick={() => setTab("history")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
              tab === "history"
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {t("admin.broadcast_history", { defaultValue: "История рассылок" })}
          </button>
          <button
            onClick={() => setTab("new")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
              tab === "new"
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {t("admin.broadcast_new", { defaultValue: "Новая рассылка" })}
          </button>
        </div>

        {tab === "history" && (
          <div className="space-y-4">
            {query.isLoading ? (
              <LoadingState />
            ) : history.length === 0 ? (
              <div className="glass rounded-xl p-12 border border-border/50">
                <EmptyState
                  title="Нет отправленных рассылок"
                  hint="Здесь будет отображаться история всех массовых уведомлений"
                />
              </div>
            ) : (
              history.map((b: NotificationBroadcast) => (
                <div
                  key={b.id}
                  className="glass rounded-xl p-5 border border-border/50 hover:border-gold/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold shrink-0">
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground">{b.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{b.body}</p>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <div className="inline-flex items-center gap-1.5 text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {getTargetLabel(b.target)}
                          </div>
                          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(b.createdAt), {
                              addSuffix: true,
                              locale: getDateLocale(),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              t("admin.confirm_delete_broadcast", {
                                defaultValue: "Удалить эту рассылку из истории?",
                              }),
                            )
                          ) {
                            deleteBroadcast.mutate(b.id);
                          }
                        }}
                        disabled={deleteBroadcast.isPending}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        {deleteBroadcast.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "new" && (
          <Panel title={t("admin.broadcast_new", { defaultValue: "Создание рассылки" })}>
            <BroadcastForm onSuccess={() => setTab("history")} />
          </Panel>
        )}
      </div>
    </DashboardShell>
  );
}

function BroadcastForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"all" | "role" | "club">("all");
  const [role, setRole] = useState<"ATHLETE" | "COACH" | "ADMIN">("ATHLETE");
  const [clubId, setClubId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const clubsQuery = useQuery({
    queryKey: ["clubs-list"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
    enabled: kind === "club",
  });

  const sendBroadcast = useMutation({
    mutationFn: (data: BroadcastNotificationInput) => api.notifications.broadcast(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
      toast.success(t("admin.broadcast_sent", { defaultValue: "Рассылка успешно отправлена!" }));
      onSuccess();
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    let target: BroadcastNotificationInput;
    if (kind === "all") target = { kind: "all", title, body, type: "announcement" };
    else if (kind === "role") target = { kind: "role", role, title, body, type: "announcement" };
    else if (kind === "club") target = { kind: "club", clubId, title, body, type: "announcement" };
    else return;

    sendBroadcast.mutate(target);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">Аудитория</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="all">Всем пользователям</option>
            <option value="role">Определенной роли</option>
            <option value="club">Определенному клубу</option>
          </select>
        </div>

        {kind === "role" && (
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Выберите роль
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            >
              <option value="ATHLETE">Спортсмены</option>
              <option value="COACH">Тренеры</option>
              <option value="ADMIN">Администраторы</option>
            </select>
          </div>
        )}

        {kind === "club" && (
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Выберите клуб
            </label>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              required
            >
              <option value="">-- Выберите клуб --</option>
              {clubsQuery.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizeName(c.name)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">Заголовок</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            placeholder="Важное объявление"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground">
            Текст уведомления
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            placeholder="Введите текст рассылки..."
            required
            maxLength={2000}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border/40">
        <button
          type="submit"
          disabled={sendBroadcast.isPending || (kind === "club" && !clubId)}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-2.5 text-sm font-medium text-gold-foreground hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {sendBroadcast.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          Отправить рассылку
        </button>
      </div>
    </form>
  );
}
