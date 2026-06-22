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
import { Loader2, Megaphone, Trash2, Clock, Users, Edit2, Check, X } from "lucide-react";
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

export const Route = createFileRoute("/admin/notifications")({
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

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

  const updateBroadcast = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title: string; body: string } }) =>
      api.notifications.updateBroadcast(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
      setEditingId(null);
      toast.success(t("admin.broadcast_updated", { defaultValue: "Рассылка обновлена" }));
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
                  className={`glass rounded-xl p-5 border transition-all duration-300 ${
                    editingId === b.id
                      ? "border-gold shadow-[0_0_15px_rgba(255,215,0,0.15)] ring-1 ring-gold/50"
                      : "border-border/50 hover:border-gold/30 hover:shadow-md"
                  }`}
                >
                  {editingId === b.id ? (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full font-semibold rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                          placeholder="Заголовок"
                          maxLength={100}
                        />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                          placeholder="Текст рассылки"
                          maxLength={2000}
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-muted-foreground hover:bg-muted/50 rounded-md transition-colors"
                          disabled={updateBroadcast.isPending}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (!editTitle.trim() || !editBody.trim()) return;
                            updateBroadcast.mutate({
                              id: b.id,
                              data: { title: editTitle, body: editBody },
                            });
                          }}
                          disabled={
                            updateBroadcast.isPending || !editTitle.trim() || !editBody.trim()
                          }
                          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-gold text-gold-foreground hover:bg-gold/90 rounded-md transition-colors disabled:opacity-50"
                        >
                          {updateBroadcast.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
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

                      <div className="flex items-center gap-1 shrink-0 bg-muted/30 p-1 rounded-lg border border-border/50">
                        <button
                          onClick={() => {
                            setEditingId(b.id);
                            setEditTitle(b.title);
                            setEditBody(b.body);
                          }}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
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
                          title="Удалить"
                        >
                          {deleteBroadcast.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "new" && (
          <div className="glass rounded-xl p-6 sm:p-8 border border-border/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gold/5 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {t("admin.broadcast_new", { defaultValue: "Создание рассылки" })}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Отправка мгновенного PUSH-уведомления и сообщения на платформе.
                </p>
              </div>
              <BroadcastForm onSuccess={() => setTab("history")} />
            </div>
          </div>
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
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/90">Аудитория</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="w-full rounded-lg border border-border/40 bg-black/20 px-4 py-3 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-all shadow-inner hover:border-border/80"
          >
            <option value="all">Всем пользователям</option>
            <option value="role">Определенной роли</option>
            <option value="club">Определенному клубу</option>
          </select>
        </div>

        {kind === "role" && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-300">
            <label className="block text-sm font-medium mb-2 text-foreground/90">
              Выберите роль
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full rounded-lg border border-border/40 bg-black/20 px-4 py-3 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-all shadow-inner hover:border-border/80"
            >
              <option value="ATHLETE">Спортсмены</option>
              <option value="COACH">Тренеры</option>
              <option value="ADMIN">Администраторы</option>
            </select>
          </div>
        )}

        {kind === "club" && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-300">
            <label className="block text-sm font-medium mb-2 text-foreground/90">
              Выберите клуб
            </label>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-black/20 px-4 py-3 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-all shadow-inner hover:border-border/80"
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
          <label className="block text-sm font-medium mb-2 text-foreground/90">Заголовок</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border/40 bg-black/20 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-all shadow-inner hover:border-border/80"
            placeholder="Важное объявление"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground/90">
            Текст уведомления
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border/40 bg-black/20 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-all shadow-inner hover:border-border/80 resize-y"
            placeholder="Введите текст рассылки..."
            required
            maxLength={2000}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 mt-8 border-t border-border/20">
        <button
          type="submit"
          disabled={sendBroadcast.isPending || (kind === "club" && !clubId)}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-8 py-3 text-sm font-bold tracking-wide text-gold-foreground hover:bg-gold/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
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
