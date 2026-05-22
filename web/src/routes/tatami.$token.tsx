/**
 * Судейская панель для целого татами — IJF TV-стиль.
 *
 * URL: /tatami/:token (без авторизации, по токену TatamiSession)
 * Визуал: IJF scoreboard. Очки начисляются нажатием прямо на ячейки карточки атлета.
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Loader2, Trophy } from "lucide-react";
import { useRealtime } from "@/lib/socket";

export const Route = createFileRoute("/tatami/$token")({
  head: () => ({ meta: [{ title: "Татами — Judo-Arena" }] }),
  component: TatamiJudgePanel,
});

function TatamiJudgePanel() {
  const { token } = useParams({ from: "/tatami/$token" });
  const qc = useQueryClient();
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tatamiQuery = useQuery({
    queryKey: ["tatami-session", token],
    queryFn: () => api.tatamiSession.get(token),
    refetchInterval: 3000,
    retry: false,
  });

  const session    = tatamiQuery.data?.session;
  const tournament = tatamiQuery.data?.tournament;
  const currentMatch = tatamiQuery.data?.currentMatch;
  const queue = tatamiQuery.data?.queue ?? [];
  const stats = tatamiQuery.data?.stats;

  useRealtime(
    tournament?.id ? [`tournament:${tournament.id}`] : [],
    {
      "match:scoreUpdate":   () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
      "match:pendingResult": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
      "match:finished":      () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
      "match:started":       () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
      "match:osaekomiStart": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
      "match:osaekomiEnd":   () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
      "tatami:queueUpdate":  () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    },
  );

  const [showResult, setShowResult] = useState(false);
  const [lastFinishedId, setLastFinishedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [osaeStartedLocal, setOsaeStartedLocal] = useState<number | null>(null);

  useEffect(() => {
    if (currentMatch?.status === "COMPLETED" && currentMatch.id !== lastFinishedId) {
      setShowResult(true);
      setLastFinishedId(currentMatch.id);
      const t = setTimeout(() => {
        setShowResult(false);
        qc.invalidateQueries({ queryKey: ["tatami-session", token] });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [currentMatch?.status, currentMatch?.id, lastFinishedId, qc, token]);

  useEffect(() => {
    const osa = currentMatch?.scoreSnapshot?.osaekomi;
    if (!osa && osaeStartedLocal !== null) setOsaeStartedLocal(null);
    else if (osa && osaeStartedLocal === null)
      setOsaeStartedLocal(new Date(osa.startedAt).getTime());
  }, [currentMatch?.scoreSnapshot?.osaekomi, osaeStartedLocal]);

  const refetch = useCallback(
    () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    [qc, token],
  );

  const matchId = currentMatch?.id;
  const onErr = (e: any) => setActionError(e instanceof ApiError ? e.message : "Қате");

  const startMatch    = useMutation({ mutationFn: () => api.matches.start(matchId!, undefined, token),     onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const pauseMatch    = useMutation({ mutationFn: () => api.matches.pause(matchId!, undefined, token),     onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const goldenScore   = useMutation({ mutationFn: () => api.matches.goldenScore(matchId!, undefined, token), onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const scoreAction   = useMutation({ mutationFn: (p: { type: string; side: "RED" | "BLUE" }) => api.matches.score(matchId!, p.type, p.side, undefined, token), onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const osaekomiAct   = useMutation({ mutationFn: (side: "RED" | "BLUE") => api.matches.osaekomi(matchId!, side, undefined, token), onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const toketaAct     = useMutation({ mutationFn: () => api.matches.toketa(matchId!, undefined, token),    onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const finishAction  = useMutation({ mutationFn: (p: { winnerSide: "RED" | "BLUE"; reason?: string }) => api.matches.finish(matchId!, p.winnerSide, p.reason, undefined, token), onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const confirmAction = useMutation({ mutationFn: () => api.matches.confirm(matchId!, undefined, token),   onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const cancelResult  = useMutation({ mutationFn: () => api.matches.cancelResult(matchId!, undefined, token), onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });
  const undoLast      = useMutation({ mutationFn: () => api.matches.undoLast(matchId!, undefined, token),     onMutate: () => setActionError(""), onSuccess: refetch, onError: onErr });

  /* ─── Loading ─── */
  if (tatamiQuery.isLoading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e" }}>
        <Loader2 style={{ width: 48, height: 48, color: "#fbbf24" }} className="animate-spin" />
      </div>
    );
  }

  /* ─── Error ─── */
  if (tatamiQuery.error) {
    const msg = tatamiQuery.error instanceof ApiError ? tatamiQuery.error.message : "Қате орын алды";
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e", padding: 24 }}>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 40, maxWidth: 400, textAlign: "center", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ color: "#ef4444", fontSize: 26, fontWeight: 900, marginBottom: 10 }}>Қол жетімсіз</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 15 }}>{msg}</div>
        </div>
      </div>
    );
  }

  /* ─── All done ─── */
  if (!currentMatch) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <Trophy style={{ width: 80, height: 80, color: "#fbbf24", margin: "0 auto 16px" }} />
          <div style={{ fontWeight: 900, fontSize: 36, color: "#fbbf24", letterSpacing: 4, textTransform: "uppercase" }}>Барлығы аяқталды!</div>
          <div style={{ color: "rgba(255,255,255,0.55)", marginTop: 10, fontSize: 16 }}>Татами #{session?.tatamiNumber}</div>
          {stats && <div style={{ marginTop: 12, color: "#fbbf24", opacity: 0.7 }}>{stats.completed} / {stats.total} матч</div>}
        </div>
      </div>
    );
  }

  /* ─── Computed ─── */
  const red  = currentMatch.redAthlete;
  const blue = currentMatch.blueAthlete;
  const score_  = currentMatch.scoreSnapshot ?? { red: {}, blue: {} };
  const redS  = score_.red  ?? {};
  const blueS = score_.blue ?? {};

  const isRunning      = currentMatch.status === "IN_PROGRESS";
  const isClockRunning = isRunning && Boolean(score_.clock?.running);
  const isPaused       = isRunning && !isClockRunning;
  const isFinished     = currentMatch.status === "COMPLETED";
  const isPending      = currentMatch.status === "PENDING";
  const winnerId       = currentMatch.winnerId;
  const pendingResult  = score_.pendingResult;
  const osaekomiSide   = score_.osaekomi?.side as "RED" | "BLUE" | undefined;

  const cat = currentMatch.bracket?.category;
  const matchDurationSec = cat?.matchDurationSec ?? 240;
  const weightLabel = cat ? `${cat.gender === "MALE" ? "Ер" : "Қыз"} ${cat.weightMin}-${cat.weightMax} кг` : "";
  const tName = tournament?.name?.kk ?? tournament?.name?.ru ?? "Жарыс";

  const canScore = isClockRunning && !pendingResult;
  const redIpponScored  = (redS.ippon  ?? 0) >= 1;
  const blueIpponScored = (blueS.ippon ?? 0) >= 1;

  /* ─── Render ─── */
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", background: "#f0f2f5",
    }}>

      {/* ══ HEADER ══ */}
      <div style={{
        background: "#1a1a2e", color: "#fff", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: compact ? "8px 14px" : "10px 28px", gap: 8,
      }}>
        <span style={{ fontWeight: 900, letterSpacing: 3, fontSize: compact ? 17 : 24, flexShrink: 0 }}>
          ТАТАМИ #{session?.tatamiNumber}
        </span>
        <span style={{ color: "#ccc", fontSize: compact ? 12 : 16, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tName}
        </span>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {stats && <div style={{ fontSize: compact ? 11 : 14, color: "#fbbf24" }}>{stats.completed}/{stats.total}</div>}
          {weightLabel && <div style={{ fontSize: compact ? 10 : 12, color: "#aaa" }}>{weightLabel}</div>}
        </div>
      </div>

      {/* ══ SCOREBOARD: АҚ card + Timer + КӨК card ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: compact ? "6px 8px" : "10px 14px" }}>

        {/* АҚ card */}
        <AthleteCard
          side="white" athlete={red} score={redS} compact={compact}
          isWinner={isFinished && winnerId === red?.id}
          isLoser={isFinished && !!winnerId && winnerId !== red?.id}
          canScore={canScore} ipponScored={redIpponScored}
          isOsaekomiActive={Boolean(score_.osaekomi) && osaekomiSide === "RED"}
          onIPPON={() => scoreAction.mutate({ type: "IPPON",    side: "RED" })}
          onWAZA={() =>  scoreAction.mutate({ type: "WAZA_ARI", side: "RED" })}
          onYUKO={() =>  scoreAction.mutate({ type: "YUKO",     side: "RED" })}
          onSHIDO={() => scoreAction.mutate({ type: "SHIDO",    side: "RED" })}
          onOsaekomi={() => osaekomiSide === "RED" && Boolean(score_.osaekomi) ? toketaAct.mutate() : osaekomiAct.mutate("RED")}
          canOsaekomi={(isClockRunning || (Boolean(score_.osaekomi) && osaekomiSide === "RED")) && !pendingResult}
        />

        {/* Timer */}
        <TimerBar
          scoreSnapshot={score_} durationSec={matchDurationSec}
          isRunning={isRunning} isGoldenScore={!!score_.isGoldenScore}
          isFinished={isFinished} osaekomi={score_.osaekomi ?? null} compact={compact}
        />

        {/* КӨК card */}
        <AthleteCard
          side="blue" athlete={blue} score={blueS} compact={compact}
          isWinner={isFinished && winnerId === blue?.id}
          isLoser={isFinished && !!winnerId && winnerId !== blue?.id}
          canScore={canScore} ipponScored={blueIpponScored}
          isOsaekomiActive={Boolean(score_.osaekomi) && osaekomiSide === "BLUE"}
          onIPPON={() => scoreAction.mutate({ type: "IPPON",    side: "BLUE" })}
          onWAZA={() =>  scoreAction.mutate({ type: "WAZA_ARI", side: "BLUE" })}
          onYUKO={() =>  scoreAction.mutate({ type: "YUKO",     side: "BLUE" })}
          onSHIDO={() => scoreAction.mutate({ type: "SHIDO",    side: "BLUE" })}
          onOsaekomi={() => osaekomiSide === "BLUE" && Boolean(score_.osaekomi) ? toketaAct.mutate() : osaekomiAct.mutate("BLUE")}
          canOsaekomi={(isClockRunning || (Boolean(score_.osaekomi) && osaekomiSide === "BLUE")) && !pendingResult}
        />
      </div>

      {/* ══ PENDING / WINNER BANNER ══ */}
      {pendingResult && (
        <div style={{ background: "#f59e0b", color: "#111", textAlign: "center", padding: compact ? "8px 0" : "12px 0", fontSize: compact ? 16 : 24, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", flexShrink: 0 }}>
          НӘТИЖЕНІ БЕКІТУ: {pendingResult.winnerSide === "RED" ? (red?.surname ?? "АҚ") : (blue?.surname ?? "КӨК")}
        </div>
      )}
      {isFinished && showResult && winnerId && (
        <div style={{ background: "#16a34a", color: "#fff", textAlign: "center", padding: compact ? "8px 0" : "12px 0", fontSize: compact ? 18 : 28, fontWeight: 900, letterSpacing: 3, flexShrink: 0 }}>
          <Trophy style={{ display: "inline", verticalAlign: "middle", width: 24, height: 24, marginRight: 10 }} />
          ЖЕҢІМПАЗ: {winnerId === red?.id ? (red?.surname ?? "АҚ") : (blue?.surname ?? "КӨК")}
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 400, marginTop: 3 }}>Келесі матч 3 секундтан кейін…</div>
        </div>
      )}

      {/* ══ QUEUE STRIP ══ */}
      {queue.length > 0 && (
        <div style={{ background: "#e8eaed", borderTop: "2px solid #d0d3d8", padding: compact ? "5px 10px" : "7px 20px", display: "flex", alignItems: "center", gap: compact ? 10 : 20, overflowX: "auto", flexShrink: 0 }}>
          <span style={{ fontSize: compact ? 11 : 13, fontWeight: 900, color: "#888", letterSpacing: 3, flexShrink: 0 }}>КЕЗЕК</span>
          {queue.slice(0, 6).map((m: any, i: number) => (
            <span key={m.id} style={{
              fontSize: compact ? 13 : 15, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#1a1a2e" : "#666",
              flexShrink: 0, background: i === 0 ? "#fff" : "transparent",
              padding: i === 0 ? "3px 10px" : "3px 0", borderRadius: 6, border: i === 0 ? "2px solid #bbb" : "none",
            }}>
              {m.redAthlete?.surname ?? "?"} vs {m.blueAthlete?.surname ?? "?"}
              {m.bracket?.category && <span style={{ fontSize: 11, color: "#999", marginLeft: 5 }}>{m.bracket.category.weightMin}-{m.bracket.category.weightMax}кг</span>}
            </span>
          ))}
        </div>
      )}

      {/* ══ ERROR ══ */}
      {actionError && (
        <div style={{ background: "#fef2f2", borderTop: "2px solid #fca5a5", color: "#dc2626", padding: "6px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {actionError}
        </div>
      )}

      {/* ══ CONTROL PANEL — только управление матчем ══ */}
      <div style={{ background: "#fff", borderTop: "2px solid #e5e7eb", padding: compact ? "8px 10px" : "10px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: compact ? 5 : 8, justifyContent: "center", flexWrap: "wrap" }}>

          {!pendingResult && (isPending || isPaused) && (
            <Btn label="▶ ХАДЖИМЕ" bg="#fbbf24" fg="#111" bold
              onClick={() => startMatch.mutate()} disabled={startMatch.isPending} compact={compact} />
          )}
          {!pendingResult && isClockRunning && (
            <Btn label="❚❚ МАТЕ" bg="#1a1a2e" fg="#fff"
              onClick={() => pauseMatch.mutate()} disabled={pauseMatch.isPending} compact={compact} />
          )}
          {isRunning && !pendingResult && !score_.isGoldenScore && (
            <Btn label="GOLDEN SCORE" bg="#f59e0b" fg="#111"
              onClick={() => goldenScore.mutate()} disabled={goldenScore.isPending} compact={compact} />
          )}
          {isRunning && !pendingResult && (
            <>
              <Btn label="АҚ ЖЕҢДІ" bg="#e5e7eb" fg="#111"
                onClick={() => finishAction.mutate({ winnerSide: "RED", reason: "Судья шешімі" })}
                disabled={finishAction.isPending} compact={compact} />
              <Btn label="КӨК ЖЕҢДІ" bg="#1e40af" fg="#fff"
                onClick={() => finishAction.mutate({ winnerSide: "BLUE", reason: "Судья шешімі" })}
                disabled={finishAction.isPending} compact={compact} />
            </>
          )}
          {isRunning && !pendingResult && (
            <Btn label="↩ БОЛДЫРУ" bg="#6b7280" fg="#fff"
              onClick={() => undoLast.mutate()} disabled={undoLast.isPending} compact={compact} />
          )}
          {pendingResult && (
            <>
              <Btn label="✓ БЕКІТУ" bg="#16a34a" fg="#fff" bold
                onClick={() => confirmAction.mutate()} disabled={confirmAction.isPending || cancelResult.isPending} compact={compact} />
              <Btn label="✗ БОЛДЫРМАУ" bg="#dc2626" fg="#fff" bold
                onClick={() => cancelResult.mutate()} disabled={cancelResult.isPending || confirmAction.isPending} compact={compact} />
            </>
          )}
          {isFinished && !showResult && (
            <Btn label="КЕЛЕСІ МАТЧ →" bg="#fbbf24" fg="#111" bold
              onClick={refetch} compact={compact} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   AthleteCard — интерактивная карточка с нажимаемыми ячейками очков
   ══════════════════════════════════════════════════════════════════ */

function AthleteCard({ side, athlete, score, isWinner, isLoser, compact,
  canScore, ipponScored, isOsaekomiActive, onIPPON, onWAZA, onYUKO, onSHIDO, onOsaekomi, canOsaekomi,
}: {
  side: "white" | "blue"; athlete: any; score: any;
  isWinner: boolean; isLoser: boolean; compact: boolean;
  canScore: boolean; ipponScored: boolean; isOsaekomiActive: boolean;
  onIPPON: () => void; onWAZA: () => void; onYUKO: () => void; onSHIDO: () => void;
  onOsaekomi: () => void; canOsaekomi: boolean;
}) {
  const isWhite  = side === "white";
  const ippon    = score?.ippon   ?? 0;
  const wazaari  = score?.wazaari ?? 0;
  const yuko     = score?.yuko    ?? 0;
  const shido    = score?.shido   ?? 0;

  const bg          = isWhite ? "#ffffff"           : "#1e40af";
  const textColor   = isWhite ? "#111"              : "#fff";
  const subColor    = isWhite ? "#666"              : "rgba(255,255,255,0.65)";
  const borderColor = isWhite ? "#c8ccd4"           : "#1e3a8a";
  const sideBarBg   = isWhite ? "#d1d5db"           : "#2563eb";

  const nameFZ  = compact ? 22 : 52;
  const firstFZ = compact ? 14 : 34;
  const cardHeight = compact ? 132 : undefined;

  const osaeLabel = isOsaekomiActive ? "TOKETA" : "OSAEKOMI";
  const osaeStyle: React.CSSProperties = isOsaekomiActive
    ? { background: "#fbbf24", color: "#111", animation: "judgeTimerPulse 1s ease-in-out infinite" }
    : { background: isWhite ? "#f3f4f6" : "rgba(255,255,255,0.12)", color: isWhite ? "#555" : "rgba(255,255,255,0.7)" };

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: isWinner ? (isWhite ? "#ecfdf5" : "#1e3a5f") : bg,
      borderRadius: 10, border: `3px solid ${isWinner ? "#22c55e" : borderColor}`,
      overflow: "hidden", opacity: isLoser ? 0.35 : 1,
      flex: compact ? "none" : 1,
      height: cardHeight, minHeight: compact ? undefined : 0,
      margin: compact ? "3px 0" : "5px 0",
    }}>

      {/* Side bar */}
      <div style={{ width: compact ? 38 : 68, background: sideBarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: compact ? 12 : 20, fontWeight: 900, color: isWhite ? "#444" : "#fff", letterSpacing: 2, writingMode: "vertical-rl", textOrientation: "mixed" }}>
          {isWhite ? "АҚ" : "КӨК"}
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top: name + tappable score cells */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: compact ? "6px 8px" : "10px 16px", gap: compact ? 6 : 10 }}>

          {/* Name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: nameFZ, fontWeight: 900, color: textColor, textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {athlete?.surname ?? "TBD"}
              {athlete?.name && <span style={{ fontWeight: 400, fontSize: firstFZ, marginLeft: 8, opacity: 0.6 }}>{athlete.name}</span>}
            </div>
            {athlete?.club && <div style={{ fontSize: compact ? 11 : 16, color: subColor, marginTop: 2 }}>{clubStr(athlete.club)}</div>}
          </div>

          {/* Score cells — tappable */}
          <div style={{ display: "flex", gap: compact ? 4 : 8, flexShrink: 0 }}>
            <TapCell label="IPPON"    value={ippon}   active={ippon > 0}   dark={!isWhite} compact={compact} onClick={onIPPON}  disabled={!canScore || ipponScored} />
            <TapCell label="WAZA-ARI" value={wazaari} active={wazaari > 0} dark={!isWhite} compact={compact} onClick={onWAZA}   disabled={!canScore || ipponScored} />
            <TapCell label="YUKO"     value={yuko}    active={yuko > 0}    dark={!isWhite} compact={compact} onClick={onYUKO}   disabled={!canScore} />
            <TapCell label="SHIDO"    value={shido}   active={shido > 0}   dark={!isWhite} compact={compact} onClick={onSHIDO}  disabled={!canScore} isShido />
          </div>

          {/* Winner icon */}
          {isWinner && (
            <div style={{ width: compact ? 34 : 50, height: compact ? 34 : 50, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Trophy style={{ width: compact ? 18 : 28, height: compact ? 18 : 28, color: "#fff" }} />
            </div>
          )}
        </div>

        {/* OSAEKOMI strip — full width */}
        <button
          onClick={onOsaekomi}
          disabled={!canOsaekomi}
          style={{
            ...osaeStyle,
            border: "none", width: "100%",
            padding: compact ? "6px 0" : "9px 0",
            fontSize: compact ? 11 : 14,
            fontWeight: 900, letterSpacing: 3,
            cursor: canOsaekomi ? "pointer" : "not-allowed",
            opacity: canOsaekomi ? 1 : 0.4,
            fontFamily: "inherit",
            borderTop: `1px solid ${isWhite ? "#e5e7eb" : "rgba(255,255,255,0.12)"}`,
          }}
        >
          {osaeLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── TapCell — нажимаемая ячейка очка ─── */
function TapCell({ label, value, active, dark, compact, onClick, disabled, isShido }: {
  label: string; value: number; active: boolean; dark: boolean;
  compact: boolean; onClick: () => void; disabled: boolean; isShido?: boolean;
}) {
  const w = compact ? 52 : 90;
  const h = compact ? 56 : 90;

  const activeBg     = isShido ? "#dc2626" : "#fbbf24";
  const activeBorder = isShido ? "#b91c1c" : "#f59e0b";
  const activeText   = isShido ? "#fff"    : "#111";
  const inactiveBg   = dark ? "rgba(255,255,255,0.1)" : "#f3f4f6";
  const inactiveBdr  = dark ? "rgba(255,255,255,0.2)" : "#d1d5db";
  const inactiveTxt  = dark ? "rgba(255,255,255,0.3)" : "#ccc";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: w, height: h, borderRadius: 8, border: `2px solid ${active ? activeBorder : inactiveBdr}`,
        background: active ? activeBg : inactiveBg,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        fontFamily: "inherit",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        transition: "transform 0.08s",
      }}
      onPointerDown={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = "scale(0.93)"; }}
      onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
    >
      <span style={{ fontSize: compact ? 8 : 10, fontWeight: 800, letterSpacing: 1, color: active ? activeText : (dark ? "rgba(255,255,255,0.45)" : "#aaa") }}>
        {label}
      </span>
      <span style={{ fontSize: compact ? 28 : 48, fontWeight: 900, lineHeight: 1, color: active ? activeText : inactiveTxt }}>
        {value}
      </span>
    </button>
  );
}

/* ─── TimerBar ─── */
function TimerBar({ scoreSnapshot, durationSec, isRunning, isGoldenScore, isFinished, osaekomi, compact }: {
  scoreSnapshot?: any; durationSec: number; isRunning: boolean;
  isGoldenScore: boolean; isFinished: boolean; osaekomi: any; compact: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const clock = scoreSnapshot?.clock;
  const isClockRunning = isRunning && Boolean(clock?.running);

  useEffect(() => {
    if (!isClockRunning) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [isClockRunning, clock?.runningStartedAt]);

  const elapsed = clockElapsedSec(scoreSnapshot, now);
  let timerStr = isGoldenScore ? fmtTimer(elapsed) : fmtTimer(Math.max(0, durationSec - elapsed));
  let timerColor = "#6b7280";
  let pulse = false;

  if (!isFinished) {
    if (isGoldenScore) { timerColor = "#d97706"; pulse = isClockRunning; }
    else {
      const rem = Math.max(0, durationSec - elapsed);
      if (isClockRunning) timerColor = rem <= 30 ? "#dc2626" : "#111827";
      if (rem <= 30) pulse = true;
    }
  }
  if (isFinished) { timerStr = "0:00"; timerColor = "#9ca3af"; }

  const hasOsae = osaekomi?.side && osaekomi?.startedAt;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: compact ? "2px 0" : "6px 0", background: "#f0f2f5", flexShrink: 0 }}>
      <div style={{ fontSize: compact ? 60 : 110, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: timerColor, lineHeight: 1, letterSpacing: 4, animation: pulse ? "judgeTimerPulse 1s ease-in-out infinite" : "none" }}>
        {timerStr}
      </div>
      {isGoldenScore && (
        <span style={{ position: "absolute", top: compact ? 2 : 4, right: compact ? 8 : 16, background: "#fbbf24", color: "#000", fontWeight: 900, padding: "2px 10px", borderRadius: 4, fontSize: compact ? 10 : 13, letterSpacing: 2 }}>
          GOLDEN SCORE
        </span>
      )}
      {hasOsae && <OsaekomiBar startedAt={osaekomi.startedAt} side={osaekomi.side} compact={compact} />}
      <style>{`@keyframes judgeTimerPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }`}</style>
    </div>
  );
}

function OsaekomiBar({ startedAt, side, compact }: { startedAt: string; side: string; compact: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const s = new Date(startedAt).getTime();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - s) / 1000)), 200);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <div style={{ position: "absolute", left: compact ? 8 : 16, background: "#fbbf24", borderRadius: 8, padding: compact ? "4px 12px" : "6px 20px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(251,191,36,0.5)", animation: "judgeTimerPulse 1s ease-in-out infinite" }}>
      <span style={{ fontSize: compact ? 11 : 14, fontWeight: 900, color: "#111", letterSpacing: 2 }}>OSAEKOMI {side === "RED" ? "АҚ" : "КӨК"}</span>
      <span style={{ fontSize: compact ? 24 : 36, fontWeight: 900, color: "#111", fontVariantNumeric: "tabular-nums" }}>{elapsed}s</span>
    </div>
  );
}

/* ─── Btn ─── */
function Btn({ label, bg, fg, onClick, disabled, compact, bold, wide }: {
  label: string; bg: string; fg: string; onClick: () => void;
  disabled?: boolean; compact: boolean; bold?: boolean; wide?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: bg, color: fg, border: "none", borderRadius: 7,
      padding: compact ? "8px 14px" : "10px 20px",
      fontSize: compact ? 13 : 15, fontWeight: bold ? 900 : 700,
      letterSpacing: 1.5, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, fontFamily: "inherit",
      minWidth: wide ? 190 : undefined,
    }}>
      {label}
    </button>
  );
}

/* ─── Helpers ─── */
function clockElapsedSec(score: any, now = Date.now()): number {
  const clock = score?.clock;
  const base = Math.max(0, Number(clock?.elapsedSec ?? 0));
  if (!clock?.running || !clock.runningStartedAt) return base;
  const startedMs = new Date(clock.runningStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return base;
  return Math.max(0, base + Math.floor((now - startedMs) / 1000));
}

function fmtTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function clubStr(club: any): string {
  if (!club) return "";
  if (club.shortName) return club.shortName;
  const n = club.name;
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk ?? n.ru ?? n.en ?? "";
}
