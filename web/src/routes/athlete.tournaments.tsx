import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { LayoutDashboard, User, Trophy, Activity, Bell, Calendar, MapPin, Clock, GitBranch, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/athlete/tournaments")({
  head: () => ({ meta: [{ title: "Жарыстар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteTournaments />
    </ProtectedRoute>
  ),
});

const nav = [
  { to: "/athlete", label: "Шолу", icon: LayoutDashboard },
  { to: "/athlete/profile", label: "Профиль", icon: User },
  { to: "/athlete/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/athlete/results", label: "Нәтижелер", icon: Activity },
  { to: "/athlete/notifications", label: "Хабарландырулар", icon: Bell },
];

function AthleteTournaments() {
  const tournamentsQuery = useQuery({
    queryKey: ["all-tournaments-public"],
    queryFn: () => api.tournaments.list(),
  });

  return (
    <DashboardShell role="Спортшы" navItems={nav} accentTitle="Жарыстар">
      <Panel title="Барлық жарыстар">
        {tournamentsQuery.isLoading ? (
          <LoadingState />
        ) : (tournamentsQuery.data?.items ?? []).length === 0 ? (
          <EmptyState title="Әзірше жарыс жоқ" hint="Жаңа жарыс жарияланғанда осы жерде көрінеді." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tournamentsQuery.data!.items.map((t: any) => (
              <Link
                key={t.id}
                to="/tournaments/$id"
                params={{ id: t.id }}
                className="glass rounded-xl p-5 hover:border-gold/40 transition-all hover:-translate-y-1 border border-border/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-display text-lg font-semibold mb-2">
                    {localizeName(t.name)}
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-gold/70" />
                    {dateRange(t.startDate, t.endDate)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-gold/70" />
                    Дедлайн: {new Date(t.applicationDeadline ?? t.startDate).toLocaleString("kk-KZ")}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gold/70" />
                    {t.location || t.city}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-gold/70" />
                    {t._count?.applications ?? 0} өтінім
                  </div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-gold/70" />
                    {t._count?.categories ?? 0} санат · {t.tatamiCount ?? 1} татами
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-center text-xs text-gold">
                  Толық ақпаратты көру
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
    CANCELLED: { c: "bg-muted text-muted-foreground", l: "Тоқтатылды" },
  };
  const x = m[status] ?? { c: "bg-muted", l: status };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${x.c}`}>{x.l}</span>;
}

function localizeName(name: any): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} - ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
