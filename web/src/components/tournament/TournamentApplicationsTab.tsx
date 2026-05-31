import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, ArrowRightLeft, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, EmptyState, LoadingState } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import {
  StatusBadge, ApplicationMetric, EntryCheckBadge, FormatBadge,
  categoryTitle, validateApplicationEntry, athleteAge, localizeName,
} from "./shared";

function ApplicationReviewDetail({
  app,
  onReview,
  allCategories,
  onRemoveEntry,
  onMoveEntry,
  isMutating,
}: {
  app: any;
  onReview: (review: { id: string; action: "approve" | "reject"; notes: string }) => void;
  allCategories: any[];
  onRemoveEntry: (entryId: string) => void;
  onMoveEntry: (entryId: string, newCategoryId: string) => void;
  isMutating: boolean;
}) {
  const { t } = useTranslation();
  const [showMoveFor, setShowMoveFor] = useState<string | null>(null);

  const grouped = new Map<string, any[]>();
  for (const entry of app.entries ?? []) {
    const key = entry.categoryId;
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }
  const validations = (app.entries ?? []).map((entry: any) => ({
    entry,
    issues: validateApplicationEntry(entry, t),
  }));
  const issueCount = validations.reduce((sum: number, item: any) => sum + item.issues.length, 0);
  const categoryCount = grouped.size;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{localizeName(app.club?.name)}</div>
          <div className="text-xs text-muted-foreground">
            {app.entries?.length ?? 0} {t("common.athletes").toLowerCase()} · {categoryCount} {t("tournament.categories").toLowerCase()} · {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : t("applications.not_submitted")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={app.status} />
          {app.status === "SUBMITTED" && (
            <>
              <button
                onClick={() => onReview({ id: app.id, action: "approve", notes: "" })}
                className="rounded-md border border-gold/30 bg-gold/15 px-2.5 py-1 text-xs text-gold hover:bg-gold/25"
              >
                {t("common.approve")}
              </button>
              <button
                onClick={() => onReview({ id: app.id, action: "reject", notes: "" })}
                className="rounded-md border border-destructive/30 bg-destructive/15 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/25"
              >
                {t("common.reject")}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <ApplicationMetric label={t("tournament.athletes")} value={app.entries?.length ?? 0} />
        <ApplicationMetric label={t("tournament.categories")} value={categoryCount} />
        <ApplicationMetric
          label={t("applications.metric_check")}
          value={issueCount ? `${issueCount} ${t("tournament.issues")}` : "OK"}
          tone={issueCount ? "red" : "green"}
        />
      </div>
      {app.notes && (
        <div className="mb-4 rounded-md border border-border/50 bg-card/40 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{t("applications.coach_note")}</div>
          {app.notes}
        </div>
      )}
      {app.reviewerNotes && (
        <div className="mb-4 rounded-md border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
          <div className="mb-1 text-xs uppercase tracking-widest">{t("applications.admin_decision")}</div>
          {app.reviewerNotes}
        </div>
      )}
      {issueCount > 0 && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {t("applications.issues_warning")}
          </div>
          <div className="mt-1 text-xs text-amber-100/80">{t("applications.issues_hint")}</div>
        </div>
      )}
      {(app.entries ?? []).length === 0 ? (
        <EmptyState title={t("applications.no_athletes")} />
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([categoryId, entries]) => {
            const category = entries[0]?.category;
            return (
              <div key={categoryId} className="rounded-md border border-border/50 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{categoryTitle(category, t)}</div>
                  <FormatBadge format={category?.format} />
                </div>
                <div className="space-y-2">
                  {entries.map((entry: any) => {
                    const issues = validateApplicationEntry(entry, t);
                    const moveTargets = allCategories.filter((c: any) => c.id !== entry.categoryId);
                    return (
                      <div key={entry.id} className={`rounded border px-3 py-2 text-sm ${issues.length ? "border-amber-500/40 bg-amber-500/10" : "border-border/40"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{entry.athlete?.name} {entry.athlete?.surname}</div>
                            <div className="text-xs text-muted-foreground">
                              {entry.athlete?.gender === "MALE" ? t("common.male") : t("tatami.female_short")} · {athleteAge(entry.athlete) ?? t("applications.no_age")} {t("common.years_short")} · {entry.athlete?.weightKg ?? "—"} {t("common.kg")} · {entry.athlete?.beltRank ?? "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <EntryCheckBadge issues={issues} />
                            {moveTargets.length > 0 && (
                              <button
                                onClick={() => setShowMoveFor(showMoveFor === entry.id ? null : entry.id)}
                                disabled={isMutating}
                                className={`rounded p-1.5 disabled:opacity-50 transition-colors ${
                                  showMoveFor === entry.id
                                    ? "bg-gold/15 text-gold"
                                    : "text-muted-foreground hover:bg-gold/10 hover:text-gold"
                                }`}
                                title={t("applications.move_category")}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setShowMoveFor(null); onRemoveEntry(entry.id); }}
                              disabled={isMutating}
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              title={t("common.delete")}
                            >
                              {isMutating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                        {issues.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-amber-100">
                            {issues.map((issue) => (
                              <span key={issue} className="rounded-full bg-amber-500/15 px-2 py-0.5">{issue}</span>
                            ))}
                          </div>
                        )}
                        {showMoveFor === entry.id && (
                          <div className="mt-2 border-t border-border/40 pt-2">
                            <div className="text-xs text-muted-foreground mb-1.5">{t("applications.move_to")}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {moveTargets.map((c: any) => (
                                <button
                                  key={c.id}
                                  onClick={() => { onMoveEntry(entry.id, c.id); setShowMoveFor(null); }}
                                  disabled={isMutating}
                                  className="text-xs px-2 py-1 rounded bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  <ArrowRightLeft className="h-3 w-3" />
                                  {c.gender === "MALE" ? t("common.male") : t("tatami.female_short")} {c.weightMin}-{c.weightMax} {t("common.kg")}
                                  <span className="text-gold/70">{c.ageMin}-{c.ageMax} {t("common.years_short")}</span>
                                </button>
                              ))}
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
    </div>
  );
}

export function TournamentApplicationsTab({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<{ id: string; action: "approve" | "reject"; notes: string } | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["tournament-apps", tournamentId],
    queryFn: () => api.tournaments.applications(tournamentId),
  });
  const detailQuery = useQuery({
    queryKey: ["admin-application-detail", selectedId],
    queryFn: () => api.applications.get(selectedId!),
    enabled: !!selectedId,
  });
  const categoriesQuery = useQuery({
    queryKey: ["tournament-categories", tournamentId],
    queryFn: () => api.tournaments.categories(tournamentId),
  });

  const adminRemoveEntry = useMutation({
    mutationFn: ({ appId, entryId }: { appId: string; entryId: string }) =>
      api.applications.adminRemoveEntry(appId, entryId),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-application-detail", selectedId] });
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("applications.remove_error")),
  });
  const adminMoveEntry = useMutation({
    mutationFn: ({ appId, entryId, newCategoryId }: { appId: string; entryId: string; newCategoryId: string }) =>
      api.applications.adminMoveEntry(appId, entryId, newCategoryId),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-application-detail", selectedId] });
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("applications.move_error")),
  });

  const approve = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.applications.approve(id, notes),
    onSuccess: () => {
      setReview(null); setError("");
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
      qc.invalidateQueries({ queryKey: ["admin-application-detail", selectedId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("applications.approve_error")),
  });
  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.applications.reject(id, notes),
    onSuccess: () => {
      setReview(null); setError("");
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
      qc.invalidateQueries({ queryKey: ["admin-application-detail", selectedId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("applications.reject_error")),
  });

  const applications = query.data ?? [];
  const submittedCount = applications.filter((app: any) => app.status === "SUBMITTED").length;
  const approvedCount = applications.filter((app: any) => app.status === "APPROVED").length;
  const rejectedCount = applications.filter((app: any) => app.status === "REJECTED").length;
  const athleteCount = applications.reduce((sum: number, app: any) => sum + (app._count?.entries ?? app.entries?.length ?? 0), 0);

  return (
    <Panel title={t("applications.panel_title")}>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {query.isLoading ? <LoadingState /> :
        applications.length === 0 ? (
          <EmptyState title={t("applications.empty")} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <ApplicationMetric label={t("applications.metric_club_apps")} value={applications.length} />
              <ApplicationMetric label={t("applications.metric_pending")} value={submittedCount} tone={submittedCount ? "gold" : undefined} />
              <ApplicationMetric label={t("applications.metric_approved")} value={approvedCount} tone="green" />
              <ApplicationMetric label={t("tournament.athletes")} value={athleteCount} />
            </div>
            {rejectedCount > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {t("applications.rejected_warning", { count: rejectedCount })}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
              <div className="space-y-2">
                {applications.map((a: any) => {
                  const entriesCount = a._count?.entries ?? a.entries?.length ?? 0;
                  return (
                    <div key={a.id} className={`rounded-md border p-3 text-sm ${selectedId === a.id ? "border-gold/40 bg-gold/5" : "border-border/60 bg-background/30"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <button onClick={() => setSelectedId(a.id)} className="min-w-0 text-left">
                          <div className="truncate font-medium">{localizeName(a.club?.name)}</div>
                          <div className="text-xs text-muted-foreground">
                            {entriesCount} {t("tournament.athletes").toLowerCase()} · {a.club?.city ?? "—"}
                          </div>
                        </button>
                        <div className="flex shrink-0 gap-2 items-center">
                          <StatusBadge status={a.status} />
                          {a.status === "SUBMITTED" && (
                            <>
                              <button onClick={() => setReview({ id: a.id, action: "approve", notes: "" })}
                                className="text-xs px-2 py-1 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25">✓</button>
                              <button onClick={() => setReview({ id: a.id, action: "reject", notes: "" })}
                                className="text-xs px-2 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">✕</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5">{entriesCount}</span>
                        {a.submittedAt && <span className="rounded-full bg-muted px-2 py-0.5">{t("applications.submitted_short")} {new Date(a.submittedAt).toLocaleDateString()}</span>}
                        {a.reviewedAt && <span className="rounded-full bg-muted px-2 py-0.5">{t("applications.reviewed_short")} {new Date(a.reviewedAt).toLocaleDateString()}</span>}
                      </div>
                      {a.reviewerNotes && (
                        <div className="mt-2 border-l-2 border-gold/40 pl-3 text-xs text-muted-foreground">{a.reviewerNotes}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md border border-border/60 bg-background/30 p-4">
                {!selectedId ? (
                  <EmptyState title={t("applications.select_hint")} hint={t("applications.select_hint_desc")} />
                ) : detailQuery.isLoading ? (
                  <LoadingState />
                ) : !detailQuery.data ? (
                  <EmptyState title={t("applications.not_found")} />
                ) : (
                  <ApplicationReviewDetail
                    app={detailQuery.data}
                    onReview={setReview}
                    allCategories={categoriesQuery.data ?? []}
                    onRemoveEntry={(entryId) =>
                      adminRemoveEntry.mutate({ appId: detailQuery.data!.id, entryId })
                    }
                    onMoveEntry={(entryId, newCategoryId) =>
                      adminMoveEntry.mutate({ appId: detailQuery.data!.id, entryId, newCategoryId })
                    }
                    isMutating={adminRemoveEntry.isPending || adminMoveEntry.isPending}
                  />
                )}
              </div>

              {review && (
                <div className="xl:col-span-2 rounded-md border border-gold/30 bg-gold/5 p-4">
                  <div className="mb-3 flex items-center gap-2 font-medium">
                    {review.action === "approve" ? t("applications.confirm_approve") : t("applications.confirm_reject")}
                  </div>
                  <textarea
                    value={review.notes}
                    onChange={(e) => setReview({ ...review, notes: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder={review.action === "approve" ? t("applications.notes_placeholder_approve") : t("applications.notes_placeholder_reject")}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => review.action === "approve"
                        ? approve.mutate({ id: review.id, notes: review.notes || undefined })
                        : reject.mutate({ id: review.id, notes: review.notes || undefined })}
                      disabled={approve.isPending || reject.isPending}
                      className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm text-gold-foreground shadow-gold disabled:opacity-50"
                    >
                      {(approve.isPending || reject.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("common.confirm")}
                    </button>
                    <button onClick={() => setReview(null)} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </Panel>
  );
}
