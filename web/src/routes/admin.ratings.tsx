import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Award,
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Trophy,
  User,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type {
  AthleteLeaderboardEntry,
  Club,
  ClubLeaderboardEntry,
  WeightClassLeaderboardEntry,
} from "@/lib/api-types";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/admin/ratings")({
  head: () => ({ meta: [{ title: "Дәреже — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminRatings />
    </ProtectedRoute>
  ),
});

function localizeName(n: import("@/lib/api-types").LocalizedName | string | null | undefined): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function athleteFullName(a: { name?: string; surname?: string } | null | undefined) {
  return `${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "—";
}

type Tab = "athletes" | "clubs" | "weight";

function AdminRatings() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("athletes");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [clubFilter, setClubFilter] = useState("");
  const [gender, setGender] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [wcGender, setWcGender] = useState<"MALE" | "FEMALE">("MALE");
  const [wcWeightMax, setWcWeightMax] = useState<number | null>(null);
  const [finalizeId, setFinalizeId] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizeOk, setFinalizeOk] = useState(false);
  const [sortKey, setSortKey] = useState<"points" | "wins" | "place">("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const clubsQuery = useQuery({
    queryKey: ["admin-ratings-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
    staleTime: 60_000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["admin-leaderboard", clubFilter, gender],
    queryFn: () =>
      api.ratings.leaderboard({
        clubId: clubFilter || undefined,
        limit: 200,
      }),
    staleTime: 30_000,
    enabled: tab === "athletes",
  });

  const clubLeaderboardQuery = useQuery({
    queryKey: ["admin-club-leaderboard"],
    queryFn: () => api.ratings.clubLeaderboard({ limit: 100 }),
    staleTime: 30_000,
    enabled: tab === "clubs",
  });

  const weightClassesQuery = useQuery({
    queryKey: ["admin-weight-classes"],
    queryFn: () => api.ratings.weightClasses(),
    staleTime: 5 * 60_000,
    enabled: tab === "weight",
  });

  const wcLeaderboardQuery = useQuery({
    queryKey: ["admin-wc-leaderboard", wcGender, wcWeightMax],
    queryFn: () =>
      api.ratings.weightClassLeaderboard({ gender: wcGender, weightMax: wcWeightMax!, limit: 100 }),
    staleTime: 30_000,
    enabled: tab === "weight" && wcWeightMax !== null,
  });

  const finalizeMutation = useMutation({
    mutationFn: (id: string) => api.admin.finalize(id),
    onSuccess: () => {
      setFinalizeOk(true);
      setFinalizeError("");
      qc.invalidateQueries({ queryKey: ["admin-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["admin-club-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["admin-wc-leaderboard"] });
    },
    onError: (e: unknown) => {
      setFinalizeError(e instanceof ApiError ? e.message : t("error.generic"));
      setFinalizeOk(false);
    },
  });

  // Filter + sort athletes
  const athleteRows = (() => {
    let rows = leaderboardQuery.data ?? [];
    if (gender !== "ALL") rows = rows.filter((r: AthleteLeaderboardEntry) => r.athlete.gender === gender);
    if (deferredSearch) {
      const s = deferredSearch.toLowerCase();
      rows = rows.filter((r: AthleteLeaderboardEntry) => {
        const name = athleteFullName(r.athlete).toLowerCase();
        const club = localizeName(r.athlete?.club?.name).toLowerCase();
        return name.includes(s) || club.includes(s);
      });
    }
    rows = [...rows].sort((a: AthleteLeaderboardEntry, b: AthleteLeaderboardEntry) => {
      const av = sortKey === "points" ? (a.totalPoints ?? 0)
        : sortKey === "wins" ? (a.wins ?? 0)
        : -(a.place ?? 999);
      const bv = sortKey === "points" ? (b.totalPoints ?? 0)
        : sortKey === "wins" ? (b.wins ?? 0)
        : -(b.place ?? 999);
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return rows;
  })();

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? (sortDir === "desc" ? <ChevronDown className="h-3 w-3 inline ml-0.5" /> : <ChevronUp className="h-3 w-3 inline ml-0.5" />)
      : null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "athletes", label: t("ratings.tab_athletes"), icon: <User className="h-4 w-4" /> },
    { id: "clubs", label: t("ratings.tab_clubs"), icon: <Building2 className="h-4 w-4" /> },
    { id: "weight", label: t("ratings.tab_weight"), icon: <Award className="h-4 w-4" /> },
  ];

  const isLoading =
    (tab === "athletes" && leaderboardQuery.isLoading) ||
    (tab === "clubs" && clubLeaderboardQuery.isLoading) ||
    (tab === "weight" && weightClassesQuery.isLoading);

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("ratings.admin_title")}
    >
      <div className="mb-6">
      {/* Recalculate panel */}
      <Panel title={t("ratings.recalc_title")}>
        <p className="text-sm text-muted-foreground mb-3">
          {t("ratings.recalc_hint")}
        </p>
        <div className="flex flex-wrap gap-2 items-start">
          <input
            className="flex-1 min-w-[220px] rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
            placeholder={t("ratings.recalc_placeholder")}
            value={finalizeId}
            onChange={e => { setFinalizeId(e.target.value); setFinalizeOk(false); setFinalizeError(""); }}
          />
          <button
            className="flex items-center gap-1.5 rounded-md bg-gold/90 hover:bg-gold text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={!finalizeId.trim() || finalizeMutation.isPending}
            onClick={() => { setFinalizeOk(false); setFinalizeError(""); finalizeMutation.mutate(finalizeId.trim()); }}
          >
            {finalizeMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            {t("ratings.recalc_btn")}
          </button>
        </div>
        {finalizeOk && (
          <p className="mt-2 text-sm text-green-400">{t("ratings.recalc_ok")}</p>
        )}
        {finalizeError && (
          <p className="mt-2 text-sm text-red-400">{finalizeError}</p>
        )}
      </Panel>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border/40 pb-0">
        {tabs.map(tab_ => (
          <button
            key={tab_.id}
            onClick={() => setTab(tab_.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              tab === tab_.id
                ? "bg-gold/15 text-gold border-b-2 border-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab_.icon}
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ── ATHLETES TAB ── */}
      {tab === "athletes" && (
        <Panel title={t("ratings.athletes_panel")}>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                className="pl-8 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
                placeholder={t("ratings.search_placeholder")}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={gender}
              onChange={e => setGender(e.target.value as typeof gender)}
            >
              <option value="ALL">{t("common.all_genders")}</option>
              <option value="MALE">{t("common.male")}</option>
              <option value="FEMALE">{t("common.female")}</option>
            </select>
            <select
              className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={clubFilter}
              onChange={e => setClubFilter(e.target.value)}
            >
              <option value="">{t("common.all_clubs")}</option>
              {(clubsQuery.data?.items ?? []).map((c: Club) => (
                <option key={c.id} value={c.id}>{localizeName(c.name)}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <LoadingState />
          ) : athleteRows.length === 0 ? (
            <EmptyState title={t("ratings.no_data")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="py-2 pr-3 text-left w-10">#</th>
                    <th className="py-2 pr-3 text-left">{t("common.athlete")}</th>
                    <th className="py-2 pr-3 text-left hidden md:table-cell">{t("common.club")}</th>
                    <th
                      className="py-2 pr-3 text-right cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort("points")}
                    >
                      {t("ratings.points")} <SortIcon k="points" />
                    </th>
                    <th
                      className="py-2 pr-3 text-right cursor-pointer hover:text-foreground hidden sm:table-cell"
                      onClick={() => toggleSort("wins")}
                    >
                      {t("ratings.wins")} <SortIcon k="wins" />
                    </th>
                    <th className="py-2 pr-3 text-right hidden sm:table-cell">{t("ratings.losses")}</th>
                    <th className="py-2 text-right hidden lg:table-cell">{t("ratings.ippon_wins")}</th>
                    <th className="py-2 text-center">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {athleteRows.map((row: AthleteLeaderboardEntry, i: number) => (
                    <tr
                      key={row.athlete.id ?? i}
                      className="border-b border-border/20 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2.5 pr-3 text-muted-foreground font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{athleteFullName(row.athlete)}</div>
                        {row.athlete?.beltRank && (
                          <div className="text-xs text-muted-foreground">{row.athlete.beltRank}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground hidden md:table-cell">
                        {localizeName(row.athlete?.club?.name)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="font-semibold text-gold">{row.totalPoints ?? 0}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-green-400 hidden sm:table-cell">
                        {row.wins ?? 0}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-muted-foreground hidden sm:table-cell">
                        {row.losses ?? 0}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground hidden lg:table-cell">
                        {row.ipponWins ?? 0}
                      </td>
                      <td className="py-2.5 text-center">
                        <Link
                          to="/admin/users/$id"
                          params={{ id: row.athlete.id }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground text-right">
                {t("ratings.showing_count", { count: athleteRows.length })}
              </p>
            </div>
          )}
        </Panel>
      )}

      {/* ── CLUBS TAB ── */}
      {tab === "clubs" && (
        <Panel title={t("ratings.clubs_panel")}>
          {clubLeaderboardQuery.isLoading ? (
            <LoadingState />
          ) : (clubLeaderboardQuery.data ?? []).length === 0 ? (
            <EmptyState title={t("ratings.no_data")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="py-2 pr-3 text-left w-10">#</th>
                    <th className="py-2 pr-3 text-left">{t("common.club")}</th>
                    <th className="py-2 pr-3 text-right">{t("ratings.points")}</th>
                    <th className="py-2 text-center">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(clubLeaderboardQuery.data ?? []).map((row: ClubLeaderboardEntry, i: number) => (
                    <tr
                      key={row.club?.id ?? i}
                      className="border-b border-border/20 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2.5 pr-3">
                        {i === 0 ? <Trophy className="h-4 w-4 text-yellow-400" />
                          : i === 1 ? <Trophy className="h-4 w-4 text-slate-400" />
                          : i === 2 ? <Trophy className="h-4 w-4 text-amber-700" />
                          : <span className="text-muted-foreground font-mono text-xs">{i + 1}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{localizeName(row.club?.name)}</div>
                        {row.club?.city && (
                          <div className="text-xs text-muted-foreground">{row.club.city}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="font-semibold text-gold">{row.totalPoints ?? 0}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <Link
                          to="/admin/clubs/$id"
                          params={{ id: row.club?.id }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ── WEIGHT CLASS TAB ── */}
      {tab === "weight" && (
        <Panel title={t("ratings.weight_panel")}>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={wcGender}
              onChange={e => { setWcGender(e.target.value as "MALE" | "FEMALE"); setWcWeightMax(null); }}
            >
              <option value="MALE">{t("common.male")}</option>
              <option value="FEMALE">{t("common.female")}</option>
            </select>
            <select
              className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              value={wcWeightMax ?? ""}
              onChange={e => setWcWeightMax(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("ratings.select_weight_class")}</option>
              {(weightClassesQuery.data ?? [])
                .filter((wc: { gender: string; weightMax: number; label: string }) => wc.gender === wcGender)
                .map((wc: { gender: string; weightMax: number; label: string }) => (
                  <option key={wc.weightMax} value={wc.weightMax}>{wc.label}</option>
                ))}
            </select>
          </div>

          {wcWeightMax === null ? (
            <EmptyState title={t("ratings.select_weight_class_hint")} />
          ) : wcLeaderboardQuery.isLoading ? (
            <LoadingState />
          ) : (wcLeaderboardQuery.data ?? []).length === 0 ? (
            <EmptyState title={t("ratings.no_data")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="py-2 pr-3 text-left w-10">#</th>
                    <th className="py-2 pr-3 text-left">{t("common.athlete")}</th>
                    <th className="py-2 pr-3 text-left hidden md:table-cell">{t("common.club")}</th>
                    <th className="py-2 pr-3 text-right">{t("ratings.points")}</th>
                    <th className="py-2 pr-3 text-right hidden sm:table-cell">{t("ratings.tournaments")}</th>
                    <th className="py-2 text-center">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(wcLeaderboardQuery.data ?? []).map((row: WeightClassLeaderboardEntry) => (
                    <tr
                      key={row.athlete?.id}
                      className="border-b border-border/20 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2.5 pr-3">
                        {row.rank <= 3 ? (
                          <Star className={`h-4 w-4 ${
                            row.rank === 1 ? "text-yellow-400"
                            : row.rank === 2 ? "text-slate-400"
                            : "text-amber-700"
                          }`} />
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">{row.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{athleteFullName(row.athlete)}</div>
                        {row.athlete?.weightKg && (
                          <div className="text-xs text-muted-foreground">{row.athlete.weightKg} кг</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground hidden md:table-cell">
                        {localizeName(row.athlete?.club?.name)}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="font-semibold text-gold">{row.totalPoints ?? 0}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-muted-foreground hidden sm:table-cell">
                        {row.tournamentsCount ?? 0}
                      </td>
                      <td className="py-2.5 text-center">
                        <Link
                          to="/admin/users/$id"
                          params={{ id: row.athlete?.id }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </DashboardShell>
  );
}
