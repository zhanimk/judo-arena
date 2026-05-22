/**
 * Глобальная рейтинговая таблица — /admin/ratings
 *
 * Показывает сводный лидерборд по всем завершённым турнирам.
 * Фильтры: клуб, поиск по имени/фамилии.
 * Клик на строку раскрывает историю турниров спортсмена.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, StatCard, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav } from "@/components/dashboard/admin-nav";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { Award, ChevronDown, ChevronUp, Medal, Search, Star, Trophy, User } from "lucide-react";

export const Route = createFileRoute("/admin/ratings")({
  head: () => ({ meta: [{ title: "Рейтинг — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminRatings />
    </ProtectedRoute>
  ),
});

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function athleteName(a: any) {
  return `${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "—";
}

function genderLabel(g: string) {
  if (g === "MALE") return "Ер";
  if (g === "FEMALE") return "Әйел";
  return "—";
}

function placeLabel(place: number): string {
  if (place === 1) return "🥇 1-орын";
  if (place === 2) return "🥈 2-орын";
  if (place === 3) return "🥉 3-орын";
  if (place === 99) return "Қатысушы";
  return `${place}-орын`;
}

function medalClass(rank: number): string {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-zinc-300";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
}

// ============================================================
// Главная страница
// ============================================================
function AdminRatings() {
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");
  const [gender, setGender] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const clubsQuery = useQuery({
    queryKey: ["admin-ratings-clubs"],
    queryFn: () => api.clubs.list(),
    staleTime: 60_000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["admin-leaderboard", clubId],
    queryFn: () => api.ratings.leaderboard({ clubId: clubId || undefined, limit: 200 }),
    staleTime: 30_000,
  });

  const rows: any[] = leaderboardQuery.data ?? [];

  const genderRows = gender === "ALL" ? rows : rows.filter((row) => row.athlete?.gender === gender);

  const filtered = genderRows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const a = row.athlete;
    return [
      athleteName(a),
      a?.club ? localizeName(a.club.name) : "",
      a?.club?.city ?? "",
      a?.weightKg ? `${a.weightKg}` : "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const top3 = genderRows.slice(0, 3);
  const totalAthletes = genderRows.length;
  const topPoints = genderRows[0]?.totalPoints ?? 0;

  return (
    <DashboardShell role="Әкімші" navItems={adminNav} accentTitle="Спортшылар рейтингі">
      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Рейтингтегі спортшылар" value={String(totalAthletes)} accent />
        <StatCard label="Клубтар" value={String(clubsQuery.data?.total ?? "…")} />
        <StatCard label="Жетекші ұпай" value={topPoints ? String(Math.round(topPoints)) : "—"} hint="1-орын" />
        <StatCard label="Клуб фильтрі" value={clubId ? (clubsQuery.data?.items?.find((c: any) => c.id === clubId) ? localizeName(clubsQuery.data!.items.find((c: any) => c.id === clubId).name) : "—") : "Барлығы"} />
      </div>

      {/* Пьедестал — топ 3 */}
      {!leaderboardQuery.isLoading && top3.length > 0 && (
        <Panel title="Топ-3 спортшылар">
          <div className="grid gap-4 sm:grid-cols-3">
            {top3.map((row, i) => {
              const a = row.athlete;
              const icons = [
                <Trophy key="1" className="h-7 w-7 text-yellow-400" />,
                <Medal key="2" className="h-7 w-7 text-zinc-300" />,
                <Award key="3" className="h-7 w-7 text-amber-600" />,
              ];
              return (
                <div
                  key={a.id}
                  className={`glass rounded-xl p-5 flex flex-col items-center text-center border ${i === 0 ? "border-yellow-400/40" : i === 1 ? "border-zinc-300/30" : "border-amber-600/30"}`}
                >
                  {icons[i]}
                  <div className="mt-3 font-display text-lg font-bold">{athleteName(a)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {a.club ? localizeName(a.club.name) : "—"}
                    {a.club?.city && ` · ${a.club.city}`}
                  </div>
                  <div className="mt-3 font-display text-2xl font-bold text-gradient-gold">
                    {Math.round(row.totalPoints)}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">ұпай</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Жыныс фильтрі */}
      <div className="mt-6 mb-4 flex gap-1.5 rounded-lg border border-border/50 bg-card/30 p-1 w-fit">
        {([
          { id: "ALL" as const, label: "Барлығы" },
          { id: "MALE" as const, label: "Ер балалар" },
          { id: "FEMALE" as const, label: "Қыз балалар" },
        ]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setGender(id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              gender === id
                ? id === "MALE"
                  ? "bg-sky-500/20 text-sky-400 shadow-sm"
                  : id === "FEMALE"
                    ? "bg-rose-500/20 text-rose-400 shadow-sm"
                    : "bg-gradient-gold text-gold-foreground shadow-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Фильтры */}
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_18rem]">
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

      {/* Таблица */}
      {leaderboardQuery.isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState title="Рейтинг жазбалары жоқ" hint="Жарыс аяқталғаннан кейін рейтинг автоматты есептеледі." />
      ) : (
        <div className="glass rounded-2xl border border-gold/20 overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_90px_90px_110px_36px] gap-3 px-6 py-4 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-background/30">
            <div>Орын</div>
            <div>Спортшы</div>
            <div>Клуб</div>
            <div>Жынысы</div>
            <div>Салмақ</div>
            <div className="text-right">Ұпай</div>
            <div />
          </div>

          <div className="divide-y divide-border/40">
            {filtered.map((row, idx) => {
              const a = row.athlete;
              const isExpanded = expandedId === a.id;
              const displayRank = gender !== "ALL" ? idx + 1 : row.rank;
              return (
                <div key={a.id}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="w-full text-left grid gap-3 px-4 py-4 hover:bg-gold/5 transition-colors sm:grid-cols-[72px_1fr_1fr_90px_90px_110px_36px] sm:px-6 sm:items-center"
                  >
                    {/* Rank */}
                    <div className={`flex items-center gap-1.5 font-display text-2xl font-bold ${medalClass(displayRank)}`}>
                      {displayRank <= 3 && <Star className="h-3.5 w-3.5 fill-current shrink-0" />}
                      {displayRank}
                    </div>

                    {/* Athlete */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-gold-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{athleteName(a)}</div>
                        <div className="text-xs text-muted-foreground sm:hidden truncate">
                          {a.club ? localizeName(a.club.name) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Club */}
                    <div className="hidden sm:block text-sm text-muted-foreground truncate">
                      {a.club ? localizeName(a.club.name) : "—"}
                      {a.club?.city && <span className="text-xs"> · {a.club.city}</span>}
                    </div>

                    {/* Gender */}
                    <div className="hidden sm:block text-sm text-muted-foreground">
                      {genderLabel(a.gender)}
                    </div>

                    {/* Weight */}
                    <div className="hidden sm:block text-sm text-muted-foreground">
                      {a.weightKg ? `−${a.weightKg} кг` : "—"}
                    </div>

                    {/* Points */}
                    <div className="text-right font-display text-xl font-bold text-gradient-gold tabular-nums">
                      {Math.round(row.totalPoints)}
                    </div>

                    {/* Toggle */}
                    <div className="hidden sm:flex items-center justify-center text-muted-foreground">
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Expanded: история турниров */}
                  {isExpanded && <AthleteHistory athleteId={a.id} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground text-right">
        Барлығы: {filtered.length} спортшы
        {search && ` (іздеу: "${search}")`}
      </div>
    </DashboardShell>
  );
}

// ============================================================
// Раскрывающаяся история турниров спортсмена
// ============================================================
function AthleteHistory({ athleteId }: { athleteId: string }) {
  const q = useQuery({
    queryKey: ["admin-athlete-rating", athleteId],
    queryFn: () => api.ratings.athlete(athleteId),
  });

  if (q.isLoading) {
    return (
      <div className="px-6 py-4 bg-background/30 border-t border-border/30">
        <LoadingState />
      </div>
    );
  }

  const entries: any[] = q.data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className="px-6 py-4 bg-background/30 border-t border-border/30 text-sm text-muted-foreground">
        Аяқталған жарыстар жоқ.
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-4 bg-background/30 border-t border-border/30">
      <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Жарыс тарихы</div>
      <div className="space-y-2">
        {entries.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between gap-4 text-sm rounded-lg glass px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                <Link
                  to="/admin/tournaments/$id"
                  params={{ id: e.tournament?.id }}
                  className="hover:text-gold transition-colors"
                >
                  {localizeName(e.tournament?.name)}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {categoryTitle(e.category)}
                {e.tournament?.startDate && (
                  <> · {new Date(e.tournament.startDate).toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" })}</>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">{placeLabel(e.place)}</div>
              <div className="font-display font-bold text-gradient-gold">{Math.round(e.points)} ұпай</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-right text-xs text-muted-foreground">
        Жалпы: <span className="font-bold text-gold">{Math.round(q.data?.totalPoints ?? 0)}</span> ұпай
      </div>
    </div>
  );
}

function categoryTitle(cat: any): string {
  if (!cat) return "—";
  const name = localizeName(cat.name);
  const weight = cat.weightMin != null && cat.weightMax != null ? `${cat.weightMin}–${cat.weightMax} кг` : "";
  const gender = cat.gender === "MALE" ? "Ер" : cat.gender === "FEMALE" ? "Әйел" : "";
  return [name, gender, weight].filter(Boolean).join(" · ");
}
