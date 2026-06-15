import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CircleDollarSign,
  Clock,
  Download,
  FileDown,
  FileText,
  Images,
  Loader2,
  MapPin,
  //   Medal,
  Radio,
  Shield,
  Trophy,
  Users,
  X,
  Youtube,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Avatar } from "@/components/ui/avatar-image";
import { api, mediaUrl } from "@/lib/api";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { buildTatamiState } from "@/lib/tatami-state";
import { useTranslation } from "react-i18next";
import { mapEmbedUrl } from "@/components/tournament/shared";
import heroKazakhstan from "@/assets/hero-kazakhstan-judo.jpg";

// ── Local types ─────────────────────────────────────────────────────────────

type LocalizedName = Record<string, string> | string | null | undefined;

interface TClub {
  id: string;
  name: LocalizedName;
  shortName?: string | null;
  city?: string | null;
  logoUrl?: string | null;
}

interface TAthlete {
  id: string;
  name: string;
  surname: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  weightKg?: number | null;
  clubId?: string | null;
  club?: TClub | null;
}

interface TMatch {
  id: string;
  status: string;
  round?: number | null;
  queuePosition?: number | null;
  bracketSection?: string | null;
  bracketId?: string | null;
  tatamiNumber?: number | null;
  winnerId?: string | null;
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
  redAthlete?: TAthlete | null;
  blueAthlete?: TAthlete | null;
  whiteAthlete?: TAthlete | null;
  blueAthleteObj?: TAthlete | null;
  scheduledAt?: string | null;
  bracket?: { id: string; categoryId: string; category?: TCategory | null } | null;
}

interface TCategory {
  id: string;
  name?: LocalizedName;
  gender?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  weightMin?: number | null;
  weightMax?: number | null;
  format?: string | null;
}

interface TBracket {
  id: string;
  categoryId: string;
  category?: TCategory | null;
  format?: string | null;
  size?: number | null;
}

interface TTournament {
  id: string;
  name: LocalizedName;
  description?: LocalizedName;
  city?: string | null;
  location?: string | null;
  startDate: string;
  endDate: string;
  applicationDeadline?: string | null;
  weighInStart?: string | null;
  weighInEnd?: string | null;
  weighInLocation?: string | null;
  status: string;
  tatamiCount?: number | null;
  mapUrl?: string | null;
  posterUrl?: string | null;
  galleryUrls?: string[] | null;
  regulationUrl?: string | null;
  regulationFileName?: string | null;
  videoUrls?: string[] | null;
  primaryLocale?: string | null;
  entryFeeKzt?: number | null;
  kaspiPaymentUrl?: string | null;
  categories?: TCategory[];
  _count?: { categories?: number; applications?: number };
}

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
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

  const [selectedCategoryId, setSelectedCategoryIdRaw] = useState<string | null>(
    urlCategoryId ?? null,
  );
  const [activeTab, setActiveTab] = useState<
    "overview" | "categories" | "wall" | "liveTop" | "results"
  >("overview");
  const [regulationOpen, setRegulationOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  function setSelectedCategoryId(catId: string | null) {
    setSelectedCategoryIdRaw(catId);
    navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, categoryId: catId ?? undefined }),
      replace: true,
    });
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
  const brackets = useMemo(() => bracketsQuery.data ?? [], [bracketsQuery.data]);
  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#sanattar") setActiveTab("categories");
    if (hash === "#tatami-live") setActiveTab("wall");
    if (hash === "#hattamalar") setActiveTab("liveTop");
    if (hash === "#natijeler") setActiveTab("results");
    if (hash === "#overview") setActiveTab("overview");
  }, []);

  const categoryRows = useMemo(() => {
    return (tourney?.categories ?? ([] as TCategory[])).map((category: TCategory) => {
      const bracket = (brackets as TBracket[]).find((b: TBracket) => b.categoryId === category.id);
      const categoryMatches = (matches as TMatch[]).filter(
        (m: TMatch) => m.bracket?.categoryId === category.id || m.bracketId === bracket?.id,
      );
      const participants = new Set<string>();
      for (const match of categoryMatches) {
        if (match.redAthleteId) participants.add(match.redAthleteId);
        if (match.blueAthleteId) participants.add(match.blueAthleteId);
      }
      return {
        category,
        bracket,
        matches: categoryMatches.length,
        participants: participants.size,
      };
    });
  }, [brackets, matches, tourney?.categories]);
  const selectedBracket =
    brackets.find((bracket: TBracket) => bracket.categoryId === selectedCategoryId) ??
    brackets[0] ??
    null;

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
            <div className="font-display text-2xl text-destructive">
              {t("tournament.not_found")}
            </div>
            <Link to="/tournaments" className="mt-4 inline-block text-gold underline">
              {t("tournaments_page.back_link")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const name = localizeName(tourney.name);
  const desc = localizeName(tourney.description);
  return (
    <div className="min-h-screen flex flex-col pt-20 sm:pt-22">
      <SiteHeader fixed />

      <section id="overview" className="relative overflow-hidden border-b border-border/40">
        <img
          src={tourney.posterUrl ? mediaUrl(tourney.posterUrl) : heroKazakhstan}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-background/20" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="container relative mx-auto px-4 py-10 sm:py-14">
          <Link
            to="/tournaments"
            className="mb-5 inline-flex text-sm text-muted-foreground hover:text-gold"
          >
            {t("tournaments_page.back_to_all")}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={tourney.status} />
            <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs text-gold">
              {t("tournament.all_info_badge")}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-tight drop-shadow-2xl sm:text-5xl lg:text-6xl">
            {name}
          </h1>
          {desc && <p className="mt-4 max-w-3xl text-muted-foreground">{desc}</p>}

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Metric
              icon={Calendar}
              label={t("tournament.metric_date")}
              value={dateRange(tourney.startDate, tourney.endDate)}
            />
            <Metric
              icon={Clock}
              label={t("tournament.metric_start")}
              value={timeText(tourney.startDate)}
            />
            <Metric
              icon={MapPin}
              label={t("tournament.metric_location")}
              value={`${tourney.location}, ${tourney.city}`}
            />
            <Metric
              icon={Users}
              label={t("tournament.metric_applications")}
              value={String(tourney._count?.applications ?? 0)}
            />
            <Metric
              icon={Radio}
              label={t("tournament.metric_tatami")}
              value={String(tourney.tatamiCount ?? 1)}
            />
            <Metric
              icon={CircleDollarSign}
              label={t("payments.entry_fee")}
              value={formatKzt(tourney.entryFeeKzt ?? 0)}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {tourney.mapUrl && (
              <a
                href={tourney.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-gold-foreground shadow-gold"
              >
                <MapPin className="h-4 w-4" /> {t("tournament.map_link")}
              </a>
            )}
            {tourney.regulationUrl && (
              <button
                type="button"
                onClick={() => setRegulationOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-background/70 px-4 py-2.5 text-sm font-semibold backdrop-blur hover:border-gold/60 hover:text-gold"
              >
                <FileText className="h-4 w-4" /> {t("tournament.regulation_title")}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="sticky top-20 z-40 mx-auto w-full max-w-6xl px-4 sm:top-24">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gold/25 bg-background/90 p-2 shadow-elegant backdrop-blur-xl [scrollbar-width:none]">
          {(
            [
              { id: "overview" as const, label: t("tournament.tab_overview") },
              { id: "categories" as const, label: t("tournament.tab_categories") },
              { id: "wall" as const, label: "3 · Татами live" },
              { id: "liveTop" as const, label: "4 · Live-топ" },
              ...(tourney?.status === "COMPLETED"
                ? [{ id: "results" as const, label: "5 · Нәтижелер" }]
                : []),
            ] as const
          ).map((item) => (
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
          <div className="space-y-5">
            {/* ── Row 1: About + Map ── */}
            <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
              {/* About */}
              <div className="rounded-2xl border border-gold/20 bg-card/60 p-6 shadow-elegant backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-gold">
                  {t("tournament.full_info")}
                </div>
                <h2 className="mt-3 font-display text-3xl font-bold">{t("tournament.about")}</h2>
                {desc && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                )}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoCard label={t("tournament.deadline")} value={deadlineText(tourney)} />
                  <InfoCard
                    label={t("tournament.weigh_in_time")}
                    value={weighInText(tourney, t("tournament.tbd_later"))}
                  />
                  <InfoCard
                    label={t("tournament.weigh_in_location")}
                    value={tourney.weighInLocation || tourney.location || t("tournament.tbd_later")}
                  />
                  <InfoCard
                    label={t("tournament.city_label")}
                    value={tourney.city || t("tournament.not_specified")}
                  />
                  <InfoCard
                    label={t("payments.entry_fee")}
                    value={formatKzt(tourney.entryFeeKzt ?? 0)}
                  />
                  <InfoCard
                    label={t("tournament.tatami_count")}
                    value={String(tourney.tatamiCount ?? 1)}
                  />
                  <InfoCard
                    label={t("tournament.metric_location")}
                    value={[tourney.location, tourney.city].filter(Boolean).join(", ")}
                  />
                  <InfoCard
                    label={t("tournament.stat_categories")}
                    value={String(tourney.categories?.length ?? 0)}
                  />
                </div>
                {/* Action buttons */}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border/40 pt-4">
                  {tourney.kaspiPaymentUrl && (
                    <a
                      href={tourney.kaspiPaymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-gold hover:opacity-90"
                    >
                      <CircleDollarSign className="h-4 w-4" /> {t("payments.pay_kaspi")}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("categories")}
                    className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                  >
                    <Users className="h-4 w-4" /> {t("tournament.view_categories")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("liveTop")}
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-4 py-2 text-sm text-muted-foreground hover:border-gold/50 hover:text-gold"
                  >
                    <Radio className="h-4 w-4" /> {t("tournament.tab_live")}
                  </button>
                </div>
              </div>

              {/* Map */}
              <div className="rounded-2xl border border-border/60 bg-card/55 shadow-elegant backdrop-blur overflow-hidden flex flex-col">
                {/* Embedded map — shown only when mapUrl is set */}
                {tourney.mapUrl ? (
                  <iframe
                    title={t("tournament.map_link")}
                    src={mapEmbedUrl(tourney)}
                    className="w-full h-52 border-0"
                    loading="lazy"
                    allow="fullscreen"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-card/30">
                    <MapPin className="h-10 w-10 text-gold/30" />
                  </div>
                )}
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-gold/30 bg-gold/10 p-2 text-gold shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{tourney.location}</div>
                      <div className="text-xs text-muted-foreground">{tourney.city}</div>
                    </div>
                  </div>
                  {tourney.weighInLocation && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg border border-border/40 bg-card/50 p-2 text-muted-foreground shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {t("tournament.weigh_in_location")}
                        </div>
                        <div className="text-sm font-medium">{tourney.weighInLocation}</div>
                      </div>
                    </div>
                  )}
                  {tourney.mapUrl && (
                    <a
                      href={tourney.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" /> {t("tournament.map_link")}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Row 2: Regulation + Stats ── */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Regulation */}
              <div className="rounded-2xl border border-gold/20 bg-card/60 p-6 shadow-elegant backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
                  {t("tournament.regulation_title")}
                </div>
                {tourney.regulationUrl ? (
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-gold shrink-0">
                      <FileText className="h-8 w-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {tourney.regulationFileName || t("tournament.regulation_title")}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("tournament.regulation_hint")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setRegulationOpen(true)}
                          className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-gold hover:opacity-90"
                        >
                          <FileText className="h-4 w-4" /> Регламентті көру
                        </button>
                        <a
                          href={mediaUrl(tourney.regulationUrl)}
                          download
                          className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20"
                        >
                          <FileDown className="h-4 w-4" /> Жүктеу
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <FileText className="h-6 w-6 shrink-0" />
                    <span className="text-sm">{t("tournament.regulation_hint")}</span>
                  </div>
                )}
              </div>

              {/* Live stats */}
              <div className="rounded-2xl border border-border/60 bg-card/55 p-6 shadow-elegant backdrop-blur">
                <div className="text-xs uppercase tracking-[0.3em] text-gold mb-3">
                  {t("tournament.open_dashboard")}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard
                    label={t("tournament.metric_applications")}
                    value={String(tourney._count?.applications ?? 0)}
                  />
                  <InfoCard label={t("tournament.stat_matches")} value={String(matches.length)} />
                  <InfoCard
                    label={t("tournament.tab_live")}
                    value={
                      brackets.length ? t("tournament.live_ready") : t("tournament.live_not_ready")
                    }
                  />
                  <InfoCard
                    label={t("tournament.tatami_count")}
                    value={String(tourney.tatamiCount ?? 1)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("categories")}
                    className="rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                  >
                    {t("tournament.view_categories")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("wall")}
                    className="rounded-md bg-gradient-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-gold"
                  >
                    Татами live
                  </button>
                </div>
              </div>
            </div>

            {Array.isArray(tourney.galleryUrls) && tourney.galleryUrls.length > 0 && (
              <div className="rounded-2xl border border-gold/20 bg-card/60 p-6 shadow-elegant backdrop-blur">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-gold">
                      Турнир атмосферасы
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-bold">Фото галерея</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Images className="h-4 w-4 text-gold" />
                    {tourney.galleryUrls.length} фото
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tourney.galleryUrls.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(url)}
                      className={`group relative overflow-hidden rounded-xl border border-border/60 bg-background/40 ${
                        index === 0 ? "sm:col-span-2 lg:row-span-2" : ""
                      }`}
                    >
                      <img
                        src={mediaUrl(url)}
                        alt={`${name} — ${index + 1}`}
                        className={`w-full object-cover transition duration-500 group-hover:scale-105 ${
                          index === 0 ? "h-64 lg:h-full" : "h-44"
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/45 to-transparent opacity-0 transition group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "categories" && (
        <section id="sanattar" className="container mx-auto px-4 py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-gold">
                {t("tournament.categories_section")}
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
                {t("tournament.composition")}
              </h2>
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
              {categoryRows.map(
                ({
                  category,
                  bracket,
                  matches: matchCount,
                  participants,
                }: {
                  category: TCategory;
                  bracket: TBracket | null | undefined;
                  matches: number;
                  participants: number;
                }) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)
                    }
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
                          {category.gender === "MALE"
                            ? t("tournament.gender_male_short")
                            : t("tournament.gender_female_short")}{" "}
                          · {category.ageMin}-{category.ageMax} {t("common.years_short")}
                        </div>
                      </div>
                      <FormatBadge format={category.format} />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <SmallMetric
                        label={t("tournament.participants_label")}
                        value={participants || "—"}
                      />
                      <SmallMetric label={t("tournament.stat_matches")} value={matchCount} />
                      <SmallMetric label={t("tournament.tab_live")} value={bracket?.size ?? "—"} />
                    </div>
                  </button>
                ),
              )}
            </div>
          )}

          {selectedCategoryId && (
            <div className="mt-8 rounded-2xl border border-gold/20 bg-card/55 shadow-elegant backdrop-blur overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-gold">Draw List</div>
                  <h3 className="font-display text-xl font-bold mt-0.5">
                    {categoryTitle(
                      categoryRows.find(
                        (r: {
                          category: TCategory;
                          bracket: TBracket | null | undefined;
                          matches: number;
                          participants: number;
                        }) => r.category.id === selectedCategoryId,
                      )?.category,
                      t,
                    )}
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
                        <div className="text-sm font-bold text-muted-foreground tabular-nums">
                          {i + 1}
                        </div>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={a.avatarUrl ? mediaUrl(a.avatarUrl) : null}
                            name={`${a.name} ${a.surname}`}
                            size={36}
                            className="border border-border/40"
                          />
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
                          <div className="flex items-center gap-1.5">
                            {a.club?.logoUrl && (
                              <Avatar
                                src={mediaUrl(a.club.logoUrl)}
                                name={localizeName(a.club.name)}
                                size={18}
                                className="rounded"
                              />
                            )}
                            {a.club ? localizeName(a.club.name) : "—"}
                            {a.club?.city && (
                              <span className="text-xs opacity-60"> · {a.club.city}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm">
                          {a.weightKg ? `${a.weightKg} ${t("common.kg")}` : "—"}
                          {passed && (
                            <span className="ml-1.5 inline-flex rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] text-emerald-400">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          {a.beltRank ? (
                            <>
                              <Shield className="h-3.5 w-3.5 text-gold/50" /> {a.beltRank}
                            </>
                          ) : (
                            "—"
                          )}
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

      {activeTab === "wall" && (
        <TatamiLiveTab
          tournamentId={id}
          matches={matches}
          tatamiCount={Number(tourney.tatamiCount ?? 1)}
          youtubeUrls={Array.isArray(tourney.youtubeUrls) ? tourney.youtubeUrls : []}
        />
      )}

      {activeTab === "liveTop" && (
        <LiveTopTab
          tournamentId={id}
          brackets={brackets}
          matches={matches}
          selectedBracket={selectedBracket}
          onSelectCategory={setSelectedCategoryId}
        />
      )}

      {activeTab === "results" && tourney?.status === "COMPLETED" && (
        <ResultsTab
          categories={tourney.categories ?? []}
          brackets={brackets}
          matches={matches}
          tournamentId={id}
        />
      )}

      {regulationOpen && tourney.regulationUrl && (
        <DocumentModal
          url={mediaUrl(tourney.regulationUrl)}
          fileName={tourney.regulationFileName || t("tournament.regulation_title")}
          onClose={() => setRegulationOpen(false)}
        />
      )}
      {selectedImage && (
        <ImageModal
          url={mediaUrl(selectedImage)}
          title={name}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

function DocumentModal({
  url,
  fileName,
  onClose,
}: {
  url: string;
  fileName: string;
  onClose: () => void;
}) {
  const isImage = /\.(jpe?g|png|webp|gif)(?:\?|$)/i.test(url);
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gold/30 bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">
              Турнир регламенті
            </div>
            <div className="truncate font-semibold">{fileName}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold"
            >
              <FileDown className="h-4 w-4" /> Жүктеу
            </a>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-md border border-border hover:border-gold/50"
              aria-label="Жабу"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-black/10">
          {isImage ? (
            <div className="grid h-full place-items-center overflow-auto p-4">
              <img src={url} alt={fileName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <iframe title={fileName} src={url} className="h-full w-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}

function ImageModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/50 text-white"
        aria-label="Жабу"
      >
        <X className="h-5 w-5" />
      </button>
      <img src={url} alt={title} className="max-h-[90vh] max-w-[94vw] rounded-xl object-contain" />
    </div>
  );
}

function TatamiLiveTab({
  tournamentId,
  matches,
  tatamiCount,
  youtubeUrls,
}: {
  tournamentId: string;
  matches: TMatch[];
  tatamiCount: number;
  youtubeUrls: string[];
}) {
  const { t } = useTranslation();
  const tatamis = useMemo(
    () => buildTatamiState(matches, Math.max(1, tatamiCount || 1)),
    [matches, tatamiCount],
  );

  return (
    <section id="tatami-live" className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-destructive">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            Live wall
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Татами алаңдары</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Барлық татами бірдей ықшам модульдерде. Карточканы басып, толық экранды ашыңыз.
          </p>
        </div>
        <Link
          to="/live-wall/$tournamentId"
          params={{ tournamentId }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-gold"
        >
          <Radio className="h-4 w-4" /> Үлкен экранға ашу
        </Link>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {tatamis.map((tatami) => {
          const current = tatami.current;
          const next = tatami.queue[0];
          const streamUrl = youtubeUrls[tatami.number - 1];
          const embedUrl = youtubeEmbedUrl(streamUrl);
          return (
            <article
              key={tatami.number}
              className="group overflow-hidden rounded-xl border-2 border-border/70 bg-[#f5f6f8] text-[#161a25] shadow-elegant transition hover:-translate-y-1 hover:border-gold"
            >
              <div className="flex min-h-20 items-center justify-between bg-[#17182c] px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <span className="font-display text-4xl font-black text-amber-400">
                    {tatami.number}
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
                    <div>Tatami</div>
                    <div>{tatami.queue.length} кезекте</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest ${
                    current ? "text-red-400" : embedUrl ? "text-amber-300" : "text-white/45"
                  }`}
                >
                  {current ? "● Live" : embedUrl ? "● Stream" : "Күтуде"}
                </span>
              </div>
              <div className="p-4">
                {embedUrl ? (
                  <div className="overflow-hidden rounded-xl border border-[#d4d8df] bg-black shadow-lg">
                    <iframe
                      className="aspect-video w-full"
                      src={embedUrl}
                      title={`Tatami ${tatami.number} live`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : streamUrl ? (
                  <div className="flex aspect-video flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-300 bg-white px-6 text-center">
                    <Youtube className="h-8 w-8 text-red-500" />
                    <div className="mt-3 text-sm font-black">YouTube сілтемесі танылмады</div>
                    <div className="mt-1 text-xs text-[#7a8190]">
                      watch, live, embed немесе youtu.be форматындағы сілтемені қолданыңыз.
                    </div>
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 text-xs font-bold text-red-600 hover:underline"
                    >
                      Сілтемені YouTube-та ашу ↗
                    </a>
                  </div>
                ) : current ? (
                  <div className="overflow-hidden rounded-lg border border-[#d4d8df] bg-white">
                    <div className="flex items-center border-b border-[#d4d8df]">
                      <div className="w-16 bg-[#e1e4e8] px-3 py-4 text-sm font-black">АҚ</div>
                      <div className="min-w-0 flex-1 px-3 py-3">
                        <div className="truncate text-sm font-black">
                          {athleteName(current.redAthlete)}
                        </div>
                        <div className="text-[10px] text-[#7a8190]">{matchMeta(current)}</div>
                      </div>
                    </div>
                    <div className="flex items-center bg-[#2457c5] text-white">
                      <div className="w-16 bg-[#1647ad] px-3 py-4 text-sm font-black">КӨК</div>
                      <div className="min-w-0 flex-1 px-3 py-3">
                        <div className="truncate text-sm font-black">
                          {athleteName(current.blueAthlete)}
                        </div>
                        <div className="text-[10px] text-white/65">{t("tatami.now")}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-36 items-center justify-center rounded-lg border-2 border-dashed border-[#d7dbe2] bg-white text-sm font-bold uppercase tracking-[0.22em] text-[#c0c4cc]">
                    Матч жоқ
                  </div>
                )}
                {embedUrl && current && (
                  <div className="mt-3 rounded-lg border border-[#d4d8df] bg-white px-3 py-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-red-500">
                      Қазір татамиде
                    </div>
                    <div className="mt-1 truncate text-sm font-black">{matchTitle(current)}</div>
                    <div className="mt-0.5 truncate text-[10px] text-[#7a8190]">
                      {matchMeta(current)}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-[#7a8190]">
                    {next ? `Келесі: ${matchTitle(next)}` : "Келесі матч жоспарланбаған"}
                  </span>
                  <Link
                    to="/live-wall/$tournamentId"
                    params={{ tournamentId }}
                    search={{ tatami: tatami.number }}
                    target="_blank"
                    className="shrink-0 font-bold transition group-hover:text-amber-600"
                  >
                    Толық экран ↗
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function youtubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    let videoId = parsed.searchParams.get("v");
    if (!videoId && parsed.hostname === "youtu.be") videoId = parsed.pathname.slice(1);
    if (!videoId && parsed.pathname.startsWith("/live/")) {
      videoId = parsed.pathname.split("/")[2] ?? null;
    }
    if (!videoId && parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.split("/")[2] ?? null;
    }
    if (!videoId && parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.split("/")[2] ?? null;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1` : null;
  } catch {
    return null;
  }
}

function LiveTopTab({
  tournamentId,
  brackets,
  matches,
  selectedBracket,
  onSelectCategory,
}: {
  tournamentId: string;
  brackets: TBracket[];
  matches: TMatch[];
  selectedBracket: TBracket | null;
  onSelectCategory: (categoryId: string) => void;
}) {
  const { t } = useTranslation();
  const liveMatches = matches.filter((match) => match.status === "IN_PROGRESS");
  const queuedMatches = matches
    .filter((match) => match.status === "PENDING")
    .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999));

  return (
    <section id="hattamalar" className="container mx-auto px-4 py-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/35 bg-destructive/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-destructive">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live-топ
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            {t("tournament.live_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("tournament.live_desc")}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <SmallMetric label="LIVE" value={liveMatches.length} />
          <SmallMetric label={t("tatami.queue")} value={queuedMatches.length} />
          <SmallMetric label={t("tournament.stat_matches")} value={matches.length} />
        </div>
      </div>

      {brackets.length === 0 ? (
        <Empty text={t("tournament.no_bracket")} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card/60 shadow-elegant backdrop-blur">
            <div className="border-b border-border/40 p-4 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                {brackets.map((bracket) => (
                  <button
                    key={bracket.id}
                    type="button"
                    onClick={() => onSelectCategory(bracket.categoryId)}
                    className={`min-h-16 rounded-xl border-2 px-4 py-3 text-left transition ${
                      selectedBracket?.id === bracket.id
                        ? "border-gold bg-gradient-gold text-gold-foreground shadow-gold"
                        : "border-border bg-background/75 text-foreground shadow-sm hover:border-gold/70 hover:bg-gold/10"
                    }`}
                  >
                    <span
                      className={`block text-[9px] font-black uppercase tracking-[0.2em] ${
                        selectedBracket?.id === bracket.id
                          ? "text-gold-foreground/70"
                          : bracket.category?.gender === "FEMALE"
                            ? "text-rose-400"
                            : "text-sky-400"
                      }`}
                    >
                      {bracket.category?.gender === "FEMALE"
                        ? t("tournament.gender_female_abbr")
                        : t("tournament.gender_male_abbr")}{" "}
                      · {bracket.category?.ageMin}-{bracket.category?.ageMax}{" "}
                      {t("common.years_short")}
                    </span>
                    <span className="mt-1 block font-display text-base font-black">
                      {categoryWeightLabel(bracket.category, t)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 sm:p-5">
              {selectedBracket && (
                <LiveBracket tournamentId={tournamentId} categoryId={selectedBracket.categoryId} />
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-elegant backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-gold">
                  Матч орталығы
                </div>
                <h3 className="font-display text-xl font-bold">{t("tournament.queue_result")}</h3>
              </div>
              <Radio className="h-5 w-5 text-destructive" />
            </div>
            <div className="divide-y divide-border/35">
              {[...liveMatches, ...queuedMatches].slice(0, 10).map((match, index) => (
                <div key={match.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest ${
                        match.status === "IN_PROGRESS" ? "text-destructive" : "text-gold"
                      }`}
                    >
                      {match.status === "IN_PROGRESS" ? "● Live" : `Кезек ${index + 1}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Tatami #{match.tatamiNumber ?? "—"}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold">{matchTitle(match)}</div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    {matchMeta(match)}
                  </div>
                </div>
              ))}
              {liveMatches.length === 0 && queuedMatches.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {t("tournament.no_matches")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
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
  categories: TCategory[];
  brackets: TBracket[];
  matches: TMatch[];
  tournamentId: string;
}) {
  const { t } = useTranslation();

  const results = useMemo(() => {
    return categories
      .map((cat: TCategory) => {
        const bracket = brackets.find((b: TBracket) => b.categoryId === cat.id);
        if (!bracket) return null;

        const catMatches = matches.filter(
          (m: TMatch) => m.bracketId === bracket.id && m.status === "COMPLETED",
        );

        const finalMatch =
          catMatches.find((m: TMatch) => m.bracketSection === "final") ??
          catMatches
            .filter((m: TMatch) => m.bracketSection === "main")
            .sort((a: TMatch, b: TMatch) => (b.round ?? 0) - (a.round ?? 0))[0];

        const gold = finalMatch?.winnerId
          ? finalMatch.redAthlete?.id === finalMatch.winnerId
            ? finalMatch.redAthlete
            : finalMatch.blueAthlete
          : null;
        const silver = finalMatch?.winnerId
          ? finalMatch.redAthlete?.id === finalMatch.winnerId
            ? finalMatch.blueAthlete
            : finalMatch.redAthlete
          : null;

        const bronzeMatches = catMatches.filter(
          (m: TMatch) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2",
        );
        const bronzeWinners = bronzeMatches
          .filter((m: TMatch) => m.winnerId)
          .map((m: TMatch) => (m.redAthlete?.id === m.winnerId ? m.redAthlete : m.blueAthlete))
          .filter(Boolean);

        const semis = catMatches.filter(
          (m: TMatch) =>
            m.bracketSection === "main" &&
            finalMatch &&
            m.round === (finalMatch as TMatch).round! - 1,
        );
        const semifinalLosers =
          bronzeWinners.length === 0
            ? semis
                .filter((m: TMatch) => m.winnerId)
                .map((m: TMatch) =>
                  m.redAthlete?.id === m.winnerId ? m.blueAthlete : m.redAthlete,
                )
                .filter(Boolean)
            : [];

        const bronze = bronzeWinners.length > 0 ? bronzeWinners : semifinalLosers;

        return { category: cat, bracket, gold, silver, bronze };
      })
      .filter(Boolean);
  }, [categories, brackets, matches]);
  const completedCount = matches.filter((match) => match.status === "COMPLETED").length;
  const medalistsCount = results.reduce(
    (total, result) =>
      total + (result?.gold ? 1 : 0) + (result?.silver ? 1 : 0) + (result?.bronze.length ?? 0),
    0,
  );

  return (
    <section id="natijeler" className="relative overflow-hidden py-12">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="container relative mx-auto px-4">
        <div className="mb-8 overflow-hidden rounded-3xl border border-gold/25 bg-card/65 p-6 shadow-elegant backdrop-blur sm:p-8">
          <div className="absolute right-10 top-0 h-44 w-44 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-gold">
                <Trophy className="h-3.5 w-3.5" />
                {t("tournament.results_header")}
              </div>
              <h2 className="mt-4 font-display text-4xl font-black sm:text-5xl">
                {t("tournament.medal_table")}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {t("tournament.medal_desc")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ResultSummary label="Санат" value={results.length} />
              <ResultSummary label="Матч" value={completedCount} />
              <ResultSummary label="Жүлдегер" value={medalistsCount} />
            </div>
          </div>
        </div>

        {results.length === 0 ? (
          <Empty text={t("tournament.no_results")} />
        ) : (
          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(
              results as Array<{
                category: TCategory;
                bracket: TBracket;
                gold: TAthlete | null | undefined;
                silver: TAthlete | null | undefined;
                bronze: (TAthlete | null | undefined)[];
              }>
            ).map((r) => (
              <article
                key={r.category.id}
                className="group overflow-hidden rounded-2xl border border-border/60 bg-card/65 shadow-elegant backdrop-blur transition hover:-translate-y-1 hover:border-gold/40"
              >
                <div className="relative overflow-hidden border-b border-gold/20 bg-gradient-to-br from-gold/15 via-card to-card px-5 py-5">
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/15 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
                        Medal podium
                      </div>
                      <div className="mt-1 font-display text-xl font-bold">
                        {categoryTitle(r.category, t)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.category.gender === "MALE"
                          ? t("tournament.gender_male_abbr")
                          : t("tournament.gender_female_abbr")}{" "}
                        · {r.category.ageMin}-{r.category.ageMax} {t("common.years_short")}
                      </div>
                    </div>
                    <FormatBadge format={r.category.format} />
                  </div>
                </div>

                {r.gold && (
                  <div className="border-b border-yellow-400/20 bg-yellow-400/8 px-5 py-5 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-400/45 bg-yellow-400/15 text-2xl shadow-[0_0_30px_rgba(250,204,21,0.15)]">
                      🥇
                    </div>
                    <div className="mt-3 text-[9px] font-bold uppercase tracking-[0.28em] text-yellow-400">
                      {t("tournament.medal_gold")}
                    </div>
                    <div className="mt-1 font-display text-xl font-black">
                      {r.gold.surname} {r.gold.name}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {r.gold.club ? localizeName(r.gold.club.name) : "—"}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 p-4">
                  <PodiumRow
                    place={2}
                    athlete={r.silver ?? null}
                    label={t("tournament.medal_silver")}
                    color="text-zinc-300"
                    bg="bg-zinc-400/8 border-zinc-400/20"
                  />
                  {r.bronze.map((a: TAthlete | null | undefined, i: number) => (
                    <PodiumRow
                      key={a?.id ?? i}
                      place={3}
                      athlete={a ?? null}
                      label={t("tournament.medal_bronze")}
                      color="text-amber-500"
                      bg="bg-amber-600/8 border-amber-600/20"
                    />
                  ))}
                </div>

                <div className="border-t border-border/30 px-4 py-3">
                  <a
                    href={`/api/pdf/bracket?bracketId=${r.bracket.id}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> {t("tournament.bracket_pdf_link")}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/10 via-card/75 to-card/55 p-6 shadow-elegant">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
              <FileText className="h-6 w-6 text-gold-foreground" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">
                {t("tournament.official_protocol")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tournament.results_protocol_desc")}
              </p>
            </div>
          </div>
          <a
            href={`/api/pdf/protocol?tournamentId=${tournamentId}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-gold"
          >
            <Download className="h-4 w-4" /> {t("tournament.download_results")}
          </a>
        </div>
      </div>
    </section>
  );
}

function ResultSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl border border-gold/20 bg-background/45 px-3 py-3">
      <div className="font-display text-2xl font-black text-gradient-gold">{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
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
  athlete: TAthlete | null;
  label: string;
  color: string;
  bg: string;
}) {
  const { t } = useTranslation();
  const medal = place === 2 ? "🥈" : "🥉";
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
          <span className="text-sm text-muted-foreground/50 italic">
            {t("tournament.unknown_athlete")}
          </span>
        )}
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
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

function formatKzt(value: number): string {
  if (value <= 0) return "0 ₸";
  return `${new Intl.NumberFormat("ru-KZ").format(value)} ₸`;
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
    PENDING: { c: "bg-muted text-muted-foreground", key: "status.PENDING" },
    CANCELLED: { c: "bg-muted text-muted-foreground", key: "status.CANCELLED" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", key: "" };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${x.c}`}>
      {x.key ? String(t(x.key, status)) : status}
    </span>
  );
}

function FormatBadge({ format }: { format: string | null | undefined }) {
  const { t } = useTranslation();
  if (!format) return null;
  const key = `format.${format}`;
  return (
    <span className="rounded bg-gold/10 px-2 py-1 text-[10px] text-gold/90">
      {String(t(key, format))}
    </span>
  );
}

function categoryTitle(category: TCategory | null | undefined, t: (key: string) => any): string {
  if (!category) return "";
  return (
    localizeName(category.name) ||
    `${category.gender === "MALE" ? t("tournament.male_label") : t("tournament.female_label")} · ${Number(category.weightMax) >= 999 ? `+${category.weightMin}` : `-${category.weightMax}`} ${t("common.kg")}`
  );
}

function categoryWeightLabel(
  category: TCategory | null | undefined,
  t: (key: string) => any,
): string {
  if (!category) return "—";
  const weight =
    Number(category.weightMax) >= 999
      ? `+${category.weightMin ?? 0}`
      : `−${category.weightMax ?? 0}`;
  return `${weight} ${t("common.kg")}`;
}

function athleteName(athlete: TAthlete | null | undefined): string {
  return `${athlete?.name ?? ""} ${athlete?.surname ?? ""}`.trim() || "—";
}

function matchTitle(match: TMatch): string {
  return `${athleteName(match.redAthlete)} vs ${athleteName(match.blueAthlete)}`;
}

function matchMeta(match: TMatch): string {
  const category = categoryTitle(match.bracket?.category, (key: string, fallback?: unknown) => {
    const labels: Record<string, string> = {
      "tournament.male_label": "Ер адамдар",
      "tournament.female_label": "Әйелдер",
      "common.kg": "кг",
    };
    return labels[key] ?? fallback ?? key;
  });
  const round = match.round ? `Раунд ${match.round}` : "Раунд —";
  const position = match.queuePosition ? `Кезек #${match.queuePosition}` : null;
  return [category, round, position].filter(Boolean).join(" · ");
}

function dateRange(start: string | Date, end: string | Date): string {
  const fmt = new Intl.DateTimeFormat("kk-KZ", { day: "2-digit", month: "short" });
  const a = new Date(start);
  const b = new Date(end);
  if (a.toDateString() === b.toDateString()) return fmt.format(a);
  return `${fmt.format(a)} - ${fmt.format(b)}`;
}

function timeText(start: string | Date): string {
  return new Intl.DateTimeFormat("kk-KZ", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(start),
  );
}

function deadlineText(tourney: TTournament): string {
  const value = tourney.applicationDeadline ?? tourney.startDate;
  return new Date(value).toLocaleString("kk-KZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function weighInText(tourney: TTournament, tbdLabel: string): string {
  if (!tourney.weighInStart && !tourney.weighInEnd) return tbdLabel;
  const fmt = new Intl.DateTimeFormat("kk-KZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const start = tourney.weighInStart ? fmt.format(new Date(tourney.weighInStart)) : "";
  const end = tourney.weighInEnd ? fmt.format(new Date(tourney.weighInEnd)) : "";
  return start && end ? `${start} - ${end}` : start || end;
}

function localizeName(n: unknown): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  const obj = n as Record<string, string>;
  return obj["kk"] || obj["ru"] || obj["en"] || "";
}
