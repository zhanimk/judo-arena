import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/admin/clubs/$id")({
  head: () => ({ meta: [{ title: "Клуб — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminClubDetail />
    </ProtectedRoute>
  ),
});



function AdminClubDetail() {
  const { id } = useParams({ from: "/admin/clubs/$id" });
  const query = useQuery({ queryKey: ["admin-club", id], queryFn: () => api.admin.getClub(id) });

  if (query.isLoading) return <DashboardShell role="Әкімші" navItems={nav} accentTitle="..."><LoadingState /></DashboardShell>;
  const c = query.data;
  if (!c) return <DashboardShell role="Әкімші" navItems={nav} accentTitle="—"><EmptyState title="Клуб табылмады" /></DashboardShell>;
  const coaches = (c.members ?? []).filter((m: any) => m.role === "COACH");
  const athletes = (c.members ?? []).filter((m: any) => m.role === "ATHLETE");

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle={localizeName(c.name)}>
      <Link to="/admin/clubs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowLeft className="h-4 w-4" /> Барлық клубтар
      </Link>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Спортшы" value={String(athletes.length)} accent />
        <StatCard label="Тренер" value={String(coaches.length)} />
        <StatCard label="Топ" value={String(c.groups?.length ?? 0)} />
        <StatCard label="Өтінімдер" value={String(c.applications?.length ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Жеке ақпарат">
          <div className="space-y-2 text-sm">
            <Field label="Атауы" value={localizeName(c.name)} />
            <Field label="Қала" value={`${c.city}, ${c.country}`} />
            <Field label="Жасаған" value={c.createdBy ? `${c.createdBy.name} ${c.createdBy.surname}` : "—"} />
            <Field label="Email" value={c.createdBy?.email ?? "—"} />
            <Field label="Тіркелген" value={new Date(c.createdAt).toLocaleDateString("kk-KZ")} />
            <Field label="Күй" value={c.isBlocked ? "Блокталған" : "Белсенді"} />
            {c.blockedReason && (
              <div className="text-xs text-destructive/80 border-l-2 border-destructive/40 pl-2 mt-2">
                {c.blockedReason}
              </div>
            )}
          </div>
        </Panel>

        <Panel title={`Тренерлер (${coaches.length})`}>
          {coaches.length === 0 ? <EmptyState title="Тренер жоқ" /> : (
            <ul className="space-y-2 text-sm">
              {coaches.map((m: any) => (
                <li key={m.id} className="flex justify-between glass rounded p-2.5">
                  <Link to="/admin/users/$id" params={{ id: m.id }} className="hover:text-gold">
                    {m.name} {m.surname}
                  </Link>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Спортшылар (${athletes.length})`}>
          {athletes.length === 0 ? <EmptyState title="Спортшылар жоқ" /> : (
            <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
              {athletes.map((m: any) => (
                <li key={m.id} className="flex justify-between glass rounded p-2.5">
                  <div>
                    <Link to="/admin/users/$id" params={{ id: m.id }} className="font-medium hover:text-gold">
                      {m.name} {m.surname}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {m.gender === "MALE" ? "Ер" : m.gender === "FEMALE" ? "Қыз" : "—"} · {m.weightKg ? `${m.weightKg} кг` : "салмақ жоқ"} · {m.beltRank ?? "белбеу жоқ"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-gold">{Math.round(m.totalPoints ?? 0)}</div>
                    <div className="text-[10px] text-muted-foreground">{!m.isActive ? "блок" : "ұпай"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel title={`Топтар (${c.groups?.length ?? 0})`}>
          {(c.groups ?? []).length === 0 ? <EmptyState title="Топтар жоқ" /> : (
            <div className="space-y-2 text-sm">
              {c.groups.map((g: any) => (
                <div key={g.id} className="rounded-md border border-border/60 bg-background/30 p-3">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.ageMin}-{g.ageMax} жас</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`Өтінімдер (${c.applications?.length ?? 0})`}>
          {(c.applications ?? []).length === 0 ? <EmptyState title="Әзірше өтінім жоқ" /> : (
            <ul className="space-y-2 text-sm">
              {c.applications.map((a: any) => (
                <li key={a.id} className="flex justify-between glass rounded p-3">
                  <div>
                    <div className="font-medium">{localizeName(a.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString("kk-KZ")} · {a._count?.entries ?? 0} спортшы
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full self-start ${
                    a.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-300" :
                    a.status === "REJECTED" ? "bg-destructive/15 text-destructive" :
                    a.status === "SUBMITTED" ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
                  }`}>{a.status}</span>
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

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
