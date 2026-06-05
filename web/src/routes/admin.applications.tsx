import { createFileRoute } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/admin/applications")({
  head: () => ({ meta: [{ title: "Өтінімдер — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminApplications />
    </ProtectedRoute>
  ),
});

function AdminApplications() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tournamentFilter, setTournamentFilter] = useState<string>("");
  const [modal, setModal] = useState<{
    id: string;
    action: "approve" | "reject";
    club: string;
  } | null>(null);
  const [comment, setComment] = useState("");

  const tQuery = useQuery({
    queryKey: ["admin-tournaments-for-apps"],
    queryFn: () => api.tournaments.list(),
  });

  const appsQuery = useQuery({
    queryKey: ["admin-all-applications"],
    queryFn: async () => {
      const apps = await api.admin.allApplications();
      return apps.map((a: any) => ({
        ...a,
        tournamentName: localizeName(a.tournament?.name),
        tournamentId: a.tournament?.id ?? a.tournamentId,
      }));
    },
  });

  const approve = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.applications.approve(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-applications"] });
      setModal(null);
      setComment("");
      toast.success(t("applications.approved") + " ✓");
    },
    onError: (e: any) => {
      const m = e instanceof ApiError ? e.message : t("error.generic");
      setError(m);
      toast.error(m);
    },
  });
  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.applications.reject(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-applications"] });
      setModal(null);
      setComment("");
      toast.success(t("applications.rejected"));
    },
    onError: (e: any) => {
      const m = e instanceof ApiError ? e.message : t("error.generic");
      setError(m);
      toast.error(m);
    },
  });
  const bulkApprove = useMutation({
    mutationFn: (tournamentId: string) => api.tournaments.bulkApprove(tournamentId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-all-applications"] });
      setError("");
      if (data.approved === 0) {
        toast.warning(t("applications.bulk_approve_none"));
      } else {
        toast.success(t("applications.bulk_approved", { count: data.approved }));
      }
    },
    onError: (e: any) => {
      const m = e instanceof ApiError ? e.message : t("error.generic");
      setError(m);
      toast.error(m);
    },
  });
  const markPaid = useMutation({
    mutationFn: (id: string) => api.applications.markPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-applications"] });
      setError("");
      toast.success(t("payments.marked_paid"));
    },
    onError: (e: any) => {
      const m = e instanceof ApiError ? e.message : t("error.generic");
      setError(m);
      toast.error(m);
    },
  });

  const filtered = useMemo(() => {
    return (appsQuery.data ?? []).filter((a: any) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (tournamentFilter && a.tournamentId !== tournamentFilter) return false;
      return true;
    });
  }, [appsQuery.data, statusFilter, tournamentFilter]);

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("applications.manage_title")}
    >
      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <Panel
        title={t("applications.total", { count: filtered.length })}
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("applications.all_statuses")}</option>
              <option value="DRAFT">{t("status.DRAFT")}</option>
              <option value="SUBMITTED">{t("status.SUBMITTED")}</option>
              <option value="APPROVED">{t("status.APPROVED")}</option>
              <option value="REJECTED">{t("status.REJECTED")}</option>
              <option value="WITHDRAWN">{t("status.WITHDRAWN")}</option>
            </select>
            <select
              value={tournamentFilter}
              onChange={(e) => setTournamentFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("applications.all_tournaments")}</option>
              {(tQuery.data?.items ?? []).map((tournament: any) => (
                <option key={tournament.id} value={tournament.id}>
                  {localizeName(tournament.name)}
                </option>
              ))}
            </select>
            {tournamentFilter && (
              <button
                onClick={() => {
                  const submittedCount = (appsQuery.data ?? []).filter(
                    (a: any) => a.tournamentId === tournamentFilter && a.status === "SUBMITTED",
                  ).length;
                  if (submittedCount === 0) {
                    setError(t("applications.bulk_approve_none"));
                    return;
                  }
                  if (
                    window.confirm(
                      t("applications.bulk_approve_confirm", { count: submittedCount }),
                    )
                  ) {
                    bulkApprove.mutate(tournamentFilter);
                  }
                }}
                disabled={bulkApprove.isPending}
                className="text-sm px-3 py-1.5 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 disabled:opacity-50 font-medium"
              >
                {bulkApprove.isPending
                  ? t("common.loading")
                  : `✓ ${t("applications.bulk_approve_btn")}`}
              </button>
            )}
          </div>
        }
      >
        {appsQuery.isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState title={t("applications.empty")} />
        ) : (
          <div className="space-y-2">
            {filtered.map((a: any) => (
              <div key={a.id} className="glass rounded-lg p-4">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div>
                    <div className="font-medium">{localizeName(a.club?.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.tournamentName} · {a._count?.entries ?? 0}{" "}
                      {t("applications.athletes_count")}
                      {a.submittedAt
                        ? ` · ${new Date(a.submittedAt).toLocaleDateString("kk-KZ")}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <PaymentBadge status={a.paymentStatus} amount={a.paymentAmountKzt} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                {a.reviewerNotes && (
                  <div className="text-xs text-muted-foreground border-l-2 border-gold/40 pl-3 mb-2">
                    «{a.reviewerNotes}»
                  </div>
                )}
                {a.paymentAmountKzt > 0 && a.paymentReference && (
                  <div className="mb-2 text-xs text-muted-foreground">
                    {t("payments.reference")}: {a.paymentReference}
                  </div>
                )}
                {a.status === "SUBMITTED" && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {a.paymentAmountKzt > 0 && a.paymentStatus !== "PAID" && (
                      <button
                        onClick={() => markPaid.mutate(a.id)}
                        disabled={markPaid.isPending}
                        className="text-xs px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        {t("payments.mark_paid")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setModal({ id: a.id, action: "approve", club: localizeName(a.club?.name) });
                        setError("");
                      }}
                      disabled={a.paymentAmountKzt > 0 && a.paymentStatus !== "PAID"}
                      className="text-xs px-3 py-1.5 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25"
                    >
                      ✓ {t("applications.approve_btn")}
                    </button>
                    <button
                      onClick={() => {
                        setModal({ id: a.id, action: "reject", club: localizeName(a.club?.name) });
                        setError("");
                      }}
                      className="text-xs px-3 py-1.5 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
                    >
                      ✕ {t("applications.reject_btn")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {modal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="glass rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold mb-2">
              {modal.action === "approve"
                ? t("applications.approve_btn")
                : t("applications.reject_btn")}
              : {modal.club}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {modal.action === "approve"
                ? t("applications.approve_hint")
                : t("applications.reject_hint")}
            </p>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("applications.comment_label")}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder={
                modal.action === "approve"
                  ? t("applications.approve_placeholder")
                  : t("applications.reject_placeholder")
              }
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="text-sm px-4 py-2 rounded glass border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => {
                  if (modal.action === "approve") approve.mutate({ id: modal.id, notes: comment });
                  else reject.mutate({ id: modal.id, notes: comment });
                }}
                disabled={approve.isPending || reject.isPending}
                className={`text-sm px-4 py-2 rounded shadow disabled:opacity-50 ${
                  modal.action === "approve"
                    ? "bg-gold/20 text-gold border border-gold/40"
                    : "bg-destructive/20 text-destructive border border-destructive/40"
                }`}
              >
                {modal.action === "approve"
                  ? t("applications.approve_btn")
                  : t("applications.reject_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-gold/15 text-gold border border-gold/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300",
    REJECTED: "bg-destructive/15 text-destructive",
    WITHDRAWN: "bg-muted text-muted-foreground",
  };
  const color = colors[status] ?? "bg-muted";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${color} shrink-0 self-start`}>
      {t(`status.${status}`, status)}
    </span>
  );
}

function PaymentBadge({ status, amount }: { status: string; amount: number }) {
  const { t } = useTranslation();
  const normalized = status || "NOT_REQUIRED";
  const colors: Record<string, string> = {
    NOT_REQUIRED: "bg-muted text-muted-foreground",
    PENDING: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    PAID: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    FAILED: "bg-destructive/15 text-destructive border border-destructive/30",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full ${colors[normalized] ?? colors.NOT_REQUIRED} shrink-0 self-start`}
    >
      {amount > 0 ? `${formatKzt(amount)} · ` : ""}
      {t(`payments.status_${normalized}`, normalized)}
    </span>
  );
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function formatKzt(value: number): string {
  return new Intl.NumberFormat("ru-KZ").format(value).replace(/\s/g, " ") + " ₸";
}
