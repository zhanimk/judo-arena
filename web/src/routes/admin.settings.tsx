import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { Save, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
  const { t } = useTranslation();
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
      setSuccess(t("settings.saved"));
      setError("");
      qc.invalidateQueries({ queryKey: ["system-config", "ratingPoints"] });
      setTimeout(() => setSuccess(""), 3000);
      toast.success(t("settings.saved"));
    },
    onError: (e: any) => {
      const m = e instanceof ApiError ? e.message : t("error.generic");
      setError(m); setSuccess(""); toast.error(m);
    },
  });

  return (
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("admin.settings_title")}>
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}
      {success && <div className="mb-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-3">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("admin.rating_points_title")}>
          {configQuery.isLoading ? <LoadingState /> : (
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
              <PointsRow label={t("admin.points_place1")} value={points.place1} onChange={(v) => setPoints({...points, place1: v})} />
              <PointsRow label={t("admin.points_place2")} value={points.place2} onChange={(v) => setPoints({...points, place2: v})} />
              <PointsRow label={t("admin.points_place3")} value={points.place3} onChange={(v) => setPoints({...points, place3: v})} />
              <PointsRow label={t("admin.points_place3_loss")} value={points.place3Loss} onChange={(v) => setPoints({...points, place3Loss: v})} />
              <PointsRow label={t("admin.points_repechage")} value={points.place7Repechage} onChange={(v) => setPoints({...points, place7Repechage: v})} />
              <PointsRow label={t("admin.points_participation")} value={points.participation} onChange={(v) => setPoints({...points, participation: v})} />
              <PointsRow label={t("admin.points_ippon_bonus")} value={points.ipponBonus ?? 0} onChange={(v) => setPoints({...points, ipponBonus: v})} />

              <button type="submit" disabled={save.isPending}
                className="w-full bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("common.save")}
              </button>
            </form>
          )}
        </Panel>

        <Panel title={t("admin.ijf_rules_title")}>
          <div className="space-y-2 text-sm">
            <Row label="Ippon" value="= immediate win" />
            <Row label="Waza-ari × 2" value="= Ippon" />
            <Row label="Shido × 3" value="= Hansoku-make" />
            <Row label="Osaekomi 5s" value="Yuko (optional)" />
            <Row label="Osaekomi 10s" value="Waza-ari" />
            <Row label="Osaekomi 20s" value="Ippon" />
            <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
              {t("admin.ijf_rules_note")}
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
