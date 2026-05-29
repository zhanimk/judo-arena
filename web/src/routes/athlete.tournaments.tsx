import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { AlertTriangle, Building2, Calendar, CheckCircle2, Clock, GitBranch, MapPin, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";

export const Route = createFileRoute("/athlete/tournaments")({
  head: () => ({ meta: [{ title: "Жарыстар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteTournaments />
    </ProtectedRoute>
  ),
});

function AthleteTournaments() {
  const { user } = useAuth();
  const tournamentsQuery = useQuery({
    queryKey: ["all-tournaments-public"],
    queryFn: () => api.tournaments.list(),
  });
  const entriesQuery = useQuery({
    queryKey: ["athlete-application-entries", user?.id],
    queryFn: () => api.applications.mineAsAthlete(),
    enabled: !!user?.id,
  });
  const entriesByTournament = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const entry of entriesQuery.data ?? []) {
      const tournamentId = entry.application?.tournament?.id;
      if (!tournamentId) continue;
      const list = map.get(tournamentId) ?? [];
      list.push(entry);
      map.set(tournamentId, list);
    }
    return map;
  }, [entriesQuery.data]);
  const approvedEntries = (entriesQuery.data ?? []).filter((entry: any) => entry.application?.status === "APPROVED");
  const pendingEntries = (entriesQuery.data ?? []).filter((entry: any) => entry.application?.status === "SUBMITTED");

  return (
    <DashboardShell role="Спортшы" navItems={nav} accentTitle="Жарыстар">
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Менің клубым">
          {user?.club ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-display text-xl font-semibold">{localizeName(user.club.name)}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 text-gold/70" />
                  {user.club.city || "Қала көрсетілмеген"}
                </div>
              </div>
              <div className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
                Клуб арқылы өтінім беріледі
              </div>
            </div>
          ) : (
            <EmptyState title="Клуб жоқ" hint="Тренер сізді клубқа қосқанда өтінімдер осы жерде көрінеді." />
          )}
        </Panel>
        <Panel title="Менің өтінімдерім">
          {entriesQuery.isLoading ? (
            <LoadingState />
          ) : (entriesQuery.data ?? []).length === 0 ? (
            <EmptyState title="Әзірше заявка жоқ" hint="Тренер сізді турнирге қосқанда статус осында шығады." />
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <MiniMetric label="Барлығы" value={entriesQuery.data?.length ?? 0} />
              <MiniMetric label="Қарауда" value={pendingEntries.length} tone="gold" />
              <MiniMetric label="Бекітілді" value={approvedEntries.length} tone="green" />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Барлық жарыстар">
        {tournamentsQuery.isLoading ? (
          <LoadingState />
        ) : (tournamentsQuery.data?.items ?? []).length === 0 ? (
          <EmptyState title="Әзірше жарыс жоқ" hint="Жаңа жарыс жарияланғанда осы жерде көрінеді." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tournamentsQuery.data!.items.map((t: any) => {
              const myEntries = entriesByTournament.get(t.id) ?? [];
              const primaryEntry = myEntries[0];
              const app = primaryEntry?.application;
              return (
                <Link
                  key={t.id}
                  to="/tournaments/$id"
                  params={{ id: t.id }}
                  className={`glass rounded-xl p-5 hover:border-gold/40 transition-all hover:-translate-y-1 border ${myEntries.length ? "border-gold/40" : "border-border/60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-lg font-semibold mb-2">
                      {localizeName(t.name)}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  {myEntries.length > 0 && (
                    <div className={`mb-3 rounded-md border p-3 text-xs ${applicationTone(app?.status)}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {app?.status === "APPROVED" ? <CheckCircle2 className="h-3.5 w-3.5" /> : app?.status === "REJECTED" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          Мен заявлен: {applicationStatusLabel(app?.status)}
                        </span>
                        <span>{myEntries.length} санат</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {myEntries.map((entry: any) => (
                          <div key={entry.id} className="truncate">
                            {categoryTitle(entry.category)}
                          </div>
                        ))}
                      </div>
                      {app?.reviewerNotes && (
                        <div className="mt-2 border-t border-current/20 pt-2 opacity-90">{app.reviewerNotes}</div>
                      )}
                    </div>
                  )}
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
              );
            })}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: number; tone?: "gold" | "green" }) {
  const color = tone === "gold" ? "text-gold" : tone === "green" ? "text-emerald-300" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
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

function applicationStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    DRAFT: "жоба",
    SUBMITTED: "қарауда",
    APPROVED: "бекітілді",
    REJECTED: "қайтарылды",
    WITHDRAWN: "қайтарып алынды",
  };
  return status ? labels[status] ?? status : "белгісіз";
}

function applicationTone(status?: string): string {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "REJECTED") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "SUBMITTED") return "border-gold/30 bg-gold/10 text-gold";
  return "border-border/50 bg-muted/20 text-muted-foreground";
}

function categoryTitle(c: any): string {
  if (!c) return "Санат";
  const custom = localizeName(c.name);
  if (custom !== "—") return custom;
  return `${c.gender === "MALE" ? "Ер" : "Қыз"} ${c.ageMin}-${c.ageMax} жас ${c.weightMin}-${c.weightMax} кг`;
}

function localizeName(name: any): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} - ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
