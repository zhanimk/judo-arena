import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/admin/applications")({
  head: () => ({ meta: [{ title: "Өтінімдер — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminApplications />
    </ProtectedRoute>
  ),
});



function AdminApplications() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tournamentFilter, setTournamentFilter] = useState<string>("");
  const [modal, setModal] = useState<{ id: string; action: "approve" | "reject"; club: string } | null>(null);
  const [comment, setComment] = useState("");

  const tQuery = useQuery({ queryKey: ["admin-tournaments-for-apps"], queryFn: () => api.tournaments.list() });

  const appsQuery = useQuery({
    queryKey: ["admin-all-applications", (tQuery.data?.items ?? []).map((t: any) => t.id).join(",")],
    queryFn: async () => {
      const all: any[] = [];
      for (const t of tQuery.data?.items ?? []) {
        try {
          const apps = await api.tournaments.applications(t.id);
          for (const a of apps) all.push({ ...a, tournamentName: localizeName(t.name), tournamentId: t.id });
        } catch { /* ignore */ }
      }
      return all;
    },
    enabled: (tQuery.data?.items ?? []).length > 0,
  });

  const approve = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.applications.approve(id, notes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-all-applications"] }); setModal(null); setComment(""); },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });
  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.applications.reject(id, notes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-all-applications"] }); setModal(null); setComment(""); },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const filtered = useMemo(() => {
    return (appsQuery.data ?? []).filter((a: any) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (tournamentFilter && a.tournamentId !== tournamentFilter) return false;
      return true;
    });
  }, [appsQuery.data, statusFilter, tournamentFilter]);

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Өтінімдерді басқару">
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      <Panel
        title={`Барлығы ${filtered.length}`}
        action={
          <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">Барлық мәртебелер</option>
              <option value="DRAFT">Жоба</option>
              <option value="SUBMITTED">Қарауда</option>
              <option value="APPROVED">Бекітілді</option>
              <option value="REJECTED">Қайтарылды</option>
              <option value="WITHDRAWN">Алынды</option>
            </select>
            <select value={tournamentFilter} onChange={(e) => setTournamentFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">Барлық жарыстар</option>
              {(tQuery.data?.items ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>{localizeName(t.name)}</option>
              ))}
            </select>
          </div>
        }
      >
        {appsQuery.isLoading ? <LoadingState /> :
          filtered.length === 0 ? <EmptyState title="Өтінімдер жоқ" /> : (
            <div className="space-y-2">
              {filtered.map((a: any) => (
                <div key={a.id} className="glass rounded-lg p-4">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div>
                      <div className="font-medium">{localizeName(a.club?.name)}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.tournamentName} · {a._count?.entries ?? 0} спортшы
                        {a.submittedAt ? ` · ${new Date(a.submittedAt).toLocaleDateString("kk-KZ")}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.reviewerNotes && (
                    <div className="text-xs text-muted-foreground border-l-2 border-gold/40 pl-3 mb-2">
                      «{a.reviewerNotes}»
                    </div>
                  )}
                  {a.status === "SUBMITTED" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { setModal({ id: a.id, action: "approve", club: localizeName(a.club?.name) }); setError(""); }}
                        className="text-xs px-3 py-1.5 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25">
                        ✓ Бекіту
                      </button>
                      <button onClick={() => { setModal({ id: a.id, action: "reject", club: localizeName(a.club?.name) }); setError(""); }}
                        className="text-xs px-3 py-1.5 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">
                        ✕ Қайтару
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </Panel>

      {modal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4"
          onClick={() => setModal(null)}>
          <div className="glass rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-2">
              {modal.action === "approve" ? "Бекіту" : "Қайтару"}: {modal.club}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {modal.action === "approve" ? "Клуб өтінімін бекіту үшін түсініктеме қалдырыңыз." : "Қайтару себебін көрсетіңіз."}
            </p>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Түсініктеме</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder={modal.action === "approve" ? "Барлығы рет, сәттілік!" : "Себебі..."} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => {
                if (modal.action === "approve") approve.mutate({ id: modal.id, notes: comment });
                else reject.mutate({ id: modal.id, notes: comment });
              }}
                disabled={approve.isPending || reject.isPending}
                className={`text-sm px-4 py-2 rounded shadow disabled:opacity-50 ${
                  modal.action === "approve"
                    ? "bg-gold/20 text-gold border border-gold/40"
                    : "bg-destructive/20 text-destructive border border-destructive/40"
                }`}>
                {modal.action === "approve" ? "Бекіту" : "Қайтару"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    SUBMITTED: { c: "bg-gold/15 text-gold border border-gold/30", l: "Қарауда" },
    APPROVED: { c: "bg-emerald-500/15 text-emerald-300", l: "Бекітілді" },
    REJECTED: { c: "bg-destructive/15 text-destructive", l: "Қайтарылды" },
    WITHDRAWN: { c: "bg-muted text-muted-foreground", l: "Алынды" },
  };
  const x = m[status] ?? { c: "bg-muted", l: status };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${x.c} shrink-0 self-start`}>{x.l}</span>;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
