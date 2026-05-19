import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, Save, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Баптаулар — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminSettings />
    </ProtectedRoute>
  ),
});



interface RatingPoints {
  place1: number;
  place2: number;
  place3: number;
  place3Loss: number;
  place7Repechage: number;
  participation: number;
  ipponBonus?: number;
}

const DEFAULT_POINTS: RatingPoints = {
  place1: 100, place2: 80, place3: 50,
  place3Loss: 30, place7Repechage: 15, participation: 0, ipponBonus: 0,
};

function AdminSettings() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [points, setPoints] = useState<RatingPoints>(DEFAULT_POINTS);

  const configQuery = useQuery({
    queryKey: ["system-config", "ratingPoints"],
    queryFn: () => api.admin.getConfig("ratingPoints"),
  });

  useEffect(() => {
    if (configQuery.data?.value) {
      setPoints({ ...DEFAULT_POINTS, ...(configQuery.data.value as RatingPoints) });
    }
  }, [configQuery.data]);

  const save = useMutation({
    mutationFn: () => api.admin.updateConfig("ratingPoints", points),
    onSuccess: () => {
      setSuccess("✓ Сақталды");
      setError("");
      qc.invalidateQueries({ queryKey: ["system-config", "ratingPoints"] });
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (e: any) => { setError(e instanceof ApiError ? e.message : "Қате"); setSuccess(""); },
  });

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Жүйе баптаулары">
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}
      {success && <div className="mb-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-3">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ұпай жүйесі (рейтинг)">
          {configQuery.isLoading ? <LoadingState /> : (
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
              <PointsRow label="1-орын (Алтын)" value={points.place1} onChange={(v) => setPoints({...points, place1: v})} />
              <PointsRow label="2-орын (Күміс)" value={points.place2} onChange={(v) => setPoints({...points, place2: v})} />
              <PointsRow label="3-орын (Қола)" value={points.place3} onChange={(v) => setPoints({...points, place3: v})} />
              <PointsRow label="3-орын үшін жеңіліс" value={points.place3Loss} onChange={(v) => setPoints({...points, place3Loss: v})} />
              <PointsRow label="Жұбату (Repechage)" value={points.place7Repechage} onChange={(v) => setPoints({...points, place7Repechage: v})} />
              <PointsRow label="Қатысу" value={points.participation} onChange={(v) => setPoints({...points, participation: v})} />
              <PointsRow label="Ippon бонусы (опц.)" value={points.ipponBonus ?? 0} onChange={(v) => setPoints({...points, ipponBonus: v})} />

              <button type="submit" disabled={save.isPending}
                className="w-full bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Сақтау
              </button>
            </form>
          )}
        </Panel>

        <Panel title="IJF ережелері (анықтама)">
          <div className="space-y-2 text-sm">
            <Row label="Ippon" value="Лезде жеңіс" />
            <Row label="Waza-ari × 2" value="Ippon = жеңіс" />
            <Row label="Shido × 3" value="Hansoku-make = жеңіліс" />
            <Row label="Osaekomi 5 сек" value="Yuko (опционалды)" />
            <Row label="Osaekomi 10 сек" value="Waza-ari" />
            <Row label="Osaekomi 20 сек" value="Ippon (лезде жеңіс)" />
            <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
              Бұл ережелер сервердің bracket-engine модулінде кодталған. Өзгерту үшін көзден өзгерту керек.
            </div>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

function PointsRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex justify-between items-center gap-3 border-b border-border/20 pb-2 last:border-0">
      <label className="text-sm text-muted-foreground flex-1">{label}</label>
      <input type="number" step="1" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-input border border-border rounded px-2 py-1.5 text-sm font-display text-gold focus:border-gold focus:outline-none" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/30 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-gold font-medium">{value}</span>
    </div>
  );
}
