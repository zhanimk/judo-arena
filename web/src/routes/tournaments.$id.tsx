import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  Radio,
  Trophy,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { api } from "@/lib/api";
import { LiveBracket } from "@/components/judo/LiveBracket";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс — Judo-Arena" }] }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = useParams({ from: "/tournaments/$id" });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "protocol">("overview");

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

  const t = tQuery.data;
  const brackets = bracketsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#sanattar") setActiveTab("categories");
    if (hash === "#hattamalar") setActiveTab("protocol");
    if (hash === "#overview") setActiveTab("overview");
  }, []);

  const categoryRows = useMemo(() => {
    return (t?.categories ?? []).map((category: any) => {
      const bracket = brackets.find((b: any) => b.categoryId === category.id);
      const categoryMatches = matches.filter((m: any) => m.bracket?.categoryId === category.id || m.bracketId === bracket?.id);
      const participants = new Set<string>();
      for (const match of categoryMatches) {
        if (match.redAthleteId) participants.add(match.redAthleteId);
        if (match.blueAthleteId) participants.add(match.blueAthleteId);
      }
      return { category, bracket, matches: categoryMatches.length, participants: participants.size };
    });
  }, [brackets, matches, t?.categories]);

  if (tQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (tQuery.error || !t) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="font-display text-2xl text-destructive">Жарыс табылмады</div>
            <Link to="/tournaments" className="mt-4 inline-block text-gold underline">
              Жарыстарға қайту
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const name = localizeName(t.name);
  const desc = localizeName(t.description);
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
            Барлық жарыстарға қайту
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={t.status} />
            <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs text-gold">
              Бір жарыс ішінде барлық ақпарат
            </span>
          </div>
          <h1 className="mt-4 max-w-5xl font-display text-4xl font-bold leading-tight sm:text-6xl">
            {name}
          </h1>
          {desc && <p className="mt-4 max-w-3xl text-muted-foreground">{desc}</p>}

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric icon={Calendar} label="Күні" value={dateRange(t.startDate, t.endDate)} />
            <Metric icon={Clock} label="Басталуы" value={timeText(t.startDate)} />
            <Metric icon={MapPin} label="Өтетін жері" value={`${t.location}, ${t.city}`} />
            <Metric icon={Users} label="Өтінім" value={String(t._count?.applications ?? 0)} />
            <Metric icon={Radio} label="Татами" value={String(t.tatamiCount ?? 1)} />
          </div>
        </div>
      </section>

      <div className="sticky top-24 z-40 mx-auto -mt-5 w-full max-w-6xl px-4">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gold/25 bg-background/90 p-2 shadow-elegant backdrop-blur-xl [scrollbar-width:none]">
          {[
            { id: "overview" as const, label: "1 · Толық ақпарат" },
            { id: "categories" as const, label: "2 · Санаттар" },
            { id: "protocol" as const, label: "3 · Жарыс хаттамасы" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
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
              <div className="text-xs uppercase tracking-[0.3em] text-gold">Толық ақпарат</div>
              <h2 className="mt-3 font-display text-3xl font-bold">Жарыс туралы</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {desc || "Бұл жерде жарыстың толық сипаттамасы, тіркеу уақыты, өлшеу және өтетін орны көрсетіледі."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoCard label="Өтінім дедлайны" value={deadlineText(t)} />
                <InfoCard label="Өлшеу уақыты" value={weighInText(t)} />
                <InfoCard label="Өлшеу орны" value={t.weighInLocation || t.location || "Кейін хабарланады"} />
                <InfoCard label="Негізгі тіл" value={t.primaryLocale || "kk"} />
                <InfoCard label="Қала" value={t.city || "Көрсетілмеген"} />
                <InfoCard label="Татами саны" value={String(t.tatamiCount ?? 1)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-5">
                {t.posterUrl && (
                  <a
                    href={t.posterUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                  >
                    <FileText className="h-4 w-4" /> Ереже / файл
                  </a>
                )}
                {t.mapUrl && (
                  <a
                    href={t.mapUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-4 py-2 text-sm text-muted-foreground hover:border-gold/50 hover:text-gold"
                  >
                    <MapPin className="h-4 w-4" /> Карта сілтемесі
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/55 p-6 shadow-elegant backdrop-blur">
              <div className="text-xs uppercase tracking-[0.3em] text-gold">Ашық дэшборд</div>
              <h3 className="mt-3 font-display text-2xl font-bold">Бір жерде көрінеді</h3>
              <div className="mt-5 grid gap-3">
                <InfoCard label="Санат" value={String(t.categories?.length ?? 0)} />
                <InfoCard label="Өтінім" value={String(t._count?.applications ?? 0)} />
                <InfoCard label="Live-тор" value={brackets.length ? "Дайын" : "Әлі жасалмаған"} />
                <InfoCard label="Белдесу" value={String(matches.length)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className="rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                >
                  Санаттарды көру
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("protocol")}
                  className="rounded-md bg-gradient-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-gold"
                >
                  Жарыс хаттамасы
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
            <div className="text-xs uppercase tracking-[0.3em] text-gold">Қатысушылар және санаттар</div>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Жарыс құрамы</h2>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center rounded-md bg-gradient-gold px-5 py-3 text-sm font-bold text-gold-foreground shadow-gold"
          >
            Тіркелу / өтінім беру
          </Link>
        </div>

        {categoryRows.length === 0 ? (
          <Empty text="Әзірше санаттар қосылмаған." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoryRows.map(({ category, bracket, matches: matchCount, participants }) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className={`group text-left rounded-2xl border p-5 shadow-elegant backdrop-blur transition-all hover:-translate-y-1 ${
                  selectedCategoryId === category.id
                    ? "border-gold/70 bg-gold/10"
                    : "border-border/60 bg-card/60 hover:border-gold/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold group-hover:text-gold">
                      {categoryTitle(category)}
                    </h3>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {category.gender === "MALE" ? "Ұлдар / ерлер" : "Қыздар / әйелдер"} · {category.ageMin}-{category.ageMax} жас
                    </div>
                  </div>
                  <FormatBadge format={category.format} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <SmallMetric label="Қатысушы" value={participants || "—"} />
                  <SmallMetric label="Белдесу" value={matchCount} />
                  <SmallMetric label="Live-тор" value={bracket ? bracket.size : "—"} />
                </div>
              </button>
            ))}
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
              <div className="text-xs uppercase tracking-[0.3em] text-gold">Жарыс хаттамасы</div>
              <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">
                Live-тор, белдесулер және ресми PDF
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Бұл бір бөлім: санатты таңдаңыз, live-торды көріңіз, белдесулердің күйін бақылаңыз және жарыс аяқталған соң ресми хаттаманы жүктеңіз.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <SmallMetric label="Барлығы" value={matches.length} />
              <SmallMetric label="LIVE" value={inProgressMatches} />
              <SmallMetric label="Аяқталды" value={completedMatches} />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gold/20 bg-card/55 p-4 shadow-elegant backdrop-blur sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Live-тор</div>
                  <h3 className="mt-1 font-display text-2xl font-bold">Санат бойынша жарыс жолы</h3>
                </div>
                {selectedBracket && (
                  <a
                    href={api.admin.bracketPdfUrl(selectedBracket.id)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:border-gold/60"
                  >
                    <Download className="h-4 w-4" /> Live-тор PDF
                  </a>
                )}
              </div>

              {brackets.length === 0 ? (
                <Empty text="Live-тор әлі жасалмаған. Тіркеу жабылғаннан кейін жеребе осы жерде көрінеді." />
              ) : (
                <>
                  {/* Category tabs grouped by gender */}
                  <div className="mb-4 space-y-2">
                    {(["MALE", "FEMALE"] as const).map((gender) => {
                      const genderBrackets = brackets.filter((b: any) => b.category?.gender === gender);
                      if (genderBrackets.length === 0) return null;
                      return (
                        <div key={gender} className="flex flex-wrap items-center gap-1.5">
                          <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                            gender === "MALE" ? "bg-sky-500/15 text-sky-400" : "bg-rose-500/15 text-rose-400"
                          }`}>
                            {gender === "MALE" ? "Ер" : "Қыз"}
                          </span>
                          {genderBrackets
                            .slice()
                            .sort((a: any, b: any) => (a.category?.weightMax ?? 0) - (b.category?.weightMax ?? 0))
                            .map((bracket: any) => {
                              const active = (selectedCategoryId ?? selectedBracket?.categoryId) === bracket.categoryId;
                              const w = bracket.category;
                              const label = w
                                ? (w.weightMax >= 200 ? `+${w.weightMin} кг` : `-${w.weightMax} кг`)
                                : categoryTitle(bracket.category);
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
                    <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Белдесулер</div>
                    <h3 className="font-display text-xl font-bold">Кезек және нәтиже</h3>
                  </div>
                  <Radio className="h-5 w-5 text-destructive" />
                </div>
                {matchesQuery.isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gold" />
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-6">
                    <Empty text="Белдесулер live-тор дайындалғаннан кейін осы жерде көрінеді." />
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
                            {categoryTitle(match.bracket?.category)} · кезең {match.round} · татами #{match.tatamiNumber ?? "—"}
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
                <h3 className="font-display text-2xl font-bold">Ресми хаттама</h3>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  Жарыс аяқталғаннан кейін барлық белдесу, орын және ұпай осы PDF ішінде сақталады.
                </p>
                {t.status === "COMPLETED" ? (
                  <a
                    href={api.admin.protocolPdfUrl(t.id)}
                    target="_blank"
                    rel="noopener"
                    className="mt-6 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-bold text-gold-foreground shadow-gold"
                  >
                    <Download className="h-4 w-4" /> Ресми хаттаманы жүктеу
                  </a>
                ) : (
                  <div className="mt-6 inline-flex rounded-md border border-border/60 bg-background/45 px-5 py-3 text-sm text-muted-foreground">
                    Хаттама жарыс аяқталғаннан кейін ашылады
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      <SiteFooter />
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
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
    PENDING: { c: "bg-muted text-muted-foreground", l: "Кезекте" },
    CANCELLED: { c: "bg-muted text-muted-foreground", l: "Болдырылмады" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs ${x.c}`}>{x.l}</span>;
}

function FormatBadge({ format }: { format: string }) {
  const m: Record<string, string> = {
    SE_IJF: "IJF торы",
    ROUND_ROBIN: "Айналмалы",
    MIXED: "Аралас",
  };
  return <span className="rounded bg-gold/10 px-2 py-1 text-[10px] text-gold/90">{m[format] ?? format}</span>;
}

function categoryTitle(category: any): string {
  if (!category) return "Санат";
  return localizeName(category.name) || `${category.gender === "MALE" ? "Ерлер" : "Әйелдер"} · ${category.weightMin}-${category.weightMax} кг`;
}

function athleteName(athlete: any): string {
  return `${athlete?.name ?? ""} ${athlete?.surname ?? ""}`.trim() || "Спортшы";
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

function deadlineText(t: any): string {
  const value = t.applicationDeadline ?? t.startDate;
  return new Date(value).toLocaleString("kk-KZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function weighInText(t: any): string {
  if (!t.weighInStart && !t.weighInEnd) return "Кейін хабарланады";
  const fmt = new Intl.DateTimeFormat("kk-KZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const start = t.weighInStart ? fmt.format(new Date(t.weighInStart)) : "";
  const end = t.weighInEnd ? fmt.format(new Date(t.weighInEnd)) : "";
  return start && end ? `${start} - ${end}` : start || end;
}

function localizeName(n: any): string {
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "";
}
