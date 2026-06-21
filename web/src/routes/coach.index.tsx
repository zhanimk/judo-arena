import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  StatCard,
  StatCardSkeleton,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Plus,
  Users,
  Trophy,
  FileCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Application, User, Tournament } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Жаттықтырушы — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachOverview />
    </ProtectedRoute>
  ),
});

function CoachOverview() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const clubId = user?.clubId;

  const clubQuery = useQuery({
    queryKey: ["club", clubId],
    queryFn: () => (clubId ? api.clubs.get(clubId) : null),
    enabled: !!clubId,
  });
  const membersQuery = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => (clubId ? api.clubs.members(clubId) : []),
    enabled: !!clubId,
  });
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments-open"],
    queryFn: () => api.tournaments.list({ status: "REGISTRATION_OPEN" }),
  });
  const myAppsQuery = useQuery({
    queryKey: ["my-club-applications"],
    queryFn: () => api.applications.myClub(),
  });

  const openTournaments = tournamentsQuery.data?.items ?? [];
  const myApps = myAppsQuery.data ?? [];

  const appByTournament = new Map(myApps.map((a: Application) => [a.tournamentId, a]));

  const pendingApps = myApps.filter((a: Application) => a.status === "SUBMITTED").length;
  const approvedApps = myApps.filter((a: Application) => a.status === "APPROVED").length;
  const rejectedApps = myApps.filter((a: Application) => a.status === "REJECTED").length;

  const clubName = clubQuery.data ? localizeName(clubQuery.data.name) : "—";

  const members = membersQuery.data ?? [];
  const athletes = members.filter((a: User) => a.role === "ATHLETE");
  const readyCount = athletes.filter((a: User) => a.weightKg && a.beltRank).length;
  const readinessPct = athletes.length > 0 ? Math.round((readyCount / athletes.length) * 100) : 0;

  return (
    <DashboardShell
      role={t("coach.role_label")}
      navItems={nav}
      accentTitle={
        clubName ? `«${clubName}» ${t("common.club").toLowerCase()}` : t("dashboard.my_club")
      }
    >
      {/* ── Hero card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card p-5 sm:p-7 mb-6">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-gold" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/8 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {t("dashboard.hello", { name: user?.name })}
            </div>
            <div className="font-display text-2xl font-bold">
              {clubName ? `«${clubName}»` : t("dashboard.my_club")}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {/* Application pipeline */}
              {[
                {
                  label: t("status.SUBMITTED"),
                  count: pendingApps,
                  color: "bg-gold/15 text-gold border-gold/30",
                },
                {
                  label: t("status.APPROVED"),
                  count: approvedApps,
                  color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
                },
                {
                  label: t("status.REJECTED"),
                  count: rejectedApps,
                  color: "bg-destructive/15 text-destructive border-destructive/30",
                },
              ].map(({ label, count, color }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${color}`}
                >
                  <span className="font-bold">{count}</span> {label}
                </span>
              ))}
            </div>
          </div>

          {/* Team readiness */}
          {athletes.length > 0 && (
            <div className="shrink-0 rounded-xl border border-border/50 bg-background/40 p-4 text-center min-w-[9rem]">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {t("coach.team_readiness")}
              </div>
              <div className="font-display text-3xl font-bold text-gradient-gold">
                {readinessPct}%
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full bg-gradient-gold transition-all duration-700"
                  style={{ width: `${readinessPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {readyCount} / {athletes.length} {t("coach.athletes_unit")}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {membersQuery.isLoading || tournamentsQuery.isLoading || myAppsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label={t("coach.stat_athletes")}
              value={String(athletes.length)}
              icon={Users}
              accent
            />
            <StatCard
              label={t("coach.open_tournaments")}
              value={String(openTournaments.length)}
              hint={String(t("status.REGISTRATION_OPEN"))}
              icon={Trophy}
            />
            <StatCard
              label={t("coach.stat_pending")}
              value={String(pendingApps)}
              hint={t("dashboard.applications").toLowerCase()}
              icon={FileCheck}
            />
            <StatCard
              label={t("coach.stat_approved")}
              value={String(approvedApps)}
              hint={t("dashboard.applications").toLowerCase()}
              icon={CheckCircle2}
            />
          </>
        )}
      </div>

      {rejectedApps > 0 && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <span className="font-medium text-destructive">
              {t("coach.rejected_apps", { count: rejectedApps })}
            </span>
            <span className="ml-2 text-muted-foreground">— {t("coach.rejected_apps_hint")}</span>
          </div>
          <Link
            to="/coach/applications"
            className="shrink-0 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            {t("coach.go_to_applications")}
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel
          title={t("coach.open_tournaments_title")}
          action={
            <Link to="/coach/tournaments" className="text-xs text-gold hover:underline">
              {t("common.all")} →
            </Link>
          }
        >
          {tournamentsQuery.isLoading ? (
            <LoadingState />
          ) : openTournaments.length === 0 ? (
            <EmptyState
              title={t("coach.no_open_tournaments")}
              hint={t("coach.no_open_tournaments_hint")}
            />
          ) : (
            <div className="space-y-3">
              {openTournaments.slice(0, 5).map((tournament: Tournament) => {
                const deadline = tournament.applicationDeadline ?? tournament.startDate;
                const deadlinePassed = new Date(deadline).getTime() < Date.now();
                const existingApp = appByTournament.get(tournament.id);

                return (
                  <div key={tournament.id} className="glass rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/coach/tournaments/$id"
                          params={{ id: tournament.id }}
                          className="font-semibold hover:text-gold"
                        >
                          {localizeName(tournament.name)}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gold/60" />
                            {dateRange(tournament.startDate, tournament.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gold/60" />
                            {tournament.city}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 ${deadlinePassed ? "text-destructive" : ""}`}
                          >
                            <Clock className="h-3.5 w-3.5 text-gold/60" />
                            {t("common.deadline")}: {new Date(deadline).toLocaleDateString("kk-KZ")}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {existingApp ? (
                          <Link
                            to="/coach/applications/$id"
                            params={{ id: existingApp.id }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/15"
                          >
                            <ApplicationStatusIcon status={existingApp.status} />
                            {String(t(`status.${existingApp.status}`, existingApp.status))}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : deadlinePassed ? (
                          <span className="rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive">
                            {t("coach.deadline_passed")}
                          </span>
                        ) : (
                          <Link
                            to="/coach/tournaments/$id"
                            params={{ id: tournament.id }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("coach.apply_tournament")}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title={t("coach.my_athletes")}
            action={
              <Link to="/coach/athletes" className="text-xs text-gold hover:underline">
                {t("common.all")} →
              </Link>
            }
          >
            {membersQuery.isLoading ? (
              <LoadingState />
            ) : (membersQuery.data ?? []).length === 0 ? (
              <EmptyState title={t("coach.no_athletes")} hint={t("coach.no_athletes_hint")} />
            ) : (
              <div className="space-y-2">
                {members.slice(0, 5).map((a: User) => (
                  <Link
                    key={a.id}
                    to="/coach/athletes/$id"
                    params={{ id: a.id }}
                    className="flex items-center gap-3 glass rounded-lg p-3 hover:border-gold/30 transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-[11px] font-bold text-[#1a1204]">
                      {(a.name?.[0] ?? "") + (a.surname?.[0] ?? "")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">
                        {a.name} {a.surname}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.weightKg ? `${a.weightKg} кг` : "—"}
                      </div>
                    </div>
                    {a.beltRank && (
                      <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">
                        {a.beltRank}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={t("coach.recent_applications")}
            action={
              <Link to="/coach/applications" className="text-xs text-gold hover:underline">
                {t("common.all")} →
              </Link>
            }
          >
            {myAppsQuery.isLoading ? (
              <LoadingState />
            ) : myApps.length === 0 ? (
              <EmptyState title={t("applications.no_applications")} hint={t("coach.apply_hint")} />
            ) : (
              <div className="space-y-2">
                {myApps.slice(0, 4).map((a: Application) => (
                  <Link
                    key={a.id}
                    to="/coach/applications/$id"
                    params={{ id: a.id }}
                    className="flex items-center justify-between glass rounded-md p-3 hover:border-gold/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">
                        {localizeName(a.tournament?.name)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("common.athletes_count", { count: a._count?.entries ?? 0 })}
                      </div>
                    </div>
                    <AppStatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

function ApplicationStatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === "REJECTED") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  return <ClipboardList className="h-3.5 w-3.5" />;
}

function AppStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-gold/15 text-gold border border-gold/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    REJECTED: "bg-destructive/15 text-destructive border border-destructive/30",
    WITHDRAWN: "bg-muted text-muted-foreground",
  };
  const color = colors[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${color}`}>
      {t(`status.${status}`, status)}
    </span>
  );
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} – ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
