import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ClipboardList,
  Clock,
  CheckCircle2,
  Download,
  CreditCard,
  ExternalLink,
  GitBranch,
  Loader2,
  MapPin,
  Plus,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useMemo, useState } from "react";
import {
  DashboardShell,
  EmptyState,
  LoadingState,
  Panel,
} from "@/components/dashboard/DashboardShell";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { api, ApiError } from "@/lib/api";
import type {
  Application,
  ApplicationEntry,
  Category,
  User,
  Match,
  Bracket,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useRealtime } from "@/lib/socket";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс санаттары — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachTournamentDetail />
    </ProtectedRoute>
  ),
});

type GroupFilter = "ALL" | "MALE" | "FEMALE";

function CoachTournamentDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/coach/tournaments/$id" });
  const { user } = useAuth();
  const canManageApplications = user?.clubRole === "OWNER";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<GroupFilter>("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [showCompRulesModal, setShowCompRulesModal] = useState(false);
  const [error, setError] = useState("");

  const tQuery = useQuery({
    queryKey: ["coach-tournament", id],
    queryFn: () => api.tournaments.get(id),
  });
  const appsQuery = useQuery({
    queryKey: ["coach-tournament-application", id],
    queryFn: () => api.tournaments.applications(id),
  });
  const membersQuery = useQuery({
    queryKey: ["club-members", user?.clubId],
    queryFn: () => (user?.clubId ? api.clubs.members(user.clubId) : []),
    enabled: !!user?.clubId,
  });
  const bracketsQuery = useQuery({
    queryKey: ["coach-tournament-brackets", id],
    queryFn: () => api.brackets.forTournament(id),
  });
  const matchesQuery = useQuery({
    queryKey: ["coach-tournament-matches", id],
    queryFn: () => api.matches.list({ tournamentId: id, limit: 500 }),
  });

  useRealtime([`tournament:${id}`], {
    "bracket:update": () => {
      qc.invalidateQueries({ queryKey: ["coach-tournament-brackets", id] });
      qc.invalidateQueries({ queryKey: ["coach-tournament-matches", id] });
    },
    "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["coach-tournament-matches", id] }),
    "match:finished": () => qc.invalidateQueries({ queryKey: ["coach-tournament-matches", id] }),
    "match:started": () => qc.invalidateQueries({ queryKey: ["coach-tournament-matches", id] }),
  });

  const createApplication = useMutation({
    mutationFn: () => api.tournaments.createApplication(id),
    onSuccess: (app) => {
      setError("");
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
      navigate({ to: "/coach/applications/$id", params: { id: app.id } });
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach.application_open_error")),
  });

  const addEntry = useMutation({
    mutationFn: async ({ athleteId, categoryId }: { athleteId: string; categoryId: string }) => {
      const app = ownApplication ?? (await api.tournaments.createApplication(id));
      return api.applications.addEntry(app.id, athleteId, categoryId);
    },
    onMutate: ({ athleteId, categoryId }) => {
      setAdding(`${athleteId}:${categoryId}`);
      setError("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach.athlete_add_error")),
    onSettled: () => setAdding(null),
  });

  const addEligible = useMutation({
    mutationFn: async ({ athletes, categoryId }: { athletes: User[]; categoryId: string }) => {
      const app = ownApplication ?? (await api.tournaments.createApplication(id));
      for (const athlete of athletes) {
        await api.applications.addEntry(app.id, athlete.id, categoryId);
      }
      return app;
    },
    onMutate: ({ categoryId }) => {
      setAdding(`all:${categoryId}`);
      setError("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach.athletes_add_error")),
    onSettled: () => setAdding(null),
  });

  const submitApplication = useMutation({
    mutationFn: () => {
      if (!ownApplication) throw new Error("NO_APPLICATION");
      return api.applications.submit(ownApplication.id);
    },
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach.application_submit_error")),
  });
  const payKaspi = useMutation({
    mutationFn: () => {
      if (!ownApplication) throw new Error("NO_APPLICATION");
      return api.applications.payKaspi(ownApplication.id);
    },
    onSuccess: (updated: Application) => {
      setError("");
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
      if (updated?.paymentUrl) {
        window.location.assign(updated.paymentUrl);
      }
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const ownApplication = appsQuery.data?.[0] ?? null;
  const entries = useMemo(() => ownApplication?.entries ?? [], [ownApplication]);
  const enteredByCategory = useMemo(() => {
    const map = new Map<string, ApplicationEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.categoryId) ?? [];
      list.push(entry);
      map.set(entry.categoryId, list);
    }
    return map;
  }, [entries]);
  const entryIssues = useMemo(
    () =>
      entries.map((entry: ApplicationEntry) => ({
        entry,
        issues: validateApplicationEntry(entry, t),
      })),
    [entries, t],
  );
  const invalidEntryCount = entryIssues.filter(
    (item: { entry: ApplicationEntry; issues: string[] }) => item.issues.length > 0,
  ).length;
  const enteredCategoryCount = enteredByCategory.size;
  const entryFeeKzt = Number(tQuery.data?.entryFeeKzt ?? 0);
  const paymentTotalKzt = entryFeeKzt * entries.length;
  const paymentRequired = !!ownApplication && paymentTotalKzt > 0;
  const paymentPaid =
    !paymentRequired ||
    (ownApplication?.paymentStatus === "PAID" &&
      Number(ownApplication?.paymentAmountKzt ?? 0) >= paymentTotalKzt);

  if (tQuery.isLoading) {
    return (
      <DashboardShell role={t("coach.role_label")} navItems={nav} accentTitle={t("common.loading")}>
        <LoadingState />
      </DashboardShell>
    );
  }

  const tournament = tQuery.data;
  if (!tournament) {
    return (
      <DashboardShell
        role={t("coach.role_label")}
        navItems={nav}
        accentTitle={t("tournament.not_found")}
      >
        <EmptyState title={t("tournament.not_found")} />
      </DashboardShell>
    );
  }

  const categories = (tournament.categories ?? [])
    .filter((category: Category) => filter === "ALL" || category.gender === filter)
    .sort(sortCategoriesByAgeWeight);
  const categoryCount = tournament.categories?.length ?? 0;
  const deadline = tournament.applicationDeadline ?? tournament.startDate;
  const deadlinePassed = new Date(deadline).getTime() < Date.now();
  const myAthleteIds = new Set((membersQuery.data ?? []).map((athlete: User) => athlete.id));
  const clubMatches = (matchesQuery.data ?? []).filter(
    (match: Match) =>
      (match.redAthlete?.id && myAthleteIds.has(match.redAthlete.id)) ||
      (match.blueAthlete?.id && myAthleteIds.has(match.blueAthlete.id)),
  );

  return (
    <DashboardShell
      role={t("coach.role_label")}
      navItems={nav}
      accentTitle={localizeName(tournament.name)}
    >
      <Link
        to="/coach/tournaments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" /> {t("tournaments_page.all_tournaments")}
      </Link>

      {error && (
        <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!user?.clubId && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {t("coach.no_club_warning_title")}
          </div>
          <div className="mt-1 text-amber-100/80">{t("coach.no_club_warning_desc")}</div>
        </div>
      )}

      <div className="mb-6 glass rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusBadge status={tournament.status} />
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <Info icon={Calendar}>{dateRange(tournament.startDate, tournament.endDate)}</Info>
              <Info icon={Calendar}>
                {t("coach.deadline_label")}: {new Date(deadline).toLocaleString("kk-KZ")}
              </Info>
              <Info icon={MapPin}>
                {tournament.location}, {tournament.city}
              </Info>
              <Info icon={Clock}>{formatWeighIn(tournament, t)}</Info>
              <Info icon={CreditCard}>
                {t("payments.entry_fee")}: {formatKzt(tournament.entryFeeKzt ?? 0)}
              </Info>
              <Info icon={Users}>{t("coach.my_athletes_info", { count: entries.length })}</Info>
              <Info icon={GitBranch}>
                {t("coach.brackets_info", { count: bracketsQuery.data?.length ?? 0 })}
              </Info>
            </div>
            {tournament.posterUrl && (
              <a
                href={tournament.posterUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
              >
                <ClipboardList className="h-4 w-4" />
                {t("coach.tournament_regulations")}
              </a>
            )}
            {tournament.mapUrl && (
              <a
                href={tournament.mapUrl}
                target="_blank"
                rel="noopener"
                className="ml-2 mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm hover:border-gold/40"
              >
                <MapPin className="h-4 w-4" />
                {t("coach.map")}
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ownApplication ? (
              <Link
                to="/coach/applications/$id"
                params={{ id: ownApplication.id }}
                className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
              >
                <ClipboardList className="h-4 w-4" /> {t("coach.open_application")}
              </Link>
            ) : tournament.status === "REGISTRATION_OPEN" &&
              !deadlinePassed &&
              canManageApplications &&
              categoryCount > 0 ? (
              <button
                onClick={() => createApplication.mutate()}
                disabled={createApplication.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm text-gold-foreground shadow-gold disabled:opacity-60"
              >
                {createApplication.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t("coach.create_application")}
              </button>
            ) : tournament.status === "DRAFT" ? (
              <ApplyUnavailable reason={t("coach.registration_not_open")} />
            ) : categoryCount === 0 ? (
              <ApplyUnavailable reason={t("coach.no_categories_to_apply")} />
            ) : tournament.status === "REGISTRATION_OPEN" && !deadlinePassed && !user?.clubId ? (
              <ApplyUnavailable reason={t("coach.no_club_short")} />
            ) : tournament.status === "REGISTRATION_OPEN" &&
              !deadlinePassed &&
              !canManageApplications ? (
              <ApplyUnavailable reason={t("coach.only_owner_can_apply")} />
            ) : tournament.status === "REGISTRATION_OPEN" && deadlinePassed ? (
              <ApplyUnavailable reason={t("coach.deadline_passed")} danger />
            ) : (
              <ApplyUnavailable reason={t("coach.registration_closed")} />
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t("coach.tournament_full_info")}>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Info icon={Calendar}>{dateRange(tournament.startDate, tournament.endDate)}</Info>
            <Info icon={Calendar}>
              {t("tournament.deadline")}: {new Date(deadline).toLocaleString("kk-KZ")}
            </Info>
            <Info icon={MapPin}>
              {tournament.location}, {tournament.city}
            </Info>
            <Info icon={Clock}>{formatWeighIn(tournament, t)}</Info>
          </div>
          {localizeName(tournament.description) && (
            <p className="mt-4 border-t border-border/30 pt-4 text-sm leading-relaxed text-muted-foreground">
              {localizeName(tournament.description)}
            </p>
          )}
        </Panel>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <iframe
            title="Tournament map"
            src={mapEmbedUrl(tournament)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MiniStat
          label={t("tournament.stat_categories")}
          value={tournament.categories?.length ?? 0}
        />
        <MiniStat
          label={t("coach.male_count")}
          value={(tournament.categories ?? []).filter((c: Category) => c.gender === "MALE").length}
        />
        <MiniStat
          label={t("coach.female_count")}
          value={
            (tournament.categories ?? []).filter((c: Category) => c.gender === "FEMALE").length
          }
        />
        <MiniStat label={t("dashboard.matches")} value={clubMatches.length} />
      </div>

      {ownApplication && (
        <Panel
          title={t("coach.my_application")}
          action={<ApplicationStatusBadge status={ownApplication.status} />}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ApplicationMetric label={t("dashboard.athletes")} value={entries.length} />
            <ApplicationMetric label={t("common.category")} value={enteredCategoryCount} />
            <ApplicationMetric
              label={t("coach.check_label")}
              value={
                invalidEntryCount ? t("coach.issues_count", { count: invalidEntryCount }) : "OK"
              }
              tone={invalidEntryCount ? "red" : "green"}
            />
            <ApplicationMetric
              label={t("common.status")}
              value={String(t(`status.${ownApplication.status}`, ownApplication.status))}
              tone={
                ownApplication.status === "APPROVED"
                  ? "green"
                  : ownApplication.status === "REJECTED"
                    ? "red"
                    : "gold"
              }
            />
            <ApplicationMetric
              label={t("payments.status")}
              value={String(
                t(
                  `payments.status_${ownApplication.paymentStatus ?? "NOT_REQUIRED"}`,
                  ownApplication.paymentStatus ?? "NOT_REQUIRED",
                ),
              )}
              tone={
                ownApplication.paymentStatus === "PAID"
                  ? "green"
                  : ownApplication.paymentStatus === "PENDING"
                    ? "gold"
                    : undefined
              }
            />
          </div>
          {ownApplication.reviewerNotes && (
            <div
              className={`mt-4 rounded-md border p-3 text-sm ${
                ownApplication.status === "REJECTED"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-gold/30 bg-gold/10 text-gold"
              }`}
            >
              <div className="mb-1 text-xs uppercase tracking-widest">
                {ownApplication.status === "REJECTED"
                  ? t("coach.admin_rejection_reason")
                  : t("coach.admin_note")}
              </div>
              {ownApplication.reviewerNotes}
            </div>
          )}
          {invalidEntryCount > 0 && (
            <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {t("coach.invalid_entries_warning")}
              </div>
              <div className="mt-1 text-xs text-amber-100/80">
                {t("coach.invalid_entries_detail")}
              </div>
            </div>
          )}
        </Panel>
      )}

      <Panel
        title={t("coach.categories_and_groups")}
        action={
          <div className="flex gap-2">
            {(["ALL", "MALE", "FEMALE"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  filter === value
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "ALL"
                  ? t("common.all")
                  : value === "MALE"
                    ? t("tournament.gender_male_abbr")
                    : t("tournament.gender_female_abbr")}
              </button>
            ))}
          </div>
        }
      >
        {categories.length === 0 ? (
          <EmptyState title={t("tournament.no_categories")} />
        ) : (
          <div className="space-y-4">
            {categories.map((category: Category) => {
              const bracket = bracketsQuery.data?.find(
                (b: Bracket) => b.categoryId === category.id,
              );
              const categoryEntries = enteredByCategory.get(category.id) ?? [];
              const eligible = (membersQuery.data ?? []).filter((athlete: User) =>
                fitsCategory(athlete, category),
              );
              const ineligiblePreview = (membersQuery.data ?? [])
                .filter((athlete: User) => !fitsCategory(athlete, category))
                .slice(0, 4);
              const enteredIds = new Set(
                categoryEntries.map((entry: ApplicationEntry) => entry.athleteId),
              );
              const eligibleToAdd = eligible.filter((athlete: User) => !enteredIds.has(athlete.id));
              const categoryMatches = clubMatches.filter(
                (match: Match) => match.bracket?.categoryId === category.id,
              );
              const isOpenDraft =
                canManageApplications &&
                tournament.status === "REGISTRATION_OPEN" &&
                !deadlinePassed &&
                (!ownApplication || ownApplication.status === "DRAFT");

              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-border/60 bg-background/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-lg font-semibold">
                          {categoryTitle(category)}
                        </div>
                        <FormatBadge format={category.format} />
                        {bracket && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                            {t("coach.bracket_ready")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {category.gender === "MALE"
                          ? t("tournament.gender_male_abbr")
                          : t("tournament.gender_female_abbr")}{" "}
                        · {category.ageMin}-{category.ageMax} {t("common.years_short")} · (
                        {category.weightMin}, {category.weightMax}] {t("common.kg")} ·{" "}
                        {category.matchDurationSec}с
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bracket && (
                        <>
                          <button
                            onClick={() =>
                              setSelectedCategoryId(
                                selectedCategoryId === category.id ? null : category.id,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
                          >
                            <GitBranch className="h-3.5 w-3.5" />{" "}
                            {selectedCategoryId === category.id
                              ? t("common.close")
                              : t("coach.bracket")}
                          </button>
                          <a
                            href={api.admin.bracketPdfUrl(bracket.id)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-gold"
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                        {t("coach.my_athletes_section")}
                      </div>
                      {isOpenDraft && eligibleToAdd.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            addEligible.mutate({ athletes: eligibleToAdd, categoryId: category.id })
                          }
                          disabled={!!adding}
                          className="mb-3 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold hover:bg-gold/15 disabled:opacity-50"
                        >
                          {adding === `all:${category.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          {t("coach.add_all_eligible", { count: eligibleToAdd.length })}
                        </button>
                      )}
                      {eligible.length === 0 ? (
                        <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                          <div>{t("coach.no_eligible_athletes")}</div>
                          {ineligiblePreview.length > 0 && (
                            <div className="mt-3 space-y-1 text-xs">
                              {ineligiblePreview.map((athlete: User) => (
                                <div key={athlete.id}>
                                  {athlete.name} {athlete.surname}:{" "}
                                  {categoryMismatchReason(athlete, category, t)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {eligible.map((athlete: User) => {
                            const alreadyIn = enteredIds.has(athlete.id);
                            const isAdding = adding === `${athlete.id}:${category.id}`;
                            return (
                              <div
                                key={athlete.id}
                                className="rounded-md border border-border/50 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-medium text-sm">
                                      {athlete.name} {athlete.surname}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {athlete.dateOfBirth ? getAge(athlete.dateOfBirth) : "—"}{" "}
                                      {t("common.years_short")} · {athlete.weightKg}{" "}
                                      {t("common.kg")} · {athlete.beltRank ?? "—"}
                                    </div>
                                  </div>
                                  {alreadyIn ? (
                                    <EntryCheckBadge
                                      issues={validateApplicationEntry(
                                        categoryEntries.find(
                                          (entry: ApplicationEntry) =>
                                            entry.athleteId === athlete.id,
                                        ) ?? ({ athlete, category } as ApplicationEntry),
                                        t,
                                      )}
                                    />
                                  ) : isOpenDraft ? (
                                    <button
                                      onClick={() =>
                                        addEntry.mutate({
                                          athleteId: athlete.id,
                                          categoryId: category.id,
                                        })
                                      }
                                      disabled={!!adding}
                                      className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
                                    >
                                      {isAdding ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Plus className="h-3 w-3" />
                                      )}
                                      {t("common.add")}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                        {t("dashboard.matches")}
                      </div>
                      {categoryMatches.length === 0 ? (
                        <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                          {t("coach.no_club_matches")}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {categoryMatches.map((match: Match) => (
                            <div
                              key={match.id}
                              className="rounded-md border border-border/50 p-3 text-xs"
                            >
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                  {t("tournament.metric_tatami")} {match.tatamiNumber ?? "—"} · R
                                  {match.round}
                                </span>
                                <MatchStatusBadge status={match.status} />
                              </div>
                              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                                <span
                                  className={
                                    myAthleteIds.has(match.redAthlete?.id ?? "")
                                      ? "font-medium text-gold"
                                      : ""
                                  }
                                >
                                  {athleteName(match.redAthlete)}
                                </span>
                                <span className="text-muted-foreground">vs</span>
                                <span
                                  className={
                                    myAthleteIds.has(match.blueAthlete?.id ?? "")
                                      ? "font-medium text-gold"
                                      : ""
                                  }
                                >
                                  {athleteName(match.blueAthlete)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedCategoryId === category.id && bracket && (
                    <div className="mt-4 rounded-lg border border-gold/20 p-4">
                      <LiveBracket tournamentId={id} categoryId={category.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {ownApplication?.status === "DRAFT" && canManageApplications && (
        <Panel title={t("coach.finalize_application")}>
          {showCompRulesModal && (
            <CompetitionRulesModal
              onAgree={() => {
                setResponsibilityAccepted(true);
                setShowCompRulesModal(false);
              }}
              onClose={() => setShowCompRulesModal(false)}
            />
          )}
          <div className="rounded-lg border border-gold/25 bg-gold/5 p-4">
            {entries.length > 0 && (
              <div className="mb-4 space-y-2">
                {entryIssues.map(
                  ({ entry, issues }: { entry: ApplicationEntry; issues: string[] }) => (
                    <div
                      key={entry.id}
                      className={`rounded-md border px-3 py-2 text-sm ${issues.length ? "border-amber-500/40 bg-amber-500/10" : "border-border/50 bg-background/30"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {entry.athlete?.name} {entry.athlete?.surname}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {categoryTitle(entry.category)}
                          </div>
                        </div>
                        <EntryCheckBadge issues={issues} />
                      </div>
                      {issues.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-amber-100">
                          {issues.map((issue: string) => (
                            <span key={issue} className="rounded-full bg-amber-500/15 px-2 py-0.5">
                              {issue}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Responsibility / Rules block */}
            {paymentRequired && (
              <div className="mb-4 rounded-lg border border-border/50 bg-background/30 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("payments.to_pay_before_submit")}
                  </span>
                  <span className="font-display text-xl font-bold text-gold">
                    {formatKzt(entryFeeKzt * entries.length)}
                  </span>
                </div>
                <div
                  className={`mt-2 text-xs ${paymentPaid ? "text-emerald-300" : "text-amber-200"}`}
                >
                  {String(
                    t(`payments.status_${ownApplication.paymentStatus ?? "PENDING"}`, {
                      defaultValue: ownApplication.paymentStatus ?? "PENDING",
                    }),
                  )}
                </div>
                {!paymentPaid && (
                  <button
                    type="button"
                    onClick={() => payKaspi.mutate()}
                    disabled={payKaspi.isPending || entries.length === 0 || deadlinePassed}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/15 disabled:opacity-50"
                  >
                    {payKaspi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CreditCard className="h-4 w-4" /> {t("payments.pay_kaspi")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Responsibility / Rules block */}
            {responsibilityAccepted ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <span className="font-medium">
                  Жарыс ережелері мен жауапкершілік шарттары қабылданды
                </span>
                <button
                  type="button"
                  onClick={() => setResponsibilityAccepted(false)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Өзгерту
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <div className="font-semibold text-amber-200">
                      {t("coach_rules.required_title")}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("coach_rules.required_hint")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCompRulesModal(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-colors"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Ережелермен танысу және растау
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => submitApplication.mutate()}
              disabled={
                submitApplication.isPending ||
                entries.length === 0 ||
                !responsibilityAccepted ||
                deadlinePassed ||
                invalidEntryCount > 0 ||
                !paymentPaid
              }
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {submitApplication.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("coach.submit_application")}
            </button>
            {entries.length === 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("coach.add_athlete_first")}
              </div>
            )}
            {deadlinePassed && (
              <div className="mt-2 text-xs text-destructive">{t("coach.deadline_passed_msg")}</div>
            )}
            {invalidEntryCount > 0 && (
              <div className="mt-2 text-xs text-amber-200">{t("coach.fix_invalid_entries")}</div>
            )}
            {paymentRequired && !paymentPaid && entries.length > 0 && (
              <div className="mt-2 text-xs text-amber-200">{t("payments.pay_before_submit")}</div>
            )}
            {!responsibilityAccepted && entries.length > 0 && (
              <div className="mt-2 text-xs text-amber-300">
                ⚠ Жіберу үшін алдымен ережелермен танысып, растаңыз
              </div>
            )}
          </div>
        </Panel>
      )}
      {ownApplication?.status === "DRAFT" && !canManageApplications && (
        <Panel title={t("coach.view_only_mode")}>
          <div className="rounded-md border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
            {t("coach.view_only_desc")}
          </div>
        </Panel>
      )}
    </DashboardShell>
  );
}

function ApplyUnavailable({ reason, danger }: { reason: string; danger?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${danger ? "border-destructive/30 text-destructive" : "border-border text-muted-foreground"}`}
    >
      <div className="font-medium">{t("coach.apply_tournament")}</div>
      <div className="mt-0.5 text-xs">{reason}</div>
    </div>
  );
}

function Info({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 text-gold/70" /> {children}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

function ApplicationMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "gold" | "green" | "red";
}) {
  const toneClass =
    tone === "gold"
      ? "text-gold"
      : tone === "green"
        ? "text-emerald-300"
        : tone === "red"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { c: string; key: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", key: "status.DRAFT" },
    REGISTRATION_OPEN: {
      c: "bg-gold/15 text-gold border border-gold/30",
      key: "status.REGISTRATION_OPEN",
    },
    REGISTRATION_CLOSED: {
      c: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      key: "status.REGISTRATION_CLOSED",
    },
    IN_PROGRESS: {
      c: "bg-destructive/20 text-destructive border border-destructive/40",
      key: "status.IN_PROGRESS",
    },
    COMPLETED: {
      c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      key: "status.COMPLETED",
    },
  };
  const item = map[status] ?? { c: "bg-muted text-muted-foreground", key: "" };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${item.c}`}>
      {item.key ? String(t(item.key, status)) : status}
    </span>
  );
}

function ApplicationStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { c: string; key: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", key: "status.DRAFT" },
    SUBMITTED: { c: "bg-gold/15 text-gold border border-gold/30", key: "status.SUBMITTED" },
    APPROVED: {
      c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      key: "status.APPROVED",
    },
    REJECTED: {
      c: "bg-destructive/15 text-destructive border border-destructive/30",
      key: "status.REJECTED",
    },
    WITHDRAWN: { c: "bg-muted text-muted-foreground", key: "status.WITHDRAWN" },
  };
  const item = map[status] ?? { c: "bg-muted text-muted-foreground", key: "" };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${item.c}`}>
      {item.key ? String(t(item.key, status)) : status}
    </span>
  );
}

function EntryCheckBadge({ issues }: { issues: string[] }) {
  const { t } = useTranslation();
  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> OK
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">
      {t("coach.issues_count", { count: issues.length })}
    </span>
  );
}

function MatchStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { c: string; key: string }> = {
    PENDING: { c: "bg-muted text-muted-foreground", key: "status.PENDING" },
    IN_PROGRESS: { c: "bg-gold/15 text-gold border border-gold/30", key: "status.IN_PROGRESS" },
    COMPLETED: {
      c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      key: "status.COMPLETED",
    },
  };
  const item = map[status] ?? { c: "bg-muted text-muted-foreground", key: "" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.c}`}>
      {item.key ? String(t(item.key, status)) : status}
    </span>
  );
}

function FormatBadge({ format }: { format: string }) {
  const { t } = useTranslation();
  return (
    <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
      {String(t(`format.${format}`, format))}
    </span>
  );
}

function categoryTitle(category: Category | null | undefined): string {
  if (!category) return "";
  const custom = localizeName(category.name);
  if (custom) return custom;
  return `${category.gender === "MALE" ? "M" : "F"} ${category.ageMin}-${category.ageMax} ${category.weightMin}-${category.weightMax}kg`;
}

function sortCategoriesByAgeWeight(a: Category, b: Category): number {
  if (a.gender !== b.gender) return String(a.gender).localeCompare(String(b.gender));
  if (a.ageMin !== b.ageMin) return Number(a.ageMin) - Number(b.ageMin);
  if (a.weightMin !== b.weightMin) return Number(a.weightMin) - Number(b.weightMin);
  return Number(a.weightMax) - Number(b.weightMax);
}

function fitsCategory(athlete: User, category: Category): boolean {
  if (!athlete.dateOfBirth || !athlete.weightKg) return false;
  const age = getAge(athlete.dateOfBirth);
  return (
    athlete.gender === category.gender &&
    age >= category.ageMin &&
    age <= category.ageMax &&
    athlete.weightKg > category.weightMin &&
    athlete.weightKg <= category.weightMax
  );
}

function validateApplicationEntry(entry: ApplicationEntry, t: (k: string) => string): string[] {
  const athlete = entry.athlete;
  const category = entry.category;
  if (!athlete || !category) return [t("coach.entry_incomplete")];
  const reason = categoryMismatchReason(athlete, category, t);
  return reason === "OK" ? [] : [reason];
}

function categoryMismatchReason(
  athlete: User,
  category: Category,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  if (!athlete.gender) return t("coach.mismatch_no_gender");
  if (athlete.gender !== category.gender) return t("coach.mismatch_gender");
  if (!athlete.dateOfBirth) return t("coach.mismatch_no_dob");
  if (!athlete.weightKg) return t("coach.mismatch_no_weight");
  const age = getAge(athlete.dateOfBirth);
  if (age < category.ageMin || age > category.ageMax)
    return t("coach.mismatch_age", { age, min: category.ageMin, max: category.ageMax });
  if (athlete.weightKg <= category.weightMin || athlete.weightKg > category.weightMax) {
    return t("coach.mismatch_weight", {
      weight: athlete.weightKg,
      min: category.weightMin,
      max: category.weightMax,
    });
  }
  return "OK";
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function athleteName(athlete: User | null | undefined): string {
  if (!athlete) return "TBD";
  return `${athlete.name ?? ""} ${athlete.surname ?? ""}`.trim() || "TBD";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} - ${new Date(end).toLocaleDateString("kk-KZ")}`;
}

function formatKzt(value: number): string {
  return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
}

function formatWeighIn(
  tournament: import("@/lib/api-types").Tournament,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const place = tournament.weighInLocation || tournament.location;
  const start = tournament.weighInStart
    ? new Date(tournament.weighInStart).toLocaleString("kk-KZ")
    : "";
  const end = tournament.weighInEnd ? new Date(tournament.weighInEnd).toLocaleString("kk-KZ") : "";
  const time = start && end ? `${start} - ${end}` : start || t("coach.weigh_in_tbd");
  return t("coach.weigh_in_format", { place, time });
}

function mapEmbedUrl(tournament: import("@/lib/api-types").Tournament): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${tournament.location}, ${tournament.city}`)}&output=embed`;
}

function localizeName(value: import("@/lib/api-types").LocalizedName): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "";
}

function getCompetitionRules(t: (k: string) => string) {
  return [
    { icon: "🔇", title: t("coach_rules.rule1_title"), text: t("coach_rules.rule1_text") },
    { icon: "🤫", title: t("coach_rules.rule2_title"), text: t("coach_rules.rule2_text") },
    { icon: "⚖️", title: t("coach_rules.rule3_title"), text: t("coach_rules.rule3_text") },
    { icon: "👥", title: t("coach_rules.rule4_title"), text: t("coach_rules.rule4_text") },
    { icon: "🏥", title: t("coach_rules.rule5_title"), text: t("coach_rules.rule5_text") },
    { icon: "🏗️", title: t("coach_rules.rule6_title"), text: t("coach_rules.rule6_text") },
    { icon: "🚫", title: t("coach_rules.rule7_title"), text: t("coach_rules.rule7_text") },
  ];
}

function CompetitionRulesModal({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const rules = getCompetitionRules(t);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const allChecked = rules.every((_, i) => checked[i]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl"
        style={{ animation: "scale-in 0.18s ease" }}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-display text-base font-bold">{t("coach_rules.modal_title")}</h2>
              <p className="text-xs text-muted-foreground">{t("coach_rules.modal_hint")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-4 space-y-3">
          {rules.map((rule, i) => (
            <label
              key={i}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-all ${
                checked[i]
                  ? "border-emerald-500/30 bg-emerald-500/8"
                  : "border-border/60 bg-background/30 hover:border-gold/30"
              }`}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors
                  ${checked[i] ? 'border-emerald-500 bg-emerald-500/20' : 'border-border'}"
              >
                {checked[i] && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={(e) => setChecked((p) => ({ ...p, [i]: e.target.checked }))}
                className="sr-only"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span>{rule.icon}</span>
                  {rule.title}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.text}</p>
              </div>
            </label>
          ))}

          <div className="rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-xs text-destructive">
            ⚠️ {t("coach_rules.warning")}
          </div>
        </div>

        <div className="border-t border-border/50 px-6 py-4 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {Object.values(checked).filter(Boolean).length} / {rules.length}{" "}
            {t("coach_rules.confirmed_count")}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onAgree}
              disabled={!allChecked}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-5 py-2 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-40 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("coach_rules.confirm_all")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
