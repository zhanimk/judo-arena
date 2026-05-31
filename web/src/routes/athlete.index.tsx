import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, StatCard, StatCardSkeleton, Panel, LoadingState, EmptyState, CardListSkeleton } from "@/components/dashboard/DashboardShell";
import { Loader2, Trophy, Swords } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/athlete/")({
  head: () => ({ meta: [{ title: "Спортшы — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteOverview />
    </ProtectedRoute>
  ),
});

function AthleteOverview() {
  const { t } = useTranslation();
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
    <DashboardShell role={t("athlete.role_label")} navItems={nav} accentTitle={fullName}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ratingQuery.isLoading || matchesQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : <>
            <StatCard label={t("athlete.stat_rating")} value={String(Math.round(ratingQuery.data?.totalPoints ?? 0))}
              hint={t("athlete.stat_tournaments", { count: myTournamentsCount })} accent />
            <StatCard label={t("common.weight")} value={user.weightKg ? `${user.weightKg} кг` : "—"} hint={user.beltRank ?? "—"} />
            <StatCard label={`${t("athlete.stat_wins")} / ${t("athlete.stat_matches")}`} value={`${wins} / ${totalMatches}`} hint={losses > 0 ? t("athlete.stat_losses_hint", { count: losses }) : undefined} />
            <StatCard label={t("athlete.stat_medals")} value={String(totalMedals)} hint={goldCount > 0 ? t("athlete.stat_gold_hint", { count: goldCount }) : undefined} />
          </>
        }
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title={t("athlete.my_rating")}>
          {ratingQuery.isLoading ? <CardListSkeleton count={4} /> :
            (ratingQuery.data?.entries ?? []).length === 0 ? (
              <EmptyState title={t("athlete.no_results")} hint={t("athlete.no_results_hint")}
                icon={Trophy} action={{ label: t("athlete.browse_tournaments"), to: "/athlete/tournaments" }} />
            ) : (
              <ul className="space-y-2 text-sm">
                {(ratingQuery.data?.entries ?? []).slice(0, 5).map((e: any, i: number) => (
                  <li key={i} className="flex items-center justify-between glass rounded-md p-3">
                    <div>
                      <div className="font-medium">{localizeName(e.tournament?.name) ?? t("common.tournament")}</div>
                      <div className="text-xs text-muted-foreground">{placeLabel(e.place, t)}</div>
                    </div>
                    <span className="text-gold font-display text-lg tabular-nums">{Number(e.points)}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title={t("athlete.recent_matches")}>
          {matchesQuery.isLoading ? <CardListSkeleton count={4} /> :
            (matchesQuery.data ?? []).length === 0 ? (
              <EmptyState title={t("athlete.no_matches")} hint={t("athlete.no_matches_hint")}
                icon={Swords} action={{ label: t("athlete.browse_tournaments"), to: "/athlete/tournaments" }} />
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
                        <div className="text-xs text-muted-foreground">{t("matches.round")} {m.round}</div>
                      </div>
                      <span className={`text-xs ${won ? "text-gold" : m.status === "COMPLETED" ? "text-destructive" : "text-muted-foreground"}`}>
                        {m.status === "COMPLETED" ? (won ? t("matches.win") : t("matches.loss")) : t("matches.pending")}
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

function placeLabel(p: number, t: (key: string, opts?: any) => string): string {
  if (p === 1) return `🥇 ${t("rankings.place_gold")}`;
  if (p === 2) return `🥈 ${t("rankings.place_silver")}`;
  if (p === 3) return `🥉 ${t("rankings.place_bronze")}`;
  if (p <= 5) return `${p}-${t("common.place")}`;
  if (p <= 8) return `${p}-${t("common.place")} · ${t("rankings.repechage")}`;
  return t("rankings.participation");
}
