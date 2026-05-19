import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, ArrowLeft, Lock, Unlock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/admin/users/$id")({
  head: () => ({ meta: [{ title: "Пайдаланушы — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminUserDetail />
    </ProtectedRoute>
  ),
});



function AdminUserDetail() {
  const { id } = useParams({ from: "/admin/users/$id" });
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const query = useQuery({ queryKey: ["admin-user", id], queryFn: () => api.admin.getUser(id) });
  const toggle = useMutation({
    mutationFn: () => api.admin.toggleUserActive(id, !query.data?.isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-user", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  if (query.isLoading) return <DashboardShell role="Әкімші" navItems={nav} accentTitle="..."><LoadingState /></DashboardShell>;
  const u = query.data;
  if (!u) return <DashboardShell role="Әкімші" navItems={nav} accentTitle="Табылмады"><EmptyState title="—" /></DashboardShell>;

  const totalPoints = (u.ratingEntries ?? []).reduce((s: number, e: any) => s + Number(e.points), 0);
  const totalMatches = (u._count?.redmatches ?? 0) + (u._count?.bluematches ?? 0);

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle={`${u.name} ${u.surname}`}>
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowLeft className="h-4 w-4" /> Пайдаланушылар
      </Link>

      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded ${u.role === "ADMIN" ? "bg-gold/15 text-gold" : u.role === "COACH" ? "bg-sky-500/15 text-sky-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                {u.role}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
                {u.isActive ? "Белсенді" : "Блокталған"}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">{u.email}</div>
          </div>
          <button onClick={() => toggle.mutate()} disabled={toggle.isPending}
            className={`text-sm px-4 py-1.5 rounded shadow inline-flex items-center gap-1.5 disabled:opacity-50 ${
              u.isActive ? "bg-destructive/15 text-destructive border border-destructive/40" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
            }`}>
            {u.isActive ? <><Lock className="h-4 w-4" /> Блоктау</> : <><Unlock className="h-4 w-4" /> Ашу</>}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <StatCard label="Дәреже" value={String(Math.round(totalPoints))} accent />
        <StatCard label="Жекпе-жек" value={String(totalMatches)} hint={`${u._count?.wonMatches ?? 0} жеңіс`} />
        <StatCard label="Жарыстар" value={String((u.ratingEntries ?? []).length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Жеке мәлімет">
          <div className="space-y-2 text-sm">
            <Field label="Аты-жөні" value={`${u.name} ${u.surname}`} />
            <Field label="Латиница" value={`${u.nameLatin ?? ""} ${u.surnameLatin ?? ""}`.trim() || "—"} />
            <Field label="Жыныс" value={u.gender === "MALE" ? "Ер" : u.gender === "FEMALE" ? "Әйел" : "—"} />
            <Field label="Туған күн" value={u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString("kk-KZ") : "—"} />
            <Field label="Салмақ" value={u.weightKg ? `${u.weightKg} кг` : "—"} />
            <Field label="Белбеу" value={u.beltRank ?? "—"} />
            <Field label="Телефон" value={u.phone ?? "—"} />
            <Field label="Клуб" value={u.club ? localizeName(u.club.name) : "—"} />
            <Field label="Тіркелген" value={new Date(u.createdAt).toLocaleDateString("kk-KZ")} />
          </div>
        </Panel>

        <Panel title="Турнирлік нәтижелер">
          {(u.ratingEntries ?? []).length === 0 ? (
            <EmptyState title="Қатысқан жарыстар жоқ" />
          ) : (
            <ul className="space-y-2 text-sm">
              {u.ratingEntries.map((e: any) => (
                <li key={e.id} className="flex justify-between glass rounded-md p-3">
                  <div>
                    <div className="font-medium">{localizeName(e.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">{placeLabel(e.place)}</div>
                  </div>
                  <span className="text-gold font-display text-lg">{Number(e.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function StatCard({ label, value, hint, accent }: any) {
  return (
    <div className={`glass rounded-xl p-5 ${accent ? "border-gold/40" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/20 pb-1.5 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function placeLabel(p: number): string {
  if (p === 1) return "🥇 1-орын";
  if (p === 2) return "🥈 2-орын";
  if (p === 3) return "🥉 3-орын";
  return `${p}-орын`;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
