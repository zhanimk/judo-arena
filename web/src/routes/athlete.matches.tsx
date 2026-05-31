/**
 * /athlete/matches — список всех матчей спортсмена.
 * Фильтры: статус, поиск по турниру/сопернику.
 * Клик → /athlete/matches/$id
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { Calendar, Search, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/athlete/matches")({
  head: () => ({ meta: [{ title: "Жекпе-жектер — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteMatchesList />
    </ProtectedRoute>
  ),
});

type StatusFilter = "all" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

function AthleteMatchesList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const athleteId = user?.id ?? "";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const matchesQuery = useQuery({
    queryKey: ["athlete-all-matches", athleteId],
    queryFn: () => api.matches.list({ athleteId, limit: 500 }),
    enabled: !!athleteId,
    staleTime: 30_000,
  });

  const matches: any[] = matchesQuery.data ?? [];

  const filtered = useMemo(() => {
    let list = matches;
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => {
        const opp = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
        return [
          opp ? `${opp.name} ${opp.surname}` : "",
          localizeName(m.tournament?.name),
          m.bracketSection ?? "",
        ].join(" ").toLowerCase().includes(q);
      });
    }
    return list;
  }, [matches, statusFilter, search, athleteId]);

  const total   = matches.length;
  const wins    = matches.filter((m) => m.winnerId === athleteId).length;
  const losses  = matches.filter((m) => m.winnerId && m.winnerId !== athleteId).length;
  const pending = matches.filter((m) => m.status === "PENDING").length;

  const stats = [
    { label: t("common.all"),         value: total },
    { label: t("matches.win"),        value: wins,    cls: "text-gold" },
    { label: t("matches.loss"),       value: losses,  cls: "text-destructive" },
    { label: t("athlete.stat_pending"), value: pending, cls: "text-muted-foreground" },
  ];

  return (
    <DashboardShell role={t("roles.ATHLETE")} navItems={nav} accentTitle={t("athlete.matches_page_title")}>
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {stats.map(({ label, value, cls }) => (
          <div key={label} className="glass rounded-xl px-4 py-3 text-center">
            <div className={`font-display text-2xl font-bold ${cls ?? ""}`}>{value}</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <Panel title={t("matches.list_title")}>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          {/* Status tabs */}
          <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
            {(["all", "PENDING", "IN_PROGRESS", "COMPLETED"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 transition-colors ${
                  statusFilter === s
                    ? "bg-gold text-gold-foreground font-semibold"
                    : "bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? t("common.all") : String(t(`status.${s}`, s))}
              </button>
            ))}
          </div>

          {/* Search */}
          <label className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gold/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("matches.search_placeholder")}
              className="w-full rounded-lg border border-border/60 bg-card/70 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-gold"
            />
          </label>
        </div>

        {/* List */}
        {matchesQuery.isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search || statusFilter !== "all" ? t("common.no_data") : t("athlete.no_matches")}
            hint={search || statusFilter !== "all" ? t("matches.search_hint") : t("athlete.no_matches_hint")}
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((m: any) => (
              <MatchRow key={m.id} match={m} athleteId={athleteId} />
            ))}
          </ul>
        )}

        {filtered.length > 0 && (
          <div className="mt-3 text-right text-xs text-muted-foreground">
            {filtered.length} {t("dashboard.matches").toLowerCase()}
            {search && ` · ${t("common.search").toLowerCase()}: "${search}"`}
          </div>
        )}
      </Panel>
    </DashboardShell>
  );
}

// ─── Строка матча ────────────────────────────────────────────────────────────

function MatchRow({ match: m, athleteId }: { match: any; athleteId: string }) {
  const { t } = useTranslation();
  const opp    = m.redAthlete?.id === athleteId ? m.blueAthlete : m.redAthlete;
  const mySide = m.redAthlete?.id === athleteId ? "red" : "blue";
  const myScore  = m.scoreSnapshot?.[mySide];
  const oppScore = m.scoreSnapshot?.[mySide === "red" ? "blue" : "red"];
  const won      = m.winnerId === athleteId;
  const done     = m.status === "COMPLETED";
  const live     = m.status === "IN_PROGRESS";

  const resultColor = done ? (won ? "border-gold/40 bg-gold/5" : "border-destructive/30 bg-destructive/5")
    : live ? "border-blue-400/40 bg-blue-400/5 animate-pulse"
    : "border-border/40";

  return (
    <li>
      <Link
        to="/athlete/matches/$id"
        params={{ id: m.id }}
        className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors hover:border-gold/40 ${resultColor}`}
      >
        {/* Result badge */}
        <div className="w-14 shrink-0 text-center">
          {live ? (
            <span className="rounded-full bg-blue-500/20 border border-blue-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">LIVE</span>
          ) : done ? (
            <span className={`font-display text-sm font-bold ${won ? "text-gold" : "text-destructive"}`}>
              {won ? t("matches.win") : t("matches.loss")}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{String(t("status.PENDING"))}</span>
          )}
        </div>

        {/* Opponent */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate text-sm">
            {opp ? `vs ${opp.name} ${opp.surname}` : "vs TBD"}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-gold/50" />
              {localizeName(m.tournament?.name) ?? "—"}
            </span>
            <span>{sectionLabel(m.bracketSection, t)} · {t("matches.round")} {m.round}</span>
            {m.tatamiNumber && <span>{t("common.tatami")} {m.tatamiNumber}</span>}
          </div>
        </div>

        {/* Score */}
        {done && myScore && (
          <div className="shrink-0 hidden sm:flex items-center gap-1 text-xs text-muted-foreground font-mono">
            <ScoreChip label="I" value={myScore.ippon ?? 0} won={won} />
            <ScoreChip label="W" value={myScore.wazaari ?? 0} won={won} />
            <ScoreChip label="S" value={myScore.shido ?? 0} bad />
            <span className="mx-1 text-border">vs</span>
            <ScoreChip label="I" value={oppScore?.ippon ?? 0} won={!won} />
            <ScoreChip label="W" value={oppScore?.wazaari ?? 0} won={!won} />
            <ScoreChip label="S" value={oppScore?.shido ?? 0} bad />
          </div>
        )}

        {/* Date */}
        {m.finishedAt ? (
          <div className="shrink-0 hidden md:flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(m.finishedAt).toLocaleDateString("kk-KZ", { day: "numeric", month: "short" })}
          </div>
        ) : null}
      </Link>
    </li>
  );
}

function ScoreChip({ label, value, won, bad }: { label: string; value: number; won?: boolean; bad?: boolean }) {
  const color = bad ? (value > 0 ? "text-destructive" : "text-muted-foreground/40")
    : value > 0 ? (won ? "text-gold" : "text-foreground") : "text-muted-foreground/40";
  return (
    <span className={`${color}`}>
      {label}{value}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function sectionLabel(s: string | null, t: (key: string) => string): string {
  if (!s) return "—";
  const m: Record<string, string> = {
    main:      t("bracket.section_main"),
    repechage: t("bracket.section_repechage"),
    bronze1:   t("bracket.section_bronze1"),
    bronze2:   t("bracket.section_bronze2"),
    final:     t("bracket.section_final"),
  };
  return m[s] ?? s;
}
