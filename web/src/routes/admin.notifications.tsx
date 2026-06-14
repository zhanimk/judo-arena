import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Bell,
  BellRing,
  Clock,
  Loader2,
  MessageSquare,
  Pencil,
  Save,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Club, NotificationBroadcast, Tournament } from "@/lib/api-types";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Хабарландыру жіберу — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminNotifications />
    </ProtectedRoute>
  ),
});

type Kind = "all" | "role" | "club" | "tournament";

function AdminNotifications() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("all");
  const [role, setRole] = useState<"ATHLETE" | "COACH">("ATHLETE");
  const [clubId, setClubId] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<NotificationBroadcast | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const clubsQuery = useQuery({
    queryKey: ["admin-clubs-list"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
  });
  const tQuery = useQuery({
    queryKey: ["admin-tournaments-list"],
    queryFn: () => api.tournaments.list({ limit: 1000 }),
  });
  const historyQuery = useQuery({
    queryKey: ["notification-broadcasts"],
    queryFn: () => api.notifications.broadcastHistory(),
  });
  const selectedTournament = (tQuery.data?.items ?? []).find(
    (t: Tournament) => t.id === tournamentId,
  );

  const fillWeighInTemplate = () => {
    if (!selectedTournament) return;
    setKind("tournament");
    setTitle(t("admin.weigh_in_notification_title"));
    setBody(
      [
        t("admin.weigh_in_notification_body", { name: localizeName(selectedTournament.name) }),
        t("admin.weigh_in_notification_location", {
          location: selectedTournament.weighInLocation || selectedTournament.location,
          city: selectedTournament.city,
        }),
        t("admin.weigh_in_notification_time", { time: formatWeighIn(selectedTournament) }),
        selectedTournament.mapUrl
          ? t("admin.weigh_in_notification_map", { url: selectedTournament.mapUrl })
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  };

  const send = useMutation({
    mutationFn: () => {
      const base = { title, body, type: "announcement" };
      if (kind === "all") return api.notifications.broadcast({ ...base, kind: "all" });
      if (kind === "role") return api.notifications.broadcast({ ...base, kind: "role", role });
      if (kind === "club") return api.notifications.broadcast({ ...base, kind: "club", clubId });
      return api.notifications.broadcast({
        ...base,
        kind: "tournament",
        tournamentId,
        type: "tournament_update",
      });
    },
    onSuccess: (r) => {
      const msg = t("admin.notification_sent", { count: r.count });
      setSuccess(msg);
      setTitle("");
      setBody("");
      setError("");
      qc.invalidateQueries({ queryKey: ["notification-broadcasts"] });
      toast.success(msg);
      setTimeout(() => setSuccess(""), 4000);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : "Қате";
      setError(msg);
      setSuccess("");
      toast.error(msg);
    },
  });

  const updateHistory = useMutation({
    mutationFn: () =>
      api.notifications.updateBroadcast(editing!.id, {
        title: editTitle,
        body: editBody,
      }),
    onSuccess: () => {
      setEditing(null);
      setEditTitle("");
      setEditBody("");
      qc.invalidateQueries({ queryKey: ["notification-broadcasts"] });
      toast.success(t("admin.notification_updated"));
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const deleteHistory = useMutation({
    mutationFn: (id: string) => api.notifications.deleteBroadcast(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-broadcasts"] });
      toast.success(t("admin.notification_deleted"));
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const historyItems = historyQuery.data ?? [];
  const totalSent = historyItems.length;
  const todaySent = historyItems.filter(
    (item) => new Date(item.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("admin.notifications_title")}
    >
      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{totalSent}</div>
            <div className="text-xs text-muted-foreground">{t("admin.notifications_total")}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{todaySent}</div>
            <div className="text-xs text-muted-foreground">{t("admin.notifications_today")}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{(clubsQuery.data?.items ?? []).length}</div>
            <div className="text-xs text-muted-foreground">
              {t("admin.notification_audience_club")}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{(tQuery.data?.items ?? []).length}</div>
            <div className="text-xs text-muted-foreground">
              {t("admin.notification_audience_tournament")}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title={t("admin.notification_new")}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("admin.notification_audience")}
              </label>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {(["all", "role", "club", "tournament"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`py-2 rounded text-xs border ${kind === k ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}
                  >
                    {k === "all"
                      ? t("admin.notification_audience_all")
                      : k === "role"
                        ? t("admin.notification_audience_role")
                        : k === "club"
                          ? t("admin.notification_audience_club")
                          : t("admin.notification_audience_tournament")}
                  </button>
                ))}
              </div>
            </div>

            {kind === "role" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("common.role")}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["ATHLETE", "COACH"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 rounded text-xs border ${role === r ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}
                    >
                      {r === "ATHLETE"
                        ? t("admin.notification_role_athletes")
                        : t("admin.notification_role_coaches")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {kind === "club" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("common.club")}
                </label>
                <select
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  required
                  className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  <option value="">{t("common.select")}...</option>
                  {(clubsQuery.data?.items ?? []).map((c: Club) => (
                    <option key={c.id} value={c.id}>
                      {localizeName(c.name)} · {c.city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {kind === "tournament" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("common.tournament")}
                </label>
                <select
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                  required
                  className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                >
                  <option value="">{t("common.select")}...</option>
                  {(tQuery.data?.items ?? []).map((t: Tournament) => (
                    <option key={t.id} value={t.id}>
                      {localizeName(t.name)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fillWeighInTemplate}
                  disabled={!selectedTournament}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" /> {t("admin.weigh_in_template")}
                </button>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("admin.notification_subject")}
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={100}
                className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("admin.notification_body")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={5}
                maxLength={2000}
                className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}
            {success && <div className="text-sm text-emerald-300">{success}</div>}

            <button
              type="submit"
              disabled={send.isPending}
              className="bg-gradient-gold text-gold-foreground px-5 py-2.5 rounded font-medium shadow-gold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("admin.notification_send")}
            </button>
          </form>
        </Panel>

        <Panel title={t("admin.notification_history")}>
          {historyQuery.isLoading ? (
            <LoadingState />
          ) : historyItems.length === 0 ? (
            <EmptyState title={t("admin.notification_empty")} />
          ) : (
            <ul className="max-h-[620px] space-y-3 overflow-y-auto pr-1 text-sm">
              {historyItems.map((item) => {
                const isEditing = editing?.id === item.id;
                return (
                  <li key={item.id} className="rounded-xl border border-border/60 bg-card/60 p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold"
                        />
                        <textarea
                          value={editBody}
                          onChange={(event) => setEditBody(event.target.value)}
                          rows={5}
                          className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateHistory.mutate()}
                            disabled={
                              updateHistory.isPending || !editTitle.trim() || !editBody.trim()
                            }
                            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-gold-foreground disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {t("common.save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 shrink-0 text-gold" />
                              <span className="font-semibold leading-snug">{item.title}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                              {item.body}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-gold/10 px-2 py-1 text-[10px] text-gold">
                            {item.count} {t("admin.notification_recipients")}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
                          <span className="rounded bg-muted/40 px-2 py-1">
                            {broadcastTargetLabel(item, t)}
                          </span>
                          <span>{item.actor?.name ?? "—"}</span>
                          <span className="ml-auto">
                            {new Date(item.createdAt).toLocaleString("kk-KZ")}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(item);
                              setEditTitle(item.title);
                              setEditBody(item.body);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t("admin.notification_delete_confirm"))) {
                                deleteHistory.mutate(item.id);
                              }
                            }}
                            disabled={deleteHistory.isPending}
                            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("common.delete")}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function formatWeighIn(t: Tournament | null | undefined): string {
  if (!t) return "уақыт көрсетілмеген";
  const start = t.weighInStart ? new Date(t.weighInStart).toLocaleString("kk-KZ") : "";
  const end = t.weighInEnd ? new Date(t.weighInEnd).toLocaleString("kk-KZ") : "";
  return start && end ? `${start} — ${end}` : start || "уақыт көрсетілмеген";
}

function broadcastTargetLabel(
  item: NotificationBroadcast,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (item.target.kind) {
    case "role":
      return item.target.role;
    case "club":
      return t("admin.notification_audience_club");
    case "tournament":
      return t("admin.notification_audience_tournament");
    case "user":
      return t("admin.notification_audience_user");
    default:
      return t("admin.notification_audience_all");
  }
}
