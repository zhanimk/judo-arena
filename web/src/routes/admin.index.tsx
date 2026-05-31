import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, StatCard, StatCardSkeleton, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { Users, ShieldAlert, Activity, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Әкімші — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminOverview />
    </ProtectedRoute>
  ),
});



function AdminOverview() {
  const { t } = useTranslation();
  const tournamentsQuery = useQuery({ queryKey: ["all-tournaments"], queryFn: () => api.tournaments.list() });
  const clubsQuery = useQuery({ queryKey: ["all-clubs"], queryFn: () => api.clubs.list() });
  const liveMatchesQuery = useQuery({
    queryKey: ["live-matches"],
    queryFn: () => api.matches.list({ status: "IN_PROGRESS" }),
    refetchInterval: 5000,
  });
  const auditQuery = useQuery({ queryKey: ["recent-audit"], queryFn: () => api.admin.auditLogs({ limit: 8 }) });

  const tournaments = tournamentsQuery.data?.items ?? [];
  const active = tournaments.filter((t: any) => t.status === "REGISTRATION_OPEN" || t.status === "IN_PROGRESS");

  return (
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("admin.panel_title")}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {(tournamentsQuery.isLoading || clubsQuery.isLoading || liveMatchesQuery.isLoading)
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : <>
            <StatCard label={t("admin.stat_tournaments")} value={String(tournaments.length)} hint={t("admin.stat_active", { count: active.length })} accent />
            <StatCard label={t("admin.stat_clubs")} value={String(clubsQuery.data?.total ?? 0)} />
            <StatCard label={t("admin.stat_live_matches")} value={String(liveMatchesQuery.data?.length ?? 0)} hint={t("admin.stat_realtime")} />
            <StatCard label={t("admin.stat_audit")} value={String(auditQuery.data?.total ?? 0)} />
          </>
        }
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title={t("admin.live_matches_panel")}>
          {liveMatchesQuery.isLoading ? <LoadingState /> :
            (liveMatchesQuery.data ?? []).length === 0 ? (
              <EmptyState title={t("admin.no_live_matches")} hint={t("admin.live_auto_refresh")} />
            ) : (
              <ul className="space-y-2 text-sm">
                {(liveMatchesQuery.data ?? []).slice(0, 5).map((m: any) => (
                  <li key={m.id} className="glass rounded-md p-3 flex justify-between">
                    <div>
                      <div className="font-medium">{t("admin.tatami_label", { n: m.tatamiNumber ?? "—" })}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.redAthlete?.surname ?? "?"} vs {m.blueAthlete?.surname ?? "?"}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/40 self-start">LIVE</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title={t("admin.quick_actions")}>
          <div className="grid gap-2">
            <Link to="/admin/tournaments" className="bg-gradient-gold text-gold-foreground py-2.5 rounded-md text-sm font-medium shadow-gold text-center">
              {t("admin.open_tournament_center")}
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/admin/applications" className="glass border border-border py-2.5 rounded-md text-xs hover:border-gold/40 text-center flex items-center justify-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-gold" /> {t("dashboard.applications")}
              </Link>
              <Link to="/admin/matches" search={{ tournamentId: undefined }} className="glass border border-border py-2.5 rounded-md text-xs hover:border-gold/40 text-center flex items-center justify-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-gold" /> {t("dashboard.matches")}
              </Link>
              <Link to="/admin/users" className="glass border border-border py-2.5 rounded-md text-xs hover:border-gold/40 text-center flex items-center justify-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gold" /> {t("dashboard.users")}
              </Link>
              <Link to="/admin/ratings" className="glass border border-border py-2.5 rounded-md text-xs hover:border-gold/40 text-center flex items-center justify-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-gold" /> {t("dashboard.ratings")}
              </Link>
            </div>
            {(tournamentsQuery.data?.items ?? []).slice(0, 2).map((tournament: any) => (
              <Link
                key={tournament.id}
                to="/admin/tournaments/$id"
                params={{ id: tournament.id }}
                className="glass border border-gold/30 px-3 py-2.5 rounded-md text-sm hover:border-gold/60"
              >
                <span className="block truncate">{localizeName(tournament.name)}</span>
                <span className="text-[11px] text-muted-foreground">{tournament.status}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title={t("admin.recent_activity")}>
          {auditQuery.isLoading ? <LoadingState /> :
            (auditQuery.data?.items ?? []).length === 0 ? (
              <EmptyState title={t("admin.audit_empty")} />
            ) : (
              <ul className="space-y-2 text-sm">
                {(auditQuery.data?.items ?? []).slice(0, 5).map((a: any) => (
                  <li key={a.id} className="flex justify-between border-b border-border/30 pb-1.5 last:border-0">
                    <span className="truncate"><span className="text-gold">{a.actor?.name ?? "—"}</span> {a.action}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
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
  const m = Math.floor(s / 60); if (m < 60) return `${m}мин`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}сағ`;
  return `${Math.floor(h / 24)}к`;
}
