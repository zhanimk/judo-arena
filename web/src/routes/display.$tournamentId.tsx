/**
 * Display Mode — fullscreen scoreboard для проектора / TV в зале.
 *
 *   /display/:tournamentId              — сетка всех татами
 *   /display/:tournamentId?tatami=N     — один татами крупно
 *
 * Особенности:
 *   • Авто-fullscreen при загрузке
 *   • Нет навигации, нет хедера — только данные
 *   • Крупный шрифт, высокий контраст
 *   • Real-time через Socket.IO
 */

import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/socket";
import { buildTatamiState, type TatamiState } from "@/lib/tatami-state";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/display/$tournamentId")({
  head: () => ({ meta: [{ title: "Display — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  validateSearch: (s: Record<string, unknown>): { tatami?: number } => {
    const n = Number(s.tatami);
    return { tatami: Number.isFinite(n) && n > 0 ? n : undefined };
  },
  component: DisplayPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchAny = Record<string, unknown> & {
  id: string;
  status?: string;
  tatamiNumber?: number | null;
  queuePosition?: number | null;
  round?: number | null;
  position?: number | null;
  scoreSnapshot?: ScoreSnap | null;
  redAthlete?: AthleteInfo | null;
  blueAthlete?: AthleteInfo | null;
  winnerId?: string | null;
  bracket?: { category?: CategoryInfo } | null;
};

interface AthleteInfo {
  id: string;
  name?: string | null;
  surname?: string | null;
  nameLatin?: string | null;
  surnameLatin?: string | null;
}

interface CategoryInfo {
  gender?: string;
  weightMax?: number;
  weightMin?: number;
  ageMin?: number;
  ageMax?: number;
}

interface ScoreSnap {
  red?: SideScore;
  blue?: SideScore;
  isGoldenScore?: boolean;
  clock?: { running?: boolean; elapsedSec?: number; runningStartedAt?: string | null };
  osaekomi?: { side?: string; startedAt?: string } | null;
  pendingResult?: { winnerSide?: string } | null;
}

interface SideScore {
  ippon?: number;
  wazaari?: number;
  yuko?: number;
  shido?: number;
  hansoku?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function DisplayPage() {
  const { tournamentId } = Route.useParams();
  const { tatami: filterTatami } = Route.useSearch();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());

  // Auto fullscreen on load
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Live clock tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const tournamentQ = useQuery({
    queryKey: ["display-tournament", tournamentId],
    queryFn: () => api.tournaments.get(tournamentId),
  });

  const matchesQ = useQuery({
    queryKey: ["display-matches", tournamentId],
    queryFn: () => api.matches.list({ tournamentId, limit: 500 }),
    refetchInterval: 5000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["display-matches", tournamentId] });
  };
  useRealtime([`tournament:${tournamentId}`], {
    "match:started": invalidate,
    "match:scoreUpdate": invalidate,
    "match:finished": invalidate,
    "match:pendingResult": invalidate,
    "match:osaekomiStart": invalidate,
    "match:osaekomiEnd": invalidate,
    "tatami:queueUpdate": invalidate,
  });

  const tournament = tournamentQ.data;
  const matches = useMemo(() => (matchesQ.data ?? []) as unknown as MatchAny[], [matchesQ.data]);
  const tatamiCount = Math.max(1, Number(tournament?.tatamiCount ?? 1));
  const allTatamis = useMemo(
    () => buildTatamiState(matches, tatamiCount) as TatamiState<MatchAny>[],
    [matches, tatamiCount],
  );
  const tatamis = filterTatami
    ? allTatamis.filter((ts) => ts.number === filterTatami)
    : allTatamis;

  const tName = useMemo(() => {
    const n = tournament?.name;
    if (!n) return "";
    if (typeof n === "string") return n;
    const obj = n as Record<string, string>;
    return obj["kk"] ?? obj["ru"] ?? obj["en"] ?? "";
  }, [tournament?.name]);

  // Single tatami — large full-screen view
  if (filterTatami && tatamis.length === 1) {
    return (
      <SingleTatamiDisplay
        ts={tatamis[0]!}
        tatamiNumber={filterTatami}
        tName={tName}
        now={now}
        tatamiCount={tatamiCount}
      />
    );
  }

  // All tatamis grid
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#060d1a",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "2px solid #D4AF37",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1, color: "#D4AF37" }}>
          JUDO-ARENA
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, flex: 1, textAlign: "center" }}>{tName}</div>
        <LiveClock />
      </div>

      {/* Tatami grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(tatamiCount, 3)}, 1fr)`,
          gap: 8,
          padding: 8,
          alignItems: "stretch",
        }}
      >
        {tatamis.map((ts) => (
          <TatamiCard key={ts.number} ts={ts} now={now} />
        ))}
      </div>
    </div>
  );
}

// ─── Single Tatami Fullscreen ─────────────────────────────────────────────────

function SingleTatamiDisplay({
  ts,
  tatamiNumber,
  tName,
  now,
  tatamiCount,
}: {
  ts: TatamiState<MatchAny>;
  tatamiNumber: number;
  tName: string;
  now: number;
  tatamiCount: number;
}) {
  const match = ts.current;
  const score = match?.scoreSnapshot;
  const red = match?.redAthlete;
  const blue = match?.blueAthlete;
  const elapsedSec = computeElapsed(score?.clock, now);
  const pending = score?.pendingResult;
  const isGS = score?.isGoldenScore;

  const catLabel = match?.bracket?.category
    ? categoryLabel(match.bracket.category)
    : "";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#060d1a",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 24px",
          background: "#0f1f3d",
          borderBottom: "3px solid #D4AF37",
        }}
      >
        <div style={{ color: "#D4AF37", fontWeight: 900, fontSize: 18, letterSpacing: 3 }}>
          ТАТАМИ {tatamiNumber}
        </div>
        <div style={{ color: "#aaa", fontSize: 13, flex: 1, textAlign: "center" }}>{tName}</div>
        {catLabel && (
          <div style={{ color: "#D4AF37", fontSize: 13, fontWeight: 700 }}>{catLabel}</div>
        )}
        <LiveClock />
      </div>

      {match && match.status !== "COMPLETED" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 24px", gap: 12 }}>
          {/* Golden Score indicator */}
          {isGS && (
            <div style={{ textAlign: "center", color: "#fbbf24", fontWeight: 900, fontSize: 20, letterSpacing: 4 }}>
              ⚡ GOLDEN SCORE
            </div>
          )}

          {/* Pending result banner */}
          {pending && (
            <div
              style={{
                textAlign: "center",
                background: "#fbbf24",
                color: "#111",
                fontWeight: 900,
                fontSize: 22,
                padding: "8px 0",
                borderRadius: 6,
                letterSpacing: 2,
              }}
            >
              ⌛ НӘТИЖЕНІ РАСТАУ КҮТІЛУДЕ
            </div>
          )}

          {/* Athletes + scores */}
          <div style={{ flex: 1, display: "flex", gap: 12 }}>
            <LargeAthletePanel
              side="red"
              athlete={red}
              score={score?.red}
              isWinner={pending?.winnerSide === "RED"}
              isLoser={!!pending && pending.winnerSide !== "RED"}
              hasOsaekomi={score?.osaekomi?.side === "RED"}
            />
            {/* Timer */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 140,
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 900,
                  color: score?.clock?.running ? "#fff" : "#fbbf24",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: 2,
                }}
              >
                {formatTime(elapsedSec)}
              </div>
              {score?.osaekomi && (
                <div
                  style={{
                    background: "#dc2626",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 14,
                    padding: "4px 14px",
                    borderRadius: 4,
                    letterSpacing: 2,
                  }}
                >
                  OSAEKOMI
                </div>
              )}
            </div>
            <LargeAthletePanel
              side="blue"
              athlete={blue}
              score={score?.blue}
              isWinner={pending?.winnerSide === "BLUE"}
              isLoser={!!pending && pending.winnerSide !== "BLUE"}
              hasOsaekomi={score?.osaekomi?.side === "BLUE"}
            />
          </div>

          {/* Queue */}
          {ts.queue.length > 0 && (
            <div
              style={{
                borderTop: "1px solid #1e3a5f",
                paddingTop: 10,
                fontSize: 13,
                color: "#6b8ab0",
              }}
            >
              <span style={{ fontWeight: 700, marginRight: 10 }}>КЕЗЕК:</span>
              {ts.queue.slice(0, 3).map((m, i) => {
                const r = m.redAthlete;
                const b = m.blueAthlete;
                return (
                  <span key={m.id} style={{ marginRight: 16 }}>
                    {i + 1}. {r?.surname ?? "?"} — {b?.surname ?? "?"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
            color: "#4b6a8a",
          }}
        >
          <div style={{ fontSize: 48 }}>🥋</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {ts.queue.length > 0 ? "Күтілуде…" : "Матч жоқ"}
          </div>
          {ts.queue.length > 0 && (
            <div style={{ fontSize: 16, color: "#6b8ab0" }}>
              {ts.queue[0]?.redAthlete?.surname} — {ts.queue[0]?.blueAthlete?.surname}
            </div>
          )}
        </div>
      )}

      {/* Tatami selector links */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          padding: "8px 0 12px",
          borderTop: "1px solid #1e3a5f",
        }}
      >
        {Array.from({ length: tatamiCount }, (_, i) => i + 1).map((n) => (
          <a
            key={n}
            href={`/display/${ts.current?.tournamentId ?? ""}?tatami=${n}`}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              background: n === tatamiNumber ? "#D4AF37" : "#1e3a5f",
              color: n === tatamiNumber ? "#111" : "#6b8ab0",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {n}
          </a>
        ))}
        <a
          href={`/display/${ts.current?.tournamentId ?? ""}`}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            background: "#1e3a5f",
            color: "#6b8ab0",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Барлығы
        </a>
      </div>
    </div>
  );
}

// ─── Grid Card per tatami ─────────────────────────────────────────────────────

function TatamiCard({ ts, now }: { ts: TatamiState<MatchAny>; now: number }) {
  const match = ts.current;
  const score = match?.scoreSnapshot;
  const red = match?.redAthlete;
  const blue = match?.blueAthlete;
  const elapsedSec = computeElapsed(score?.clock, now);
  const isGS = score?.isGoldenScore;
  const pending = score?.pendingResult;

  return (
    <div
      style={{
        background: "#0a1628",
        border: `2px solid ${match?.status === "IN_PROGRESS" ? "#D4AF37" : "#1e3a5f"}`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 180,
      }}
    >
      {/* Tatami header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #1e3a5f",
          paddingBottom: 6,
        }}
      >
        <span style={{ color: "#D4AF37", fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>
          ТАТАМИ {ts.number}
        </span>
        {match?.status === "IN_PROGRESS" && (
          <span
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: score?.clock?.running ? "#fff" : "#fbbf24",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(elapsedSec)}
          </span>
        )}
        {isGS && (
          <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>GS</span>
        )}
      </div>

      {match && match.status !== "COMPLETED" ? (
        <>
          {/* Red side */}
          <ScoreRow
            label={red?.surname ?? "—"}
            score={score?.red}
            isWinner={pending?.winnerSide === "RED"}
            color="#e5e7eb"
            hasOsaekomi={score?.osaekomi?.side === "RED"}
          />
          {/* Blue side */}
          <ScoreRow
            label={blue?.surname ?? "—"}
            score={score?.blue}
            isWinner={pending?.winnerSide === "BLUE"}
            color="#60a5fa"
            hasOsaekomi={score?.osaekomi?.side === "BLUE"}
          />
          {ts.queue.length > 0 && (
            <div style={{ color: "#4b6a8a", fontSize: 11, marginTop: 2 }}>
              + {ts.queue.length} кезекте
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#2d4a6a",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {ts.queue.length > 0
            ? `${ts.queue[0]?.redAthlete?.surname ?? "?"} — ${ts.queue[0]?.blueAthlete?.surname ?? "?"}`
            : "Матч жоқ"}
        </div>
      )}
    </div>
  );
}

// ─── Large athlete panel (single tatami fullscreen) ───────────────────────────

function LargeAthletePanel({
  side,
  athlete,
  score,
  isWinner,
  isLoser,
  hasOsaekomi,
}: {
  side: "red" | "blue";
  athlete?: AthleteInfo | null;
  score?: SideScore;
  isWinner: boolean;
  isLoser: boolean;
  hasOsaekomi: boolean;
}) {
  const bg = side === "red" ? "#1a0000" : "#000e2e";
  const accent = side === "red" ? "#dc2626" : "#1e40af";

  return (
    <div
      style={{
        flex: 1,
        background: bg,
        border: `3px solid ${isWinner ? "#D4AF37" : isLoser ? "#374151" : accent}`,
        borderRadius: 8,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: isLoser ? 0.6 : 1,
      }}
    >
      {/* Name */}
      <div>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 1, lineHeight: 1.1 }}>
          {athlete?.surname ?? "—"}
        </div>
        <div style={{ fontSize: 16, color: "#9ca3af", fontWeight: 500 }}>
          {athlete?.name ?? ""}
        </div>
      </div>

      {/* Scores */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Array.from({ length: score?.ippon ?? 0 }).map((_, i) => (
          <ScoreBadge key={`ippon-${i}`} label="IPPON" color="#D4AF37" />
        ))}
        {Array.from({ length: score?.wazaari ?? 0 }).map((_, i) => (
          <ScoreBadge key={`wa-${i}`} label="W" color="#f59e0b" />
        ))}
        {Array.from({ length: score?.yuko ?? 0 }).map((_, i) => (
          <ScoreBadge key={`y-${i}`} label="Y" color="#6b7280" />
        ))}
        {Array.from({ length: score?.shido ?? 0 }).map((_, i) => (
          <ScoreBadge key={`sh-${i}`} label="C" color="#dc2626" />
        ))}
        {score?.hansoku && <ScoreBadge label="DQ" color="#111" bg="#dc2626" />}
      </div>

      {/* Osaekomi */}
      {hasOsaekomi && (
        <div
          style={{
            background: "#dc2626",
            color: "#fff",
            fontWeight: 900,
            fontSize: 13,
            padding: "3px 10px",
            borderRadius: 4,
            display: "inline-block",
            letterSpacing: 2,
          }}
        >
          OSAEKOMI
        </div>
      )}

      {/* Winner badge */}
      {isWinner && (
        <div
          style={{
            background: "#D4AF37",
            color: "#111",
            fontWeight: 900,
            fontSize: 20,
            padding: "4px 12px",
            borderRadius: 4,
            display: "inline-block",
            letterSpacing: 2,
          }}
        >
          ✓ ЖЕҢІМПАЗ
        </div>
      )}
    </div>
  );
}

// ─── Score row for grid view ──────────────────────────────────────────────────

function ScoreRow({
  label,
  score,
  isWinner,
  color,
  hasOsaekomi,
}: {
  label: string;
  score?: SideScore;
  isWinner: boolean;
  color: string;
  hasOsaekomi: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        borderLeft: `3px solid ${isWinner ? "#D4AF37" : color}`,
        paddingLeft: 8,
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: isWinner ? 900 : 600,
          color: isWinner ? "#D4AF37" : color,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {hasOsaekomi && (
          <span style={{ background: "#dc2626", color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 2, fontWeight: 700 }}>
            OSA
          </span>
        )}
        {(score?.ippon ?? 0) > 0 && (
          <span style={{ background: "#D4AF37", color: "#111", fontSize: 11, padding: "1px 6px", borderRadius: 2, fontWeight: 900 }}>
            IP
          </span>
        )}
        {Array.from({ length: score?.wazaari ?? 0 }).map((_, i) => (
          <span key={i} style={{ background: "#f59e0b", color: "#111", fontSize: 11, padding: "1px 6px", borderRadius: 2, fontWeight: 900 }}>
            W
          </span>
        ))}
        {Array.from({ length: score?.shido ?? 0 }).map((_, i) => (
          <span key={i} style={{ background: "#dc2626", color: "#fff", fontSize: 11, padding: "1px 6px", borderRadius: 2, fontWeight: 700 }}>
            C
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ScoreBadge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg?: string;
}) {
  return (
    <span
      style={{
        background: bg ?? color,
        color: bg ? color : "#111",
        fontWeight: 900,
        fontSize: 14,
        padding: "4px 10px",
        borderRadius: 4,
        letterSpacing: 1,
      }}
    >
      {label}
    </span>
  );
}

function LiveClock() {
  const [time, setTime] = useState("");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ color: "#6b8ab0", fontSize: 14, fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>
      {time}
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function computeElapsed(
  clock?: ScoreSnap["clock"],
  now?: number,
): number {
  if (!clock) return 0;
  const base = Math.max(0, Math.floor(clock.elapsedSec ?? 0));
  if (!clock.running || !clock.runningStartedAt || !now) return base;
  const startMs = new Date(clock.runningStartedAt).getTime();
  if (!Number.isFinite(startMs)) return base;
  return base + Math.max(0, Math.floor((now - startMs) / 1000));
}

function categoryLabel(cat: CategoryInfo): string {
  const gender = cat.gender === "MALE" ? "Ер" : "Әйел";
  const w = (cat.weightMax ?? 0) >= 200 ? `+${cat.weightMin}` : `-${cat.weightMax}`;
  return `${gender} ${w} кг`;
}
