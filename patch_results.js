const fs = require("fs");

const matchesFile = fs.readFileSync(
  "web/src/routes/athlete.matches.tsx",
  "utf8",
);
const resultsFile = fs.readFileSync(
  "web/src/routes/athlete.results.tsx",
  "utf8",
);

const matchHelpers = matchesFile.split(
  "// ─── Строка матча ────────────────────────────────────────────────────────────",
)[1];

const newResults =
  `import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { RatingEntry, Match } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";
import { Calendar, Search, Trophy } from "lucide-react";

export const Route = createFileRoute("/athlete/results")({
  head: () => ({ meta: [{ title: "Нәтижелер — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <Results />
    </ProtectedRoute>
  ),
});

type StatusFilter = "all" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

function Results() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const athleteId = user?.id ?? "";

  const [tab, setTab] = useState<"overview" | "matches">("overview");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

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
    queryKey: ["athlete-all-matches", athleteId],
    queryFn: () => api.matches.list({ athleteId, limit: 500 }),
    enabled: !!athleteId,
    staleTime: 30_000,
  });

  const matches: Match[] = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const filteredMatches = useMemo(() => {
    let list = matches;
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => {
        const opp = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
        return [
          opp ? \`\${opp.name} \${opp.surname}\` : "",
          localizeName(m.tournament?.name),
          m.bracketSection ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }
    return list;
  }, [matches, statusFilter, search, athleteId]);

  return (
    <DashboardShell
      role={t("roles.ATHLETE")}
      navItems={nav}
      accentTitle={t("athlete.results_page_title")}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex space-x-2 border-b border-border/40 pb-px overflow-x-auto">
          <button
            onClick={() => setTab("overview")}
            className={\`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap \${
              tab === "overview"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
            }\`}
          >
            {t("dashboard.overview")}
          </button>
          <button
            onClick={() => setTab("matches")}
            className={\`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap \${
              tab === "matches"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
            }\`}
          >
            {t("dashboard.matches")}
          </button>
        </div>

        {tab === "overview" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-5">
              {statsQuery.data && <AthleteStatsPanel stats={statsQuery.data} t={t} />}
            </div>
            <div className="mt-5 space-y-5 max-w-3xl">
              <Panel title={t("athlete.tournament_results") || "Жарыс нәтижелері"}>
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
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
            <Panel title={t("matches.list_title")}>
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
                  {(["all", "PENDING", "IN_PROGRESS", "COMPLETED"] as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={\`px-3 py-2 transition-colors \${
                        statusFilter === s
                          ? "bg-gold text-gold-foreground font-semibold"
                          : "bg-card/60 text-muted-foreground hover:text-foreground"
                      }\`}
                    >
                      {s === "all" ? t("common.all") : String(t(\`status.\${s}\`, s))}
                    </button>
                  ))}
                </div>

                <label className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold/60" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("matches.search_placeholder")}
                    className="w-full rounded-lg border border-border/60 bg-card/70 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-gold"
                  />
                </label>
              </div>

              {matchesQuery.isLoading ? (
                <LoadingState />
              ) : filteredMatches.length === 0 ? (
                <EmptyState
                  title={search || statusFilter !== "all" ? t("common.no_data") : t("athlete.no_matches")}
                  hint={
                    search || statusFilter !== "all"
                      ? t("matches.search_hint")
                      : t("athlete.no_matches_hint")
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {filteredMatches.map((m: Match) => (
                    <MatchRow key={m.id} match={m} athleteId={athleteId} />
                  ))}
                </ul>
              )}

              {filteredMatches.length > 0 && (
                <div className="mt-3 text-right text-xs text-muted-foreground">
                  {filteredMatches.length} {t("dashboard.matches").toLowerCase()}
                  {search && \` · \${t("common.search").toLowerCase()}: "\${search}"\`}
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function placeLabel(p: number, t: (key: string) => string): string {
  if (p === 1) return \`🥇 \${t("rankings.place_gold")}\`;
  if (p === 2) return \`🥈 \${t("rankings.place_silver")}\`;
  if (p === 3) return \`🥉 \${t("rankings.place_bronze")}\`;
  if (p <= 5) return \`\${p}-\${t("rankings.place")}\`;
  if (p <= 8) return \`\${p}-\${t("rankings.place")} · \${t("rankings.repechage")}\`;
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
      sub: \`\${m.winRate}%\`,
      color: "text-emerald-500",
    },
    { label: t("stats.losses"), value: String(m.losses), sub: "", color: "text-rose-400" },
    {
      label: t("stats.ippon_wins"),
      value: String(m.ipponWins),
      sub: \`\${m.ipponWinRate}% \${t("stats.of_wins")}\`,
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
            <div className={\`text-3xl font-black tabular-nums \${card.color ?? ""}\`}>
              {card.value}
            </div>
            {card.sub && <div className="text-[11px] text-muted-foreground">{card.sub}</div>}
          </div>
        ))}
      </div>

      {r.history.length > 1 && (
        <div className="mt-4 rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("stats.rating_history")}
          </div>
          <RatingSparkline history={r.history} />
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
    return \`\${x},\${y}\`;
  });

  return (
    <svg viewBox={\`0 0 \${W} \${H}\`} className="w-full h-12" preserveAspectRatio="none">
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

// ─── Строка матча ────────────────────────────────────────────────────────────
` + matchHelpers;

fs.writeFileSync("web/src/routes/athlete.results.tsx", newResults);
