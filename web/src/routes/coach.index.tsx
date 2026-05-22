import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, StatCard, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  LayoutDashboard,
  MapPin,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Жаттықтырушы — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachOverview />
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

function CoachOverview() {
  const { user } = useAuth();
  const clubId = user?.clubId;

  const clubQuery = useQuery({
    queryKey: ["club", clubId],
    queryFn: () => (clubId ? api.clubs.get(clubId) : null),
    enabled: !!clubId,
  });
  const membersQuery = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => (clubId ? api.clubs.members(clubId) : []),
    enabled: !!clubId,
  });
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments-open"],
    queryFn: () => api.tournaments.list({ status: "REGISTRATION_OPEN" }),
  });
  const myAppsQuery = useQuery({
    queryKey: ["my-club-applications"],
    queryFn: () => api.applications.myClub(),
  });

  const openTournaments = tournamentsQuery.data?.items ?? [];
  const myApps = myAppsQuery.data ?? [];

  // Собираем карту tournamentId → application для быстрого lookup
  const appByTournament = new Map(myApps.map((a: any) => [a.tournamentId, a]));

  const pendingApps = myApps.filter((a: any) => a.status === "SUBMITTED").length;
  const approvedApps = myApps.filter((a: any) => a.status === "APPROVED").length;
  const rejectedApps = myApps.filter((a: any) => a.status === "REJECTED").length;

  const clubName = clubQuery.data ? localizeName(clubQuery.data.name) : "—";

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle={clubName ? `«${clubName}» клубы` : "Менің клубым"}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Спортшылар" value={membersQuery.isLoading ? "…" : String(membersQuery.data?.length ?? 0)} accent />
        <StatCard label="Ашық жарыстар" value={tournamentsQuery.isLoading ? "…" : String(openTournaments.length)} hint="тіркеу ашық" />
        <StatCard label="Қаралуда" value={myAppsQuery.isLoading ? "…" : String(pendingApps)} hint="өтінімдер" />
        <StatCard label="Бекітілді" value={myAppsQuery.isLoading ? "…" : String(approvedApps)} hint="өтінімдер" />
      </div>

      {rejectedApps > 0 && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <span className="font-medium text-destructive">{rejectedApps} өтінім қайтарылды</span>
            <span className="ml-2 text-muted-foreground">— себебін тексеріп, түзетіңіз.</span>
          </div>
          <Link to="/coach/applications" className="shrink-0 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
            Өтінімдерге өту
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Ашық жарыстар */}
        <Panel
          title="Ашық жарыстар — өтінім беруге болады"
          action={
            <Link to="/coach/tournaments" className="text-xs text-gold hover:underline">
              Барлығы →
            </Link>
          }
        >
          {tournamentsQuery.isLoading ? (
            <LoadingState />
          ) : openTournaments.length === 0 ? (
            <EmptyState title="Ашық жарыс жоқ" hint="Тіркеу ашылғанда осында шығады" />
          ) : (
            <div className="space-y-3">
              {openTournaments.slice(0, 5).map((t: any) => {
                const deadline = t.applicationDeadline ?? t.startDate;
                const deadlinePassed = new Date(deadline).getTime() < Date.now();
                const existingApp = appByTournament.get(t.id);

                return (
                  <div key={t.id} className="glass rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/coach/tournaments/$id"
                          params={{ id: t.id }}
                          className="font-semibold hover:text-gold"
                        >
                          {localizeName(t.name)}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gold/60" />
                            {dateRange(t.startDate, t.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gold/60" />
                            {t.city}
                          </span>
                          <span className={`inline-flex items-center gap-1 ${deadlinePassed ? "text-destructive" : ""}`}>
                            <Clock className="h-3.5 w-3.5 text-gold/60" />
                            Дедлайн: {new Date(deadline).toLocaleDateString("kk-KZ")}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {existingApp ? (
                          <Link
                            to="/coach/applications/$id"
                            params={{ id: existingApp.id }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/15"
                          >
                            <ApplicationStatusIcon status={existingApp.status} />
                            {appStatusLabel(existingApp.status)}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : deadlinePassed ? (
                          <span className="rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive">Дедлайн өтті</span>
                        ) : (
                          <Link
                            to="/coach/tournaments/$id"
                            params={{ id: t.id }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Өтінім беру
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          {/* Менің спортшыларым */}
          <Panel
            title="Менің спортшыларым"
            action={
              <Link to="/coach/athletes" className="text-xs text-gold hover:underline">
                Барлығы →
              </Link>
            }
          >
            {membersQuery.isLoading ? (
              <LoadingState />
            ) : (membersQuery.data ?? []).length === 0 ? (
              <EmptyState title="Спортшылар жоқ" hint="«Спортшылар» бөлімінен қосуға болады" />
            ) : (
              <div className="space-y-2">
                {(membersQuery.data ?? []).slice(0, 5).map((a: any) => (
                  <Link
                    key={a.id}
                    to="/coach/athletes/$id"
                    params={{ id: a.id }}
                    className="flex items-center justify-between glass rounded-md p-3 hover:border-gold/30"
                  >
                    <div>
                      <div className="font-medium text-sm">{a.name} {a.surname}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.weightKg ? `${a.weightKg} кг` : ""}{a.beltRank ? ` · ${a.beltRank}` : ""}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {/* Соңғы өтінімдер */}
          <Panel
            title="Соңғы өтінімдер"
            action={
              <Link to="/coach/applications" className="text-xs text-gold hover:underline">
                Барлығы →
              </Link>
            }
          >
            {myAppsQuery.isLoading ? (
              <LoadingState />
            ) : myApps.length === 0 ? (
              <EmptyState title="Өтінімдер жоқ" hint="Ашық жарыстан өтінім бере аласыз" />
            ) : (
              <div className="space-y-2">
                {myApps.slice(0, 4).map((a: any) => (
                  <Link
                    key={a.id}
                    to="/coach/applications/$id"
                    params={{ id: a.id }}
                    className="flex items-center justify-between glass rounded-md p-3 hover:border-gold/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{localizeName(a.tournament?.name)}</div>
                      <div className="text-xs text-muted-foreground">{a._count?.entries ?? 0} спортшы</div>
                    </div>
                    <AppStatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

function ApplicationStatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === "REJECTED") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  return <ClipboardList className="h-3.5 w-3.5" />;
}

function AppStatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    SUBMITTED: { c: "bg-gold/15 text-gold border border-gold/30", l: "Қаралуда" },
    APPROVED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Бекітілді" },
    REJECTED: { c: "bg-destructive/15 text-destructive border border-destructive/30", l: "Қайтарылды" },
    WITHDRAWN: { c: "bg-muted text-muted-foreground", l: "Алынды" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${x.c}`}>{x.l}</span>;
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

function localizeName(n: any): string { if (!n) return ""; if (typeof n === "string") return n; return n.kk || n.ru || n.en || ""; }

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} – ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
