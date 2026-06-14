/**
 * Аналитика федерации — дашборд для отчётов Министерству спорта.
 *   /admin/analytics
 */

import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FederationAnalytics } from "@/lib/api-types";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import {
  Award,
  BarChart3,
  Building2,
  Calendar,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Аналитика — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminAnalytics />
    </ProtectedRoute>
  ),
});

const GENDER_COLORS: Record<string, string> = {
  MALE: "#3b82f6",
  FEMALE: "#ec4899",
  UNKNOWN: "#9ca3af",
};
const CHART_COLORS = ["#c9a84c", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"];

function monthLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}.${String(year).slice(2)}`;
}

function locName(name: unknown): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  const n = name as Record<string, string>;
  return n.kk || n.ru || n.en || "—";
}

function AdminAnalytics() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<FederationAnalytics>({
    queryKey: ["federation-analytics"],
    queryFn: () => api.admin.analytics(),
    staleTime: 5 * 60 * 1000,
  });

  const athletesByMonthData = useMemo(() => {
    if (!data) return [];
    return data.athletes.byMonth.map((r) => ({
      label: monthLabel(r.year, r.month),
      count: r.count,
    }));
  }, [data]);

  const matchesByMonthData = useMemo(() => {
    if (!data) return [];
    return data.matches.byMonth.map((r) => ({
      label: monthLabel(r.year, r.month),
      count: r.count,
    }));
  }, [data]);

  const totalAthletes = useMemo(
    () => data?.athletes.byGender.reduce((s, g) => s + g.count, 0) ?? 0,
    [data],
  );

  const genderPieData = useMemo(
    () =>
      (data?.athletes.byGender ?? []).map((g) => ({
        name: g.gender === "MALE" ? t("common.male") : g.gender === "FEMALE" ? t("tatami.female_short") : "—",
        value: g.count,
        color: GENDER_COLORS[g.gender] ?? "#9ca3af",
      })),
    [data, t],
  );

  const weightClassData = useMemo(() => {
    if (!data) return [];
    return data.categories.popularWeightClasses
      .slice(0, 10)
      .map((w) => ({
        label: `${w.gender === "MALE" ? "♂" : "♀"} ${w.weightMax >= 200 ? "+" : "-"}${w.weightMax}kg`,
        count: w.count,
      }));
  }, [data]);

  if (isLoading || !data) return <LoadingState />;

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("analytics.title")}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label={t("analytics.total_athletes")}
          value={totalAthletes}
          color="blue"
        />
        <KpiCard
          icon={<Trophy className="h-5 w-5" />}
          label={t("analytics.tournaments_this_year")}
          value={data.tournaments.completedThisYear.length}
          color="gold"
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label={t("analytics.matches_total")}
          value={data.matches.byMonth.reduce((s, m) => s + m.count, 0)}
          color="green"
        />
        <KpiCard
          icon={<Building2 className="h-5 w-5" />}
          label={t("analytics.clubs_active")}
          value={data.athletes.topClubs.length}
          color="purple"
        />
      </div>

      {/* Athletes Registration Trend */}
      <Panel
        title={t("analytics.athlete_registrations")}
        action={<span className="text-xs text-muted-foreground">{t("analytics.last_24_months")}</span>}
       
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={athletesByMonthData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#c9a84c"
              strokeWidth={2}
              dot={false}
              name={t("analytics.athletes")}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid gap-6 mb-6 lg:grid-cols-2">
        {/* Gender breakdown pie */}
        <Panel title={t("analytics.gender_breakdown")}>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={genderPieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {genderPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {genderPieData.map((g, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: g.color }} />
                    <span>{g.name}</span>
                  </div>
                  <span className="font-semibold">{g.value.toLocaleString()}</span>
                </div>
              ))}
              {data.athletes.avgAgeByGender.map((a, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {a.gender === "MALE" ? t("common.male") : t("tatami.female_short")} —{" "}
                  {t("analytics.avg_age")}: <strong>{a.avgAge} {t("common.years")}</strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Matches per month */}
        <Panel title={t("analytics.matches_per_month")}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={matchesByMonthData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name={t("analytics.matches")} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-6 mb-6 lg:grid-cols-2">
        {/* Athletes by city */}
        <Panel title={t("analytics.athletes_by_city")}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data.athletes.byCity}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 50, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="city" tick={{ fontSize: 10 }} width={50} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[0, 3, 3, 0]} name={t("analytics.athletes")} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Popular weight classes */}
        <Panel title={t("analytics.popular_weight_classes")}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={weightClassData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 3, 3, 0]} name={t("analytics.entries")}>
                {weightClassData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Top clubs */}
      <Panel title={t("analytics.top_clubs")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="pb-2 text-left font-medium w-8">#</th>
                <th className="pb-2 text-left font-medium">{t("analytics.club")}</th>
                <th className="pb-2 text-left font-medium">{t("common.city")}</th>
                <th className="pb-2 text-right font-medium">{t("analytics.athletes")}</th>
              </tr>
            </thead>
            <tbody>
              {data.athletes.topClubs.map((club, i) => (
                <tr key={club.clubId} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium">{locName(club.name)}</td>
                  <td className="py-2 text-muted-foreground">{club.city}</td>
                  <td className="py-2 text-right font-semibold">{club.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Top athletes this year */}
      <Panel
        title={t("analytics.top_athletes_year")}
        action={
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Award className="h-3 w-3" />
            {new Date().getFullYear()}
          </span>
        }
       
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="pb-2 text-left font-medium w-8">#</th>
                <th className="pb-2 text-left font-medium">{t("analytics.athlete")}</th>
                <th className="pb-2 text-left font-medium">{t("common.city")}</th>
                <th className="pb-2 text-right font-medium">{t("analytics.points")}</th>
              </tr>
            </thead>
            <tbody>
              {data.ratings.topAthletesThisYear.map((a, i) => (
                <tr key={a.athleteId} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 text-muted-foreground font-bold">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="py-2 font-medium">{a.surname} {a.name}</td>
                  <td className="py-2 text-muted-foreground">{a.clubCity ?? "—"}</td>
                  <td className="py-2 text-right font-semibold text-gold">{a.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Completed tournaments this year */}
      <Panel
        title={t("analytics.completed_tournaments")}
        action={
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date().getFullYear()}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="pb-2 text-left font-medium">{t("tournament.name")}</th>
                <th className="pb-2 text-left font-medium">{t("common.city")}</th>
                <th className="pb-2 text-left font-medium">{t("tournament.start_date")}</th>
                <th className="pb-2 text-right font-medium">{t("analytics.categories")}</th>
              </tr>
            </thead>
            <tbody>
              {data.tournaments.completedThisYear.map((t_) => (
                <tr key={t_.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 font-medium">{locName(t_.name)}</td>
                  <td className="py-2 text-muted-foreground">{t_.city}</td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(t_.startDate).toLocaleDateString("kk-KZ")}
                  </td>
                  <td className="py-2 text-right">{t_.categoriesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </DashboardShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "gold" | "green" | "purple";
}) {
  const colorMap = {
    blue: "text-blue-500 bg-blue-500/10",
    gold: "text-amber-400 bg-amber-400/10",
    green: "text-emerald-500 bg-emerald-500/10",
    purple: "text-violet-500 bg-violet-500/10",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
