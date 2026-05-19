import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import heroKazakhstan from "@/assets/hero-kazakhstan-judo.jpg";
import athleteBlue1 from "@/assets/athlete-blue-1.jpg";
import athleteBlue2 from "@/assets/athlete-blue-2.jpg";
import athleteWomanWhite from "@/assets/athlete-woman-white.jpg";
import { Award, Building2, Loader2, Medal, Search, Star, Trophy, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Дәреже — Judo-Arena" },
      { name: "description", content: "Дзюдо спортшыларының жалпы дәреже кестесі." },
    ],
  }),
  component: Rankings,
});

function localizeName(name: any): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function athleteName(a: any) {
  return `${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "—";
}

const podiumImages = [athleteBlue1, athleteBlue2, athleteWomanWhite];

function Rankings() {
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");

  const clubsQuery = useQuery({
    queryKey: ["rankings-clubs"],
    queryFn: () => api.clubs.list(),
    staleTime: 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", clubId],
    queryFn: () => api.ratings.leaderboard({ clubId: clubId || undefined, limit: 100 }),
    staleTime: 60_000,
  });

  const rows = leaderboardQuery.data ?? [];
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row: any) => {
      const a = row.athlete;
      return [
        athleteName(a),
        a?.club ? localizeName(a.club.name) : "",
        a?.club?.city ?? "",
        a?.weightKg ? `${a.weightKg}` : "",
      ].join(" ").toLowerCase().includes(q);
    });
  }, [rows, search]);

  const topThree = rows.slice(0, 3);
  const totalPoints = rows.reduce((sum: number, row: any) => sum + Math.round(row.totalPoints ?? 0), 0);
  const uniqueClubCount = new Set(rows.map((row: any) => row.athlete?.club?.id).filter(Boolean)).size;
  const leader = rows[0]?.athlete;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/40">
        <img src={heroKazakhstan} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/45" />
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="container mx-auto px-4 relative py-14 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-3">Жалпы дәреже</div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
                Спортшылар <span className="text-gradient-gold italic">рейтингі</span>
              </h1>
              <p className="mt-4 text-muted-foreground max-w-2xl">
                Бұл бет тек backend-тегі нақты нәтижелерден құралады: турнир қорытындысы бекітілген сайын ұпайлар жаңарып отырады.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/tournaments" className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-3 font-semibold text-gold-foreground shadow-gold">
                  Жарыстарды көру
                </Link>
                <a href="#rating-table" className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-background/50 px-5 py-3 font-medium text-gold backdrop-blur hover:border-gold/60">
                  Кестеге өту
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Спортшы", value: rows.length, icon: User },
                { label: "Клуб", value: uniqueClubCount, icon: Building2 },
                { label: "Ұпай", value: totalPoints, icon: Star },
                { label: "Лидер", value: leader ? athleteName(leader).split(" ")[0] : "—", icon: Trophy },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-gold/20 bg-card/70 p-4 shadow-elegant backdrop-blur">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-gold shadow-gold">
                    <item.icon className="h-5 w-5 text-gold-foreground" />
                  </div>
                  <div className="font-display text-2xl font-bold text-gradient-gold tabular-nums">{item.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 flex-1">
        {leaderboardQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : leaderboardQuery.error ? (
          <div className="text-center py-20 text-destructive">
            Дәрежені жүктеу мүмкін болмады.
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <div className="text-lg font-medium">Әзірше дәреже бос</div>
            <div className="text-sm mt-1">Жарыстар өткеннен кейін ұпайлар көрінеді.</div>
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 lg:grid-cols-3">
              {topThree.map((row: any, i: number) => {
                const a = row.athlete;
                return (
                  <div key={a.id} className="relative overflow-hidden rounded-2xl border border-gold/20 bg-card/70 p-5 shadow-elegant backdrop-blur">
                    <img src={podiumImages[i]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-12" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold">
                        <Medal className="h-7 w-7 text-gold-foreground" />
                      </div>
                      <div className="font-display text-5xl font-bold text-gold/25">#{row.rank}</div>
                    </div>
                    <div className="relative mt-5">
                      <div className="font-display text-2xl font-bold">{athleteName(a)}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {a.club ? localizeName(a.club.name) : "—"}
                        {a.club?.city ? ` · ${a.club.city}` : ""}
                      </div>
                      <div className="mt-5 inline-flex rounded-full border border-gold/30 bg-gold/10 px-4 py-2 font-display text-xl font-bold text-gradient-gold">
                        {Math.round(row.totalPoints ?? 0)} ұпай
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_18rem]">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Спортшы, клуб, қала немесе салмақ іздеу..."
                  className="w-full rounded-xl border border-border/60 bg-card/70 py-3 pl-11 pr-4 outline-none transition-colors focus:border-gold"
                />
              </label>
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="rounded-xl border border-border/60 bg-card/70 px-4 py-3 outline-none transition-colors focus:border-gold"
              >
                <option value="">Барлық клубтар</option>
                {(clubsQuery.data?.items ?? []).map((club: any) => (
                  <option key={club.id} value={club.id}>{localizeName(club.name)}</option>
                ))}
              </select>
            </div>

            <div id="rating-table" className="glass rounded-2xl border border-gold/20 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_120px_140px] gap-4 px-6 py-4 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-background/30">
                <div>Орын</div>
                <div>Спортшы</div>
                <div>Клуб</div>
                <div>Салмақ</div>
                <div className="text-right">Ұпай</div>
              </div>
              <div className="divide-y divide-border/40">
                {filteredRows.map((row: any) => {
                  const a = row.athlete;
                  const medal =
                    row.rank === 1 ? "text-yellow-400" :
                    row.rank === 2 ? "text-zinc-300" :
                    row.rank === 3 ? "text-amber-600" :
                    "text-muted-foreground";
                  return (
                    <div
                      key={a.id}
                      className="grid gap-4 px-4 py-4 hover:bg-gold/5 transition-colors sm:grid-cols-[80px_1fr_1fr_120px_140px] sm:px-6 sm:items-center"
                    >
                      <div className={`flex items-center gap-2 font-display text-2xl font-bold ${medal}`}>
                        {row.rank <= 3 && <Star className="h-4 w-4 fill-current" />}
                        {row.rank}
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-gold-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{athleteName(a)}</div>
                          <div className="text-xs text-muted-foreground sm:hidden truncate">
                            {a.club ? localizeName(a.club.name) : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="hidden sm:block text-sm text-muted-foreground truncate">
                        {a.club ? localizeName(a.club.name) : "—"}
                        {a.club?.city && <span className="text-xs"> · {a.club.city}</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {a.weightKg ? `−${a.weightKg} кг` : "—"}
                      </div>
                      <div className="text-right font-display text-xl font-bold text-gradient-gold tabular-nums">
                        {Math.round(row.totalPoints ?? 0)}
                      </div>
                    </div>
                  );
                })}
                {filteredRows.length === 0 && (
                  <div className="px-6 py-12 text-center text-muted-foreground">
                    Бұл іздеу бойынша спортшы табылмады.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
