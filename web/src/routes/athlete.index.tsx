import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  StatCard,
  StatCardSkeleton,
  Panel,
  EmptyState,
  CardListSkeleton,
} from "@/components/dashboard/DashboardShell";
import { Loader2, Trophy, Swords, Weight, Star, TrendingUp, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const Route = createFileRoute("/athlete/")({
  head: () => ({ meta: [{ title: "Спортшы — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteOverview />
    </ProtectedRoute>
  ),
});

const BELT_GRADIENT: Record<string, string> = {
  "6 КЮ": "from-zinc-200 to-white",
  "5 КЮ": "from-yellow-300 to-yellow-500",
  "4 КЮ": "from-orange-400 to-orange-600",
  "3 КЮ": "from-green-500 to-emerald-700",
  "2 КЮ": "from-sky-500 to-blue-700",
  "1 КЮ": "from-amber-700 to-amber-950",
  "1 ДАН": "from-gray-800 to-gray-950",
};

const BELT_PROGRESS: Record<string, number> = {
  "6 КЮ": 14,
  "5 КЮ": 28,
  "4 КЮ": 42,
  "3 КЮ": 57,
  "2 КЮ": 71,
  "1 КЮ": 85,
  "1 ДАН": 100,
};

const NEXT_LEVEL_TECHNIQUES: Record<string, { next: string; techniques: string[] }> = {
  "6 КЮ": {
    next: "5 КЮ (Сары)",
    techniques: [
      "De-ashi-barai",
      "Hiza-guruma",
      "Sasae-tsurikomi-ashi",
      "O-goshi",
      "O-soto-gari",
      "O-uchi-gari",
      "Seoi-nage",
    ],
  },
  "5 КЮ": {
    next: "4 КЮ (Қызғылт сары)",
    techniques: [
      "Ko-soto-gari",
      "Ko-uchi-gari",
      "Koshi-guruma",
      "Tsurikomi-goshi",
      "Okuri-ashi-barai",
      "Tai-otoshi",
      "Harai-goshi",
      "Uchi-mata",
    ],
  },
  "4 КЮ": {
    next: "3 КЮ (Жасыл)",
    techniques: [
      "Ko-soto-gake",
      "Tsuri-goshi",
      "Yoko-otoshi",
      "Ashi-guruma",
      "Hane-goshi",
      "Harai-tsurikomi-ashi",
      "Tomoe-nage",
      "Kata-guruma",
    ],
  },
  "3 КЮ": {
    next: "2 КЮ (Көк)",
    techniques: [
      "Sumi-gaeshi",
      "Tani-otoshi",
      "Hane-makikomi",
      "Sukui-nage",
      "Utsuri-goshi",
      "O-guruma",
      "Soto-makikomi",
      "Uki-otoshi",
    ],
  },
  "2 КЮ": {
    next: "1 КЮ (Қоңыр)",
    techniques: [
      "O-soto-guruma",
      "Uki-waza",
      "Yoko-wakare",
      "Yoko-guruma",
      "Ushiro-goshi",
      "Ura-nage",
      "Sumi-otoshi",
      "Yoko-gake",
    ],
  },
  "1 КЮ": {
    next: "1 ДАН (Қара)",
    techniques: [
      "Барлық техниканы кемелдендіру",
      "Комбинация жасау",
      "Не-вадза меңгеру",
      "Жарыста тұрақты нәтиже",
    ],
  },
};

function nextLevelLabel(belt: string, t: TranslateFn): string {
  const keyByBelt: Record<string, string> = {
    "6 КЮ": "athlete_dashboard.next_5_kyu",
    "5 КЮ": "athlete_dashboard.next_4_kyu",
    "4 КЮ": "athlete_dashboard.next_3_kyu",
    "3 КЮ": "athlete_dashboard.next_2_kyu",
    "2 КЮ": "athlete_dashboard.next_1_kyu",
    "1 КЮ": "athlete_dashboard.next_1_dan",
  };
  return t(keyByBelt[belt] ?? "athlete_dashboard.next_5_kyu");
}

function techniqueLabel(technique: string, t: TranslateFn): string {
  const keyByTechnique: Record<string, string> = {
    "Барлық техниканы кемелдендіру": "athlete_dashboard.technique_master_previous",
    "Комбинация жасау": "athlete_dashboard.technique_combinations",
    "Не-вадза меңгеру": "athlete_dashboard.technique_ne_waza",
    "Жарыста тұрақты нәтиже": "athlete_dashboard.technique_competition_consistency",
  };
  return keyByTechnique[technique] ? t(keyByTechnique[technique]) : technique;
}

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
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments-open"],
    queryFn: () => api.tournaments.list({ status: "REGISTRATION_OPEN" }),
  });

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );

  const myTournamentsCount = new Set(
    (ratingQuery.data?.entries ?? []).map((e: any) => e.tournament?.id),
  ).size;
  const totalMatches = matchesQuery.data?.length ?? 0;
  const wins = (matchesQuery.data ?? []).filter((m: any) => m.winnerId === athleteId).length;
  const losses = (matchesQuery.data ?? []).filter(
    (m: any) => m.winnerId && m.winnerId !== athleteId,
  ).length;
  const goldCount = (ratingQuery.data?.entries ?? []).filter((e: any) => e.place === 1).length;
  const totalMedals = (ratingQuery.data?.entries ?? []).filter((e: any) => e.place <= 3).length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const fullName = `${user.name} ${user.surname}`;
  const belt = normalizeBelt(user.beltRank) || "6 КЮ";
  const beltGrad = BELT_GRADIENT[belt] ?? "from-zinc-300 to-zinc-500";
  const beltProgress = BELT_PROGRESS[belt] ?? 0;
  const nextTournament = (tournamentsQuery.data?.items ?? [])[0];
  const nextLevel = NEXT_LEVEL_TECHNIQUES[belt];

  const circumference = 2 * Math.PI * 28;
  const winArc = circumference - (circumference * winRate) / 100;

  return (
    <DashboardShell role={t("athlete.role_label")} navItems={nav} accentTitle={fullName}>
      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card p-5 sm:p-7 mb-6">
        <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${beltGrad}`} />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/8 blur-3xl" />
        <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-emerald-500/6 blur-2xl" />

        <div className="relative flex flex-wrap items-start gap-6 sm:flex-nowrap">
          {/* Win rate donut */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="relative h-16 w-16">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  strokeWidth="6"
                  className="stroke-border/40"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  strokeWidth="6"
                  stroke="oklch(0.76 0.15 80)"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={winArc}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-sm font-bold text-gold">{winRate}%</span>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("athlete_dashboard.win_rate")}
            </span>
          </div>

          {/* Name + belt */}
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">
              {t("athlete_dashboard.hello", { name: user.name })}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 rounded-md border border-white/20 bg-gradient-to-br ${beltGrad}`}
              />
              <span className="font-display text-2xl font-bold leading-none sm:text-3xl">
                {belt}
              </span>
              <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
                {user.weightKg ? `${user.weightKg} кг` : "—"}
              </span>
            </div>

            {/* Belt progress */}
            <div className="mt-3 max-w-xs">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t("athlete_dashboard.belt_progress")}</span>
                <span className="font-semibold text-gold">{beltProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border/40">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${beltGrad} transition-all duration-700`}
                  style={{ width: `${beltProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Next tournament */}
          {nextTournament && (
            <Link
              to="/athlete/tournaments"
              className="group shrink-0 rounded-xl border border-gold/20 bg-gold/5 p-3 hover:border-gold/40 hover:bg-gold/10 transition-all sm:w-44"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gold">
                <Calendar className="h-3 w-3" /> {t("athlete_dashboard.next_tournament")}
              </div>
              <div className="mt-1.5 text-sm font-semibold leading-snug line-clamp-2 group-hover:text-gold transition-colors">
                {localizeName(nextTournament.name) ?? "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {nextTournament.startDate
                  ? new Date(nextTournament.startDate).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                    })
                  : "—"}
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {ratingQuery.isLoading || matchesQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label={t("athlete.stat_rating")}
              value={String(Math.round(ratingQuery.data?.totalPoints ?? 0))}
              hint={t("athlete.stat_tournaments", { count: myTournamentsCount })}
              icon={TrendingUp}
              accent
            />
            <StatCard
              label={t("common.weight")}
              value={user.weightKg ? `${user.weightKg} кг` : "—"}
              hint={belt}
              icon={Weight}
            />
            <StatCard
              label={`${t("athlete.stat_wins")} / ${t("athlete.stat_matches")}`}
              value={`${wins} / ${totalMatches}`}
              hint={losses > 0 ? t("athlete.stat_losses_hint", { count: losses }) : undefined}
              icon={Swords}
              trend={totalMatches > 0 ? { value: winRate, label: "%" } : undefined}
            />
            <StatCard
              label={t("athlete.stat_medals")}
              value={String(totalMedals)}
              hint={goldCount > 0 ? t("athlete.stat_gold_hint", { count: goldCount }) : undefined}
              icon={Star}
            />
          </>
        )}
      </div>

      {/* ── Next level techniques ── */}
      {belt && nextLevel && (
        <div className="mt-6 relative overflow-hidden rounded-2xl border border-gold/25 bg-card p-5 sm:p-6">
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${beltGrad}`} />
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gold/6 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-gold">
                  {t("athlete_dashboard.belt_preparation")}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold">
                  {t("athlete_dashboard.next_level_preparation")}
                </h3>
              </div>
              <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
                {t("athlete_dashboard.target")}: {nextLevelLabel(belt, t)}
              </span>
            </div>
            <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              {t("athlete_dashboard.techniques_for_next_belt", { belt })}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {nextLevel.techniques.map((tech, i) => (
                <div
                  key={tech}
                  className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 transition-all hover:border-gold/30 hover:bg-gold/5"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-[9px] font-bold text-gold">
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium leading-tight">
                    {techniqueLabel(tech, t)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold/15 bg-gold/5 p-3 text-xs text-muted-foreground">
              <span className="text-base">💡</span>
              <span>{t("athlete_dashboard.practice_hint")}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Rating + Matches ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t("athlete.my_rating")}>
          {ratingQuery.isLoading ? (
            <CardListSkeleton count={4} />
          ) : (ratingQuery.data?.entries ?? []).length === 0 ? (
            <EmptyState
              title={t("athlete.no_results")}
              hint={t("athlete.no_results_hint")}
              icon={Trophy}
              action={{ label: t("athlete.browse_tournaments"), to: "/athlete/tournaments" }}
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {(ratingQuery.data?.entries ?? []).slice(0, 5).map((e: any, i: number) => (
                <li key={i} className="flex items-center gap-3 glass rounded-lg p-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      e.place === 1
                        ? "bg-yellow-400/20 text-yellow-500"
                        : e.place === 2
                          ? "bg-zinc-400/20 text-zinc-400"
                          : e.place === 3
                            ? "bg-amber-700/20 text-amber-600"
                            : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {e.place <= 3 ? ["🥇", "🥈", "🥉"][e.place - 1] : `${e.place}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {localizeName(e.tournament?.name) ?? t("common.tournament")}
                    </div>
                    <div className="text-xs text-muted-foreground">{placeLabel(e.place, t)}</div>
                  </div>
                  <span className="font-display text-lg font-bold text-gold tabular-nums">
                    {Number(e.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("athlete.recent_matches")}>
          {matchesQuery.isLoading ? (
            <CardListSkeleton count={4} />
          ) : (matchesQuery.data ?? []).length === 0 ? (
            <EmptyState
              title={t("athlete.no_matches")}
              hint={t("athlete.no_matches_hint")}
              icon={Swords}
              action={{ label: t("athlete.browse_tournaments"), to: "/athlete/tournaments" }}
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {(matchesQuery.data ?? []).slice(0, 5).map((m: any) => {
                const opp = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
                const won = m.winnerId === athleteId;
                const oppName = opp ? `${opp.name} ${opp.surname}` : "TBD";
                const method = m.winMethod ?? "";
                return (
                  <li key={m.id} className="flex items-center gap-3 glass rounded-lg p-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        m.status !== "COMPLETED"
                          ? "bg-muted/40 text-muted-foreground"
                          : won
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {m.status !== "COMPLETED" ? "?" : won ? "W" : "L"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/athlete/matches/$id"
                        params={{ id: m.id }}
                        className="truncate font-medium hover:text-gold transition-colors"
                      >
                        vs {oppName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {t("matches.round")} {m.round}
                        {method ? ` · ${method}` : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        m.status !== "COMPLETED"
                          ? "bg-muted/30 text-muted-foreground"
                          : won
                            ? "bg-emerald-500/12 text-emerald-500"
                            : "bg-destructive/12 text-destructive"
                      }`}
                    >
                      {m.status === "COMPLETED"
                        ? won
                          ? t("matches.win")
                          : t("matches.loss")
                        : t("matches.pending")}
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

function normalizeBelt(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/\bKYU\b/, "КЮ")
    .replace(/\bDAN\b/, "ДАН")
    .replace(/\bKU\b/, "КЮ");
}

function localizeName(n: any): string | null {
  if (!n) return null;
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || null;
}

function placeLabel(p: number, t: (key: string, opts?: any) => string): string {
  if (p === 1) return t("rankings.place_gold");
  if (p === 2) return t("rankings.place_silver");
  if (p === 3) return t("rankings.place_bronze");
  if (p <= 5) return `${p}-${t("common.place")}`;
  if (p <= 8) return `${p}-${t("common.place")} · ${t("rankings.repechage")}`;
  return t("rankings.participation");
}
