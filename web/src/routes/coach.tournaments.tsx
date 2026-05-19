import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { Building2, LayoutDashboard, Users, ClipboardList, Trophy, Bell, Calendar, MapPin, Clock, GitBranch, ArrowRight } from "lucide-react";
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

const nav = [
  { to: "/coach", label: "Шолу", icon: LayoutDashboard },
  { to: "/coach/club", label: "Клуб", icon: Building2 },
  { to: "/coach/athletes", label: "Спортшылар", icon: Users },
  { to: "/coach/applications", label: "Өтінімдер", icon: ClipboardList },
  { to: "/coach/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/coach/notifications", label: "Хабарландырулар", icon: Bell },
];

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

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Барлық жарыстар">
      <Panel title="Жарыстар">
        {tQuery.isLoading ? <LoadingState /> :
          (tQuery.data?.items ?? []).length === 0 ? (
            <EmptyState title="Әзірше жарыс жоқ" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tQuery.data!.items.map((t: any) => (
                <div key={t.id} className="glass rounded-xl p-5 flex flex-col border border-border/60">
                  {(() => {
                    const deadline = t.applicationDeadline ?? t.startDate;
                    const deadlinePassed = new Date(deadline).getTime() < Date.now();
                    return (
                      <>
                  <Link
                    to="/coach/tournaments/$id"
                    params={{ id: t.id }}
                    className="font-display text-xl font-semibold mb-3 hover:text-gold"
                  >
                    {localizeName(t.name)}
                  </Link>
                  <div className="space-y-2 text-sm text-muted-foreground flex-1">
                    <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-gold/70" />
                      {dateRange(t.startDate, t.endDate)}
                    </div>
                    <div className={`flex items-center gap-2 ${deadlinePassed ? "text-destructive" : ""}`}>
                      <Clock className="h-3.5 w-3.5 text-gold/70" />
                      Дедлайн: {new Date(deadline).toLocaleString("kk-KZ")}
                    </div>
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-gold/70" />{t.location || t.city}</div>
                    <div className="flex items-center gap-2"><GitBranch className="h-3.5 w-3.5 text-gold/70" />{t._count?.categories ?? 0} санат · {t.tatamiCount ?? 1} татами</div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
                    <StatusBadge status={t.status} />
                    <div className="flex gap-2">
                      <Link
                        to="/coach/tournaments/$id"
                        params={{ id: t.id }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-gold/50 hover:text-gold"
                      >
                        Қарау <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      {t.status === "REGISTRATION_OPEN" && !deadlinePassed && (
                        <Link
                          to="/coach/tournaments/$id"
                          params={{ id: t.id }}
                          className="text-xs bg-gradient-gold text-gold-foreground px-3 py-2 rounded-md shadow-gold inline-flex items-center gap-1"
                        >
                          Өтінім беру
                        </Link>
                      )}
                      {t.status === "REGISTRATION_OPEN" && deadlinePassed && (
                        <span className="rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive">Дедлайн өтті</span>
                      )}
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
      </Panel>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${x.c}`}>{x.l}</span>;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} - ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
