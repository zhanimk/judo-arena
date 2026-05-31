import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  Medal,
  Radio,
  Shield,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Avatar } from "@/components/ui/avatar-image";
import { SiteFooter } from "@/components/site/SiteFooter";
import { api, mediaUrl } from "@/lib/api";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс — Judo-Arena" }] }),
  validateSearch: (s: Record<string, unknown>): { categoryId?: string } => ({
    categoryId: typeof s.categoryId === "string" ? s.categoryId : undefined,
  }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/tournaments/$id" });
  const { categoryId: urlCategoryId } = Route.useSearch();
  const navigate = useNavigate({ from: "/tournaments/$id" });

  const [selectedCategoryId, setSelectedCategoryIdRaw] = useState<string | null>(urlCategoryId ?? null);
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "protocol" | "results">("overview");

  function setSelectedCategoryId(catId: string | null) {
    setSelectedCategoryIdRaw(catId);
    navigate({ search: (prev) => ({ ...prev, categoryId: catId ?? undefined }), replace: true });
  }

  const tQuery = useQuery({ queryKey: ["tournament", id], queryFn: () => api.tournaments.get(id) });
  const bracketsQuery = useQuery({
    queryKey: ["tournament-brackets", id],
    queryFn: () => api.brackets.forTournament(id),
    enabled: Boolean(id),
  });
  const matchesQuery = useQuery({
    queryKey: ["public-tournament-matches", id],
    queryFn: () => api.matches.list({ tournamentId: id, limit: 200 }),
    enabled: Boolean(id),
  });

  const participantsQuery = useQuery({
    queryKey: ["category-participants", id, selectedCategoryId],
    queryFn: () => api.tournaments.categoryParticipants(id, selectedCategoryId!),
    enabled: Boolean(selectedCategoryId),
    staleTime: 30_000,
  });

  const tourney = tQuery.data;
  const brackets = bracketsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#sanattar") setActiveTab("categories");
    if (hash === "#hattamalar") setActiveTab("protocol");
    if (hash === "#natijeler") setActiveTab("results");
    if (hash === "#overview") setActiveTab("overview");
  }, []);

  const categoryRows = useMemo(() => {
    return (tourney?.categories ?? []).map((category: any) => {
      const bracket = brackets.find((b: any) => b.categoryId === category.id);
      const categoryMatches = matches.filter((m: any) => m.bracket?.categoryId === category.id || m.bracketId === bracket?.id);
      const participants = new Set<string>();
      for (const match of categoryMatches) {
        if (match.redAthleteId) participants.add(match.redAthleteId);
        if (match.blueAthleteId) participants.add(match.blueAthleteId);
      }
      return { category, bracket, matches: categoryMatches.length, participants: participants.size };
    });
  }, [brackets, matches, tourney?.categories]);

  if (tQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (tQuery.error || !tourney) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="font-display text-2xl text-destructive">{t("tournament.not_found")}</div>
            <Link to="/tournaments" className="mt-4 inline-block text-gold underline">
              {t("tournaments_page.back_link")}
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const name = localizeName(tourney.name);
  const desc = localizeName(tourney.description);
  const completedMatches = matches.filter((m: any) => m.status === "COMPLETED").length;
  const inProgressMatches = matches.filter((m: any) => m.status === "IN_PROGRESS").length;
  const selectedBracket =
    brackets.find((b: any) => b.categoryId === selectedCategoryId) ??
    brackets[0] ??
    null;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section id="overview" className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-hero opacity-75" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="container relative mx-auto px-4 py-12 sm:py-16">
          <Link to="/tournaments" className="mb-5 inline-flex text-sm text-muted-foreground hover:text-gold">
            {t("tournaments_page.back_to_all")}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={tourney.status} />
            <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs text-gold">
              {t("tournament.all_info_badge")}
            </span>
          </div>
          <h1 className="mt-4 max-w-5xl font-display text-4xl font-bold leading-tight sm:text-6xl">
            {name}
          </h1>
          {desc && <p className="mt-4 max-w-3xl text-muted-foreground">{desc}</p>}

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric icon={Calendar} label={t("tournament.metric_date")} value={dateRange(tourney.startDate, tourney.endDate)} />
            <Metric icon={Clock} label={t("tournament.metric_start")} value={timeText(tourney.startDate)} />
            <Metric icon={MapPin} label={t("tournament.metric_location")} value={`${tourney.location}, ${tourney.city}`} />
            <Metric icon={Users} label={t("tournament.metric_applications")} value={String(tourney._count?.applications ?? 0)} />
            <Metric icon={Radio} label={t("tournament.metric_tatami")} value={String(tourney.tatamiCount ?? 1)} />
          </div>
        </div>
      </section>

      <div className="sticky top-24 z-40 mx-auto -mt-5 w-full max-w-6xl px-4">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gold/25 bg-background/90 p-2 shadow-elegant backdrop-blur-xl [scrollbar-width:none]">
          {([
            { id: "overview" as const, label: t("tournament.tab_overview") },
            { id: "categories" as const, label: t("tournament.tab_categories") },
            { id: "protocol" as const, label: t("tournament.tab_live") },
            ...(tourney?.status === "COMPLETED" ? [{ id: "results" as const, label: t("tournament.tab_results") }] : []),
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={`group shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                activeTab === item.id
                  ? "border-gold/70 bg-gradient-gold text-gold-foreground shadow-gold"
                  : "border-border/50 bg-card/60 text-muted-foreground hover:border-gold/50 hover:bg-gold/10 hover:text-gold"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
        <section id="overview-detail" className="container mx-auto px-4 py-12">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-gold/20 bg-card/60 p-6 shadow-elegant backdrop-blur">
              <div className="text-xs uppercase tracking-[0.3em] text-gold">{t("tournament.full_info")}</div>
              <h2 className="mt-3 font-display text-3xl font-bold">{t("tournament.about")}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {desc || t("tournament.no_desc")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoCard label={t("tournament.deadline")} value={deadlineText(tourney)} />
                <InfoCard label={t("tournament.weigh_in_time")} value={weighInText(tourney, t("tournament.tbd_later"))} />
                <InfoCard label={t("tournament.weigh_in_location")} value={tourney.weighInLocation || tourney.location || t("tournament.tbd_later")} />
                <InfoCard label={t("tournament.primary_locale")} value={tourney.primaryLocale || "kk"} />
                <InfoCard label={t("tournament.city_label")} value={tourney.city || t("tournament.not_specified")} />
                <InfoCard label={t("tournament.tatami_count")} value={String(tourney.tatamiCount ?? 1)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-5">
                {tourney.posterUrl && (
                  <a
                    href={tourney.posterUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                  >
                    <FileText className="h-4 w-4" /> {t("tournament.rules_file")}
                  </a>
                )}
                {tourney.mapUrl && (
                  <a
                    href={tourney.mapUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-4 py-2 text-sm text-muted-foreground hover:border-gold/50 hover:text-gold"
                  >
                    <MapPin className="h-4 w-4" /> {t("tournament.map_link")}
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/55 p-6 shadow-elegant backdrop-blur">
              <div className="text-xs uppercase tracking-[0.3em] text-gold">{t("tournament.open_dashboard")}</div>
              <h3 className="mt-3 font-display text-2xl font-bold">{t("tournament.visible_all")}</h3>
              <div className="mt-5 grid gap-3">
                <InfoCard label={t("tournament.stat_categories")} value={String(tourney.categories?.length ?? 0)} />
                <InfoCard label={t("tournament.metric_applications")} value={String(tourney._count?.applications ?? 0)} />
                <InfoCard label={t("tournament.tab_live")} value={brackets.length ? t("tournament.live_ready") : t("tournament.live_not_ready")} />
                <InfoCard label={t("tournament.stat_matches")} value={String(matches.length)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className="rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                >
                  {t("tournament.view_categories")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("protocol")}
                  className="rounded-md bg-gradient-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-gold"
                >
                  {t("tournament.protocol_btn")}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "categories" && (
      <section id="sanattar" className="container mx-auto px-4 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-gold">{t("tournament.categories_section")}</div>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t("tournament.composition")}</h2>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center rounded-md bg-gradient-gold px-5 py-3 text-sm font-bold text-gold-foreground shadow-gold"
          >
            {t("tournament.register_link")}
          </Link>
        </div>

        {categoryRows.length === 0 ? (
          <Empty text={t("tournament.no_categories")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoryRows.map(({ category, bracket, matches: matchCount, participants }: { category: any; bracket: any; matches: number; participants: number }) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                className={`group text-left rounded-2xl border p-5 shadow-elegant backdrop-blur transition-all hover:-translate-y-1 ${
                  selectedCategoryId === category.id
                    ? "border-gold/70 bg-gold/10"
                    : "border-border/60 bg-card/60 hover:border-gold/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold group-hover:text-gold">
                      {categoryTitle(category, t)}
                    </h3>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {category.gender === "MALE" ? t("tournament.gender_male_short") : t("tournament.gender_female_short")} · {category.ageMin}-{category.ageMax} {t("common.years_short")}
                    </div>
                  </div>
                  <FormatBadge format={category.format} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <SmallMetric label={t("tournament.participants_label")} value={participants || "—"} />
                  <SmallMetric label={t("tournament.stat_matches")} value={matchCount} />
                  <SmallMetric label={t("tournament.tab_live")} value={bracket ? bracket.size : "—"} />
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedCategoryId && (
          <div className="mt-8 rounded-2xl border border-gold/20 bg-card/55 shadow-elegant backdrop-blur overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Draw List</div>
                <h3 className="font-display text-xl font-bold mt-0.5">
                  {categoryTitle(categoryRows.find((r: { category: any; bracket: any; matches: number; participants: number }) => r.category.id === selectedCategoryId)?.category, t)}
                </h3>
              </div>
              <Users className="h-5 w-5 text-gold/60" />
            </div>

            {participantsQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
              </div>
            ) : (participantsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                {t("tournament.no_approved")}
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                <div className="hidden sm:grid grid-cols-[36px_1fr_1fr_80px_90px] gap-3 px-6 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <div>#</div>
                  <div>{t("tournament.col_athlete")}</div>
                  <div>{t("tournament.col_club")}</div>
                  <div>{t("tournament.col_weight")}</div>
                  <div>{t("tournament.col_belt")}</div>
                </div>
                {(participantsQuery.data ?? []).map((entry, i) => {
                  const a = entry.athlete;
                  const passed = entry.weighInStatus === "PASSED";
                  return (
                    <div
                      key={entry.entryId}
                      className="grid gap-3 px-6 py-3 hover:bg-gold/5 transition-colors sm:grid-cols-[36px_1fr_1fr_80px_90px] sm:items-center"
                    >
                      <div className="text-sm font-bold text-muted-foreground tabular-nums">{i + 1}</div>
                      <div className="flex items-center gap-3 min-w-0">
                        {a.avatarUrl ? (
                          <Avatar src={mediaUrl(a.avatarUrl)} name={`${a.name} ${a.surname}`} size={36} className="border border-border/40" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-gold/60" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {a.surname} {a.name}
                          </div>
                          {(a.surnameLatin || a.nameLatin) && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {a.surnameLatin} {a.nameLatin}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground min-w-0 truncate">
                        {a.club ? localizeName(a.club.name) : "—"}
                        {a.club?.city && <span className="text-xs opacity-60"> · {a.club.city}</span>}
                      </div>
                      <div className="text-sm">
                        {a.weightKg ? `${a.weightKg} ${t("common.kg")}` : "—"}
                        {passed && <span className="ml-1.5 inline-flex rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] text-emerald-400">✓</span>}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        {a.beltRank ? (
                          <><Shield className="h-3.5 w-3.5 text-gold/50" /> {a.beltRank}</>
                        ) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
      )}

      {activeTab === "protocol" && (
      <section id="hattamalar" className="relative overflow-hidden border-y border-border/40 bg-navy-deep/30 py-12 sm:py-16">
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-gold">{t("tournament.protocol_section")}</div>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">
                {t("tournament.live_title")}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {t("tournament.live_desc")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <SmallMetric label={t("tournament.total_label")} value={matches.length} />
              <SmallMetric label="LIVE" value={inProgressMatches} />
              <SmallMetric label={t("tournament.completed_label")} value={completedMatches} />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gold/20 bg-card/55 p-4 shadow-elegant backdrop-blur sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gold">{t("tournament.bracket_section")}</div>
                  <h3 className="mt-1 font-display text-2xl font-bold">{t("tournament.bracket_by_category")}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedBracket && (
                    <a
                      href={api.admin.bracketPdfUrl(selectedBracket.id)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                    >
                      <Download className="h-4 w-4" /> {t("tournament.bracket_pdf")}
                    </a>
                  )}
                  {brackets.length > 0 && (
                    <a
                      href={api.admin.allBracketsPdfUrl(id)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-gold/40 hover:text-foreground"
                    >
                      <FileText className="h-4 w-4" /> {t("tournament.all_brackets_pdf")}
                    </a>
                  )}
                </div>
              </div>

              {brackets.length === 0 ? (
                <Empty text={t("tournament.no_bracket")} />
              ) : (
                <>
                  <div className="mb-4 space-y-2">
                    {(["MALE", "FEMALE"] as const).map((gender) => {
                      const genderBrackets = brackets.filter((b: any) => b.category?.gender === gender);
                      if (genderBrackets.length === 0) return null;
                      return (
                        <div key={gender} className="flex flex-wrap items-center gap-1.5">
                          <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                            gender === "MALE" ? "bg-sky-500/15 text-sky-400" : "bg-rose-500/15 text-rose-400"
                          }`}>
                            {gender === "MALE" ? t("tournament.gender_male_abbr") : t("tournament.gender_female_abbr")}
                          </span>
                          {genderBrackets
                            .slice()
                            .sort((a: any, b: any) => (a.category?.weightMax ?? 0) - (b.category?.weightMax ?? 0))
                            .map((bracket: any) => {
                              const active = (selectedCategoryId ?? selectedBracket?.categoryId) === bracket.categoryId;
                              const w = bracket.category;
                              const label = w
                                ? (w.weightMax >= 200 ? `+${w.weightMin} ${t("common.kg")}` : `-${w.weightMax} ${t("common.kg")}`)
                                : categoryTitle(bracket.category, t);
                              return (
                                <button
                                  key={bracket.id}
                                  type="button"
                                  onClick={() => setSelectedCategoryId(bracket.categoryId)}
                                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                    active
                                      ? "bg-gradient-gold text-gold-foreground shadow-sm"
                                      : "border border-border/60 bg-background/50 hover:border-gold/40 hover:text-gold"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                        </div>
                      );
                    })}
                  </div>
                  {selectedBracket && <LiveBracket tournamentId={id} categoryId={selectedBracket.categoryId} />}
                </>
              )}
            </div>

            <div className="grid gap-5">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/55 shadow-elegant backdrop-blur">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-gold">{t("tournament.matches_section")}</div>
                    <h3 className="font-display text-xl font-bold">{t("tournament.queue_result")}</h3>
                  </div>
                  <Radio className="h-5 w-5 text-destructive" />
                </div>
                {matchesQuery.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gold" />
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-6">
                    <Empty text={t("tournament.no_matches")} />
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {matches.slice(0, 10).map((match: any) => (
                      <Link
                        key={match.id}
                        to="/athlete/matches/$id"
                        params={{ id: match.id }}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-gold/5"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {athleteName(match.redAthlete)} vs {athleteName(match.blueAthlete)}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {categoryTitle(match.bracket?.category, t)} · {t("tournament.round_label")} {match.round} · {t("tournament.metric_tatami")} #{match.tatamiNumber ?? "—"}
                          </div>
                        </div>
                        <StatusBadge status={match.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gold/25 bg-card/65 p-6 text-center shadow-elegant backdrop-blur">
                <FileText className="mx-auto mb-4 h-10 w-10 text-gold" />
                <h3 className="font-display text-2xl font-bold">{t("tournament.official_protocol")}</h3>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  {t("tournament.protocol_desc")}
                </p>
                {tourney.status === "COMPLETED" ? (
                  <a
                    href={api.admin.protocolPdfUrl(tourney.id)}
                    target="_blank"
                    rel="noopener"
                    className="mt-6 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-bold text-gold-foreground shadow-gold"
                  >
                    <Download className="h-4 w-4" /> {t("tournament.download_protocol")}
                  </a>
                ) : (
                  <div className="mt-6 inline-flex rounded-md border border-border/60 bg-background/45 px-5 py-3 text-sm text-muted-foreground">
                    {t("tournament.protocol_pending")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {activeTab === "results" && tourney?.status === "COMPLETED" && (
        <ResultsTab
          categories={tourney.categories ?? []}
          brackets={brackets}
          matches={matches}
          tournamentId={id}
        />
      )}

      <SiteFooter />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ResultsTab
// ──────────────────────────────────────────────────────────────

function ResultsTab({
  categories,
  brackets,
  matches,
  tournamentId,
}: {
  categories: any[];
  brackets: any[];
  matches: any[];
  tournamentId: string;
}) {
  const { t } = useTranslation();

  const results = useMemo(() => {
    return categories
      .map((cat: any) => {
        const bracket = brackets.find((b: any) => b.categoryId === cat.id);
        if (!bracket) return null;

        const catMatches = matches.filter((m: any) => m.bracketId === bracket.id && m.status === "COMPLETED");

        const finalMatch =
          catMatches.find((m: any) => m.bracketSection === "final") ??
          catMatches.filter((m: any) => m.bracketSection === "main").sort((a: any, b: any) => b.round - a.round)[0];

        const gold =
          finalMatch?.winnerId
            ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.redAthlete : finalMatch.blueAthlete)
            : null;
        const silver =
          finalMatch?.winnerId
            ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.blueAthlete : finalMatch.redAthlete)
            : null;

        const bronzeMatches = catMatches.filter(
          (m: any) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2",
        );
        const bronzeWinners = bronzeMatches
          .filter((m: any) => m.winnerId)
          .map((m: any) =>
            m.redAthlete?.id === m.winnerId ? m.redAthlete : m.blueAthlete,
          )
          .filter(Boolean);

        const semis = catMatches.filter((m: any) => m.bracketSection === "main" && finalMatch && m.round === finalMatch.round - 1);
        const semifinalLosers =
          bronzeWinners.length === 0
            ? semis
                .filter((m: any) => m.winnerId)
                .map((m: any) =>
                  m.redAthlete?.id === m.winnerId ? m.blueAthlete : m.redAthlete,
                )
                .filter(Boolean)
            : [];

        const bronze = bronzeWinners.length > 0 ? bronzeWinners : semifinalLosers;

        return { category: cat, bracket, gold, silver, bronze };
      })
      .filter(Boolean);
  }, [categories, brackets, matches]);

  return (
    <section id="natijeler" className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.3em] text-gold">{t("tournament.results_header")}</div>
        <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
          {t("tournament.medal_table")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          {t("tournament.medal_desc")}
        </p>
      </div>

      {results.length === 0 ? (
        <Empty text={t("tournament.no_results")} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {results.map((r: any) => (
            <div
              key={r.category.id}
              className="rounded-2xl border border-border/60 bg-card/60 shadow-elegant backdrop-blur overflow-hidden"
            >
              <div className="border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-bold">{categoryTitle(r.category, t)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.category.gender === "MALE" ? t("tournament.gender_male_abbr") : t("tournament.gender_female_abbr")} · {r.category.ageMin}-{r.category.ageMax} {t("common.years_short")}
                  </div>
                </div>
                <FormatBadge format={r.category.format} />
              </div>

              <div className="p-5 space-y-2.5">
                <PodiumRow place={1} athlete={r.gold} label={t("tournament.medal_gold")} color="text-yellow-400" bg="bg-yellow-400/10 border-yellow-400/25" />
                <PodiumRow place={2} athlete={r.silver} label={t("tournament.medal_silver")} color="text-zinc-400" bg="bg-zinc-400/10 border-zinc-400/20" />
                {r.bronze.map((a: any, i: number) => (
                  <PodiumRow key={a?.id ?? i} place={3} athlete={a} label={t("tournament.medal_bronze")} color="text-amber-600" bg="bg-amber-600/10 border-amber-600/20" />
                ))}
              </div>

              <div className="border-t border-border/30 px-5 py-3">
                <a
                  href={`/api/pdf/bracket?bracketId=${r.bracket.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> {t("tournament.bracket_pdf_link")}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-gold/25 bg-gold/5 p-6 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-gold" />
        <h3 className="font-display text-2xl font-bold">{t("tournament.official_protocol")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("tournament.results_protocol_desc")}</p>
        <a
          href={`/api/pdf/protocol?tournamentId=${tournamentId}`}
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-bold text-gold-foreground shadow-gold"
        >
          <Download className="h-4 w-4" /> {t("tournament.download_results")}
        </a>
      </div>
    </section>
  );
}

function PodiumRow({
  place,
  athlete,
  label,
  color,
  bg,
}: {
  place: number;
  athlete: any;
  label: string;
  color: string;
  bg: string;
}) {
  const { t } = useTranslation();
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${bg}`}>
      <div className="text-xl shrink-0">{medal}</div>
      <div className="min-w-0 flex-1">
        {athlete ? (
          <>
            <div className="font-semibold text-sm truncate">
              {athlete.surname} {athlete.name}
            </div>
            {athlete.club && (
              <div className="text-[11px] text-muted-foreground truncate">
                {localizeName(athlete.club?.name) || athlete.clubId || ""}
                {athlete.club?.city && ` · ${athlete.club.city}`}
              </div>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground/50 italic">{t("tournament.unknown_athlete")}</span>
        )}
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/55 p-4 backdrop-blur">
      <Icon className="mb-3 h-5 w-5 text-gold" />
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-bold leading-tight">{value}</div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold text-gradient-gold">{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/45 p-10 text-center text-muted-foreground">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const m: Record<string, { c: string; key: string }> = {
    DRAFT:                { c: "bg-muted text-muted-foreground",                                  key: "status.DRAFT" },
    REGISTRATION_OPEN:    { c: "bg-gold/15 text-gold border border-gold/30",                      key: "status.REGISTRATION_OPEN" },
    REGISTRATION_CLOSED:  { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30",       key: "status.REGISTRATION_CLOSED" },
    IN_PROGRESS:          { c: "bg-destructive/20 text-destructive border border-destructive/40", key: "status.IN_PROGRESS" },
    COMPLETED:            { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", key: "status.COMPLETED" },
    PENDING:              { c: "bg-muted text-muted-foreground",                                  key: "status.PENDING" },
    CANCELLED:            { c: "bg-muted text-muted-foreground",                                  key: "status.CANCELLED" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", key: "" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs ${x.c}`}>{x.key ? String(t(x.key, status)) : status}</span>;
}

function FormatBadge({ format }: { format: string }) {
  const { t } = useTranslation();
  const key = `format.${format}`;
  return <span className="rounded bg-gold/10 px-2 py-1 text-[10px] text-gold/90">{String(t(key, format))}</span>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function categoryTitle(category: any, t: any): string {
  if (!category) return "";
  return localizeName(category.name) || `${category.gender === "MALE" ? t("tournament.male_label") : t("tournament.female_label")} · ${category.weightMin}-${category.weightMax} ${t("common.kg")}`;
}

function athleteName(athlete: any): string {
  return `${athlete?.name ?? ""} ${athlete?.surname ?? ""}`.trim() || "—";
}

function dateRange(start: string | Date, end: string | Date): string {
  const fmt = new Intl.DateTimeFormat("kk-KZ", { day: "2-digit", month: "short" });
  const a = new Date(start);
  const b = new Date(end);
  if (a.toDateString() === b.toDateString()) return fmt.format(a);
  return `${fmt.format(a)} - ${fmt.format(b)}`;
}

function timeText(start: string | Date): string {
  return new Intl.DateTimeFormat("kk-KZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(start));
}

function deadlineText(tourney: any): string {
  const value = tourney.applicationDeadline ?? tourney.startDate;
  return new Date(value).toLocaleString("kk-KZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function weighInText(tourney: any, tbdLabel: string): string {
  if (!tourney.weighInStart && !tourney.weighInEnd) return tbdLabel;
  const fmt = new Intl.DateTimeFormat("kk-KZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const start = tourney.weighInStart ? fmt.format(new Date(tourney.weighInStart)) : "";
  const end = tourney.weighInEnd ? fmt.format(new Date(tourney.weighInEnd)) : "";
  return start && end ? `${start} - ${end}` : start || end;
}

function localizeName(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "";
}
