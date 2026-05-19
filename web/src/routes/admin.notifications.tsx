import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, Send, Loader2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Хабарландыру жіберу — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminNotifications />
    </ProtectedRoute>
  ),
});



type Kind = "all" | "role" | "club" | "tournament";

function AdminNotifications() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("all");
  const [role, setRole] = useState<"ATHLETE" | "COACH">("ATHLETE");
  const [clubId, setClubId] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clubsQuery = useQuery({ queryKey: ["admin-clubs-list"], queryFn: () => api.clubs.list() });
  const tQuery = useQuery({ queryKey: ["admin-tournaments-list"], queryFn: () => api.tournaments.list() });
  const auditQuery = useQuery({
    queryKey: ["audit-notifications"],
    queryFn: () => api.admin.auditLogs({ action: "notification.broadcast", limit: 20 }),
  });
  const selectedTournament = (tQuery.data?.items ?? []).find((t: any) => t.id === tournamentId);

  const fillWeighInTemplate = () => {
    if (!selectedTournament) return;
    setKind("tournament");
    setTitle("Взвешивание туралы хабарландыру");
    setBody([
      `${localizeName(selectedTournament.name)} жарысына взвешивание:`,
      `Орын: ${selectedTournament.weighInLocation || selectedTournament.location}, ${selectedTournament.city}`,
      `Уақыты: ${formatWeighIn(selectedTournament)}`,
      selectedTournament.mapUrl ? `Карта: ${selectedTournament.mapUrl}` : null,
    ].filter(Boolean).join("\n"));
  };

  const send = useMutation({
    mutationFn: () => {
      const base: any = { title, body, type: "announcement" };
      if (kind === "all") return api.notifications.broadcast({ ...base, kind: "all" });
      if (kind === "role") return api.notifications.broadcast({ ...base, kind: "role", role });
      if (kind === "club") return api.notifications.broadcast({ ...base, kind: "club", clubId });
      return api.notifications.broadcast({ ...base, kind: "tournament", tournamentId, type: "tournament_update" });
    },
    onSuccess: (r) => {
      setSuccess(`✓ ${r.count} адамға жіберілді`);
      setTitle(""); setBody(""); setError("");
      qc.invalidateQueries({ queryKey: ["audit-notifications"] });
      setTimeout(() => setSuccess(""), 4000);
    },
    onError: (e: any) => { setError(e instanceof ApiError ? e.message : "Қате"); setSuccess(""); },
  });

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Хабарландыру жіберу">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Жаңа хабарландыру">
          <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Аудитория</label>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {(["all", "role", "club", "tournament"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setKind(k)}
                    className={`py-2 rounded text-xs border ${kind === k ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}>
                    {k === "all" ? "Барлығы" : k === "role" ? "Рөл" : k === "club" ? "Клуб" : "Жарыс"}
                  </button>
                ))}
              </div>
            </div>

            {kind === "role" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Рөл</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["ATHLETE", "COACH"] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={`py-2 rounded text-xs border ${role === r ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}>
                      {r === "ATHLETE" ? "Спортшылар" : "Жаттықтырушылар"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {kind === "club" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Клуб</label>
                <select value={clubId} onChange={(e) => setClubId(e.target.value)} required
                  className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none">
                  <option value="">Таңдау...</option>
                  {(clubsQuery.data?.items ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{localizeName(c.name)} · {c.city}</option>
                  ))}
                </select>
              </div>
            )}

            {kind === "tournament" && (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Жарыс</label>
                <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} required
                  className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none">
                  <option value="">Таңдау...</option>
                  {(tQuery.data?.items ?? []).map((t: any) => (
                    <option key={t.id} value={t.id}>{localizeName(t.name)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fillWeighInTemplate}
                  disabled={!selectedTournament}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" /> Взвешивание шаблоны
                </button>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Тақырып</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100}
                className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Мәтін</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={5} maxLength={2000}
                className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}
            {success && <div className="text-sm text-emerald-300">{success}</div>}

            <button type="submit" disabled={send.isPending}
              className="bg-gradient-gold text-gold-foreground px-5 py-2.5 rounded font-medium shadow-gold inline-flex items-center gap-2 disabled:opacity-50">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Жіберу
            </button>
          </form>
        </Panel>

        <Panel title="Соңғы рассылкалар">
          {auditQuery.isLoading ? <LoadingState /> :
            (auditQuery.data?.items ?? []).length === 0 ? <EmptyState title="Әзірше рассылкалар жоқ" /> : (
              <ul className="space-y-2 text-sm max-h-[500px] overflow-y-auto">
                {(auditQuery.data?.items ?? []).map((a: any) => (
                  <li key={a.id} className="glass rounded p-2.5">
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("kk-KZ")}
                    </div>
                    <div className="text-xs">{a.actor?.name ?? "—"}</div>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }

function formatWeighIn(t: any): string {
  const start = t.weighInStart ? new Date(t.weighInStart).toLocaleString("kk-KZ") : "";
  const end = t.weighInEnd ? new Date(t.weighInEnd).toLocaleString("kk-KZ") : "";
  return start && end ? `${start} — ${end}` : start || "уақыт көрсетілмеген";
}
