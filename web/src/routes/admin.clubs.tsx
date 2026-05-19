import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, Lock, Unlock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/admin/clubs")({
  head: () => ({ meta: [{ title: "Клубтар — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminClubs />
    </ProtectedRoute>
  ),
});



function AdminClubs() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [blockModal, setBlockModal] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");

  const query = useQuery({ queryKey: ["admin-clubs"], queryFn: () => api.clubs.list() });

  const blockMut = useMutation({
    mutationFn: ({ id, blocked, reason }: { id: string; blocked: boolean; reason?: string }) =>
      api.admin.blockClub(id, blocked, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-clubs"] }); setBlockModal(null); setReason(""); },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Барлық клубтар">
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      <Panel title={`${query.data?.total ?? 0} клуб`}>
        {query.isLoading ? <LoadingState /> :
          (query.data?.items ?? []).length === 0 ? <EmptyState title="Клубтар жоқ" /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {query.data!.items.map((c: any) => (
                <div key={c.id} className={`glass rounded-xl p-5 ${c.isBlocked ? "border-destructive/40" : ""}`}>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <Link to="/admin/clubs/$id" params={{ id: c.id }}
                      className="font-display text-lg font-semibold hover:text-gold">
                      {localizeName(c.name)}
                    </Link>
                    {c.isBlocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Блок</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.city}, {c.country}</div>
                  {c.blockedReason && (
                    <div className="mt-2 text-xs text-destructive/80 border-l-2 border-destructive/40 pl-2">
                      {c.blockedReason}
                    </div>
                  )}
                  <div className="mt-3 flex justify-between items-center">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Спортшы: </span>
                      <span className="text-gold font-display text-lg">{c._count?.members ?? 0}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Link to="/admin/clubs/$id" params={{ id: c.id }}
                        className="text-xs px-2.5 py-1 rounded glass border border-border hover:border-gold/40">
                        Толық
                      </Link>
                      {c.isBlocked ? (
                        <button onClick={() => blockMut.mutate({ id: c.id, blocked: false })}
                          className="text-xs px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                          <Unlock className="h-3 w-3" /> Ашу
                        </button>
                      ) : (
                        <button onClick={() => { setBlockModal({ id: c.id, name: localizeName(c.name) }); setError(""); }}
                          className="text-xs px-2.5 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Блок
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Panel>

      {/* Block modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4"
          onClick={() => setBlockModal(null)}>
          <div className="glass rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-3">«{blockModal.name}» клубын блоктау</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Блокталған клуб жаңа өтінімдер жібере алмайды.
            </p>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Себебі</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder="Блоктау себебі..." />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setBlockModal(null); setReason(""); }}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => blockMut.mutate({ id: blockModal.id, blocked: true, reason })}
                disabled={blockMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive/20 text-destructive border border-destructive/40 disabled:opacity-50">
                Блоктау
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
