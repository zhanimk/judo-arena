import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  GitBranch,
  MapPin,
  Plus,
} from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/tournaments")({
  head: () => ({ meta: [{ title: "Жарыстар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachTournamentsRoute />
    </ProtectedRoute>
  ),
});


function CoachTournamentsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath !== "/coach/tournaments") {
    return <Outlet />;
  }

  return <CoachTournaments />;
}

function CoachTournaments() {
  const tQuery = useQuery({
    queryKey: ["tournaments-public"],
    queryFn: () => api.tournaments.list(),
  });
  const myAppsQuery = useQuery({
    queryKey: ["my-club-applications"],
    queryFn: () => api.applications.myClub(),
  });

  const appByTournament = new Map((myAppsQuery.data ?? []).map((a: any) => [a.tournamentId, a]));

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Барлық жарыстар">
      <Panel title="Жарыстар">
        {tQuery.isLoading ? (
          <LoadingState />
        ) : (tQuery.data?.items ?? []).length === 0 ? (
          <EmptyState title="Әзірше жарыс жоқ" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tQuery.data!.items.map((t: any) => {
              const deadline = t.applicationDeadline ?? t.startDate;
              const deadlinePassed = new Date(deadline).getTime() < Date.now();
              const existingApp = appByTournament.get(t.id);
              const canApply = t.status === "REGISTRATION_OPEN" && !deadlinePassed && !existingApp;

              return (
                <div key={t.id} className="glass rounded-xl p-5 flex flex-col border border-border/60">
                  <Link
                    to="/coach/tournaments/$id"
                    params={{ id: t.id }}
                    className="font-display text-xl font-semibold mb-3 hover:text-gold leading-tight"
                  >
                    {localizeName(t.name)}
                  </Link>

                  <div className="space-y-2 text-sm text-muted-foreground flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                      {dateRange(t.startDate, t.endDate)}
                    </div>
                    <div className={`flex items-center gap-2 ${deadlinePassed && t.status === "REGISTRATION_OPEN" ? "text-destructive" : ""}`}>
                      <Clock className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                      Дедлайн: {new Date(deadline).toLocaleString("kk-KZ")}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                      {t.location || t.city}
                    </div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                      {t._count?.categories ?? 0} санат · {t.tatamiCount ?? 1} татами
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
                    <TournamentStatusBadge status={t.status} />

                    <div className="flex gap-2">
                      <Link
                        to="/coach/tournaments/$id"
                        params={{ id: t.id }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-gold/50 hover:text-gold"
                      >
                        Қарау <ArrowRight className="h-3.5 w-3.5" />
                      </Link>

                      {existingApp ? (
                        <Link
                          to="/coach/applications/$id"
                          params={{ id: existingApp.id }}
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs border ${applicationButtonStyle(existingApp.status)}`}
                        >
                          <ApplicationStatusIcon status={existingApp.status} />
                          {appStatusLabel(existingApp.status)}
                        </Link>
                      ) : canApply ? (
                        <Link
                          to="/coach/tournaments/$id"
                          params={{ id: t.id }}
                          className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-3 py-2 text-xs font-medium text-gold-foreground shadow-gold"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Өтінім беру
                        </Link>
                      ) : t.status === "REGISTRATION_OPEN" && deadlinePassed ? (
                        <span className="rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive">
                          Дедлайн өтті
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
    CANCELLED: { c: "bg-muted text-muted-foreground", l: "Жойылды" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${x.c}`}>{x.l}</span>;
}

function ApplicationStatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "REJECTED") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <ClipboardList className="h-3.5 w-3.5" />;
}

function applicationButtonStyle(status: string): string {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15";
  if (status === "REJECTED") return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15";
  if (status === "SUBMITTED") return "border-gold/30 bg-gold/10 text-gold hover:bg-gold/15";
  return "border-border text-muted-foreground hover:text-foreground";
}

function appStatusLabel(status: string): string {
  const m: Record<string, string> = {
    DRAFT: "Жоба",
    SUBMITTED: "Қаралуда",
    APPROVED: "Бекітілді",
    REJECTED: "Қайтарылды",
    WITHDRAWN: "Алынды",
  };
  return m[status] ?? status;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} – ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
