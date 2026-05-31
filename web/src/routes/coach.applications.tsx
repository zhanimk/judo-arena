import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { AlertTriangle, CheckCircle2, Clock3, Plus } from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/applications")({
  head: () => ({ meta: [{ title: "Өтінімдер — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachApplicationsRoute />
    </ProtectedRoute>
  ),
});


function CoachApplicationsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath !== "/coach/applications") {
    return <Outlet />;
  }

  return <CoachApplications />;
}

function CoachApplications() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");

  const appsQuery = useQuery({
    queryKey: ["my-club-applications"],
    queryFn: () => api.applications.myClub(),
  });
  const notificationsQuery = useQuery({
    queryKey: ["my-application-notifications"],
    queryFn: () => api.notifications.list(),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-application-notifications"] });
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
  });

  const apps = (appsQuery.data ?? []).map((a: any) => ({
    ...a,
    tournamentName: localizeName(a.tournament?.name),
  }));
  const filteredApps = useMemo(() => {
    if (statusFilter === "ALL") return apps;
    return apps.filter((a: any) => a.status === statusFilter);
  }, [apps, statusFilter]);
  const applicationNotifications = useMemo(
    () => (notificationsQuery.data ?? []).filter((n: any) => String(n.type).startsWith("application_")),
    [notificationsQuery.data],
  );
  const rejected = apps.filter((a: any) => a.status === "REJECTED").length;
  const pending = apps.filter((a: any) => a.status === "SUBMITTED").length;
  const approved = apps.filter((a: any) => a.status === "APPROVED").length;

  return (
    <DashboardShell role={t("roles.COACH")} navItems={nav} accentTitle={t("coach.applications_page_title")}>
      {applicationNotifications.length > 0 && (
        <div className="mb-6 grid gap-3">
          {applicationNotifications.slice(0, 3).map((n: any) => (
            <div
              key={n.id}
              className={`rounded-md border p-4 text-sm ${
                n.type === "application_rejected"
                  ? "border-destructive/40 bg-destructive/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {n.type === "application_rejected" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                    {n.titleKey}
                  </div>
                  <div className="mt-1 text-muted-foreground">{n.bodyKey}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString("kk-KZ")}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {n.payload?.applicationId && (
                    <Link
                      to="/coach/applications/$id"
                      params={{ id: n.payload.applicationId }}
                      className="rounded-md bg-gold/15 px-3 py-1.5 text-xs text-gold hover:bg-gold/20"
                    >
                      {t("coach.open_application")}
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("common.unread")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MiniStat icon={Clock3} label={t("coach.stat_pending")} value={pending} />
        <MiniStat icon={CheckCircle2} label={t("coach.stat_approved")} value={approved} ok />
        <MiniStat icon={AlertTriangle} label={t("applications.needs_correction")} value={rejected} danger />
      </div>

      <Panel
        title={`${t("common.all")} ${apps.length} ${t("applications.title").toLowerCase()}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/coach/tournaments"
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("coach.apply_tournament")}
            </Link>
            <div className="flex flex-wrap gap-2">
              {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    statusFilter === status ? "border-gold/50 bg-gold/15 text-gold" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "ALL" ? t("common.all") : String(t(`status.${status}`, status))}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {appsQuery.isLoading ? <LoadingState /> :
          filteredApps.length === 0 ? (
            <EmptyState title={t("applications.no_applications")} hint={t("coach.apply_hint")} />
          ) : (
            <ul className="space-y-3 text-sm">
              {filteredApps.map((a: any) => (
                <li key={a.id}>
                  <Link
                    to="/coach/applications/$id"
                    params={{ id: a.id }}
                    className="block glass rounded-md p-4 hover:border-gold/40 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-medium">{a.tournamentName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("common.athletes_count", { count: a._count?.entries ?? 0 })}
                          {a.submittedAt ? ` · ${t("applications.submitted")} ${new Date(a.submittedAt).toLocaleDateString("kk-KZ")}` : ""}
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.reviewerNotes && (
                      <div className={`mt-3 text-xs border-l-2 pl-3 ${a.status === "REJECTED" ? "border-destructive text-destructive" : "border-gold/40 text-muted-foreground"}`}>
                        «{a.reviewerNotes}»
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gold">{t("common.view")} →</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </Panel>
    </DashboardShell>
  );
}

function MiniStat({ icon: Icon, label, value, ok, danger }: { icon: any; label: string; value: number; ok?: boolean; danger?: boolean }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className={`h-4 w-4 ${danger ? "text-destructive" : ok ? "text-emerald-300" : "text-gold"}`} />
        {label}
      </div>
      <div className={`mt-2 font-display text-3xl font-bold ${danger ? "text-destructive" : ok ? "text-emerald-300" : ""}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-gold/15 text-gold border border-gold/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    REJECTED: "bg-destructive/15 text-destructive border border-destructive/40",
    WITHDRAWN: "bg-muted text-muted-foreground",
  };
  const cls = colors[status] ?? "bg-muted";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls} shrink-0`}>{String(t(`status.${status}`, status))}</span>;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
