import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  GitBranch,
  MapPin,
  Plus,
} from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tournament, Application, Notification } from "@/lib/api-types";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/coach/tournaments")({
  head: () => ({ meta: [{ title: "Жарыстар мен Өтінімдер — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachTournamentsRoute />
    </ProtectedRoute>
  ),
});

function CoachTournamentsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath !== "/coach/tournaments") {
    return <Outlet />;
  }

  return <CoachTournaments />;
}

function CoachTournaments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tournaments" | "applications">("tournaments");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Tournaments queries
  const tQuery = useQuery({
    queryKey: ["tournaments-public"],
    queryFn: () => api.tournaments.list({ limit: 1000 }),
  });
  const myAppsQuery = useQuery({
    queryKey: ["my-club-applications"],
    queryFn: () => api.applications.myClub(),
  });

  // Applications notifications
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

  const appByTournament = new Map(
    (myAppsQuery.data ?? []).map((a: Application) => [a.tournamentId, a]),
  );

  const apps = (myAppsQuery.data ?? []).map((a: Application) => ({
    ...a,
    tournamentName: localizeName(a.tournament?.name),
  }));
  const filteredApps = useMemo(() => {
    if (statusFilter === "ALL") return apps;
    return apps.filter((a: Application) => a.status === statusFilter);
  }, [apps, statusFilter]);

  const applicationNotifications = useMemo(
    () =>
      (notificationsQuery.data ?? []).filter((n: Notification) =>
        String(n.type).startsWith("application_"),
      ),
    [notificationsQuery.data],
  );

  const rejected = apps.filter((a: Application) => a.status === "REJECTED").length;
  const pending = apps.filter((a: Application) => a.status === "SUBMITTED").length;
  const approved = apps.filter((a: Application) => a.status === "APPROVED").length;

  return (
    <DashboardShell
      role={t("roles.COACH")}
      navItems={nav}
      accentTitle={t("tournaments_page.all_tournaments")}
    >
      <div className="mb-6 flex space-x-2 border-b border-border/40 pb-px overflow-x-auto">
        <button
          onClick={() => setTab("tournaments")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
            tab === "tournaments"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
          }`}
        >
          {t("dashboard.tournaments")}
        </button>
        <button
          onClick={() => setTab("applications")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            tab === "applications"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60"
          }`}
        >
          {t("dashboard.applications")}
          {applicationNotifications.some((n: Notification) => !n.read) && (
            <span className="w-2 h-2 rounded-full bg-destructive"></span>
          )}
        </button>
      </div>

      {tab === "tournaments" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
          <Panel title={t("dashboard.tournaments")}>
            {tQuery.isLoading ? (
              <LoadingState />
            ) : (tQuery.data?.items ?? []).length === 0 ? (
              <EmptyState title={t("tournament.no_tournaments")} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tQuery.data!.items.map((tournament: Tournament) => {
                  const deadline = tournament.applicationDeadline ?? tournament.startDate;
                  const deadlinePassed = new Date(deadline).getTime() < Date.now();
                  const existingApp = appByTournament.get(tournament.id);
                  const categoryCount = tournament._count?.categories ?? 0;
                  const canApply =
                    tournament.status === "REGISTRATION_OPEN" &&
                    !deadlinePassed &&
                    !existingApp &&
                    categoryCount > 0;

                  return (
                    <div
                      key={tournament.id}
                      className="glass rounded-xl p-5 flex flex-col border border-border/60"
                    >
                      <Link
                        to="/coach/tournaments/$id"
                        params={{ id: tournament.id }}
                        className="font-display text-xl font-semibold mb-3 hover:text-gold leading-tight"
                      >
                        {localizeName(tournament.name)}
                      </Link>

                      <div className="space-y-2 text-sm text-muted-foreground flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                          {dateRange(tournament.startDate, tournament.endDate)}
                        </div>
                        <div
                          className={`flex items-center gap-2 ${deadlinePassed && tournament.status === "REGISTRATION_OPEN" ? "text-destructive" : ""}`}
                        >
                          <Clock className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                          {t("common.deadline")}: {new Date(deadline).toLocaleString("kk-KZ")}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                          {tournament.location || tournament.city}
                        </div>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3.5 w-3.5 text-gold/70 shrink-0" />
                          {tournament._count?.categories ?? 0} {t("common.category").toLowerCase()}{" "}
                          · {tournament.tatamiCount ?? 1} {t("common.tatami")}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap justify-between items-center gap-2">
                        <TournamentStatusBadge status={tournament.status} />

                        <div className="flex gap-2">
                          <Link
                            to="/coach/tournaments/$id"
                            params={{ id: tournament.id }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-gold/50 hover:text-gold"
                          >
                            {t("common.view")} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>

                          {existingApp ? (
                            <Link
                              to="/coach/applications/$id"
                              params={{ id: existingApp.id }}
                              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs border ${applicationButtonStyle(existingApp.status)}`}
                            >
                              <ApplicationStatusIcon status={existingApp.status} />
                              {String(t(`status.${existingApp.status}`, existingApp.status))}
                            </Link>
                          ) : canApply ? (
                            <button
                              onClick={() => {
                                // Instead of linking to the tournament application immediately, we just go to tournament detail and they apply there, or directly if route handles it.
                                // It was /coach/tournaments/$id
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-gradient-gold px-3 py-2 text-xs font-medium text-gold-foreground shadow-gold"
                            >
                              <Link
                                to="/coach/tournaments/$id"
                                params={{ id: tournament.id }}
                                className="flex items-center gap-1"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {t("coach.apply_tournament")}
                              </Link>
                            </button>
                          ) : tournament.status === "DRAFT" ? (
                            <UnavailableApplyBadge reason={t("coach.registration_not_open")} />
                          ) : categoryCount === 0 ? (
                            <UnavailableApplyBadge reason={t("coach.no_categories_to_apply")} />
                          ) : tournament.status === "REGISTRATION_OPEN" && deadlinePassed ? (
                            <UnavailableApplyBadge reason={t("coach.deadline_passed")} danger />
                          ) : (
                            <UnavailableApplyBadge reason={t("coach.registration_closed")} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "applications" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
          {applicationNotifications.length > 0 && (
            <div className="mb-6 grid gap-3">
              {applicationNotifications.slice(0, 3).map((n: Notification) => (
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
                        {n.type === "application_rejected" ? (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        )}
                        {n.titleKey}
                      </div>
                      <div className="mt-1 text-muted-foreground">{n.bodyKey}</div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString("kk-KZ")}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {typeof n.payload?.applicationId === "string" && (
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
            <MiniStat
              icon={AlertTriangle}
              label={t("applications.needs_correction")}
              value={rejected}
              danger
            />
          </div>

          <Panel
            title={`${t("common.all")} ${apps.length} ${t("applications.title").toLowerCase()}`}
            action={
              <div className="flex flex-wrap gap-2">
                {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      statusFilter === status
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status === "ALL" ? t("common.all") : String(t(`status.${status}`, status))}
                  </button>
                ))}
              </div>
            }
          >
            {myAppsQuery.isLoading ? (
              <LoadingState />
            ) : filteredApps.length === 0 ? (
              <EmptyState title={t("applications.no_applications")} hint={t("coach.apply_hint")} />
            ) : (
              <ul className="space-y-3 text-sm">
                {filteredApps.map((a: Application) => (
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
                            {a.submittedAt
                              ? ` · ${t("applications.submitted")} ${new Date(a.submittedAt).toLocaleDateString("kk-KZ")}`
                              : ""}
                          </div>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.reviewerNotes && (
                        <div
                          className={`mt-3 text-xs border-l-2 pl-3 ${a.status === "REJECTED" ? "border-destructive text-destructive" : "border-gold/40 text-muted-foreground"}`}
                        >
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
        </div>
      )}
    </DashboardShell>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  ok,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  ok?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon
          className={`h-4 w-4 ${danger ? "text-destructive" : ok ? "text-emerald-300" : "text-gold"}`}
        />
        {label}
      </div>
      <div
        className={`mt-2 font-display text-3xl font-bold ${danger ? "text-destructive" : ok ? "text-emerald-300" : ""}`}
      >
        {value}
      </div>
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
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls} shrink-0`}>
      {String(t(`status.${status}`, status))}
    </span>
  );
}

function UnavailableApplyBadge({ reason, danger }: { reason: string; danger?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex flex-col rounded-md border px-3 py-1.5 text-xs ${danger ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}
    >
      <span className="font-medium">{t("coach.apply_tournament")}</span>
      <span>{reason}</span>
    </span>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    REGISTRATION_OPEN: "bg-gold/15 text-gold border border-gold/30",
    REGISTRATION_CLOSED: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    IN_PROGRESS: "bg-destructive/20 text-destructive border border-destructive/40",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    CANCELLED: "bg-muted text-muted-foreground",
  };
  const cls = colors[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls}`}>
      {String(t(`status.${status}`, status))}
    </span>
  );
}

function ApplicationStatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "REJECTED") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <ClipboardList className="h-3.5 w-3.5" />;
}

function applicationButtonStyle(status: string): string {
  if (status === "APPROVED")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15";
  if (status === "REJECTED")
    return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15";
  if (status === "SUBMITTED") return "border-gold/30 bg-gold/10 text-gold hover:bg-gold/15";
  return "border-border text-muted-foreground hover:text-foreground";
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} – ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
