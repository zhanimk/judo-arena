import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Award, Building2, Loader2, MapPin, Search, Star, Trophy, User, Users } from "lucide-react";
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

type Tab = "athletes" | "clubs";
type Gender = "ALL" | "MALE" | "FEMALE";

function Rankings() {
  const [tab, setTab] = useState<Tab>("athletes");
  const [gender, setGender] = useState<Gender>("ALL");
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
  const clubLeaderboardQuery = useQuery({
    queryKey: ["club-leaderboard"],
    queryFn: () => api.ratings.clubLeaderboard({ limit: 100 }),
    staleTime: 60_000,
  });

  const rows = leaderboardQuery.data ?? [];
  const clubRows = clubLeaderboardQuery.data ?? [];

  const genderRows = useMemo(() => {
    if (gender === "ALL") return rows;
    return rows.filter((row: any) => row.athlete?.gender === gender);
  }, [rows, gender]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return genderRows;
    return genderRows.filter((row: any) => {
      const a = row.athlete;
      return [athleteName(a), a?.club ? localizeName(a.club.name) : "", a?.club?.city ?? "", a?.weightKg ? `${a.weightKg}` : ""].join(" ").toLowerCase().includes(q);
    });
  }, [genderRows, search]);

  const filteredClubRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubRows;
    return clubRows.filter((row: any) =>
      [localizeName(row.club?.name), row.club?.city ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [clubRows, search]);

  const topThree = genderRows.slice(0, 3);
  const topThreeClubs = clubRows.slice(0, 3);
  const loading = tab === "athletes" ? leaderboardQuery.isLoading : clubLeaderboardQuery.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* ── Compact header ── */}
      <div className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 py-8">
          <h1 className="font-display text-3xl font-bold">
            Спортшылар <span className="text-gradient-gold">рейтингі</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
            Турнир нәтижелері бекітілген сайын автоматты жаңарады
          </p>
        </div>
      </div>

      <section className="container mx-auto px-4 py-6 flex-1">
        {/* ── Toolbar: tabs + gender (одна строка) ── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Main tabs */}
          <div className="flex gap-1 rounded-lg border border-border/50 bg-card/40 p-1">
            {([
              { id: "athletes" as Tab, label: "Спортшылар", icon: User },
              { id: "clubs" as Tab, label: "Клубтар", icon: Building2 },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setSearch(""); setGender("ALL"); }}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  tab === id
                    ? "bg-gradient-gold text-gold-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Gender filter (только для спортшылар) */}
          {tab === "athletes" && (
            <>
              <div className="h-5 w-px bg-border/50 hidden sm:block" />
              <div className="flex gap-1">
                {([
                  { id: "ALL" as Gender, label: "Барлығы" },
                  { id: "MALE" as Gender, label: "Ер" },
                  { id: "FEMALE" as Gender, label: "Қыз" },
                ]).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setGender(id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                      gender === id
                        ? id === "MALE"
                          ? "bg-sky-500/15 text-sky-400"
                          : id === "FEMALE"
                            ? "bg-rose-500/15 text-rose-400"
                            : "bg-gold/15 text-gold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
          </div>
        ) : tab === "athletes" && rows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium">Әзірше дәреже бос</div>
            <div className="text-sm mt-1">Жарыстар өткеннен кейін ұпайлар көрінеді.</div>
          </div>
        ) : tab === "clubs" && clubRows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <div className="font-medium">Клуб рейтингі бос</div>
            <div className="text-sm mt-1">Жарыстар аяқталғаннан кейін клуб ұпайлары есептеледі.</div>
          </div>
        ) : (
          <>
            {/* ═══ ATHLETES ═══ */}
            {tab === "athletes" && (
              <>
                {/* Top-3 — compact strip */}
                {topThree.length > 0 && (
                  <div className="mb-6 grid gap-3 sm:grid-cols-3">
                    {topThree.map((row: any, i: number) => {
                      const a = row.athlete;
                      const accent = i === 0 ? "border-yellow-400/40 bg-yellow-400/5" : i === 1 ? "border-zinc-300/30 bg-zinc-200/5" : "border-amber-600/30 bg-amber-600/5";
                      const medal = i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-400" : "text-amber-600";
                      return (
                        <div key={a.id} className={`flex items-center gap-3 rounded-xl border p-3 ${accent}`}>
                          <div className={`font-display text-2xl font-bold ${medal} shrink-0 w-8 text-center`}>{i + 1}</div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">{athleteName(a)}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {a.club ? localizeName(a.club.name) : "—"}
                              {a.weightKg ? ` · ${a.weightKg} кг` : ""}
                            </div>
                          </div>
                          <div className="shrink-0 font-display text-lg font-bold text-gradient-gold tabular-nums">
                            {Math.round(row.totalPoints ?? 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Search + club filter */}
                <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_16rem]">
                  <label className="relative block">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Іздеу..."
                      className="w-full rounded-lg border border-border/60 bg-card/60 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-gold"
                    />
                  </label>
                  <select
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    className="rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold"
                  >
                    <option value="">Барлық клубтар</option>
                    {(clubsQuery.data?.items ?? []).map((club: any) => (
                      <option key={club.id} value={club.id}>{localizeName(club.name)}</option>
                    ))}
                  </select>
                </div>

                {/* Table */}
                <div id="rating-table" className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[56px_1fr_1fr_90px_100px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-muted/20">
                    <div>#</div>
                    <div>Спортшы</div>
                    <div>Клуб</div>
                    <div>Салмақ</div>
                    <div className="text-right">Ұпай</div>
                  </div>
                  <div className="divide-y divide-border/30">
                    {filteredRows.map((row: any, idx: number) => {
                      const a = row.athlete;
                      const rank = gender !== "ALL" ? idx + 1 : row.rank;
                      const medal =
                        rank === 1 ? "text-yellow-400" :
                        rank === 2 ? "text-zinc-400" :
                        rank === 3 ? "text-amber-600" :
                        "text-muted-foreground";
                      return (
                        <div
                          key={a.id}
                          className="grid gap-3 px-4 py-3 hover:bg-muted/30 transition-colors sm:grid-cols-[56px_1fr_1fr_90px_100px] sm:px-5 sm:items-center"
                        >
                          <div className={`flex items-center gap-1.5 font-display text-lg font-bold ${medal}`}>
                            {rank <= 3 && <Star className="h-3 w-3 fill-current" />}
                            {rank}
                          </div>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                              <User className="h-3.5 w-3.5 text-gold-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{athleteName(a)}</div>
                              <div className="text-[11px] text-muted-foreground sm:hidden truncate">
                                {a.club ? localizeName(a.club.name) : "—"}
                              </div>
                            </div>
                          </div>
                          <div className="hidden sm:block text-sm text-muted-foreground truncate">
                            {a.club ? localizeName(a.club.name) : "—"}
                            {a.club?.city && <span className="text-xs"> · {a.club.city}</span>}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {a.weightKg ? `${a.weightKg} кг` : "—"}
                          </div>
                          <div className="text-right font-display text-base font-bold text-gradient-gold tabular-nums">
                            {Math.round(row.totalPoints ?? 0)}
                          </div>
                        </div>
                      );
                    })}
                    {filteredRows.length === 0 && (
                      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                        Спортшы табылмады.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground text-right tabular-nums">
                  {gender !== "ALL" && <>{genderRows.length} / </>}{rows.length} спортшы
                </div>
              </>
            )}

            {/* ═══ CLUBS ═══ */}
            {tab === "clubs" && (
              <>
                {/* Top-3 clubs strip */}
                {topThreeClubs.length > 0 && (
                  <div className="mb-6 grid gap-3 sm:grid-cols-3">
                    {topThreeClubs.map((row: any, i: number) => {
                      const accent = i === 0 ? "border-yellow-400/40 bg-yellow-400/5" : i === 1 ? "border-zinc-300/30 bg-zinc-200/5" : "border-amber-600/30 bg-amber-600/5";
                      const medal = i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-400" : "text-amber-600";
                      return (
                        <div key={row.club.id} className={`flex items-center gap-3 rounded-xl border p-3 ${accent}`}>
                          <div className={`font-display text-2xl font-bold ${medal} shrink-0 w-8 text-center`}>{row.rank}</div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">{localizeName(row.club.name)}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {row.club.city || "—"} · {row.athleteCount} спортшы
                            </div>
                          </div>
                          <div className="shrink-0 font-display text-lg font-bold text-gradient-gold tabular-nums">
                            {Math.round(row.totalPoints ?? 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Search */}
                <div className="mb-4">
                  <label className="relative block">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Клуб немесе қала іздеу..."
                      className="w-full rounded-lg border border-border/60 bg-card/60 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-gold"
                    />
                  </label>
                </div>

                {/* Table */}
                <div id="rating-table" className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[56px_1fr_140px_100px_100px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-muted/20">
                    <div>#</div>
                    <div>Клуб</div>
                    <div>Қала</div>
                    <div>Спортшылар</div>
                    <div className="text-right">Ұпай</div>
                  </div>
                  <div className="divide-y divide-border/30">
                    {filteredClubRows.map((row: any) => {
                      const medal =
                        row.rank === 1 ? "text-yellow-400" :
                        row.rank === 2 ? "text-zinc-400" :
                        row.rank === 3 ? "text-amber-600" :
                        "text-muted-foreground";
                      return (
                        <div
                          key={row.club.id}
                          className="grid gap-3 px-4 py-3 hover:bg-muted/30 transition-colors sm:grid-cols-[56px_1fr_140px_100px_100px] sm:px-5 sm:items-center"
                        >
                          <div className={`flex items-center gap-1.5 font-display text-lg font-bold ${medal}`}>
                            {row.rank <= 3 && <Star className="h-3 w-3 fill-current" />}
                            {row.rank}
                          </div>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-gold-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{localizeName(row.club.name)}</div>
                              <div className="text-[11px] text-muted-foreground sm:hidden truncate">
                                {row.club.city || "—"} · {row.athleteCount} спортшы
                              </div>
                            </div>
                          </div>
                          <div className="hidden sm:block text-sm text-muted-foreground">
                            {row.club.city || "—"}
                          </div>
                          <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {row.athleteCount}
                          </div>
                          <div className="text-right font-display text-base font-bold text-gradient-gold tabular-nums">
                            {Math.round(row.totalPoints ?? 0)}
                          </div>
                        </div>
                      );
                    })}
                    {filteredClubRows.length === 0 && (
                      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                        Клуб табылмады.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
