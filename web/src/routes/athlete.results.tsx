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

  const statsQuery = useQuery({
    queryKey: ["athlete-stats", athleteId],
    queryFn: () => api.ratings.athleteStats(athleteId),
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
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

        {statsQuery.data && <AthleteStatsPanel stats={statsQuery.data} t={t} />}

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
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

// ─── AthleteStatsPanel ────────────────────────────────────────────────────────

type AthleteStatsData = Awaited<ReturnType<typeof import("@/lib/api").api.ratings.athleteStats>>;

function AthleteStatsPanel({ stats, t }: { stats: AthleteStatsData; t: (k: string) => string }) {
  const m = stats.matches;
  const r = stats.rating;

  const statCards = [
    { label: t("stats.total_matches"), value: String(m.total), sub: "" },
    {
      label: t("stats.wins"),
      value: String(m.wins),
      sub: `${m.winRate}%`,
      color: "text-emerald-500",
    },
    { label: t("stats.losses"), value: String(m.losses), sub: "", color: "text-rose-400" },
    {
      label: t("stats.ippon_wins"),
      value: String(m.ipponWins),
      sub: `${m.ipponWinRate}% ${t("stats.of_wins")}`,
      color: "text-yellow-500",
    },
    { label: t("stats.wazaari_wins"), value: String(m.wazaariWins), sub: "" },
    { label: t("stats.gs_wins"), value: String(m.goldenScoreWins), sub: "" },
    { label: t("stats.tournaments"), value: String(stats.tournaments.total), sub: "" },
    {
      label: t("stats.rating_points"),
      value: r.totalPoints.toFixed(0),
      sub: "",
      color: "text-gold",
    },
  ];

  return (
    <div className="mt-2">
      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-gold font-semibold px-1">
        {t("stats.section_title")}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/40 bg-card/60 p-4 flex flex-col gap-1"
          >
            <div className="text-[11px] text-muted-foreground font-medium">{card.label}</div>
            <div className={`text-3xl font-black tabular-nums ${card.color ?? ""}`}>
              {card.value}
            </div>
            {card.sub && <div className="text-[11px] text-muted-foreground">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* Рейтинговая история */}
      {r.history.length > 1 && (
        <div className="mt-4 rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("stats.rating_history")}
          </div>
          <RatingSparkline history={r.history} />
        </div>
      )}

      {/* Последние результаты */}
      {(stats.rating.recent as unknown[]).length > 0 && (
        <div className="mt-4 rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("stats.recent_results")}
          </div>
          <div className="space-y-2">
            {(
              stats.rating.recent as Array<{
                place: number;
                points: number;
                tournament: { name: unknown; startDate: string };
                category: { gender: string; weightMin: number; weightMax: number };
              }>
            ).map((entry, i) => {
              const tName = entry.tournament.name;
              const name =
                typeof tName === "object" && tName !== null
                  ? ((tName as Record<string, string>)["kk"] ??
                    (tName as Record<string, string>)["ru"] ??
                    "—")
                  : String(tName ?? "—");
              const w =
                entry.category.weightMax >= 200
                  ? `+${entry.category.weightMin}`
                  : `-${entry.category.weightMax}`;
              const placeColor =
                entry.place === 1
                  ? "text-yellow-500"
                  : entry.place === 2
                    ? "text-slate-400"
                    : entry.place === 3
                      ? "text-amber-600"
                      : "text-muted-foreground";
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 font-black tabular-nums ${placeColor}`}>{entry.place}</span>
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-muted-foreground shrink-0">{w} кг</span>
                  <span className="text-gold font-semibold shrink-0">
                    +{Number(entry.points).toFixed(0)} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RatingSparkline({
  history,
}: {
  history: Array<{ date: string; points: number; tournamentName: string }>;
}) {
  if (history.length < 2) return null;
  const max = Math.max(...history.map((h) => h.points));
  const min = 0;
  const W = 400;
  const H = 60;
  const pad = 4;

  const pts = history.map((h, i) => {
    const x = pad + (i / (history.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((h.points - min) / (max - min || 1)) * (H - 2 * pad);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="hsl(var(--gold))"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts.join(" ")}
      />
      {history.map((h, i) => {
        const x = pad + (i / (history.length - 1)) * (W - 2 * pad);
        const y = H - pad - ((h.points - min) / (max - min || 1)) * (H - 2 * pad);
        return <circle key={i} cx={x} cy={y} r="3" fill="hsl(var(--gold))" />;
      })}
    </svg>
  );
}
