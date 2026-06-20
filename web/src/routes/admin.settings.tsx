import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { Save, Loader2, ShieldCheck, ShieldOff, DatabaseBackup, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Баптаулар — Әкімші" }] }),
  errorComponent: RouteErrorUI,
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
    onError: (e: unknown) => {
      const m = e instanceof ApiError ? e.message : t("error.generic");
      setError(m); setSuccess(""); toast.error(m);
    },
  });

  return (
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("admin.settings_title")}>
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}
      {success && <div className="mb-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-3">{success}</div>}

      {/* Security panels */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <TwoFactorPanel />
        <BackupPanel />
      </div>

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

// ─── BackupPanel ──────────────────────────────────────────────────────────────

function BackupPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [lastResult, setLastResult] = useState<{ filename: string; sizeBytes: number; durationMs: number } | null>(null);

  const trigger = async () => {
    setStatus("running");
    try {
      const res = await api.admin.triggerBackup();
      setLastResult(res as typeof lastResult);
      setStatus("success");
      toast.success(t("admin.backup_success"));
    } catch (e: unknown) {
      setStatus("error");
      toast.error(e instanceof Error ? e.message : t("admin.backup_error"));
    }
  };

  return (
    <Panel title={t("admin.backup_title")}>
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">
          {t("admin.backup_schedule")}{" "}
          {status === "success" && lastResult && (
            <span className="text-emerald-500">
              {t("admin.backup_last", { filename: lastResult.filename, size: (lastResult.sizeBytes / 1024 / 1024).toFixed(2) })}
            </span>
          )}
          {status === "error" && (
            <span className="text-destructive">{t("admin.backup_error")}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {status === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          {status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
          {status === "running" && <Loader2 className="h-5 w-5 animate-spin text-gold" />}
          {status === "idle" && <DatabaseBackup className="h-5 w-5 text-muted-foreground" />}

          <button
            onClick={trigger}
            disabled={status === "running"}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50"
          >
            {status === "running" ? t("admin.backup_creating") : t("admin.backup_create_now")}
          </button>
        </div>
      </div>
    </Panel>
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

// ─── TwoFactorPanel ───────────────────────────────────────────────────────────

export function TwoFactorPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [code, setCode] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  const statusQ = useQuery({
    queryKey: ["2fa-status"],
    queryFn: () => api.auth.twofa.status(),
  });

  const setupMut = useMutation({
    mutationFn: () => api.auth.twofa.setup(),
    onSuccess: (data) => {
      setQrUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep("setup");
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : t("error.generic")),
  });

  const verifyMut = useMutation({
    mutationFn: (c: string) => api.auth.twofa.verifySetup(c),
    onSuccess: () => {
      toast.success(t("2fa.enabled_success"));
      setStep("idle"); setCode(""); setQrUrl(""); setSecret("");
      qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : t("2fa.invalid_code")),
  });

  const disableMut = useMutation({
    mutationFn: (c: string) => api.auth.twofa.disable(c),
    onSuccess: () => {
      toast.success(t("2fa.disabled_success"));
      setStep("idle"); setCode("");
      qc.invalidateQueries({ queryKey: ["2fa-status"] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : t("2fa.invalid_code")),
  });

  const enabled = statusQ.data?.enabled ?? false;

  return (
    <Panel title={t("2fa.title")}>
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          {enabled
            ? <ShieldCheck className="h-5 w-5 text-emerald-500" />
            : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
          <span className={`text-sm font-semibold ${enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
            {enabled ? t("2fa.status_on") : t("2fa.status_off")}
          </span>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Setup flow */}
        {step === "idle" && !enabled && (
          <button
            onClick={() => { setError(""); setupMut.mutate(); }}
            disabled={setupMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-gold/10 border border-gold/30 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {setupMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {t("2fa.btn_enable")}
          </button>
        )}

        {step === "setup" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {t("2fa.scan_qr")}
            </div>
            {qrUrl && (
              <img src={qrUrl} alt="QR code" className="w-48 h-48 rounded-lg border border-border/40" />
            )}
            {secret && (
              <div className="rounded-md bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                {t("2fa.secret_key")}: {secret}
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("2fa.enter_code")}:
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-36 bg-input border border-border rounded px-3 py-2 text-center font-mono text-lg tracking-[0.4em] focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setError(""); verifyMut.mutate(code); }}
                disabled={code.length !== 6 || verifyMut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {verifyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("common.confirm")}
              </button>
              <button
                onClick={() => { setStep("idle"); setCode(""); setQrUrl(""); setSecret(""); setError(""); }}
                className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Disable flow */}
        {step === "idle" && enabled && (
          <button
            onClick={() => { setStep("disable"); setError(""); }}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
          >
            <ShieldOff className="h-4 w-4" />
            {t("2fa.btn_disable")}
          </button>
        )}

        {step === "disable" && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{t("2fa.enter_code_disable")}:</div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoFocus
              className="w-36 bg-input border border-border rounded px-3 py-2 text-center font-mono text-lg tracking-[0.4em] focus:border-destructive focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setError(""); disableMut.mutate(code); }}
                disabled={code.length !== 6 || disableMut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                {disableMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("common.disable")}
              </button>
              <button
                onClick={() => { setStep("idle"); setCode(""); setError(""); }}
                className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
