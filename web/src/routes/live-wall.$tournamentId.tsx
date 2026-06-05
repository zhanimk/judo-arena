/**
 * Live Wall — IJF TV Scoreboard (Paris 2024 style).
 *
 *   /live-wall/:tournamentId           — все татами компактно (тёмная)
 *   /live-wall/:tournamentId?tatami=N  — IJF табло для TV через HDMI
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, mediaUrl } from "@/lib/api";
import { useRealtime } from "@/lib/socket";
import { buildTatamiState, hasPendingResult, type TatamiState } from "@/lib/tatami-state";

type Match = any;

export const Route = createFileRoute("/live-wall/$tournamentId")({
  head: () => ({ meta: [{ title: "Live Wall — Judo-Arena" }] }),
  validateSearch: (search: Record<string, unknown>): { tatami?: number } => {
    const tv = Number(search.tatami);
    return { tatami: Number.isFinite(tv) && tv > 0 ? tv : undefined };
  },
  component: LiveWall,
});

function LiveWall() {
  const { t } = useTranslation();
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
    "match:pendingResult": invalidate,
    "match:finished": invalidate,
    "match:osaekomiStart": invalidate,
    "match:osaekomiEnd": invalidate,
    "tatami:queueUpdate": invalidate,
    "bracket:update": invalidate,
  });

  const tournament = tournamentQuery.data;
  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const tatamiCount = Math.max(1, Number(tournament?.tatamiCount ?? 3));
  const allTatamis = useMemo(() => buildTatamiState(matches, tatamiCount), [matches, tatamiCount]);
  const tatamis = singleTatami ? allTatamis.filter((ts) => ts.number === singleTatami) : allTatamis;

  const goFull = () => {
    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  /* ════════════════════════════════════════════
     COMPLETED — Final results screen
     ════════════════════════════════════════════ */
  if (tournament?.status === "COMPLETED") {
    const bracketMap = new Map<
      string,
      { catLabel: string; gender: string; winner: any; second: any; bronze: any[] }
    >();
    for (const m of matches) {
      const catId = m.bracket?.categoryId ?? m.bracket?.category?.id;
      if (!catId) continue;
      const cat = m.bracket?.category;
      const gender = cat?.gender === "MALE" ? t("common.male") : t("tatami.female_short");
      const wMax = cat?.weightMax >= 200 ? `+${cat?.weightMin}` : `-${cat?.weightMax}`;
      const catLabel = `${gender} ${wMax} ${t("common.kg")}`;
      if (!bracketMap.has(catId))
        bracketMap.set(catId, {
          catLabel,
          gender: cat?.gender,
          winner: null,
          second: null,
          bronze: [],
        });
      const entry = bracketMap.get(catId)!;
      if (m.bracketSection === "final" && m.status === "COMPLETED" && m.winnerId) {
        entry.winner = m.winnerId === m.redAthlete?.id ? m.redAthlete : m.blueAthlete;
        entry.second = m.winnerId === m.redAthlete?.id ? m.blueAthlete : m.redAthlete;
      }
      if (
        (m.bracketSection === "bronze1" || m.bracketSection === "bronze2") &&
        m.status === "COMPLETED" &&
        m.winnerId
      ) {
        const b = m.winnerId === m.redAthlete?.id ? m.redAthlete : m.blueAthlete;
        if (b && !entry.bronze.find((x: any) => x?.id === b?.id)) entry.bronze.push(b);
      }
    }
    const categories = Array.from(bracketMap.values()).filter((c) => c.winner);
    const surnameOnly = (a: any) =>
      a ? `${a.surname ?? ""} ${(a.name ?? "")[0] ?? ""}.`.trim() : "—";
    const tName =
      typeof tournament.name === "object"
        ? ((tournament.name as any)?.kk ?? (tournament.name as any)?.ru ?? "")
        : (tournament.name ?? "");

    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "#0B1426",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          color: "#fff",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            borderBottom: "2px solid #D4AF37",
            padding: "20px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                color: "#D4AF37",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {t("live_wall.results_title")}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 1 }}>{tName}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                background: "#D4AF37",
                color: "#0B1426",
                borderRadius: 6,
                padding: "6px 18px",
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 3,
              }}
            >
              {t("status.COMPLETED")}
            </div>
            <button
              onClick={goFull}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 13,
                color: "#ccc",
                background: "none",
                cursor: "pointer",
              }}
            >
              ⛶ {t("live_wall.fullscreen")}
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "32px 40px",
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          }}
        >
          {categories.length === 0 ? (
            <div
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                color: "rgba(255,255,255,0.4)",
                paddingTop: 60,
                fontSize: 18,
              }}
            >
              {t("live_wall.no_results")}
            </div>
          ) : (
            categories.map((cat, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid rgba(212,175,55,0.3)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "rgba(212,175,55,0.12)",
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(212,175,55,0.2)",
                    color: "#D4AF37",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {cat.catLabel}
                </div>
                <div
                  style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {[
                    {
                      label: t("live_wall.place_1"),
                      athlete: cat.winner,
                      bg: "rgba(212,175,55,0.15)",
                      color: "#D4AF37",
                    },
                    {
                      label: t("live_wall.place_2"),
                      athlete: cat.second,
                      bg: "rgba(255,255,255,0.05)",
                      color: "#9CA3AF",
                    },
                    ...(cat.bronze ?? [])
                      .slice(0, 2)
                      .map((b: any) => ({
                        label: t("live_wall.place_3"),
                        athlete: b,
                        bg: "rgba(180,120,60,0.1)",
                        color: "#CD7F32",
                      })),
                  ].map((row, ri) =>
                    row.athlete ? (
                      <div
                        key={ri}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: row.bg,
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        <span
                          style={{ fontSize: 11, color: row.color, fontWeight: 700, minWidth: 54 }}
                        >
                          {row.label}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>
                          {surnameOnly(row.athlete)}
                        </span>
                        {row.athlete.club && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.4)",
                              marginLeft: "auto",
                            }}
                          >
                            {typeof row.athlete.club.name === "object"
                              ? ((row.athlete.club.name as any)?.kk ??
                                (row.athlete.club.name as any)?.ru)
                              : row.athlete.club.name}
                          </span>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════
     SINGLE TATAMI — IJF TV Scoreboard (light)
     ════════════════════════════════════════════ */
  if (singleTatami) {
    const tatami = tatamis[0];
    const current = tatami?.current;
    const queue = tatami?.queue ?? [];

    return (
      <main
        className="h-screen flex flex-col select-none overflow-hidden"
        style={{
          background: "#f0f2f5",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
        onDoubleClick={goFull}
      >
        {current ? (
          <IjfBoard match={current} queue={queue} tatamiNumber={singleTatami} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div style={{ fontSize: 80, fontWeight: 900, color: "#ccc", letterSpacing: 4 }}>
              TATAMI {singleTatami}
            </div>
            <div style={{ fontSize: 28, color: "#999", marginTop: 16 }}>
              {queue.length > 0
                ? `${t("live_wall.next")}: ${surnameShort(queue[0]?.redAthlete)} vs ${surnameShort(queue[0]?.blueAthlete)}`
                : t("live_wall.no_match")}
            </div>
            {queue.length > 0 && (
              <div style={{ fontSize: 20, color: "#bbb", marginTop: 8 }}>
                {weightCat(queue[0]?.bracket?.category, t)}
              </div>
            )}
          </div>
        )}
      </main>
    );
  }

  /* ════════════════════════════════════════════
     ALL TATAMI — dark compact overview
     ════════════════════════════════════════════ */
  return (
    <main
      className="min-h-screen bg-[#f0f2f5] text-[#111827]"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      <header className="flex items-center justify-between border-b border-[#d8dce3] bg-[#1a1a2e] px-8 py-4 text-white">
        <div className="flex min-w-0 items-center gap-4">
          <span className="truncate text-2xl font-black tracking-wide">
            {localizeName(tournament?.name, t)}
          </span>
          <span className="rounded bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-black">
            LIVE WALL
          </span>
        </div>
        <button
          onClick={goFull}
          className="flex items-center gap-2 rounded border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        >
          <Maximize2 className="h-4 w-4" /> {t("live_wall.fullscreen")}
        </button>
      </header>
      <section className="grid gap-5 p-5 xl:grid-cols-3">
        {tatamis.map((ts) => (
          <CompactTatami key={ts.number} tatami={ts} tournamentId={tournamentId} />
        ))}
      </section>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════
   IJF BOARD — Paris 2024 style, full-screen, light theme
   ═══════════════════════════════════════════════════════════ */

function IjfBoard({
  match,
  queue,
  tatamiNumber,
}: {
  match: Match;
  queue: Match[];
  tatamiNumber: number;
}) {
  const { t } = useTranslation();
  const whiteA = match.redAthlete;
  const blueA = match.blueAthlete;
  const whiteS = match.scoreSnapshot?.red ?? {};
  const blueS = match.scoreSnapshot?.blue ?? {};
  const isGS = match.scoreSnapshot?.isGoldenScore || match.isGoldenScore;
  const isFinished = match.status === "COMPLETED";
  const isLive = match.status === "IN_PROGRESS";
  const pendingResult = match.scoreSnapshot?.pendingResult;
  const winnerId = match.winnerId;
  const duration = match.bracket?.category?.matchDurationSec ?? 240;
  const osaekomi = match.scoreSnapshot?.osaekomi ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      {/* ─── Top info bar ─── */}
      <div
        style={{
          background: "#1a1a2e",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 40px",
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 800, letterSpacing: 3, fontSize: 26 }}>
          TATAMI {tatamiNumber}
        </span>
        <span style={{ color: "#ccc", fontSize: 22 }}>
          {weightCat(match.bracket?.category, t)}
          {" · "}
          {secLabel(match.bracketSection, t)} R{match.round}
        </span>
        {isGS && (
          <span
            style={{
              background: "#fbbf24",
              color: "#000",
              fontWeight: 900,
              padding: "6px 24px",
              borderRadius: 6,
              fontSize: 20,
              letterSpacing: 3,
            }}
          >
            GOLDEN SCORE
          </span>
        )}
      </div>

      {/* ─── Scoreboard body ─── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "16px 40px",
          gap: 0,
          minHeight: 0,
        }}
      >
        <AthleteRow
          side="white"
          athlete={whiteA}
          score={whiteS}
          isWinner={isFinished && winnerId === whiteA?.id}
          isLoser={isFinished && !!winnerId && winnerId !== whiteA?.id}
        />

        <TimerBar
          scoreSnapshot={match.scoreSnapshot}
          durationSec={duration}
          isRunning={isLive}
          isGoldenScore={!!isGS}
          isFinished={isFinished}
          osaekomi={osaekomi}
        />

        <AthleteRow
          side="blue"
          athlete={blueA}
          score={blueS}
          isWinner={isFinished && winnerId === blueA?.id}
          isLoser={isFinished && !!winnerId && winnerId !== blueA?.id}
        />
      </div>

      {/* ─── Pending result banner ─── */}
      {pendingResult && (
        <div
          style={{
            background: "#f59e0b",
            color: "#111",
            textAlign: "center",
            padding: "14px 0",
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: 3,
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {t("judge.confirm_btn")}:{" "}
          {pendingResult.winnerSide === "RED" ? surname(whiteA) : surname(blueA)}
        </div>
      )}

      {/* ─── Winner banner ─── */}
      {isFinished && winnerId && (
        <div
          style={{
            background: "#16a34a",
            color: "#fff",
            textAlign: "center",
            padding: "16px 0",
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          <Trophy
            style={{
              display: "inline",
              verticalAlign: "middle",
              width: 36,
              height: 36,
              marginRight: 16,
            }}
          />
          {t("common.winner")}: {winnerId === whiteA?.id ? surname(whiteA) : surname(blueA)}
        </div>
      )}

      {/* ─── Queue strip ─── */}
      {queue.length > 0 && (
        <div
          style={{
            background: "#e8eaed",
            borderTop: "2px solid #d0d3d8",
            padding: "10px 40px",
            display: "flex",
            alignItems: "center",
            gap: 32,
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#888",
              letterSpacing: 3,
              flexShrink: 0,
            }}
          >
            {t("tatami.queue")}
          </span>
          {queue.slice(0, 6).map((m: any, i: number) => (
            <span
              key={m.id}
              style={{
                fontSize: 18,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? "#1a1a2e" : "#666",
                flexShrink: 0,
                background: i === 0 ? "#fff" : "transparent",
                padding: i === 0 ? "6px 16px" : "6px 0",
                borderRadius: 8,
                border: i === 0 ? "2px solid #bbb" : "none",
              }}
            >
              {surname(m.redAthlete)} vs {surname(m.blueAthlete)}
              <span style={{ fontSize: 14, color: "#999", marginLeft: 8 }}>
                {wShort(m.bracket?.category, t)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Athlete Row (IJF style) ─── */

function AthleteRow({
  side,
  athlete,
  score,
  isWinner,
  isLoser,
}: {
  side: "white" | "blue";
  athlete: any;
  score: any;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const { t } = useTranslation();
  const isWhite = side === "white";
  const ippon = score?.ippon ?? 0;
  const wazaari = score?.wazaari ?? 0;
  const yuko = score?.yuko ?? 0;
  const shido = score?.shido ?? 0;
  const isHansoku = shido >= 3;

  const bg = isWhite ? "#ffffff" : "#1e40af";
  const textColor = isWhite ? "#111" : "#fff";
  const subColor = isWhite ? "#777" : "rgba(255,255,255,0.65)";
  const borderColor = isWhite ? "#c8ccd4" : "#1e3a8a";
  const sideBarBg = isWhite ? "#d1d5db" : "#2563eb";
  const labelText = isWhite ? t("judge.side_red") : t("judge.side_blue");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: isWinner ? (isWhite ? "#ecfdf5" : "#1e3a5f") : bg,
        borderRadius: 12,
        border: `4px solid ${isWinner ? "#22c55e" : borderColor}`,
        overflow: "hidden",
        opacity: isLoser ? 0.3 : 1,
        flex: 1,
        minHeight: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 80,
          background: sideBarBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: isWhite ? "#444" : "#fff",
            letterSpacing: 4,
          }}
        >
          {labelText}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "16px 32px",
          minWidth: 0,
        }}
      >
        <AthletePortrait athlete={athlete} size="large" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: textColor,
              textTransform: "uppercase",
              letterSpacing: 2,
              lineHeight: 1.05,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {athlete?.surname ?? "TBD"}
            <span style={{ fontWeight: 400, fontSize: 48, marginLeft: 16, opacity: 0.65 }}>
              {athlete?.name ?? ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>{athleteFlag(athlete)}</span>
            {athlete?.club && (
              <div
                style={{
                  fontSize: 22,
                  color: subColor,
                  letterSpacing: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {clubStr(athlete.club)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", flexShrink: 0 }}
      >
        <ScoreBox label="IPPON" value={ippon} active={ippon > 0} dark={!isWhite} />
        <ScoreBox label="WAZA-ARI" value={wazaari} active={wazaari > 0} dark={!isWhite} />
        <ScoreBox label="YUKO" value={yuko} active={yuko > 0} dark={!isWhite} isYuko />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          flexShrink: 0,
          borderLeft: `3px solid ${isWhite ? "#e5e7eb" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: subColor,
            letterSpacing: 3,
            marginBottom: 10,
          }}
        >
          SHIDO
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                width: 32,
                height: 46,
                borderRadius: 4,
                border: `3px solid ${shido >= n ? (n === 3 ? "#dc2626" : "#eab308") : isWhite ? "#d1d5db" : "rgba(255,255,255,0.2)"}`,
                background: shido >= n ? (n === 3 ? "#dc2626" : "#eab308") : "transparent",
              }}
            />
          ))}
        </div>
        {isHansoku && (
          <span
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: "#dc2626",
              marginTop: 6,
              letterSpacing: 2,
            }}
          >
            HANSOKU
          </span>
        )}
      </div>

      {isWinner && (
        <div style={{ display: "flex", alignItems: "center", padding: "0 20px", flexShrink: 0 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trophy style={{ width: 36, height: 36, color: "#fff" }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Score Box ─── */

function ScoreBox({
  label,
  value,
  active,
  dark,
  isYuko,
}: {
  label: string;
  value: number;
  active: boolean;
  dark: boolean;
  isYuko?: boolean;
}) {
  const bgActive = isYuko ? "#16a34a" : "#fbbf24";
  const bgInactive = dark ? "rgba(255,255,255,0.08)" : "#f3f4f6";
  const borderActive = isYuko ? "#15803d" : "#f59e0b";
  const borderInactive = dark ? "rgba(255,255,255,0.15)" : "#d1d5db";

  return (
    <div
      style={{
        width: 110,
        height: 120,
        borderRadius: 10,
        border: `3px solid ${active ? borderActive : borderInactive}`,
        background: active ? bgActive : bgInactive,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 2,
          color: active
            ? isYuko
              ? "#dcfce7"
              : "#92400e"
            : dark
              ? "rgba(255,255,255,0.4)"
              : "#999",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1,
          color: active ? (isYuko ? "#fff" : "#111") : dark ? "rgba(255,255,255,0.25)" : "#ccc",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─── Timer Bar ─── */

function TimerBar({
  scoreSnapshot,
  durationSec,
  isRunning,
  isGoldenScore,
  isFinished,
  osaekomi,
}: {
  scoreSnapshot?: any;
  durationSec: number;
  isRunning: boolean;
  isGoldenScore: boolean;
  isFinished: boolean;
  osaekomi: any;
}) {
  const [now, setNow] = useState(Date.now());
  const clock = scoreSnapshot?.clock;
  const isClockRunning = isRunning && Boolean(clock?.running);

  useEffect(() => {
    if (!isClockRunning) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [isClockRunning, clock?.runningStartedAt]);

  const elapsed = getClockElapsedSec(scoreSnapshot, now);
  let timerStr = isGoldenScore ? fmtTimer(elapsed) : fmtTimer(Math.max(0, durationSec - elapsed));
  let timerColor = "#111";
  let pulse = false;

  if (!isFinished) {
    if (isGoldenScore) {
      timerColor = "#d97706";
      pulse = isClockRunning;
    } else {
      const remaining = Math.max(0, durationSec - elapsed);
      if (remaining <= 30) {
        timerColor = "#dc2626";
        pulse = true;
      }
      if (remaining === 0 && isClockRunning) {
        timerColor = "#d97706";
      }
      if (!isClockRunning && isRunning) {
        timerColor = "#6b7280";
        pulse = false;
      }
    }
  }
  if (isFinished) {
    timerStr = "0:00";
    timerColor = "#999";
  }

  const hasOsae = osaekomi && osaekomi.side && osaekomi.startedAt;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        padding: "20px 0",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 130,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          color: timerColor,
          lineHeight: 1,
          animation: pulse ? "pulse 1s ease-in-out infinite" : "none",
          fontFamily: "'Inter', monospace",
          letterSpacing: 6,
        }}
      >
        {timerStr}
      </div>

      {hasOsae && <OsaekomiBar startedAt={osaekomi.startedAt} side={osaekomi.side} />}

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
    </div>
  );
}

function getClockElapsedSec(score: any, now = Date.now()): number {
  const clock = score?.clock;
  const base = Math.max(0, Number(clock?.elapsedSec ?? 0));
  if (!clock?.running || !clock.runningStartedAt) return base;
  const startedMs = new Date(clock.runningStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return base;
  return Math.max(0, base + Math.floor((now - startedMs) / 1000));
}

function boardClockText(match: Match): string {
  const score = match.scoreSnapshot;
  const duration = match.bracket?.category?.matchDurationSec ?? 240;
  const elapsed = getClockElapsedSec(score);
  return score?.isGoldenScore ? fmtTimer(elapsed) : fmtTimer(Math.max(0, duration - elapsed));
}

function OsaekomiBar({ startedAt, side }: { startedAt: string; side: string }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const s = new Date(startedAt).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - s) / 1000)), 200);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        background: "#fbbf24",
        borderRadius: 14,
        padding: "12px 32px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 6px 30px rgba(251,191,36,0.5)",
        animation: "pulse 1s ease-in-out infinite",
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 900, color: "#111", letterSpacing: 3 }}>
        OSAEKOMI {side === "RED" ? t("judge.side_red") : t("judge.side_blue")}
      </span>
      <span
        style={{ fontSize: 48, fontWeight: 900, color: "#111", fontVariantNumeric: "tabular-nums" }}
      >
        {elapsed}s
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Compact multi-tatami panel (dark, overview mode)
   ═══════════════════════════════════════════════════════════ */

function CompactTatami({
  tatami,
  tournamentId,
}: {
  tatami: TatamiState<Match>;
  tournamentId: string;
}) {
  const { t } = useTranslation();
  const c = tatami.current;
  const q = tatami.queue;
  const pending = hasPendingResult(c);
  const score = c?.scoreSnapshot;
  const clockText = c ? boardClockText(c) : "4:00";

  return (
    <section className="overflow-hidden rounded-xl border-4 border-[#c8ccd4] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b-2 border-[#d8dce3] bg-[#1a1a2e] px-5 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="text-4xl font-black tracking-wider text-amber-400">{tatami.number}</span>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            <div>TATAMI</div>
            <div>{t("live_wall.in_queue", { count: q.length })}</div>
          </div>
        </div>
        {c ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${pending ? "bg-amber-300" : "bg-red-400"} opacity-75`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${pending ? "bg-amber-300" : "bg-red-500"}`}
              />
            </span>
            <span
              className={`text-xs font-black uppercase tracking-[0.18em] ${pending ? "text-amber-300" : "text-red-400"}`}
            >
              {pending ? t("tatami.confirm_short") : "LIVE"}
            </span>
          </div>
        ) : (
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            {t("judge.waiting")}
          </span>
        )}
      </div>

      <div className="p-4">
        {c ? (
          <Link
            to="/live-wall/$tournamentId"
            params={{ tournamentId }}
            search={{ tatami: tatami.number }}
            className={`block overflow-hidden rounded-lg border-2 ${pending ? "border-amber-400" : "border-[#d1d5db]"} transition hover:border-amber-400`}
          >
            <CompactScoreRow side="white" athlete={c.redAthlete} score={score?.red} />
            <div className="flex items-center justify-between border-y-2 border-[#d8dce3] bg-[#f0f2f5] px-4 py-2">
              <span className="text-xs font-black uppercase tracking-[0.22em] text-[#6b7280]">
                {wShort(c.bracket?.category, t)}
              </span>
              <span
                className={`font-display text-4xl font-black tabular-nums ${pending ? "text-amber-500" : "text-[#6b7280]"}`}
              >
                {clockText}
              </span>
              {pending ? (
                <span className="rounded bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black">
                  {t("tatami.confirm_short")}
                </span>
              ) : c.scoreSnapshot?.isGoldenScore || c.isGoldenScore ? (
                <span className="rounded bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black">
                  GS
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                  {t("live_wall.scoreboard")}
                </span>
              )}
            </div>
            <CompactScoreRow side="blue" athlete={c.blueAthlete} score={score?.blue} />
          </Link>
        ) : (
          <div className="flex h-44 items-center justify-center rounded-lg border-2 border-dashed border-[#d1d5db] text-xl font-black uppercase tracking-[0.2em] text-[#c8ccd4]">
            {t("live_wall.no_match")}
          </div>
        )}

        {q.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {q.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  i === 0 ? "border border-amber-300 bg-amber-50 text-[#111827]" : "text-[#6b7280]"
                }`}
              >
                <span className="w-4 font-black text-amber-500">{i + 1}</span>
                <span className="truncate font-semibold">
                  {surname(m.redAthlete)} vs {surname(m.blueAthlete)}
                </span>
                <span className="ml-auto shrink-0 text-xs text-[#9ca3af]">
                  {wShort(m.bracket?.category, t)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CompactScoreRow({
  side,
  athlete,
  score,
}: {
  side: "white" | "blue";
  athlete: any;
  score: any;
}) {
  const { t } = useTranslation();
  const isWhite = side === "white";
  return (
    <div
      className={`flex items-center ${isWhite ? "bg-white text-[#111827]" : "bg-[#1e40af] text-white"}`}
    >
      <div
        className={`flex h-20 w-16 items-center justify-center text-lg font-black tracking-widest ${isWhite ? "bg-[#d1d5db] text-[#444]" : "bg-[#2563eb] text-white"}`}
      >
        {isWhite ? t("judge.side_red") : t("judge.side_blue")}
      </div>
      <div className="flex shrink-0 items-center pl-3">
        <AthletePortrait athlete={athlete} size="compact" />
      </div>
      <div className="min-w-0 flex-1 px-3">
        <div className="truncate text-2xl font-black uppercase">{surname(athlete)}</div>
        <div className={`text-sm font-bold ${isWhite ? "text-[#6b7280]" : "text-white/70"}`}>
          {athleteFlag(athlete)}
        </div>
      </div>
      <MiniScore label="I" value={score?.ippon ?? 0} dark={!isWhite} />
      <MiniScore label="W" value={score?.wazaari ?? 0} dark={!isWhite} />
      <MiniScore label="Y" value={score?.yuko ?? 0} dark={!isWhite} isYuko />
      <div className="flex w-24 justify-center gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-7 w-4 rounded-sm border-2 ${
              (score?.shido ?? 0) >= n
                ? n === 3
                  ? "border-red-500 bg-red-500"
                  : "border-amber-400 bg-amber-400"
                : isWhite
                  ? "border-[#d1d5db]"
                  : "border-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function MiniScore({
  label,
  value,
  dark,
  isYuko,
}: {
  label: string;
  value: number;
  dark: boolean;
  isYuko?: boolean;
}) {
  return (
    <div
      className={`mx-1 flex h-14 w-14 flex-col items-center justify-center rounded border-2 ${
        value > 0
          ? isYuko
            ? "border-green-600 bg-green-600 text-white"
            : "border-amber-400 bg-amber-300 text-black"
          : dark
            ? "border-white/20 bg-white/10 text-white/40"
            : "border-[#d1d5db] bg-[#f3f4f6] text-[#c7c7c7]"
      }`}
    >
      <span className="text-[9px] font-black tracking-widest">{label}</span>
      <span className="font-display text-2xl font-black leading-none">{value}</span>
    </div>
  );
}

function AthletePortrait({ athlete, size }: { athlete: any; size: "large" | "compact" }) {
  const src = athlete?.avatarUrl ? mediaUrl(athlete.avatarUrl) : "";
  const large = size === "large";
  return (
    <div
      style={{
        width: large ? 96 : 42,
        height: large ? 128 : 56,
        borderRadius: large ? 8 : 5,
        border: large ? "3px solid rgba(212,175,55,0.65)" : "2px solid rgba(212,175,55,0.55)",
        background: "#f8fafc",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        boxShadow: large ? "0 8px 22px rgba(0,0,0,0.18)" : "none",
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span
        style={{
          position: "absolute",
          right: 2,
          bottom: 1,
          fontSize: large ? 18 : 11,
          lineHeight: 1,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
        }}
      >
        {athleteFlag(athlete)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function surname(a: any): string {
  return a?.surname ?? "TBD";
}
function surnameShort(a: any): string {
  return a?.surname || a?.name || "TBD";
}

const COUNTRY_FLAGS: Record<string, string> = {
  KZ: "🇰🇿",
  KAZ: "🇰🇿",
  RU: "🇷🇺",
  US: "🇺🇸",
  USA: "🇺🇸",
  JP: "🇯🇵",
  FR: "🇫🇷",
  DE: "🇩🇪",
  IT: "🇮🇹",
  BR: "🇧🇷",
  ES: "🇪🇸",
  UA: "🇺🇦",
};

function athleteFlag(athlete: any): string {
  const code = String(athlete?.country ?? athlete?.club?.country ?? "KZ").toUpperCase();
  return COUNTRY_FLAGS[code] ?? COUNTRY_FLAGS.KZ;
}

function clubStr(club: any): string {
  if (!club) return "";
  if (club.shortName) return club.shortName;
  const n = club.name;
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk ?? n.ru ?? n.en ?? "";
}

function localizeName(v: any, t: any) {
  if (!v) return t("common.tournament");
  if (typeof v === "string") return v;
  return v.kk ?? v.ru ?? v.en ?? "";
}

function weightCat(c: any, t: any): string {
  if (!c) return "";
  const g = c.gender === "MALE" ? t("common.male") : t("tatami.female_short");
  return `${g} ${c.weightMin}-${c.weightMax} ${t("common.kg")}`;
}

function wShort(c: any, t: any): string {
  if (!c) return "";
  const g = c.gender === "MALE" ? t("common.male") : t("tatami.female_short");
  const w = c.weightMax >= 200 ? `+${c.weightMin}` : `-${c.weightMax}`;
  return `${g} ${w}${t("common.kg")}`;
}

function secLabel(s: string | null | undefined, t: any): string {
  const m: Record<string, string> = {
    main: t("live_wall.sec_main"),
    repechage: t("live_wall.sec_repechage"),
    bronze1: t("live_wall.sec_bronze"),
    bronze2: t("live_wall.sec_bronze"),
    final: t("bracket.final"),
  };
  return s ? (m[s] ?? s) : "";
}

function fmtTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
