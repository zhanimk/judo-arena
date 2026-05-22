/**
 * Live Wall — проектор-табло в стиле IJF / Olympic TV.
 *
 * Режимы:
 *   /live-wall/:tournamentId           — все татами в сетке 3-col
 *   /live-wall/:tournamentId?tatami=N  — один татами, крупно (для экрана рядом с татами)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Maximize2, MonitorPlay, Trophy } from "lucide-react";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/socket";

type Match = any;

export const Route = createFileRoute("/live-wall/$tournamentId")({
  head: () => ({ meta: [{ title: "Live Wall — Judo-Arena" }] }),
  validateSearch: (search: Record<string, unknown>): { tatami?: number } => {
    const t = Number(search.tatami);
    return { tatami: Number.isFinite(t) && t > 0 ? t : undefined };
  },
  component: LiveWall,
});

/* ─── Root ─── */

function LiveWall() {
  const { tournamentId } = Route.useParams();
  const { tatami: singleTatami } = Route.useSearch();
  const qc = useQueryClient();

  const tournamentQuery = useQuery({
    queryKey: ["live-wall-tournament", tournamentId],
    queryFn: () => api.tournaments.get(tournamentId),
  });

  const matchesQuery = useQuery({
    queryKey: ["live-wall-matches", tournamentId],
    queryFn: () => api.matches.list({ tournamentId, limit: 200 }),
    refetchInterval: 2000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["live-wall-matches", tournamentId] });
  useRealtime([`tournament:${tournamentId}`], {
    "match:started": invalidate,
    "match:event": invalidate,
    "match:scoreUpdate": invalidate,
    "match:finished": invalidate,
    "match:osaekomiStart": invalidate,
    "match:osaekomiEnd": invalidate,
    "tatami:queueUpdate": invalidate,
  });

  const tournament = tournamentQuery.data;
  const matches = matchesQuery.data ?? [];
  const tatamiCount = Math.max(3, Number(tournament?.tatamiCount ?? 3));
  const allTatamis = useMemo(() => buildTatamis(matches, tatamiCount), [matches, tatamiCount]);
  const tatamis = singleTatami ? allTatamis.filter((t) => t.number === singleTatami) : allTatamis;

  const openFullscreen = () => {
    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <main className="min-h-screen bg-[#040810] text-white">
      {/* Header — тонкий */}
      <header className="border-b border-white/8 bg-[#060e20] px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <MonitorPlay className="h-5 w-5 text-gold shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold md:text-xl">
                {localizeName(tournament?.name) ?? "Жарыс"}
              </h1>
            </div>
            {singleTatami && (
              <span className="rounded-full bg-gold/20 px-3 py-0.5 text-xs font-bold text-gold">
                Татами {singleTatami}
              </span>
            )}
          </div>
          <button
            onClick={openFullscreen}
            className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 py-1.5 text-xs hover:bg-white/12"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Толық экран
          </button>
        </div>
      </header>

      <section className={`grid min-h-[calc(100vh-56px)] gap-4 p-4 ${
        singleTatami ? "lg:grid-cols-1 max-w-5xl mx-auto" : "lg:grid-cols-3"
      }`}>
        {tatamis.map((tatami) => (
          <TatamiWall key={tatami.number} tatami={tatami} single={!!singleTatami} />
        ))}
      </section>
    </main>
  );
}

/* ─── Tatami Panel ─── */

function TatamiWall({ tatami, single }: {
  tatami: { number: number; current: Match | null; queue: Match[]; completed: Match[] };
  single?: boolean;
}) {
  const current = tatami.current;
  const queue = tatami.queue;
  const showQueue = single ? queue.slice(0, 10) : queue.slice(0, 6);

  return (
    <section className="flex flex-col rounded-xl border border-white/8 bg-[#080f22] shadow-2xl shadow-black/40">
      {/* ─ Header ─ */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={`font-display font-bold ${single ? "text-5xl" : "text-3xl"} text-gold`}>
            {tatami.number}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">Татами</div>
            <div className="text-xs text-white/50">
              {queue.length} кезекте · {tatami.completed.length} аяқталды
            </div>
          </div>
        </div>
        {current ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-red-300">LIVE</span>
          </div>
        ) : (
          <span className="text-xs text-white/30">Күтуде</span>
        )}
      </div>

      <div className="flex-1 p-4">
        {/* ─ IJF Scoreboard ─ */}
        {current ? (
          <IjfScoreboard match={current} large={!!single} />
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
            <div className="text-center">
              <div className="font-display text-xl font-semibold text-white/50">Матч жоқ</div>
              <div className="mt-1 text-xs text-white/25">Келесі матч кезекте</div>
            </div>
          </div>
        )}

        {/* ─ Queue ─ */}
        {showQueue.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/30">
              <Clock className="h-3 w-3" />
              Кезек ({queue.length})
            </div>
            <div className="space-y-1.5">
              {showQueue.map((m, idx) => (
                <QueueRow key={m.id} match={m} index={idx + 1} highlight={idx === 0} large={!!single} />
              ))}
              {queue.length > showQueue.length && (
                <div className="rounded-md bg-white/[0.03] py-1.5 text-center text-[10px] text-white/25">
                  +{queue.length - showQueue.length} тағы
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─ Last result ─ */}
      {tatami.completed[0] && (
        <div className="border-t border-white/8 px-4 py-3">
          <CompletedResult match={tatami.completed[0]} />
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════
   IJF Olympic-style Scoreboard
   ═══════════════════════════════════════════ */

function IjfScoreboard({ match, large }: { match: Match; large?: boolean }) {
  const red = match.redAthlete;
  const blue = match.blueAthlete;
  const redS = match.scoreSnapshot?.red ?? {};
  const blueS = match.scoreSnapshot?.blue ?? {};
  const isGoldenScore = match.scoreSnapshot?.isGoldenScore;
  const isFinished = match.status === "COMPLETED";
  const winnerId = match.winnerId;

  return (
    <div className="overflow-hidden rounded-xl border border-white/12 bg-[#0b1530] shadow-xl shadow-black/50">
      {/* ─ AKA (white / red) row ─ */}
      <IjfAthleteRow
        side="white"
        athlete={red}
        score={redS}
        isWinner={isFinished && winnerId === red?.id}
        isLoser={isFinished && !!winnerId && winnerId !== red?.id}
        large={large}
      />

      {/* ─ Separator ─ */}
      <div className="h-[2px] bg-gradient-to-r from-white/5 via-white/15 to-white/5" />

      {/* ─ AO (blue) row ─ */}
      <IjfAthleteRow
        side="blue"
        athlete={blue}
        score={blueS}
        isWinner={isFinished && winnerId === blue?.id}
        isLoser={isFinished && !!winnerId && winnerId !== blue?.id}
        large={large}
      />

      {/* ─ Footer bar: category · section · timer/status ─ */}
      <div className={`flex items-center justify-between border-t border-white/8 bg-black/40 ${
        large ? "px-6 py-3" : "px-4 py-2"
      }`}>
        <div className={`text-white/50 ${large ? "text-sm" : "text-[11px]"}`}>
          {weightCategory(match.bracket?.category)}
          <span className="mx-1.5 text-white/20">·</span>
          {sectionLabel(match.bracketSection)}
          <span className="mx-1.5 text-white/20">·</span>
          R{match.round}
        </div>
        <div className={`font-display font-bold ${large ? "text-xl" : "text-sm"} ${
          isGoldenScore ? "text-gold animate-pulse" : isFinished ? "text-white/40" : "text-gold"
        }`}>
          {isGoldenScore ? "GOLDEN SCORE" : isFinished ? "АЯҚТАЛДЫ" : ""}
        </div>
      </div>
    </div>
  );
}

function IjfAthleteRow({ side, athlete, score, isWinner, isLoser, large }: {
  side: "white" | "blue";
  athlete: any;
  score: any;
  isWinner: boolean;
  isLoser: boolean;
  large?: boolean;
}) {
  const isWhite = side === "white";

  // Color accent
  const barColor = isWhite ? "bg-white" : "bg-blue-500";
  const labelSide = isWhite ? "АҚ" : "КӨК";

  // Background tint
  const bgTint = isWinner
    ? "bg-gradient-to-r from-gold/15 to-gold/5"
    : isWhite
      ? "bg-white/[0.04]"
      : "bg-blue-500/[0.06]";

  const ippon = score?.ippon ?? 0;
  const wazaari = score?.wazaari ?? 0;
  const yuko = score?.yuko ?? 0;
  const shido = score?.shido ?? 0;

  return (
    <div className={`relative flex items-center gap-0 ${bgTint} ${isLoser ? "opacity-50" : ""}`}>
      {/* ─ Color side bar ─ */}
      <div className={`${barColor} shrink-0 self-stretch ${large ? "w-3" : "w-2"}`} />

      {/* ─ Side label ─ */}
      <div className={`shrink-0 ${large ? "w-14 px-2" : "w-10 px-1.5"} text-center`}>
        <div className={`${large ? "text-[10px]" : "text-[8px]"} uppercase tracking-widest ${
          isWhite ? "text-white/60" : "text-blue-300/70"
        }`}>
          {labelSide}
        </div>
      </div>

      {/* ─ Athlete name ─ */}
      <div className={`flex-1 min-w-0 ${large ? "py-5" : "py-3"}`}>
        {athlete ? (
          <>
            <div className={`truncate font-display font-bold leading-tight ${large ? "text-4xl" : "text-xl"}`}>
              <span className="uppercase">{athlete.surname}</span>
              {" "}
              <span className="font-normal text-white/70">{athlete.name}</span>
            </div>
            {athlete.club?.name && (
              <div className={`truncate text-white/30 ${large ? "text-sm mt-1" : "text-[10px] mt-0.5"}`}>
                {athlete.club.name}
              </div>
            )}
          </>
        ) : (
          <div className={`italic text-white/25 ${large ? "text-2xl" : "text-base"}`}>TBD</div>
        )}
      </div>

      {/* ─ Score cells: I · W · Y ─ */}
      <div className={`flex shrink-0 ${large ? "gap-2 mr-3" : "gap-1 mr-2"}`}>
        <ScoreCell label="I" value={ippon} large={large} gold={ippon > 0} />
        <ScoreCell label="W" value={wazaari} large={large} gold={wazaari > 0} />
        <ScoreCell label="Y" value={yuko} large={large} gold={yuko > 0} />
      </div>

      {/* ─ Shido cards ─ */}
      <div className={`shrink-0 flex items-center ${large ? "gap-1.5 mr-5" : "gap-1 mr-3"}`}>
        <ShidoCards count={shido} large={large} />
      </div>

      {/* ─ Winner trophy ─ */}
      {isWinner && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Trophy className={`text-gold ${large ? "h-7 w-7" : "h-4 w-4"}`} />
        </div>
      )}
    </div>
  );
}

function ScoreCell({ label, value, large, gold }: {
  label: string;
  value: number;
  large?: boolean;
  gold?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border ${
      gold
        ? "border-gold/50 bg-gold/20"
        : "border-white/8 bg-black/30"
    } ${large ? "w-16 h-20" : "w-10 h-12"}`}>
      <div className={`font-bold uppercase leading-none ${
        large ? "text-[9px]" : "text-[7px]"
      } ${gold ? "text-gold/80" : "text-white/30"}`}>
        {label}
      </div>
      <div className={`font-display font-bold leading-none ${
        large ? "text-3xl mt-1" : "text-lg mt-0.5"
      } ${gold ? "text-gold" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function ShidoCards({ count, large }: { count: number; large?: boolean }) {
  const size = large ? "h-8 w-5" : "h-5 w-3";
  const gap = large ? "gap-1" : "gap-0.5";

  // 3 slots: first 2 are yellow, 3rd (hansoku-make) is red
  return (
    <div className={`flex ${gap}`}>
      {[1, 2, 3].map((n) => {
        const active = count >= n;
        const isRed = n === 3;
        return (
          <div
            key={n}
            className={`${size} rounded-sm border ${
              active
                ? isRed
                  ? "border-red-500 bg-red-500 shadow-lg shadow-red-500/40"
                  : "border-yellow-400 bg-yellow-400 shadow-lg shadow-yellow-400/30"
                : "border-white/10 bg-white/[0.04]"
            }`}
          />
        );
      })}
    </div>
  );
}

/* ─── Queue Row ─── */

function QueueRow({ match, index, highlight, large }: {
  match: Match;
  index: number;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${
      highlight
        ? "border-gold/30 bg-gold/8"
        : "border-white/6 bg-white/[0.025]"
    }`}>
      <div className={`flex shrink-0 items-center justify-center rounded-md font-display font-bold ${
        highlight ? "bg-gold/20 text-gold" : "bg-white/8 text-white/40"
      } ${large ? "h-10 w-10 text-lg" : "h-7 w-7 text-xs"}`}>
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-display font-semibold ${large ? "text-base" : "text-xs"}`}>
          <span className="uppercase">{surnameOnly(match.redAthlete)}</span>
          <span className="mx-1.5 text-white/25">vs</span>
          <span className="uppercase">{surnameOnly(match.blueAthlete)}</span>
        </div>
        <div className={`truncate text-white/30 ${large ? "text-xs mt-0.5" : "text-[10px]"}`}>
          {weightCategory(match.bracket?.category)}
          <span className="mx-1 text-white/15">·</span>
          {sectionLabel(match.bracketSection)}
        </div>
      </div>
      {highlight && (
        <div className={`shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-gold font-semibold ${
          large ? "text-xs" : "text-[9px]"
        }`}>
          Келесі
        </div>
      )}
    </div>
  );
}

/* ─── Completed Result ─── */

function CompletedResult({ match }: { match: Match }) {
  const winner = match.winnerId === match.redAthlete?.id ? match.redAthlete : match.blueAthlete;
  const loser = match.winnerId === match.redAthlete?.id ? match.blueAthlete : match.redAthlete;
  return (
    <div className="flex items-center gap-2">
      <Trophy className="h-3.5 w-3.5 text-gold/60 shrink-0" />
      <div className="min-w-0 flex-1 truncate text-xs">
        <span className="font-semibold text-gold/70">{athleteName(winner)}</span>
        <span className="text-white/25"> vs </span>
        <span className="text-white/35">{athleteName(loser)}</span>
      </div>
      <div className="text-[10px] text-white/20 shrink-0">{formatResult(match)}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Data helpers
   ═══════════════════════════════════════════ */

function buildTatamis(matches: Match[], tatamiCount: number) {
  const sorted = [...matches].sort(matchSort);
  return Array.from({ length: tatamiCount }, (_, index) => {
    const number = index + 1;
    const assigned = sorted.filter((m) => Number(m.tatamiNumber) === number);
    return {
      number,
      current: assigned.find((m) => m.status === "IN_PROGRESS") ?? null,
      queue: assigned.filter((m) => m.status === "PENDING"),
      completed: assigned.filter((m) => m.status === "COMPLETED").slice(0, 3),
    };
  });
}

function matchSort(a: Match, b: Match) {
  if (a.status === "IN_PROGRESS" && b.status !== "IN_PROGRESS") return -1;
  if (a.status !== "IN_PROGRESS" && b.status === "IN_PROGRESS") return 1;
  return (a.queuePosition ?? 999999) - (b.queuePosition ?? 999999) || (a.round ?? 0) - (b.round ?? 0) || (a.position ?? 0) - (b.position ?? 0);
}

function athleteName(athlete: any) {
  if (!athlete) return "TBD";
  return [athlete.name, athlete.surname].filter(Boolean).join(" ") || "TBD";
}

function surnameOnly(athlete: any) {
  if (!athlete) return "TBD";
  return athlete.surname || athlete.name || "TBD";
}

function localizeName(value: any) {
  if (!value) return "Жарыс";
  if (typeof value === "string") return value;
  return value.kk ?? value.ru ?? value.en ?? Object.values(value)[0] ?? "Жарыс";
}

function weightCategory(category: any): string {
  if (!category) return "";
  const gender = category.gender === "MALE" ? "Ер" : "Қыз";
  return `${gender} ${category.weightMin}–${category.weightMax} кг`;
}

function sectionLabel(section?: string | null): string {
  const labels: Record<string, string> = {
    main: "Негізгі",
    repechage: "Жұбату",
    bronze1: "Қола",
    bronze2: "Қола",
    final: "Финал",
  };
  return section ? labels[section] ?? section : "";
}

function formatResult(match: Match): string {
  const s = match.scoreSnapshot;
  if (!s) return "";
  const w = match.winnerId === match.redAthlete?.id ? s.red : s.blue;
  if (!w) return "";
  if (w.ippon > 0) return "Ippon";
  if (w.wazaari >= 2) return "Waza-ari ×2";
  if (w.wazaari > 0) return "Waza-ari";
  if (w.yuko > 0) return "Yuko";
  return "";
}
