import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, EmptyState, LoadingState } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { ApplicationMetric, WeighInStatusBadge, localizeName, weightLabel } from "./shared";

export function TournamentWeighInTab({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, { weight: string; notes: string }>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [clubView, setClubView] = useState<Record<string, "all" | "passed" | "waiting" | "failed">>({});
  const [clubStatusView, setClubStatusView] = useState<"active" | "accepted" | "problem" | "all">("active");
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["admin-weigh-in", tournamentId],
    queryFn: () => api.admin.weighIn(tournamentId),
  });

  const update = useMutation({
    mutationFn: ({ entryId, status, reset }: { entryId: string; status: string; reset?: boolean }) => {
      const draft = editing[entryId] ?? { notes: "" };
      return api.admin.updateWeighIn(entryId, {
        status,
        notes: reset ? null : draft.notes || null,
      });
    },
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-weigh-in", tournamentId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("weigh_in.save_error")),
  });
  const setStatus = (entry: any, status: string) => {
    if (status !== "PASSED") {
      setExpanded((current) => ({ ...current, [entry.id]: true }));
    }
    if (status === "PENDING") {
      setEditing((current) => ({ ...current, [entry.id]: { notes: "" } }));
    }
    update.mutate({ entryId: entry.id, status, reset: status === "PENDING" });
  };
  const bulkPass = useMutation({
    mutationFn: async (entryIds: string[]) => {
      for (const entryId of entryIds) {
        await api.admin.updateWeighIn(entryId, { status: "PASSED" });
      }
      return { count: entryIds.length };
    },
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-weigh-in", tournamentId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("weigh_in.bulk_error")),
  });

  if (query.isLoading) return <Panel title={t("weigh_in.panel_title")}><LoadingState /></Panel>;
  const tournament = query.data;
  const applications = tournament?.applications ?? [];
  const entries = applications.flatMap((app: any) => app.entries ?? []);
  const passed = entries.filter((entry: any) => entry.weighInStatus === "PASSED").length;
  const pending = entries.filter((entry: any) => entry.weighInStatus === "PENDING").length;
  const failed = entries.length - passed - pending;
  const pendingEntryIds = entries.filter((entry: any) => entry.weighInStatus === "PENDING").map((entry: any) => entry.id);
  const clubStatus = (app: any) => {
    const appEntries = app.entries ?? [];
    const hasProblem = appEntries.some((entry: any) => entry.weighInStatus !== "PENDING" && entry.weighInStatus !== "ABSENT" && entry.weighInStatus !== "PASSED");
    const allPassed = appEntries.length > 0 && appEntries.every((entry: any) => entry.weighInStatus === "PASSED");
    if (hasProblem) return "problem";
    if (allPassed) return "accepted";
    return "active";
  };
  const acceptedApplications = applications.filter((app: any) => clubStatus(app) === "accepted");
  const problemApplications = applications.filter((app: any) => clubStatus(app) === "problem");
  const activeApplications = applications.filter((app: any) => clubStatus(app) === "active");
  const visibleApplications = clubStatusView === "accepted"
    ? acceptedApplications
    : clubStatusView === "problem"
      ? problemApplications
      : clubStatusView === "all"
        ? applications
        : activeApplications;
  const clubStatusTabs = [
    { id: "active" as const, label: t("weigh_in.tab_active"), count: activeApplications.length },
    { id: "accepted" as const, label: t("weigh_in.tab_accepted"), count: acceptedApplications.length },
    { id: "problem" as const, label: t("weigh_in.tab_problem"), count: problemApplications.length },
    { id: "all" as const, label: t("weigh_in.tab_all"), count: applications.length },
  ];

  return (
    <Panel title={t("weigh_in.panel_title")}>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-4">
          <ApplicationMetric label={t("weigh_in.metric_total")} value={entries.length} />
          <ApplicationMetric label={t("weigh_in.metric_passed")} value={passed} tone="green" />
          <ApplicationMetric label={t("weigh_in.metric_pending")} value={pending} tone="gold" />
          <ApplicationMetric label={t("weigh_in.metric_failed")} value={failed} tone={failed ? "red" : undefined} />
        </div>
        <button
          type="button"
          disabled={bulkPass.isPending || pendingEntryIds.length === 0}
          onClick={() => bulkPass.mutate(pendingEntryIds)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500/15 px-4 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {bulkPass.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
          {t("weigh_in.bulk_pass_all")}
        </button>
      </div>
      {applications.length > 0 && (
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          {clubStatusTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setClubStatusView(item.id)}
              className={`flex items-center justify-between rounded-md border px-4 py-3 text-left transition ${
                clubStatusView === item.id
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-medium">{item.label}</span>
              <span className="rounded-full bg-muted/60 px-2.5 py-1 text-sm text-foreground">{item.count}</span>
            </button>
          ))}
        </div>
      )}
      {applications.length === 0 ? (
        <EmptyState title={t("weigh_in.no_approved")} hint={t("weigh_in.no_approved_hint")} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleApplications.length === 0 && (
            <div className="xl:col-span-2 rounded-md border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              {t("weigh_in.no_clubs_here")}
            </div>
          )}
          {visibleApplications.map((app: any) => {
            const appEntries = app.entries ?? [];
            const clubPendingIds = appEntries
              .filter((entry: any) => entry.weighInStatus === "PENDING")
              .map((entry: any) => entry.id);
            const passedEntries = appEntries.filter((entry: any) => entry.weighInStatus === "PASSED");
            const waitingEntries = appEntries.filter((entry: any) => entry.weighInStatus === "PENDING" || entry.weighInStatus === "ABSENT");
            const failedEntries = appEntries.filter((entry: any) => entry.weighInStatus !== "PENDING" && entry.weighInStatus !== "ABSENT" && entry.weighInStatus !== "PASSED");
            const clubPassed = passedEntries.length;
            const clubProblems = failedEntries.length;
            const selectedView = clubView[app.id] ?? (clubPendingIds.length > 0 ? "waiting" : clubProblems > 0 ? "failed" : "passed");
            const visibleEntries = selectedView === "passed"
              ? passedEntries
              : selectedView === "waiting"
                ? waitingEntries
                : selectedView === "failed"
                  ? failedEntries
                  : appEntries;
            const viewTabs = [
              { id: "all" as const, label: t("weigh_in.view_all"), count: appEntries.length },
              { id: "passed" as const, label: t("weigh_in.view_passed"), count: passedEntries.length },
              { id: "waiting" as const, label: t("weigh_in.view_waiting"), count: waitingEntries.length },
              { id: "failed" as const, label: t("weigh_in.view_failed"), count: failedEntries.length },
            ];

            return (
              <div key={app.id} className="rounded-md border border-border/60 bg-background/30 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-semibold">{localizeName(app.club?.name)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {app.club?.city} · {appEntries.length} {t("tournament.athletes").toLowerCase()} · {clubPassed} {t("weigh_in.metric_passed").toLowerCase()} · {clubPendingIds.length} {t("weigh_in.metric_pending").toLowerCase()}
                      {clubProblems > 0 ? ` · ${clubProblems} ${t("weigh_in.tab_problem").toLowerCase()}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={bulkPass.isPending || clubPendingIds.length === 0}
                    onClick={() => {
                      setClubView((current) => ({ ...current, [app.id]: "passed" }));
                      bulkPass.mutate(clubPendingIds);
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {bulkPass.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                    {t("weigh_in.club_pass_btn")}
                  </button>
                </div>

                <div className="mb-3 grid gap-2 sm:grid-cols-4">
                  {viewTabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setClubView((current) => ({ ...current, [app.id]: item.id }))}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                        selectedView === item.id
                          ? "border-gold/60 bg-gold/10 text-gold"
                          : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-foreground">{item.count}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {visibleEntries.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/60 px-3 py-5 text-center text-sm text-muted-foreground">
                      {t("weigh_in.no_athletes_here")}
                    </div>
                  )}
                  {visibleEntries.map((entry: any) => {
                    const draft = editing[entry.id] ?? { notes: entry.weighInNotes ?? "" };
                    const hasProblemStatus = entry.weighInStatus !== "PENDING" && entry.weighInStatus !== "PASSED";
                    const isDetailsOpen = expanded[entry.id] || hasProblemStatus;
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-md border p-3 ${
                          entry.weighInStatus === "PASSED"
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : entry.weighInStatus === "PENDING"
                              ? "border-border/50 bg-background/30"
                              : "border-destructive/25 bg-destructive/5"
                        }`}
                      >
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{entry.athlete?.name} {entry.athlete?.surname}</div>
                              <WeighInStatusBadge status={entry.weighInStatus} />
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.category?.gender === "MALE" ? t("common.male") : t("tatami.female_short")} · {entry.category?.ageMin}-{entry.category?.ageMax} {t("common.years_short")} · {weightLabel(entry.category, t)} · {t("weigh_in.app_weight")} {entry.athlete?.weightKg ?? "—"} {t("common.kg")}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {entry.weighInStatus !== "PASSED" && (
                              <button
                                disabled={update.isPending}
                                onClick={() => setStatus(entry, "PASSED")}
                                className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                {t("weigh_in.btn_pass")}
                              </button>
                            )}
                            {entry.weighInStatus !== "FAILED_WEIGHT" && (
                              <button
                                disabled={update.isPending}
                                onClick={() => setStatus(entry, "FAILED_WEIGHT")}
                                className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive hover:bg-destructive/20 disabled:opacity-50"
                              >
                                {t("weigh_in.btn_fail_weight")}
                              </button>
                            )}
                            {entry.weighInStatus !== "ABSENT" && (
                              <button
                                disabled={update.isPending}
                                onClick={() => setStatus(entry, "ABSENT")}
                                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                              >
                                {t("weigh_in.btn_absent")}
                              </button>
                            )}
                            {entry.weighInStatus !== "PENDING" && (
                              <button
                                disabled={update.isPending}
                                onClick={() => setStatus(entry, "PENDING")}
                                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                              >
                                {t("weigh_in.btn_reset")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpanded((current) => ({ ...current, [entry.id]: !current[entry.id] }))}
                              className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                            >
                              {t("weigh_in.details")}
                            </button>
                          </div>
                        </div>

                        {isDetailsOpen && (
                          <div className="mt-3 border-t border-border/30 pt-3 space-y-2">
                            <input
                              value={draft.notes}
                              onChange={(e) => setEditing((current) => ({ ...current, [entry.id]: { ...draft, notes: e.target.value } }))}
                              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                              placeholder={t("weigh_in.notes_placeholder")}
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-muted-foreground">{t("weigh_in.notes_hint")}</p>
                              <button
                                onClick={() => update.mutate({ entryId: entry.id, status: entry.weighInStatus })}
                                disabled={update.isPending}
                                className="inline-flex items-center gap-1.5 rounded-md bg-gold/10 border border-gold/20 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20 disabled:opacity-50 transition-colors"
                              >
                                {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                {t("common.save")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
