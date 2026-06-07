import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  StatCard,
  StatCardSkeleton,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Users,
  ShieldAlert,
  Activity,
  ClipboardList,
  Trophy,
  Radio,
  Building2,
  BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Әкімші — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminOverview />
    </ProtectedRoute>
  ),
});

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-500",
  update: "bg-sky-500/15 text-sky-400",
  delete: "bg-destructive/15 text-destructive",
  approve: "bg-gold/15 text-gold",
  reject: "bg-destructive/15 text-destructive",
  override: "bg-amber-500/15 text-amber-400",
  finalize: "bg-emerald-500/15 text-emerald-500",
  block: "bg-destructive/15 text-destructive",
  broadcast: "bg-sky-500/15 text-sky-400",
};

function AdminOverview() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tournamentsQuery = useQuery({
    queryKey: ["all-tournaments"],
    queryFn: () => api.tournaments.list({ limit: 1000 }),
  });
  const clubsQuery = useQuery({
    queryKey: ["all-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
  });
  const liveMatchesQuery = useQuery({
    queryKey: ["live-matches"],
    queryFn: () => api.matches.list({ status: "IN_PROGRESS", limit: 100 }),
    refetchInterval: 5000,
  });
  const auditQuery = useQuery({
    queryKey: ["recent-audit"],
    queryFn: () => api.admin.auditLogs({ limit: 8 }),
  });

  const tournaments = tournamentsQuery.data?.items ?? [];
  const active = tournaments.filter(
    (t: any) => t.status === "REGISTRATION_OPEN" || t.status === "IN_PROGRESS",
  );
  const liveCount = liveMatchesQuery.data?.length ?? 0;

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("admin.panel_title")}
    >
      {/* ── Hero / system status ── */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card p-5 sm:p-7 mb-6">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gold via-amber-500 to-orange-500" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/8 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {t("dashboard.hello", { name: user?.name })}
            </div>
            <div className="font-display text-2xl font-bold">{t("admin.panel_title")}</div>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              {t("admin.hero_summary", {
                tournaments: tournaments.length,
                clubs: clubsQuery.data?.total ?? 0,
              })}
            </p>

            {/* Status pills */}
            <div className="mt-3 flex flex-wrap gap-2">
              {active.map((trn: any) => (
                <span
                  key={trn.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                    trn.status === "IN_PROGRESS"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-gold/30 bg-gold/10 text-gold"
                  }`}
                >
                  {trn.status === "IN_PROGRESS" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  {localizeName(trn.name)}
                </span>
              ))}
              {active.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("admin.no_active_tournaments")}
                </span>
              )}
            </div>
          </div>

          {/* Live pulse */}
          <div className="shrink-0 flex flex-col items-center gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-center">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${liveCount > 0 ? "bg-emerald-400 opacity-75 animate-ping" : "bg-muted"}`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${liveCount > 0 ? "bg-emerald-500" : "bg-muted"}`}
                />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                LIVE
              </span>
            </div>
            <div className="font-display text-3xl font-bold text-emerald-500">{liveCount}</div>
            <div className="text-[11px] text-muted-foreground">{t("admin.live_matches_unit")}</div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tournamentsQuery.isLoading || clubsQuery.isLoading || liveMatchesQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label={t("admin.stat_tournaments")}
              value={String(tournaments.length)}
              hint={t("admin.stat_active", { count: active.length })}
              icon={Trophy}
              accent
            />
            <StatCard
              label={t("admin.stat_clubs")}
              value={String(clubsQuery.data?.total ?? 0)}
              icon={Building2}
            />
            <StatCard
              label={t("admin.stat_live_matches")}
              value={String(liveCount)}
              hint={t("admin.stat_realtime")}
              icon={Radio}
            />
            <StatCard
              label={t("admin.stat_audit")}
              value={String(auditQuery.data?.total ?? 0)}
              icon={BarChart3}
            />
          </>
        )}
      </div>

      {/* ── Panels ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title={t("admin.live_matches_panel")}>
          {liveMatchesQuery.isLoading ? (
            <LoadingState />
          ) : (liveMatchesQuery.data ?? []).length === 0 ? (
            <EmptyState title={t("admin.no_live_matches")} hint={t("admin.live_auto_refresh")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {(liveMatchesQuery.data ?? []).slice(0, 5).map((m: any) => (
                <li key={m.id} className="glass rounded-lg p-3 flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-[10px] font-bold text-emerald-500">
                    T{m.tatamiNumber ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">
                      {m.redAthlete?.surname ?? "?"} vs {m.blueAthlete?.surname ?? "?"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("admin.tatami_label", { n: m.tatamiNumber ?? "—" })}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                    <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("admin.quick_actions")}>
          <div className="grid gap-2">
            <Link
              to="/admin/tournaments"
              className="bg-gradient-gold text-gold-foreground py-3 rounded-xl text-sm font-semibold shadow-gold text-center hover:opacity-90 transition-opacity"
            >
              {t("admin.open_tournament_center")}
            </Link>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  to: "/admin/applications",
                  icon: ClipboardList,
                  label: t("dashboard.applications"),
                },
                {
                  to: "/admin/matches",
                  icon: Activity,
                  label: t("dashboard.matches"),
                  search: { tournamentId: undefined },
                },
                { to: "/admin/users", icon: Users, label: t("dashboard.users") },
                { to: "/admin/ratings", icon: ShieldAlert, label: t("dashboard.ratings") },
              ].map(({ to, icon: Icon, label, search }: any) => (
                <Link
                  key={to}
                  to={to}
                  {...(search ? { search } : {})}
                  className="glass border border-border py-3 rounded-xl text-xs hover:border-gold/40 hover:bg-gold/5 text-center flex flex-col items-center gap-1.5 transition-colors"
                >
                  <Icon className="h-4 w-4 text-gold" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={t("admin.recent_activity")}>
          {auditQuery.isLoading ? (
            <LoadingState />
          ) : (auditQuery.data?.items ?? []).length === 0 ? (
            <EmptyState title={t("admin.audit_empty")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {(auditQuery.data?.items ?? []).slice(0, 6).map((a: any) => {
                const actionLower = (a.action ?? "").toLowerCase();
                const actionKey =
                  Object.keys(ACTION_COLORS).find((k) => actionLower.includes(k)) ?? "";
                const colorClass = ACTION_COLORS[actionKey] ?? "bg-muted/40 text-muted-foreground";
                return (
                  <li key={a.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${colorClass}`}
                    >
                      {actionKey || "ACT"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gold text-xs">{a.actor?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground"> {a.action}</span>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </span>
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

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}сағ`;
  return `${Math.floor(h / 24)}к`;
}
