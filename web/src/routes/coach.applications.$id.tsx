/**
 * Страница управления одной заявкой тренера.
 * Можно добавлять/удалять спортсменов в категории и отправлять заявку.
 */

import React from "react";
import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Plus,
  Send,
  Trash2,
  Trophy,
  Undo2,
  Users,
  XCircle,
} from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Application, ApplicationEntry, Category, User, Match } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/applications/$id")({
  head: () => ({ meta: [{ title: "Өтінім — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <ApplicationDetail />
    </ProtectedRoute>
  ),
});

function ApplicationDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/coach/applications/$id" });
  const { user } = useAuth();
  const canManageApplication = user?.clubRole === "OWNER";
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [movingEntry, setMovingEntry] = useState<string | null>(null);
  const [showMoveFor, setShowMoveFor] = useState<string | null>(null);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [onlyEligible, setOnlyEligible] = useState(false);

  const appQuery = useQuery({
    queryKey: ["application", id],
    queryFn: () => api.applications.get(id),
  });

  const membersQuery = useQuery({
    queryKey: ["club-members-for-app", user?.clubId],
    queryFn: () => (user?.clubId ? api.clubs.members(user.clubId) : []),
    enabled: !!user?.clubId,
  });

  const categoriesQuery = useQuery({
    queryKey: ["tournament-categories", appQuery.data?.tournamentId],
    queryFn: () => api.tournaments.categories(appQuery.data!.tournamentId),
    enabled: !!appQuery.data?.tournamentId,
  });
  const matchesQuery = useQuery({
    queryKey: ["coach-application-matches", appQuery.data?.tournamentId],
    queryFn: () => api.matches.list({ tournamentId: appQuery.data!.tournamentId, limit: 500 }),
    enabled: !!appQuery.data?.tournamentId,
  });

  const addEntry = useMutation({
    mutationFn: (params: { athleteId: string; categoryId: string }) =>
      api.applications.addEntry(id, params.athleteId, params.categoryId),
    onMutate: (p) => {
      setAdding(p.athleteId);
      setError("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setAdding(null),
  });

  const submit = useMutation({
    mutationFn: () => api.applications.submit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application", id] });
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });
  const payKaspi = useMutation({
    mutationFn: () => api.applications.payKaspi(id),
    onSuccess: (updated: Application) => {
      qc.invalidateQueries({ queryKey: ["application", id] });
      if (updated?.paymentUrl) {
        window.location.assign(updated.paymentUrl);
      }
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });
  const removeEntry = useMutation({
    mutationFn: (entryId: string) => api.applications.removeEntry(id, entryId),
    onMutate: (entryId) => {
      setRemoving(entryId);
      setError("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setRemoving(null),
  });
  const withdraw = useMutation({
    mutationFn: () => api.applications.withdraw(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });
  const moveEntry = useMutation({
    mutationFn: async ({
      entryId,
      athleteId,
      newCategoryId,
    }: {
      entryId: string;
      athleteId: string;
      newCategoryId: string;
    }) => {
      await api.applications.removeEntry(id, entryId);
      return api.applications.addEntry(id, athleteId, newCategoryId);
    },
    onMutate: ({ entryId }) => {
      setMovingEntry(entryId);
      setError("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application", id] });
      setShowMoveFor(null);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setMovingEntry(null),
  });

  if (appQuery.isLoading) {
    return (
      <DashboardShell role={t("coach.role_label")} navItems={nav} accentTitle={t("common.loading")}>
        <LoadingState />
      </DashboardShell>
    );
  }

  const app = appQuery.data;
  if (!app) {
    return (
      <DashboardShell
        role={t("coach.role_label")}
        navItems={nav}
        accentTitle={t("applications.not_found")}
      >
        <Panel title={t("error.generic")}>
          <EmptyState title={t("applications.not_found")} />
        </Panel>
      </DashboardShell>
    );
  }

  const isEditable = app.status === "DRAFT";
  const entriesCount = app.entries?.length ?? 0;
  const entryFeeKzt = Number(app.tournament?.entryFeeKzt ?? 0);
  const paymentTotalKzt = entryFeeKzt * entriesCount;
  const paymentRequired = paymentTotalKzt > 0;
  const paymentPaid =
    !paymentRequired ||
    (app.paymentStatus === "PAID" && Number(app.paymentAmountKzt ?? 0) >= paymentTotalKzt);
  const rosterIds = new Set((app.entries ?? []).map((e: ApplicationEntry) => e.athleteId));
  const deadline = app.tournament?.applicationDeadline ?? app.tournament?.startDate;
  const deadlinePassed = deadline ? new Date(deadline).getTime() < Date.now() : false;
  const canEditRoster = canManageApplication && isEditable && !deadlinePassed;
  const categories = categoriesQuery.data ?? [];
  const filteredAthletes = (() => {
    const search = athleteSearch.trim().toLowerCase();
    return (membersQuery.data ?? [])
      .filter((athlete: User) => {
        const fullName = `${athlete.name ?? ""} ${athlete.surname ?? ""}`.toLowerCase();
        if (search && !fullName.includes(search)) return false;
        if (genderFilter !== "ALL" && athlete.gender !== genderFilter) return false;
        const relevantCategories =
          categoryFilter === "ALL"
            ? categories
            : categories.filter((category: Category) => category.id === categoryFilter);
        const hasMatch = relevantCategories.some((category: Category) =>
          fitsCategory(athlete, category),
        );
        if (onlyEligible && !hasMatch) return false;
        return true;
      })
      .sort(sortAthletesByAgeWeightName);
  })();
  const clubMatches = (matchesQuery.data ?? []).filter(
    (m: Match) =>
      (m.redAthlete?.id && rosterIds.has(m.redAthlete.id)) ||
      (m.blueAthlete?.id && rosterIds.has(m.blueAthlete.id)),
  );

  return (
    <DashboardShell
      role={t("coach.role_label")}
      navItems={nav}
      accentTitle={localizeName(app.tournament?.name) || t("applications.title")}
    >
      <Link
        to="/coach/tournaments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> {t("applications.all_applications")}
      </Link>

      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      {!user?.clubId && app.status === "DRAFT" && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {t("coach.no_club_warning_title")}
          </div>
          <div className="mt-1 text-amber-100/80">{t("applications.no_club_to_add_hint")}</div>
        </div>
      )}

      {app.status === "REJECTED" && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t("applications.rejected_needs_fix")}
          </div>
          {app.reviewerNotes && (
            <div className="mt-2 text-muted-foreground">{app.reviewerNotes}</div>
          )}
        </div>
      )}

      {app.status === "APPROVED" && app.reviewerNotes && (
        <div className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-emerald-300">{t("coach.admin_note")}:</span>{" "}
          {app.reviewerNotes}
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title={t("applications.tournament_info")}>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoItem
              icon={Trophy}
              label={t("common.tournament")}
              value={localizeName(app.tournament?.name) || "—"}
            />
            <InfoItem
              icon={CalendarDays}
              label={t("tournament.metric_start")}
              value={
                app.tournament?.startDate
                  ? new Date(app.tournament.startDate).toLocaleDateString("kk-KZ")
                  : "—"
              }
            />
            <InfoItem
              icon={Clock3}
              label={t("tournament.deadline")}
              value={deadline ? new Date(deadline).toLocaleString("kk-KZ") : "—"}
            />
            <InfoItem
              icon={MapPin}
              label={t("tournament.metric_location")}
              value={
                app.tournament?.location
                  ? `${app.tournament.location}, ${app.tournament.city}`
                  : (app.tournament?.status ?? "—")
              }
            />
            <InfoItem
              icon={Users}
              label={t("applications.club_athletes")}
              value={String(entriesCount)}
            />
            <InfoItem
              icon={CreditCard}
              label={t("payments.entry_fee")}
              value={formatKzt(app.tournament?.entryFeeKzt ?? 0)}
            />
          </div>
          {app.tournament?.posterUrl && (
            <a
              href={app.tournament.posterUrl}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
            >
              <ClipboardList className="h-4 w-4" />
              {t("coach.tournament_regulations")}
            </a>
          )}
        </Panel>

        <Panel title={t("applications.actions")} action={<StatusBadge status={app.status} />}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              {isEditable
                ? t("applications.draft_hint")
                : t("applications.not_editable_hint", {
                    status: String(t(`status.${app.status}`, app.status)),
                  })}
            </div>
            {!canManageApplication && app.status === "DRAFT" && (
              <div className="rounded-md border border-border/60 bg-background/30 p-3">
                {t("coach.view_only_desc")}
              </div>
            )}
            {app.submittedAt && (
              <div>
                {t("applications.submitted_at")}:{" "}
                {new Date(app.submittedAt).toLocaleString("kk-KZ")}
              </div>
            )}
            {app.reviewedAt && (
              <div>
                {t("applications.reviewed_at")}: {new Date(app.reviewedAt).toLocaleString("kk-KZ")}
              </div>
            )}
            <PaymentSummary app={app} entriesCount={entriesCount} />
            {canManageApplication && (app.status === "DRAFT" || app.status === "SUBMITTED") && (
              <button
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {withdraw.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Undo2 className="h-3.5 w-3.5" />
                )}
                {t("applications.withdraw")}
              </button>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title={`${t("applications.title")} · ${String(t(`status.${app.status}`, app.status))}`}
      >
        <div className="text-sm text-muted-foreground mb-4">
          {t("applications.entries_count", { count: entriesCount })}
          {!isEditable &&
            ` · ${t("applications.not_editable_short", { status: String(t(`status.${app.status}`, app.status)) })}`}
          {isEditable && deadlinePassed && ` · ${t("coach.deadline_passed_msg")}`}
        </div>

        {/* Текущие entries */}
        {entriesCount > 0 && (
          <div className="space-y-2 mb-6">
            {(app.entries ?? []).map((e: ApplicationEntry) => {
              if (!e.athlete) return null;
              const athlete = e.athlete;
              const moveCategories = categories.filter(
                (c: Category) => c.id !== e.category?.id && fitsCategory(athlete, c),
              );
              return (
                <div key={e.id} className="glass rounded-md p-3">
                  <div className="flex justify-between items-center gap-3">
                    <div>
                      <div className="font-medium text-sm">
                        {e.athlete.name} {e.athlete.surname}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.athlete.weightKg ? `${e.athlete.weightKg} ${t("common.kg")}` : ""}
                        {" · "}
                        {e.category?.gender === "MALE"
                          ? t("tournament.gender_male_abbr")
                          : t("tournament.gender_female_abbr")}{" "}
                        {e.category?.weightMin}-{e.category?.weightMax} {t("common.kg")}
                        {e.category?.ageMin
                          ? ` · ${e.category.ageMin}-${e.category.ageMax} ${t("common.years_short")}`
                          : ""}
                      </div>
                    </div>
                    {canEditRoster && (
                      <div className="flex items-center gap-1.5">
                        {moveCategories.length > 0 && (
                          <button
                            onClick={() => setShowMoveFor(showMoveFor === e.id ? null : e.id)}
                            disabled={movingEntry === e.id || removing === e.id}
                            className={`rounded-md p-2 disabled:opacity-50 transition-colors ${
                              showMoveFor === e.id
                                ? "bg-gold/15 text-gold"
                                : "text-muted-foreground hover:bg-gold/10 hover:text-gold"
                            }`}
                            aria-label={t("applications.move_category")}
                            title={t("applications.move_category")}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowMoveFor(null);
                            removeEntry.mutate(e.id);
                          }}
                          disabled={removing === e.id || movingEntry === e.id}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          aria-label={t("common.delete")}
                        >
                          {removing === e.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  {canEditRoster && showMoveFor === e.id && (
                    <div className="mt-2 border-t border-border/40 pt-2">
                      <div className="text-xs text-muted-foreground mb-1.5">
                        {t("applications.move_to_category")}:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {moveCategories.map((c: Category) => (
                          <button
                            key={c.id}
                            onClick={() =>
                              moveEntry.mutate({
                                entryId: e.id,
                                athleteId: athlete.id,
                                newCategoryId: c.id,
                              })
                            }
                            disabled={movingEntry === e.id}
                            className="text-xs px-2 py-1 rounded bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {movingEntry === e.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="h-3 w-3" />
                            )}
                            {c.gender === "MALE"
                              ? t("tournament.gender_male_abbr")
                              : t("tournament.gender_female_abbr")}{" "}
                            {c.weightMin}-{c.weightMax} {t("common.kg")}
                            <span className="text-gold/70">
                              {c.ageMin}-{c.ageMax} {t("common.years_short")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Форма добавления */}
        {canEditRoster && categoriesQuery.data && membersQuery.data && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-medium text-sm">{t("applications.add_athlete")}</h4>
              <div className="text-xs text-muted-foreground">
                {filteredAthletes.length} / {(membersQuery.data ?? []).length} көрсетілді
              </div>
            </div>
            <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(180px,1fr)_140px_minmax(180px,220px)_auto]">
              <input
                value={athleteSearch}
                onChange={(e) => setAthleteSearch(e.target.value)}
                placeholder={t("applications.search_by_name")}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-gold/60"
              />
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as "ALL" | "MALE" | "FEMALE")}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-gold/60"
              >
                <option value="ALL">{t("common.all")}</option>
                <option value="MALE">{t("tournament.gender_male_abbr")}</option>
                <option value="FEMALE">{t("tournament.gender_female_abbr")}</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-gold/60"
              >
                <option value="ALL">{t("applications.all_categories")}</option>
                {categories.map((category: Category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category, t)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyEligible}
                  onChange={(e) => setOnlyEligible(e.target.checked)}
                  className="accent-gold"
                />
                {t("applications.only_eligible")}
              </label>
            </div>
            {(categoriesQuery.data ?? []).length === 0 ? (
              <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                {t("applications.no_categories_hint")}
              </div>
            ) : (membersQuery.data ?? []).length === 0 ? (
              <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                {t("applications.no_club_athletes_hint")}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAthletes.map((athlete: User) => {
                  const alreadyIn = (app.entries ?? []).some(
                    (e: ApplicationEntry) => e.athleteId === athlete.id,
                  );
                  const relevantCategories =
                    categoryFilter === "ALL"
                      ? categoriesQuery.data!
                      : categoriesQuery.data!.filter(
                          (category: Category) => category.id === categoryFilter,
                        );
                  const matching = relevantCategories.filter((c: Category) =>
                    fitsCategory(athlete, c),
                  );
                  const issues = athleteEligibilityIssues(athlete, relevantCategories, t);

                  return (
                    <div
                      key={athlete.id}
                      className={`glass rounded-md p-3 ${alreadyIn ? "border-emerald-500/25" : matching.length === 0 ? "opacity-80" : ""}`}
                    >
                      <div className="flex flex-wrap justify-between items-start gap-3">
                        <div>
                          <div className="font-medium text-sm">
                            {athlete.name} {athlete.surname}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {athleteMeta(athlete, t)}
                          </div>
                        </div>
                        {alreadyIn && <StatusPill value="APPROVED" />}
                      </div>
                      {alreadyIn ? (
                        <div className="mt-2 text-xs text-emerald-300">
                          {t("applications.athlete_already_added")}
                        </div>
                      ) : matching.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {matching.map((c: Category) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                addEntry.mutate({ athleteId: athlete.id, categoryId: c.id })
                              }
                              disabled={adding === athlete.id}
                              className="text-xs px-2 py-1 rounded bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              {c.gender === "MALE"
                                ? t("tournament.gender_male_abbr")
                                : t("tournament.gender_female_abbr")}{" "}
                              {c.weightMin}-{c.weightMax} {t("common.kg")}
                              <span className="text-gold/70">
                                {c.ageMin}-{c.ageMax} {t("common.years_short")}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 rounded border border-border/40 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                          {t("applications.cannot_add")}: {issues.join("; ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isEditable && canManageApplication && (
          <div className="mt-6 rounded-lg border border-gold/25 bg-gold/5 p-4">
            <PaymentDraftSummary app={app} entriesCount={entriesCount} />
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={responsibilityAccepted}
                onChange={(e) => setResponsibilityAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 accent-gold"
              />
              <span className="text-muted-foreground">{t("coach.responsibility_text")}</span>
            </label>
            {paymentRequired && !paymentPaid && (
              <button
                type="button"
                onClick={() => payKaspi.mutate()}
                disabled={payKaspi.isPending || entriesCount === 0 || deadlinePassed}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/15 disabled:opacity-50"
              >
                {payKaspi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <CreditCard className="h-4 w-4" /> {t("payments.pay_kaspi")}
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => submit.mutate()}
              disabled={
                submit.isPending ||
                entriesCount === 0 ||
                !responsibilityAccepted ||
                deadlinePassed ||
                !paymentPaid
              }
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" /> {t("coach.submit_application")}
            </button>
            {entriesCount === 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("coach.add_athlete_first")}
              </div>
            )}
            {deadlinePassed && (
              <div className="mt-2 text-xs text-destructive">{t("coach.deadline_passed_msg")}</div>
            )}
            {paymentRequired && !paymentPaid && entriesCount > 0 && (
              <div className="mt-2 text-xs text-amber-200">{t("payments.pay_before_submit")}</div>
            )}
            {!responsibilityAccepted && entriesCount > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("coach.accept_responsibility_first")}
              </div>
            )}
          </div>
        )}
        {isEditable && !canManageApplication && (
          <div className="mt-6 rounded-md border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
            {t("applications.contact_owner_hint")}
          </div>
        )}
      </Panel>

      <div className="mt-6">
        <ApplicationHistory applicationId={id} />
      </div>

      <div className="mt-6">
        <Panel title={`${t("applications.club_matches_table")} ${clubMatches.length}`}>
          {matchesQuery.isLoading ? (
            <LoadingState />
          ) : clubMatches.length === 0 ? (
            <EmptyState
              title={t("applications.no_match_schedule")}
              hint={t("applications.no_match_schedule_hint")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("tournament.metric_tatami")}</th>
                    <th>{t("tournament.round_label")}</th>
                    <th>{t("matches.side_red")}</th>
                    <th>{t("matches.side_blue")}</th>
                    <th>{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {clubMatches.map((m: Match) => (
                    <tr key={m.id} className="hover:bg-gold/5">
                      <td className="py-2.5">{m.tatamiNumber ?? "—"}</td>
                      <td className="text-xs text-muted-foreground">
                        {m.bracketSection ?? "main"} · {m.round}
                      </td>
                      <td
                        className={
                          rosterIds.has(m.redAthlete?.id ?? "") ? "font-medium text-gold" : ""
                        }
                      >
                        {athleteName(m.redAthlete)}
                      </td>
                      <td
                        className={
                          rosterIds.has(m.blueAthlete?.id ?? "") ? "font-medium text-gold" : ""
                        }
                      >
                        {athleteName(m.blueAthlete)}
                      </td>
                      <td>
                        <StatusPill value={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function PaymentSummary({ app, entriesCount }: { app: Application; entriesCount: number }) {
  const { t } = useTranslation();
  const fee = Number(app.tournament?.entryFeeKzt ?? 0);
  const expectedTotal = fee * entriesCount;
  const total = Number(app.paymentAmountKzt || expectedTotal || 0);
  const needsPayment = total > 0;

  if (!needsPayment) {
    return (
      <div>
        {t("payments.status")}: {t("payments.not_required")}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("payments.status")}
          </div>
          <div className="mt-1 font-medium">
            {String(
              t(`payments.status_${app.paymentStatus ?? "PENDING"}`, {
                defaultValue: app.paymentStatus ?? "PENDING",
              }),
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            {entriesCount} × {formatKzt(fee)}
          </div>
          <div className="font-display text-xl font-bold text-gold">{formatKzt(total)}</div>
        </div>
      </div>
      {app.paymentReference && (
        <div className="mt-2 text-xs text-muted-foreground">
          {t("payments.reference")}: {app.paymentReference}
        </div>
      )}
      {app.paymentStatus === "PENDING" && app.paymentUrl && (
        <a
          href={app.paymentUrl}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-xs font-semibold text-gold-foreground shadow-gold"
        >
          <CreditCard className="h-4 w-4" />
          {t("payments.pay_kaspi")}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {app.paymentStatus === "PENDING" && !app.paymentUrl && (
        <div className="mt-2 text-xs text-amber-200">{t("payments.no_kaspi_url")}</div>
      )}
      {app.paidAt && (
        <div className="mt-2 text-xs text-emerald-300">
          {t("payments.paid_at")}: {new Date(app.paidAt).toLocaleString("kk-KZ")}
        </div>
      )}
    </div>
  );
}

function PaymentDraftSummary({ app, entriesCount }: { app: Application; entriesCount: number }) {
  const { t } = useTranslation();
  const fee = Number(app.tournament?.entryFeeKzt ?? 0);
  if (fee <= 0) return null;
  return (
    <div className="mb-4 rounded-md border border-border/60 bg-background/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">{t("payments.to_pay_before_submit")}</span>
        <span className="font-display text-xl font-bold text-gold">
          {formatKzt(fee * entriesCount)}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {entriesCount} × {formatKzt(fee)}
      </div>
      <div
        className={`mt-2 text-xs ${app.paymentStatus === "PAID" ? "text-emerald-300" : "text-amber-200"}`}
      >
        {String(
          t(`payments.status_${app.paymentStatus ?? "PENDING"}`, {
            defaultValue: app.paymentStatus ?? "PENDING",
          }),
        )}
      </div>
    </div>
  );
}

function ApplicationHistory({ applicationId }: { applicationId: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["application-history", applicationId],
    queryFn: () => api.applications.history(applicationId),
    staleTime: 30_000,
  });

  const actionMeta: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    "application.submit": {
      label: t("status.SUBMITTED"),
      icon: Send,
      color: "text-gold border-gold/40 bg-gold/10",
    },
    "application.approve": {
      label: t("status.APPROVED"),
      icon: CheckCircle2,
      color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    },
    "application.reject": {
      label: t("status.REJECTED"),
      icon: XCircle,
      color: "text-destructive border-destructive/40 bg-destructive/10",
    },
    "application.withdraw": {
      label: t("status.WITHDRAWN"),
      icon: Undo2,
      color: "text-muted-foreground border-border bg-muted/20",
    },
  };

  const items = q.data ?? [];

  return (
    <Panel
      title={t("applications.history")}
      action={<History className="h-4 w-4 text-muted-foreground" />}
    >
      {q.isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title={t("applications.no_history")} hint={t("applications.no_history_hint")} />
      ) : (
        <ol className="relative border-l border-border/40 ml-3 space-y-4">
          {items.map((log: import("@/lib/api-types").AuditLog) => {
            const meta = actionMeta[log.action] ?? {
              label: log.action,
              icon: Clock3,
              color: "text-muted-foreground border-border bg-muted/20",
            };
            const Icon = meta.icon;
            const notes = (log.after as Record<string, unknown>)?.reviewerNotes as
              | string
              | undefined;
            const actor = log.actor;
            return (
              <li key={log.id} className="ml-5">
                <span
                  className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border ${meta.color}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="glass rounded-lg px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${meta.color.split(" ")[0]}`}>
                      {meta.label}
                    </span>
                    <time className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("kk-KZ")}
                    </time>
                  </div>
                  {actor && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {actor.name} {actor.surname}
                      {actor.role === "ADMIN" && ` · ${t("admin.role_label")}`}
                    </div>
                  )}
                  {notes && (
                    <div className="mt-2 border-l-2 border-gold/40 pl-3 text-xs text-muted-foreground">
                      {notes}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-gold" />
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const c = statusClass(status);
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${c}`}>
      {String(t(`status.${status}`, status))}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  const { t } = useTranslation();
  const c = statusClass(value);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${c}`}>
      {String(t(`status.${value}`, value))}
    </span>
  );
}

function statusClass(status: string): string {
  const m: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-gold/15 text-gold border border-gold/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    REJECTED: "bg-destructive/15 text-destructive border border-destructive/40",
    WITHDRAWN: "bg-muted text-muted-foreground",
    PENDING: "bg-muted text-muted-foreground",
    IN_PROGRESS: "bg-gold/15 text-gold border border-gold/30",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  };
  return m[status] ?? "bg-muted text-muted-foreground";
}

function athleteName(a: User | null | undefined): string {
  if (!a) return "—";
  return `${a.name ?? ""} ${a.surname ?? ""}`.trim() || "—";
}

function fitsCategory(athlete: User | null | undefined, category: Category): boolean {
  if (!athlete) return false;
  if (athlete.gender !== category.gender) return false;
  if (!athlete.weightKg) return false;
  if (!athlete.dateOfBirth) return false;
  const age = getAge(athlete.dateOfBirth);
  return (
    age >= category.ageMin &&
    age <= category.ageMax &&
    athlete.weightKg > category.weightMin &&
    athlete.weightKg <= category.weightMax
  );
}

function athleteEligibilityIssues(
  athlete: User,
  categories: Category[],
  t: (k: string, opts?: Record<string, unknown>) => string,
): string[] {
  const issues: string[] = [];
  if (!athlete.gender) issues.push(t("coach.mismatch_no_gender"));
  if (!athlete.dateOfBirth) issues.push(t("coach.mismatch_no_dob"));
  if (!athlete.weightKg) issues.push(t("coach.mismatch_no_weight"));
  if (issues.length > 0) return issues;

  const sameGender = categories.filter((category: Category) => category.gender === athlete.gender);
  if (sameGender.length === 0) return [t("applications.no_gender_category")];

  const age = getAge(athlete.dateOfBirth!);
  const ageMatches = sameGender.filter(
    (category: Category) => age >= category.ageMin && age <= category.ageMax,
  );
  if (ageMatches.length === 0) return [t("applications.age_mismatch", { age })];

  const weightMatches = ageMatches.filter(
    (category: Category) =>
      athlete.weightKg! > category.weightMin && athlete.weightKg! <= category.weightMax,
  );
  if (weightMatches.length === 0)
    return [t("applications.weight_mismatch", { weight: athlete.weightKg })];

  return [t("applications.no_matching_category")];
}

function athleteMeta(athlete: User, t: (k: string) => string): string {
  const gender =
    athlete.gender === "MALE"
      ? t("tournament.gender_male_abbr")
      : athlete.gender === "FEMALE"
        ? t("tournament.gender_female_abbr")
        : t("coach.mismatch_no_gender");
  const weight = athlete.weightKg
    ? `${athlete.weightKg} ${t("common.kg")}`
    : t("coach.mismatch_no_weight");
  const age = athlete.dateOfBirth
    ? `${getAge(athlete.dateOfBirth)} ${t("common.years_short")}`
    : t("coach.mismatch_no_dob");
  return `${gender} · ${weight} · ${age}`;
}

function sortAthletesByAgeWeightName(a: User, b: User): number {
  const ageA = a.dateOfBirth ? getAge(a.dateOfBirth) : Number.MAX_SAFE_INTEGER;
  const ageB = b.dateOfBirth ? getAge(b.dateOfBirth) : Number.MAX_SAFE_INTEGER;
  if (ageA !== ageB) return ageA - ageB;
  const weightA = Number(a.weightKg ?? Number.MAX_SAFE_INTEGER);
  const weightB = Number(b.weightKg ?? Number.MAX_SAFE_INTEGER);
  if (weightA !== weightB) return weightA - weightB;
  return athleteName(a).localeCompare(athleteName(b), "ru");
}

function categoryLabel(category: Category, t: (k: string) => string): string {
  return `${category.gender === "MALE" ? t("tournament.gender_male_abbr") : t("tournament.gender_female_abbr")} ${category.ageMin}-${category.ageMax} ${t("common.years_short")} ${category.weightMin}-${category.weightMax} ${t("common.kg")}`;
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function localizeName(n: import("@/lib/api-types").LocalizedName): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "";
}

function formatKzt(value: number): string {
  return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
}
