import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/athlete/results")({
  head: () => ({ meta: [{ title: "Нәтижелер — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <Results />
    </ProtectedRoute>
  ),
});

function Results() {
  const { t } = useTranslation();
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
    <DashboardShell role={t("roles.ATHLETE")} navItems={nav} accentTitle={t("athlete.results_page_title")}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`${t("athlete.my_rating")}: ${Math.round(ratingQuery.data?.totalPoints ?? 0)} ${t("common.points").toLowerCase()}`}>
          {ratingQuery.isLoading ? (
            <LoadingState />
          ) : (ratingQuery.data?.entries ?? []).length === 0 ? (
            <EmptyState
              title={t("athlete.no_results")}
              hint={t("athlete.no_results_hint")}
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {(ratingQuery.data?.entries ?? []).map((e: any) => (
                <li key={e.id} className="flex justify-between glass rounded-md p-3">
                  <div>
                    <div className="font-medium">{localizeName(e.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">{placeLabel(e.place, t)}</div>
                  </div>
                  <span className="text-gold font-display text-lg tabular-nums">{Number(e.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`${t("dashboard.matches")}: ${matchesQuery.data?.length ?? 0}`}>
          {matchesQuery.isLoading ? (
            <LoadingState />
          ) : (matchesQuery.data ?? []).length === 0 ? (
            <EmptyState title={t("athlete.no_matches")} hint={t("athlete.no_matches_hint")} />
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
                      <div className="text-xs text-muted-foreground">{m.round}-{t("matches.round").toLowerCase()}</div>
                    </div>
                    <span className={`text-xs ${won ? "text-gold" : m.status === "COMPLETED" ? "text-destructive" : "text-muted-foreground"}`}>
                      {m.status === "COMPLETED" ? (won ? t("matches.win") : t("matches.loss"))
                        : String(t(`status.${m.status}`, m.status))}
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

function placeLabel(p: number, t: (key: string) => string): string {
  if (p === 1) return `🥇 ${t("rankings.place_gold")}`;
  if (p === 2) return `🥈 ${t("rankings.place_silver")}`;
  if (p === 3) return `🥉 ${t("rankings.place_bronze")}`;
  if (p <= 5) return `${p}-${t("rankings.place")}`;
  if (p <= 8) return `${p}-${t("rankings.place")} · ${t("rankings.repechage")}`;
  return t("rankings.participation");
}
