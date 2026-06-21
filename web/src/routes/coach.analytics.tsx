import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import {
  DashboardShell,
  StatCard,
  StatCardSkeleton,
  Panel,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { Users, Trophy, Star, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/coach/analytics")({
  head: () => ({ meta: [{ title: "Аналитика — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachAnalytics />
    </ProtectedRoute>
  ),
});

function CoachAnalytics() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const clubId = user?.clubId;

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["club-analytics", clubId],
    queryFn: () => (clubId ? api.clubs.analytics(clubId) : null),
    enabled: !!clubId,
  });

  return (
    <DashboardShell
      role={t("coach.role_label")}
      navItems={nav}
      accentTitle={t("coach_analytics.title", "Аналитика клуба")}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label={t("coach.stat_athletes", "Спортсмены")}
              value={String(analytics?.totalAthletes ?? 0)}
              icon={Users}
            />
            <StatCard
              label={t("coach_analytics.total_medals", "Всего медалей")}
              value={String(analytics?.medals?.total ?? 0)}
              icon={Medal}
              accent
            />
            <StatCard
              label={t("coach_analytics.average_rating", "Средний рейтинг")}
              value={String(analytics?.averageRating ?? 0)}
              icon={Star}
            />
            <StatCard
              label={t("coach_analytics.total_points", "Сумма очков клуба")}
              value={String(analytics?.totalPoints ?? 0)}
              icon={Trophy}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title={t("coach_analytics.top_athletes", "Топ-10 спортсменов (по очкам)")}>
          {isLoading ? (
            <div className="space-y-3">
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          ) : !analytics?.topAthletes?.length ? (
            <div className="relative">
              <EmptyState
                title={t("coach_analytics.no_data", "Пока нет данных")}
                hint={t(
                  "coach_analytics.no_data_hint",
                  "Ваши спортсмены еще не участвовали в турнирах или не заработали очки.",
                )}
              />
              <div className="absolute inset-0 opacity-10 pointer-events-none blur-[2px] mt-20">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[
                      { name: "A", points: 10 },
                      { name: "B", points: 8 },
                      { name: "C", points: 5 },
                    ]}
                  >
                    <Bar dataKey="points" fill="#d4af37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.topAthletes}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="surname"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="points"
                      fill="url(#goldGradient)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                    <defs>
                      <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f5d67b" />
                        <stop offset="100%" stopColor="#d4af37" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {analytics.topAthletes.slice(0, 5).map((athlete, index) => (
                  <div
                    key={athlete.id}
                    className="flex items-center gap-4 glass rounded-xl border border-border/60 p-3 hover:border-gold/30 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display font-bold text-lg text-muted-foreground">
                      #{index + 1}
                    </div>
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={athlete.avatarUrl ?? ""} />
                      <AvatarFallback className="bg-muted text-xs">
                        {(athlete.name?.[0] ?? "") + (athlete.surname?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">
                        {athlete.name} {athlete.surname}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-bold text-gradient-gold">
                        {athlete.points}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {t("coach_analytics.points", "Очков")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title={t("coach_analytics.medals_distribution", "Распределение медалей")}>
          {!analytics?.medals || analytics.medals.total === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
              <Medal className="h-12 w-12 opacity-20 mb-3" />
              <p className="text-sm">{t("coach_analytics.no_data", "Пока нет данных")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: t("coach_analytics.gold", "Золото"),
                          value: analytics.medals.gold,
                          fill: "#eab308",
                        },
                        {
                          name: t("coach_analytics.silver", "Серебро"),
                          value: analytics.medals.silver,
                          fill: "#94a3b8",
                        },
                        {
                          name: t("coach_analytics.bronze", "Бронза"),
                          value: analytics.medals.bronze,
                          fill: "#b45309",
                        },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {[
                        {
                          name: t("coach_analytics.gold", "Золото"),
                          value: analytics.medals.gold,
                          fill: "#eab308",
                        },
                        {
                          name: t("coach_analytics.silver", "Серебро"),
                          value: analytics.medals.silver,
                          fill: "#94a3b8",
                        },
                        {
                          name: t("coach_analytics.bronze", "Бронза"),
                          value: analytics.medals.bronze,
                          fill: "#b45309",
                        },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm font-medium">
                      {t("coach_analytics.gold", "Золото")}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-yellow-500">{analytics.medals.gold}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-400/10 to-transparent border border-slate-400/20 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-slate-400" />
                    <span className="text-sm font-medium">
                      {t("coach_analytics.silver", "Серебро")}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-slate-400">
                    {analytics.medals.silver}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-700/10 to-transparent border border-amber-700/20 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-amber-600" />
                    <span className="text-sm font-medium">
                      {t("coach_analytics.bronze", "Бронза")}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-amber-600">
                    {analytics.medals.bronze}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}
