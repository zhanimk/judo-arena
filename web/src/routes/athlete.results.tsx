import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RatingEntry, Match } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";
import { Award, Swords, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/athlete/results")({
  head: () => ({ meta: [{ title: "Нәтижелер — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
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
  const matches = matchesQuery.data ?? [];
  const wins = matches.filter(
    (match: Match) => match.status === "COMPLETED" && match.winnerId === athleteId,
  ).length;
  const completed = matches.filter((match: Match) => match.status === "COMPLETED").length;

  return (
    <DashboardShell
      role={t("roles.ATHLETE")}
      navItems={nav}
      accentTitle={t("athlete.results_page_title")}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <ResultMetric
            icon={TrendingUp}
            label={t("athlete.my_rating")}
            value={String(Math.round(ratingQuery.data?.totalPoints ?? 0))}
          />
          <ResultMetric icon={Swords} label={t("dashboard.matches")} value={String(completed)} />
          <ResultMetric icon={Award} label={t("matches.win")} value={String(wins)} />
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel
            title={`${t("athlete.my_rating")}: ${Math.round(ratingQuery.data?.totalPoints ?? 0)} ${t("common.points").toLowerCase()}`}
          >
            {ratingQuery.isLoading ? (
              <LoadingState />
            ) : (ratingQuery.data?.entries ?? []).length === 0 ? (
              <EmptyState title={t("athlete.no_results")} hint={t("athlete.no_results_hint")} />
            ) : (
              <ul className="space-y-2 text-sm">
                {(ratingQuery.data?.entries ?? []).map((e: RatingEntry) => (
                  <li key={e.id} className="flex items-center justify-between glass rounded-md p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{localizeName(e.tournament?.name)}</div>
                      <div className="text-xs text-muted-foreground">{placeLabel(e.place, t)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-gold font-display text-lg tabular-nums">
                        {Number(e.points)}
                      </span>
                      {e.place <= 3 && e.tournament?.id && (
                        <a
                          href={api.admin.certificateUrl(athleteId, e.tournament.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t("athlete.download_certificate") ?? "Сертификат жүктеу"}
                          className="inline-flex items-center rounded-md border border-gold/30 bg-gold/10 px-2 py-1 text-[10px] font-bold text-gold hover:bg-gold/20 transition-colors"
                        >
                          PDF
                        </a>
                      )}
                    </div>
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
                {(matchesQuery.data ?? []).map((m: Match) => {
                  const opp = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
                  const won = m.winnerId === athleteId;
                  return (
                    <li key={m.id} className="flex justify-between glass rounded-md p-3">
                      <div>
                        <Link
                          to="/athlete/matches/$id"
                          params={{ id: m.id }}
                          className="font-medium hover:text-gold"
                        >
                          vs {opp?.name ?? "TBD"} {opp?.surname ?? ""}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {m.round}-{t("matches.round").toLowerCase()}
                        </div>
                      </div>
                      <span
                        className={`text-xs ${won ? "text-gold" : m.status === "COMPLETED" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {m.status === "COMPLETED"
                          ? won
                            ? t("matches.win")
                            : t("matches.loss")
                          : String(t(`status.${m.status}`, m.status))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

function ResultMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gold/20 bg-card/55 p-4 shadow-elegant">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold text-gradient-gold">{value}</div>
      </div>
    </div>
  );
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
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
