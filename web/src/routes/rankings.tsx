import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Award, Building2, Loader2, Search, Star, Users, Weight } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar-image";
import { mediaUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AthleteLeaderboardEntry, Club, ClubLeaderboardEntry } from "@/lib/api-types";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Дәреже — Judo Child League" },
      { name: "description", content: "Дзюдо спортшыларының жалпы дәреже кестесі." },
    ],
  }),
  errorComponent: RouteErrorUI,
  component: Rankings,
});

function localizeName(
  name: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function athleteName(a: { name?: string; surname?: string } | null | undefined) {
  return `${a?.surname ?? ""} ${a?.name ?? ""}`.trim() || "—";
}

type Tab = "athletes" | "clubs" | "weight";
type Gender = "ALL" | "MALE" | "FEMALE";

const MEDAL_COLORS = ["text-yellow-400", "text-slate-400", "text-amber-600"];
const MEDAL_BG = [
  "border-yellow-400/30 bg-yellow-400/5",
  "border-slate-400/20 bg-slate-400/5",
  "border-amber-600/25 bg-amber-600/5",
];
const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

function Rankings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("athletes");
  const [gender, setGender] = useState<Gender>("ALL");
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");
  const [wcGender, setWcGender] = useState<"MALE" | "FEMALE">("MALE");
  const [wcWeightMax, setWcWeightMax] = useState<number | null>(null);

  const clubsQuery = useQuery({
    queryKey: ["rankings-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
    staleTime: 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", clubId],
    queryFn: () => api.ratings.leaderboard({ clubId: clubId || undefined, limit: 50 }),
    staleTime: 60_000,
  });
  const clubLeaderboardQuery = useQuery({
    queryKey: ["club-leaderboard"],
    queryFn: () => api.ratings.clubLeaderboard({ limit: 30 }),
    staleTime: 60_000,
  });
  const weightClassesQuery = useQuery({
    queryKey: ["weight-classes"],
    queryFn: () => api.ratings.weightClasses(),
    staleTime: 5 * 60_000,
    enabled: tab === "weight",
  });
  const wcLeaderboardQuery = useQuery({
    queryKey: ["weight-class-leaderboard", wcGender, wcWeightMax],
    queryFn: () =>
      api.ratings.weightClassLeaderboard({ gender: wcGender, weightMax: wcWeightMax! }),
    staleTime: 60_000,
    enabled: tab === "weight" && wcWeightMax !== null,
  });

  const rows = useMemo(() => leaderboardQuery.data ?? [], [leaderboardQuery.data]);
  const clubRows = useMemo(() => clubLeaderboardQuery.data ?? [], [clubLeaderboardQuery.data]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (gender !== "ALL")
      list = list.filter((r: AthleteLeaderboardEntry) => r.athlete.gender === gender);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r: AthleteLeaderboardEntry) => {
      const a = r.athlete;
      return [athleteName(a), localizeName(a?.club?.name), a?.club?.city ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, gender, search]);

  const filteredClubRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubRows;
    return clubRows.filter((r: ClubLeaderboardEntry) =>
      [localizeName(r.club?.name), r.club?.city ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [clubRows, search]);

  const topThree = filteredRows.slice(0, 3);
  const topThreeClubs = clubRows.slice(0, 3);

  const POINTS_SCALE = [
    { place: "1", pts: 100, cls: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
    { place: "2", pts: 80, cls: "bg-slate-300/10 text-slate-400 border-slate-300/20" },
    { place: "3", pts: 50, cls: "bg-amber-600/15 text-amber-500 border-amber-600/25" },
    { place: "5", pts: 30, cls: "bg-muted/50 text-muted-foreground border-border/40" },
    { place: "7", pts: 15, cls: "bg-muted/50 text-muted-foreground border-border/40" },
  ];

  const tabs = [
    { id: "athletes" as Tab, label: t("rankings.tab_athletes"), icon: Users },
    { id: "clubs" as Tab, label: t("rankings.tab_clubs"), icon: Building2 },
    { id: "weight" as Tab, label: t("rankings.tab_weight"), icon: Weight },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* ── Hero header ── */}
      <div className="border-b border-border/40 bg-gradient-to-b from-card/60 to-background">
        <div className="container mx-auto px-4 pt-8 pb-6">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {t("rankings.title_prefix")}{" "}
            <span className="text-gradient-gold">{t("rankings.title_suffix")}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("rankings.subtitle")}</p>

          {/* Points legend */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
              {t("rankings.points_label")}:
            </span>
            {POINTS_SCALE.map((s) => (
              <div
                key={s.place}
                className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${s.cls}`}
              >
                <span className="opacity-70 font-normal">{s.place}·</span>
                <span className="font-display tabular-nums">{s.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="container mx-auto px-4 py-6 flex-1">
        {/* ── Tabs row ── */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-border/50 bg-card/40 p-1 gap-0.5">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setSearch("");
                  setGender("ALL");
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  tab === id
                    ? "bg-gradient-gold text-gold-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {tab === "athletes" && (
            <div className="flex gap-1">
              {[
                { id: "ALL" as Gender, label: t("rankings.filter_all") },
                { id: "MALE" as Gender, label: t("rankings.filter_male") },
                { id: "FEMALE" as Gender, label: t("rankings.filter_female") },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setGender(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                    gender === id
                      ? id === "MALE"
                        ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                        : id === "FEMALE"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                          : "bg-gold/15 text-gold border border-gold/20"
                      : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ══════════════ ATHLETES ══════════════ */}
        {tab === "athletes" && (
          <>
            {/* Top-3 podium strip */}
            {topThree.length > 0 && (
              <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topThree.map((row: AthleteLeaderboardEntry, i: number) => {
                  const a = row.athlete;
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 rounded-xl border p-4 ${MEDAL_BG[i]}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          src={a.avatarUrl ? mediaUrl(a.avatarUrl) : null}
                          name={athleteName(a)}
                          size={40}
                        />
                        <span className="absolute -bottom-1 -right-1 text-base leading-none">
                          {MEDAL_EMOJI[i]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{athleteName(a)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {localizeName(a.club?.name)}
                          {a.weightKg ? ` · ${a.weightKg} кг` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-xl font-bold text-gradient-gold tabular-nums">
                        {Math.round(row.totalPoints ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filters */}
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("rankings.search_placeholder")}
                  className="w-full rounded-xl border border-border/60 bg-card/60 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/60 transition-colors"
                />
              </div>
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                aria-label={t("common.all_clubs")}
                className="rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-sm focus:outline-none focus:border-gold/60 transition-colors min-w-[180px]"
              >
                <option value="">{t("common.all_clubs")}</option>
                {(clubsQuery.data?.items ?? []).map((c: Club) => (
                  <option key={c.id} value={c.id}>
                    {localizeName(c.name)}
                  </option>
                ))}
              </select>
            </div>

            {leaderboardQuery.isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-gold" />
              </div>
            ) : filteredRows.length === 0 ? (
              <Empty icon={Award} text={t("rankings.no_data")} hint={t("rankings.no_data_hint")} />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <RankTable
                    cols={[
                      "#",
                      t("rankings.col_athlete"),
                      t("rankings.col_club"),
                      t("rankings.col_weight"),
                      t("rankings.col_points"),
                    ]}
                    colWidths="grid-cols-[48px_1fr_1fr_80px_90px]"
                  >
                    {filteredRows.map((row: AthleteLeaderboardEntry, idx: number) => {
                      const a = row.athlete;
                      const rank = row.rank ?? idx + 1;
                      return (
                        <RankRow
                          key={a.id}
                          rank={rank}
                          colWidths="grid-cols-[48px_1fr_1fr_80px_90px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              src={a.avatarUrl ? mediaUrl(a.avatarUrl) : null}
                              name={athleteName(a)}
                              size={32}
                              className="shrink-0"
                            />
                            <p className="font-medium text-sm truncate">{athleteName(a)}</p>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {localizeName(a.club?.name)}
                            {a.club?.city && <span className="text-xs"> · {a.club.city}</span>}
                          </div>
                          <div className="text-sm text-muted-foreground tabular-nums">
                            {a.weightKg ? `${a.weightKg} кг` : "—"}
                          </div>
                          <div className="text-right font-display font-bold text-gradient-gold tabular-nums">
                            {Math.round(row.totalPoints ?? 0)}
                          </div>
                        </RankRow>
                      );
                    })}
                  </RankTable>
                </div>
                {/* Mobile table — compact 3-col layout */}
                <div className="sm:hidden rounded-2xl border border-border/50 overflow-hidden">
                  <div className="divide-y divide-border/25">
                    {filteredRows.map((row: AthleteLeaderboardEntry, idx: number) => {
                      const a = row.athlete;
                      const rank = row.rank ?? idx + 1;
                      const medal =
                        rank === 1
                          ? MEDAL_COLORS[0]
                          : rank === 2
                            ? MEDAL_COLORS[1]
                            : rank === 3
                              ? MEDAL_COLORS[2]
                              : "text-muted-foreground";
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"
                        >
                          <span
                            className={`w-7 shrink-0 font-display text-sm font-bold tabular-nums ${medal} flex items-center gap-0.5`}
                          >
                            {rank <= 3 && <Star className="h-3 w-3 fill-current" />}
                            {rank}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{athleteName(a)}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {localizeName(a.club?.name)}
                              {a.weightKg ? ` · ${a.weightKg} кг` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 font-display font-bold text-gradient-gold tabular-nums text-sm">
                            {Math.round(row.totalPoints ?? 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-right text-muted-foreground tabular-nums">
              {filteredRows.length} / {rows.length} {t("rankings.tab_athletes").toLowerCase()}
            </p>
          </>
        )}

        {/* ══════════════ CLUBS ══════════════ */}
        {tab === "clubs" && (
          <>
            {topThreeClubs.length > 0 && (
              <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topThreeClubs.map((row: ClubLeaderboardEntry, i: number) => (
                  <div
                    key={row.club.id}
                    className={`flex items-center gap-3 rounded-xl border p-4 ${MEDAL_BG[i]}`}
                  >
                    <span className="text-2xl shrink-0">{MEDAL_EMOJI[i]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">
                        {localizeName(row.club.name)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.club.city || "—"} · {row.athleteCount}{" "}
                        {t("rankings.col_athletes").toLowerCase()}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-xl font-bold text-gradient-gold tabular-nums">
                      {Math.round(row.totalPoints ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("rankings.search_clubs_placeholder")}
                  className="w-full rounded-xl border border-border/60 bg-card/60 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/60 transition-colors"
                />
              </div>
            </div>

            {clubLeaderboardQuery.isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-gold" />
              </div>
            ) : filteredClubRows.length === 0 ? (
              <Empty
                icon={Building2}
                text={t("rankings.no_clubs")}
                hint={t("rankings.no_clubs_hint")}
              />
            ) : (
              <RankTable
                cols={[
                  "#",
                  t("rankings.col_club"),
                  t("rankings.col_city"),
                  t("rankings.col_athletes"),
                  t("rankings.col_points"),
                ]}
                colWidths="grid-cols-[48px_1fr_140px_80px_90px]"
              >
                {filteredClubRows.map((row: ClubLeaderboardEntry) => (
                  <RankRow
                    key={row.club.id}
                    rank={row.rank}
                    colWidths="grid-cols-[48px_1fr_140px_80px_90px]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-gold/20 border border-gold/20 flex items-center justify-center shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-gold/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {localizeName(row.club.name)}
                        </p>
                        <p className="text-[11px] text-muted-foreground sm:hidden">
                          {row.club.city || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:block text-sm text-muted-foreground">
                      {row.club.city || "—"}
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {row.athleteCount}
                    </div>
                    <div className="text-right font-display font-bold text-gradient-gold tabular-nums">
                      {Math.round(row.totalPoints ?? 0)}
                    </div>
                  </RankRow>
                ))}
              </RankTable>
            )}
          </>
        )}

        {/* ══════════════ WEIGHT CLASS ══════════════ */}
        {tab === "weight" && (
          <div>
            {/* Gender + weight selectors */}
            <div className="mb-6 space-y-3">
              {/* Gender */}
              <div className="flex gap-2">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setWcGender(g);
                      setWcWeightMax(null);
                    }}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                      wcGender === g
                        ? "bg-gradient-gold text-gold-foreground shadow-sm"
                        : "border border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"
                    }`}
                  >
                    {g === "MALE" ? t("rankings.filter_male") : t("rankings.filter_female")}
                  </button>
                ))}
              </div>

              {/* Weight class pills */}
              <div className="flex flex-wrap gap-2">
                {weightClassesQuery.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                {(weightClassesQuery.data ?? [])
                  .filter((wc) => wc.gender === wcGender)
                  .map((wc) => (
                    <button
                      key={wc.weightMax}
                      onClick={() => setWcWeightMax(wc.weightMax)}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                        wcWeightMax === wc.weightMax
                          ? "bg-gold/20 border border-gold/50 text-gold shadow-sm"
                          : "border border-border/60 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                      }`}
                    >
                      {wc.label}
                    </button>
                  ))}
              </div>
            </div>

            {wcWeightMax === null ? (
              <Empty
                icon={Weight}
                text={t("rankings.tab_weight")}
                hint={t("rankings.no_data_hint")}
              />
            ) : wcLeaderboardQuery.isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
              </div>
            ) : (wcLeaderboardQuery.data ?? []).length === 0 ? (
              <Empty icon={Award} text={t("rankings.no_data")} hint={t("rankings.no_data_hint")} />
            ) : (
              <RankTable
                cols={[
                  "#",
                  t("rankings.col_athlete"),
                  t("rankings.best_place"),
                  t("rankings.tournaments"),
                  t("rankings.col_points"),
                ]}
                colWidths="grid-cols-[48px_1fr_100px_100px_90px]"
              >
                {(wcLeaderboardQuery.data ?? []).map((row) => {
                  const a = row.athlete;
                  return (
                    <RankRow
                      key={a.id}
                      rank={row.rank}
                      colWidths="grid-cols-[48px_1fr_100px_100px_90px]"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {a.surname} {a.name}
                        </p>
                        {(a.surnameLatin || a.nameLatin) && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {a.surnameLatin} {a.nameLatin}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground truncate">
                          {localizeName(a.club?.name)}
                          {a.club?.city ? ` · ${a.club.city}` : ""}
                        </p>
                      </div>
                      <div className="text-sm text-right text-muted-foreground tabular-nums">
                        {row.bestPlace != null
                          ? row.bestPlace <= 3
                            ? MEDAL_EMOJI[row.bestPlace - 1]
                            : row.bestPlace
                          : "—"}
                      </div>
                      <div className="text-sm text-right text-muted-foreground tabular-nums">
                        {row.tournamentsCount}
                      </div>
                      <div className="text-right font-display font-bold text-gradient-gold tabular-nums">
                        {Math.round(row.totalPoints)}
                      </div>
                    </RankRow>
                  );
                })}
              </RankTable>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Empty({
  icon: Icon,
  text,
  hint,
}: {
  icon: React.ElementType;
  text: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 py-16 text-center text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="font-medium">{text}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RankTable({
  cols,
  colWidths,
  children,
}: {
  cols: string[];
  colWidths: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden">
      <div
        className={`hidden sm:grid ${colWidths} gap-4 px-5 py-3 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground bg-muted/20 border-b border-border/40`}
      >
        {cols.map((c, i) => (
          <div key={i} className={i === cols.length - 1 ? "text-right" : ""}>
            {c}
          </div>
        ))}
      </div>
      <div className="divide-y divide-border/25">{children}</div>
    </div>
  );
}

function RankRow({
  rank,
  colWidths,
  children,
}: {
  rank: number;
  colWidths: string;
  children: React.ReactNode;
}) {
  const medal =
    rank === 1
      ? MEDAL_COLORS[0]
      : rank === 2
        ? MEDAL_COLORS[1]
        : rank === 3
          ? MEDAL_COLORS[2]
          : "text-muted-foreground";
  return (
    <div
      className={`grid ${colWidths} gap-3 px-4 py-3.5 items-center hover:bg-white/[0.03] transition-colors sm:px-5`}
    >
      <div
        className={`flex items-center gap-1 font-display text-base font-bold tabular-nums ${medal}`}
      >
        {rank <= 3 && <Star className="h-3 w-3 fill-current shrink-0" />}
        {rank}
      </div>
      {children}
    </div>
  );
}
