import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";

export const Route = createFileRoute("/athlete/results")({
  head: () => ({ meta: [{ title: "Нәтижелер — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <Results />
    </ProtectedRoute>
  ),
});

function Results() {
  const { user } = useAuth();
  const athleteId = user?.id ?? "";

  const ratingQuery = useQuery({
    queryKey: ["my-rating", athleteId],
    queryFn: () => api.ratings.athlete(athleteId),
    enabled: !!athleteId,
  });

  const matchesQuery = useQuery({
    queryKey: ["my-matches", athleteId],
    queryFn: () => api.matches.list({ athleteId, limit: 200 }),
    enabled: !!athleteId,
  });

  return (
    <DashboardShell role="Спортшы" navItems={nav} accentTitle="Менің нәтижелерім">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Рейтинг: ${Math.round(ratingQuery.data?.totalPoints ?? 0)} ұпай`}>
          {ratingQuery.isLoading ? (
            <LoadingState />
          ) : (ratingQuery.data?.entries ?? []).length === 0 ? (
            <EmptyState
              title="Әзірше жарыстар жоқ"
              hint="Жарыс аяқталғаннан кейін орын мен ұпайлар көрінеді."
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {(ratingQuery.data?.entries ?? []).map((e: any) => (
                <li key={e.id} className="flex justify-between glass rounded-md p-3">
                  <div>
                    <div className="font-medium">{localizeName(e.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">{placeLabel(e.place)}</div>
                  </div>
                  <span className="text-gold font-display text-lg tabular-nums">{Number(e.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Жекпе-жектер: ${matchesQuery.data?.length ?? 0}`}>
          {matchesQuery.isLoading ? (
            <LoadingState />
          ) : (matchesQuery.data ?? []).length === 0 ? (
            <EmptyState title="Жекпе-жектер жоқ" hint="Сіздің бірінші турниріңіз әлі алда!" />
          ) : (
            <ul className="space-y-2 text-sm">
              {(matchesQuery.data ?? []).map((m: any) => {
                const opp = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
                const won = m.winnerId === athleteId;
                return (
                  <li key={m.id} className="flex justify-between glass rounded-md p-3">
                    <div>
                      <Link to="/athlete/matches/$id" params={{ id: m.id }} className="font-medium hover:text-gold">
                        vs {opp?.name ?? "TBD"} {opp?.surname ?? ""}
                      </Link>
                      <div className="text-xs text-muted-foreground">{m.round}-тур</div>
                    </div>
                    <span className={`text-xs ${won ? "text-gold" : m.status === "COMPLETED" ? "text-destructive" : "text-muted-foreground"}`}>
                      {m.status === "COMPLETED" ? (won ? "Жеңіс" : "Жеңіліс")
                        : m.status === "IN_PROGRESS" ? "Жүріп жатыр"
                        : m.status === "PENDING" ? "Күтуде"
                        : m.status === "CANCELLED" ? "Болдырылмады"
                        : m.status}
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

function placeLabel(p: number): string {
  if (p === 1) return "🥇 1-орын · Алтын";
  if (p === 2) return "🥈 2-орын · Күміс";
  if (p === 3) return "🥉 3-орын · Қола";
  if (p <= 5) return `${p}-орын`;
  if (p <= 8) return `${p}-орын · Жұбату`;
  return "Қатысу";
}
