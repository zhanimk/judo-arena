import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Есептер — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminReports />
    </ProtectedRoute>
  ),
});



function AdminReports() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.admin.stats() });

  if (stats.isLoading) {
    return <DashboardShell role="Әкімші" navItems={nav} accentTitle="Есептер"><LoadingState /></DashboardShell>;
  }

  const tournamentByStatus = (stats.data?.tournaments ?? []).reduce((acc: any, t: any) => ({ ...acc, [t.status]: t._count.id }), {});
  const usersByRole = (stats.data?.users ?? []).reduce((acc: any, u: any) => ({ ...acc, [u.role]: u._count.id }), {});
  const matchesByStatus = (stats.data?.matches ?? []).reduce((acc: any, m: any) => ({ ...acc, [m.status]: m._count.id }), {});

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Есептер және статистика">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Барлық клубтар" value={String(stats.data?.clubsCount ?? 0)} accent />
        <StatCard label="Барлық турнирлер" value={String((stats.data?.tournaments ?? []).reduce((s: number, t: any) => s + t._count.id, 0))} />
        <StatCard label="Барлық матчтар" value={String((stats.data?.matches ?? []).reduce((s: number, m: any) => s + m._count.id, 0))} />
        <StatCard label="Рейтинг жазбалары" value={String(stats.data?.ratingEntriesCount ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Турнирлер">
          <div className="space-y-2">
            {Object.entries({
              DRAFT: "Жоба", REGISTRATION_OPEN: "Тіркеу ашық", REGISTRATION_CLOSED: "Тіркеу жабық",
              IN_PROGRESS: "LIVE", COMPLETED: "Аяқталды", CANCELLED: "Тоқтатылды",
            }).map(([k, l]) => {
              const count = tournamentByStatus[k] ?? 0;
              const total = Object.values(tournamentByStatus).reduce((s: number, x: any) => s + x, 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>

        <Panel title="Пайдаланушылар">
          <div className="space-y-2">
            {Object.entries({ ATHLETE: "Спортшы", COACH: "Жаттықтырушы", ADMIN: "Әкімші" }).map(([k, l]) => {
              const count = usersByRole[k] ?? 0;
              const total = Object.values(usersByRole).reduce((s: number, x: any) => s + x, 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>

        <Panel title="Матчтар">
          <div className="space-y-2">
            {Object.entries({ PENDING: "Күтуде", IN_PROGRESS: "LIVE", COMPLETED: "Аяқталды", CANCELLED: "Тоқтатылды" }).map(([k, l]) => {
              const count = matchesByStatus[k] ?? 0;
              const total = Object.values(matchesByStatus).reduce((s: number, x: any) => s + x, 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

function StatCard({ label, value, accent }: any) {
  return (
    <div className={`glass rounded-xl p-5 ${accent ? "border-gold/40" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
    </div>
  );
}

function Bar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>{value} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
