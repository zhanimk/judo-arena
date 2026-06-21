import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  GitBranch,
  MapPin,
  Trash2,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { Tournament, ApplicationEntry } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/athlete/tournaments")({
  head: () => ({ meta: [{ title: "Жарыстар — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteTournaments />
    </ProtectedRoute>
  ),
});

function AthleteTournaments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const removeEntryMut = useMutation({
    mutationFn: ({ applicationId, entryId }: { applicationId: string; entryId: string }) =>
      api.applications.removeEntry(applicationId, entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athlete-application-entries", user?.id] }),
  });

  const tournamentsQuery = useQuery({
    queryKey: ["all-tournaments-public"],
    queryFn: () => api.tournaments.list({ limit: 1000 }),
  });
  const entriesQuery = useQuery({
    queryKey: ["athlete-application-entries", user?.id],
    queryFn: () => api.applications.mineAsAthlete(),
    enabled: !!user?.id,
  });
  const entriesByTournament = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const entry of entriesQuery.data ?? []) {
      const tournamentId = entry.application?.tournament?.id;
      if (!tournamentId) continue;
      const list = map.get(tournamentId) ?? [];
      list.push(entry);
      map.set(tournamentId, list);
    }
    return map;
  }, [entriesQuery.data]);
  const approvedEntries = (entriesQuery.data ?? []).filter(
    (entry: ApplicationEntry) => entry.application?.status === "APPROVED",
  );
  const pendingEntries = (entriesQuery.data ?? []).filter(
    (entry: ApplicationEntry) => entry.application?.status === "SUBMITTED",
  );

  return (
    <DashboardShell
      role={t("roles.ATHLETE")}
      navItems={nav}
      accentTitle={t("dashboard.tournaments")}
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={t("dashboard.my_club")}>
          {user?.club ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-display text-xl font-semibold">
                  {localizeName(user.club.name)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 text-gold/70" />
                  {user.club.city || t("athlete.no_city")}
                </div>
              </div>
              <div className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
                {t("athlete.applied_via_club")}
              </div>
            </div>
          ) : (
            <EmptyState title={t("athlete.no_club")} hint={t("athlete.no_club_hint")} />
          )}
        </Panel>
        <Panel title={t("athlete.my_applications")}>
          {entriesQuery.isLoading ? (
            <LoadingState />
          ) : (entriesQuery.data ?? []).length === 0 ? (
            <EmptyState title={t("athlete.no_entries")} hint={t("athlete.no_entries_hint")} />
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <MiniMetric label={t("common.all")} value={entriesQuery.data?.length ?? 0} />
              <MiniMetric
                label={t("athlete.stat_pending")}
                value={pendingEntries.length}
                tone="gold"
              />
              <MiniMetric
                label={t("athlete.stat_approved")}
                value={approvedEntries.length}
                tone="green"
              />
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t("tournaments_page.all_tournaments")}>
        {tournamentsQuery.isLoading ? (
          <LoadingState />
        ) : (tournamentsQuery.data?.items ?? []).length === 0 ? (
          <EmptyState
            title={t("tournament.no_tournaments")}
            hint={t("athlete.no_tournaments_hint")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tournamentsQuery.data!.items.map((tournament: Tournament) => {
              const myEntries = entriesByTournament.get(tournament.id) ?? [];
              const primaryEntry = myEntries[0];
              const app = primaryEntry?.application;
              return (
                <Link
                  key={tournament.id}
                  to="/tournaments/$id"
                  params={{ id: tournament.id }}
                  className={`glass rounded-xl p-5 hover:border-gold/40 transition-all hover:-translate-y-1 border ${myEntries.length ? "border-gold/40" : "border-border/60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-lg font-semibold mb-2">
                      {localizeName(tournament.name)}
                    </div>
                    <StatusBadge status={tournament.status} />
                  </div>
                  {myEntries.length > 0 && (
                    <div
                      className={`mb-3 rounded-md border p-3 text-xs ${applicationTone(app?.status)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {app?.status === "APPROVED" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : app?.status === "REJECTED" ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {t("athlete.i_applied")}:{" "}
                          {String(t(`status.${app?.status}`, app?.status ?? ""))}
                        </span>
                        <span>
                          {myEntries.length} {t("common.category").toLowerCase()}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {myEntries.map((entry: ApplicationEntry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">{categoryTitle(entry.category, t)}</span>
                            {(app?.status === "DRAFT" || app?.status === "SUBMITTED") && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (confirm(t("athlete.confirm_remove_entry"))) {
                                    removeEntryMut.mutate({
                                      applicationId: app.id,
                                      entryId: entry.id,
                                    });
                                  }
                                }}
                                disabled={removeEntryMut.isPending}
                                className="shrink-0 rounded p-0.5 text-current/60 hover:text-destructive disabled:opacity-40"
                                title={t("athlete.remove_entry")}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {app?.reviewerNotes && (
                        <div className="mt-2 border-t border-current/20 pt-2 opacity-90">
                          {app.reviewerNotes}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gold/70" />
                      {dateRange(tournament.startDate, tournament.endDate)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gold/70" />
                      {t("common.deadline")}:{" "}
                      {new Date(
                        tournament.applicationDeadline ?? tournament.startDate,
                      ).toLocaleString("kk-KZ")}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gold/70" />
                      {tournament.location || tournament.city}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-gold/70" />
                      {tournament._count?.applications ?? 0} {t("applications.title").toLowerCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-gold/70" />
                      {tournament._count?.categories ?? 0} {t("common.category").toLowerCase()} ·{" "}
                      {tournament.tatamiCount ?? 1} {t("common.tatami")}
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-center text-xs text-gold">
                    {t("home.open_full")}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "gold" | "green";
}) {
  const color =
    tone === "gold" ? "text-gold" : tone === "green" ? "text-emerald-300" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    REGISTRATION_OPEN: "bg-gold/15 text-gold border border-gold/30",
    REGISTRATION_CLOSED: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    IN_PROGRESS: "bg-destructive/20 text-destructive border border-destructive/40",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    CANCELLED: "bg-muted text-muted-foreground",
  };
  const cls = colors[status] ?? "bg-muted";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls}`}>
      {String(t(`status.${status}`, status))}
    </span>
  );
}

function applicationTone(status?: string): string {
  if (status === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "REJECTED") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "SUBMITTED") return "border-gold/30 bg-gold/10 text-gold";
  return "border-border/50 bg-muted/20 text-muted-foreground";
}

function categoryTitle(
  c: import("@/lib/api-types").Category | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!c) return t("common.category");
  const custom = localizeName(c.name);
  if (custom !== "—") return custom;
  const genderLabel = c.gender === "MALE" ? t("rankings.filter_male") : t("rankings.filter_female");
  return `${genderLabel} ${c.ageMin}-${c.ageMax} ${t("common.years_short")} ${c.weightMin}-${c.weightMax} кг`;
}

function localizeName(
  name: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} - ${new Date(end).toLocaleDateString("kk-KZ")}`;
}
