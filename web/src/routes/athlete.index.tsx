import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, StatCard, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { LayoutDashboard, Trophy, Activity, User, Bell, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/athlete/")({
  head: () => ({ meta: [{ title: "Спортшы — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteOverview />
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

function AthleteOverview() {
  const { user } = useAuth();
  const athleteId = user?.id ?? "";

  const ratingQuery = useQuery({
    queryKey: ["athlete-rating", athleteId],
    queryFn: () => api.ratings.athlete(athleteId),
    enabled: !!athleteId,
  });
  const matchesQuery = useQuery({
    queryKey: ["athlete-matches", athleteId],
    queryFn: () => api.matches.list({ athleteId, limit: 200 }),
    enabled: !!athleteId,
  });

  if (!user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  const myTournamentsCount = new Set((ratingQuery.data?.entries ?? []).map((e: any) => e.tournament?.id)).size;
  const totalMatches = matchesQuery.data?.length ?? 0;
  const wins = (matchesQuery.data ?? []).filter((m: any) => m.winnerId === athleteId).length;
  const losses = (matchesQuery.data ?? []).filter((m: any) => m.winnerId && m.winnerId !== athleteId).length;
  const goldCount = (ratingQuery.data?.entries ?? []).filter((e: any) => e.place === 1).length;
  const totalMedals = (ratingQuery.data?.entries ?? []).filter((e: any) => e.place <= 3).length;
  const fullName = `${user.name} ${user.surname}`;

  return (
    <DashboardShell role="Спортшы" navItems={nav} accentTitle={fullName}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Дәреже" value={String(Math.round(ratingQuery.data?.totalPoints ?? 0))}
          hint={ratingQuery.isLoading ? "жүктелуде..." : `${myTournamentsCount} жарыс`} accent />
        <StatCard label="Салмақ" value={user.weightKg ? `${user.weightKg} кг` : "—"} hint={user.beltRank ?? "—"} />
        <StatCard label="Жеңіс / жекпе-жек" value={matchesQuery.isLoading ? "…" : `${wins} / ${totalMatches}`} hint={losses > 0 ? `${losses} жеңіліс` : undefined} />
        <StatCard label="Медальдар" value={String(totalMedals)} hint={goldCount > 0 ? `${goldCount} алтын` : undefined} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Менің рейтингім">
          {ratingQuery.isLoading ? <LoadingState /> :
            (ratingQuery.data?.entries ?? []).length === 0 ? (
              <EmptyState title="Әзірше жарыс жоқ" hint="Бірінші жарысыңыз — алтын болсын! 🏆" />
            ) : (
              <ul className="space-y-2 text-sm">
                {(ratingQuery.data?.entries ?? []).slice(0, 5).map((e: any, i: number) => (
                  <li key={i} className="flex items-center justify-between glass rounded-md p-3">
                    <div>
                      <div className="font-medium">{localizeName(e.tournament?.name) ?? "Турнир"}</div>
                      <div className="text-xs text-muted-foreground">{placeLabel(e.place)}</div>
                    </div>
                    <span className="text-gold font-display text-lg tabular-nums">{Number(e.points)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="Соңғы жекпе-жектер">
          {matchesQuery.isLoading ? <LoadingState /> :
            (matchesQuery.data ?? []).length === 0 ? (
              <EmptyState title="Жекпе-жектер жоқ" hint="Жарысқа қатысқанда осы жерде көрінеді" />
            ) : (
              <ul className="space-y-2 text-sm">
                {(matchesQuery.data ?? []).slice(0, 5).map((m: any) => {
                  const opp = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
                  const won = m.winnerId === athleteId;
                  const oppName = opp ? `${opp.name} ${opp.surname}` : "TBD";
                  return (
                    <li key={m.id} className="flex items-center justify-between glass rounded-md p-3">
                      <div>
                        <Link to="/athlete/matches/$id" params={{ id: m.id }} className="font-medium hover:text-gold">
                          vs {oppName}
                        </Link>
                        <div className="text-xs text-muted-foreground">Раунд {m.round}</div>
                      </div>
                      <span className={`text-xs ${won ? "text-gold" : m.status === "COMPLETED" ? "text-destructive" : "text-muted-foreground"}`}>
                        {m.status === "COMPLETED" ? (won ? "Жеңіс" : "Жеңіліс") : "Күтуде"}
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

function localizeName(n: any): string | null {
  if (!n) return null;
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || null;
}

function placeLabel(p: number): string {
  if (p === 1) return "🥇 1-орын · Алтын";
  if (p === 2) return "🥈 2-орын · Күміс";
  if (p === 3) return "🥉 3-орын · Қола";
  if (p <= 5) return `${p}-орын`;
  if (p <= 8) return `${p}-орын · Жұбату`;
  return "Қатысу";
}
