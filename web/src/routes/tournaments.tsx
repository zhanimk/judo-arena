import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { LazyImage } from "@/components/ui/avatar-image";
import { SiteFooter } from "@/components/site/SiteFooter";
import heroKazakhstan from "@/assets/hero-kazakhstan-judo.jpg";
import teamLineup from "@/assets/team-lineup.jpg";
import athleteBlue from "@/assets/athlete-blue-2.jpg";
import athleteWhite from "@/assets/athlete-woman-white.jpg";
import { Calendar, Clock, GitBranch, MapPin, Radio, Search, Trophy, Users, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Жарыстар — Judo-Arena" },
      { name: "description", content: "Дзюдо жарыстарының афишасы және live-нәтижелері." },
    ],
  }),
  component: Tournaments,
});

type Status = "DRAFT" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const statusLabel: Record<Status, string> = {
  DRAFT: "Жоба",
  REGISTRATION_OPEN: "Тіркеу ашық",
  REGISTRATION_CLOSED: "Тіркеу жабық",
  IN_PROGRESS: "LIVE",
  COMPLETED: "Аяқталды",
  CANCELLED: "Тоқтатылды",
};

const statusColor = (s: Status) =>
  s === "IN_PROGRESS" ? "bg-destructive/20 text-destructive border-destructive/40 animate-pulse" :
  s === "REGISTRATION_OPEN" ? "bg-gold/15 text-gold border-gold/30" :
  s === "REGISTRATION_CLOSED" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
  s === "COMPLETED" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
  "bg-muted/50 text-muted-foreground border-border";

const tournamentImages = [heroKazakhstan, teamLineup, athleteBlue, athleteWhite];

const filters: Array<{ value: "ALL" | Status; label: string }> = [
  { value: "ALL", label: "Барлығы" },
  { value: "REGISTRATION_OPEN", label: "Тіркеу ашық" },
  { value: "IN_PROGRESS", label: "LIVE" },
  { value: "COMPLETED", label: "Аяқталған" },
];

function localizeName(name: any): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function Tournaments() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["tournaments-public"],
    queryFn: () => api.tournaments.list(),
  });
  const tournaments = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments.filter((t: any) => {
      const byStatus = filter === "ALL" || t.status === filter;
      const text = `${localizeName(t.name)} ${t.city ?? ""} ${t.location ?? ""}`.toLowerCase();
      return byStatus && (!q || text.includes(q));
    });
  }, [filter, search, tournaments]);
  const featured = filtered[0] ?? tournaments[0];
  const liveCount = tournaments.filter((t: any) => t.status === "IN_PROGRESS").length;
  const openCount = tournaments.filter((t: any) => t.status === "REGISTRATION_OPEN").length;
  const totalApplications = tournaments.reduce((sum: number, t: any) => sum + (t._count?.applications ?? 0), 0);

  if (pathname !== "/tournaments") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="relative min-h-[520px] overflow-hidden border-b border-border/40">
        <img src={heroKazakhstan} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <div className="container relative mx-auto grid min-h-[520px] gap-8 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div className="max-w-3xl pb-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-gold">
              <Radio className="h-3.5 w-3.5" /> Жарыстар күнтізбесі
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Жарыстар, жеребе және live нәтижелер бір жерде
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Қай жарысқа тіркелу ашық, қай жерде өтеді, қанша санат бар және live экран қашан қосылады — бәрі осы бетте.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <StatCard label="Жарыс" value={String(tournaments.length)} />
              <StatCard label="Тіркеу ашық" value={String(openCount)} />
              <StatCard label="Өтінім" value={String(totalApplications)} />
            </div>
          </div>

          {featured && (
            <Link
              to="/tournaments/$id"
              params={{ id: featured.id }}
              className="group overflow-hidden rounded-2xl border border-gold/30 bg-card/80 shadow-2xl backdrop-blur transition hover:-translate-y-1 hover:border-gold/60"
            >
              <div className="relative h-44">
                <LazyImage src={featured.posterUrl || teamLineup} alt="" className="h-full w-full object-cover" priority />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                <span className={`absolute left-4 top-4 rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest ${statusColor(featured.status)}`}>
                  {statusLabel[featured.status as Status] ?? featured.status}
                </span>
              </div>
              <div className="p-5">
                <div className="text-xs uppercase tracking-widest text-gold">Басты жарыс</div>
                <h2 className="mt-2 font-display text-2xl font-bold leading-tight group-hover:text-gold">
                  {localizeName(featured.name)}
                </h2>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <Info icon={Calendar}>{dateRange(featured.startDate, featured.endDate)}</Info>
                  <Info icon={MapPin}>{featured.location || featured.city}</Info>
                  <Info icon={Users}>{featured._count?.applications ?? 0} өтінім · {featured._count?.categories ?? 0} санат</Info>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-gold">
                  Толық ашу
                  <GitBranch className="h-4 w-4" />
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 flex-1">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Барлық жарыстар</h2>
            <p className="mt-1 text-sm text-muted-foreground">Санат, дедлайн, орын және live статус бойынша тез қарап шығу.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Қала, жарыс, орын..."
                className="h-11 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-gold"
              />
            </label>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`min-h-10 rounded-full px-4 text-sm font-medium transition ${
                filter === item.value
                  ? "bg-gradient-gold text-gold-foreground shadow-gold"
                  : "border border-border bg-card/60 hover:border-gold/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-destructive">
            Жарыстарды жүктеу мүмкін болмады. Серверге қосылу жоқ па?
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <div>Әзірше жарыстар жоқ.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 py-16 text-center text-muted-foreground">
            Бұл фильтр бойынша жарыс табылмады.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t: any, index: number) => (
              <Link
                key={t.id}
                to="/tournaments/$id"
                params={{ id: t.id }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 transition-all hover:-translate-y-1 hover:border-gold/50"
              >
                <div className="relative h-40 overflow-hidden">
                  <LazyImage src={t.posterUrl || tournamentImages[index % tournamentImages.length]!} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                  <span className={`absolute left-4 top-4 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusColor(t.status)} shrink-0`}>
                    {statusLabel[t.status as Status] ?? t.status}
                  </span>
                </div>
                <div className="relative p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold group-hover:text-gold transition-colors leading-snug">
                      {localizeName(t.name)}
                    </h3>
                    <span className="rounded-full bg-gold/10 px-2 py-1 text-xs text-gold">{t.tatamiCount ?? 1} татами</span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <Info icon={Calendar}>{dateRange(t.startDate, t.endDate)}</Info>
                    <Info icon={MapPin}>{t.location || t.city}</Info>
                    <Info icon={Clock}>Дедлайн: {formatDeadline(t)}</Info>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                    <Metric icon={Users} label="Өтінім" value={t._count?.applications ?? 0} />
                    <Metric icon={GitBranch} label="Санат" value={t._count?.categories ?? 0} />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {["Ақпарат", "Санат", "Хаттама"].map((tab) => (
                        <span key={tab} className="rounded-full border border-border/60 bg-background/35 px-2.5 py-1">
                          {tab}
                        </span>
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition-colors group-hover:bg-gold group-hover:text-gold-foreground">
                      Толық ашу
                      <GitBranch className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/45 p-4 backdrop-blur">
      <div className="font-display text-3xl font-bold text-gold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Info({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-gold/70" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-gold/70" /> {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function dateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });
  }
  return `${s.toLocaleDateString("kk-KZ", { day: "numeric", month: "short" })} - ${e.toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatDeadline(t: any): string {
  const value = t.applicationDeadline ?? t.startDate;
  return new Date(value).toLocaleDateString("kk-KZ", { day: "numeric", month: "short" });
}
