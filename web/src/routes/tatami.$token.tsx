/**
 * Судейская панель для целого татами — IJF TV-стиль.
 *
 * URL: /tatami/:token (без авторизации, по токену TatamiSession)
 * Визуал: IJF scoreboard. Очки начисляются нажатием прямо на ячейки карточки атлета.
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "@/lib/api";
import { Loader2, Trophy, WifiOff } from "lucide-react";
import { useRealtime } from "@/lib/socket";
import { HoldButton } from "@/components/judo/HoldButton";
import { useTatamiOfflineQueue } from "@/lib/tatami-offline-queue";

/* ─── Offline hook ─── */
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export const Route = createFileRoute("/tatami/$token")({
  head: () => ({ meta: [{ title: "Татами — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  component: TatamiJudgePanel,
});

function TatamiJudgePanel() {
  const { t } = useTranslation();
  const { token } = useParams({ from: "/tatami/$token" });
  const qc = useQueryClient();
  const [compact, setCompact] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const isOnline = useOnlineStatus();
  const [actionError, setActionError] = useState("");

  // ── Offline queue: сохраняем действия судьи при потере сети ──────────────
  const {
    enqueue: enqueueOffline,
    pendingCount: offlinePending,
    isFlushing: offlineFlushing,
  } = useTatamiOfflineQueue(token, isOnline, (msg) => setActionError(msg));

  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tatamiQuery = useQuery({
    queryKey: ["tatami-session", token],
    queryFn: () => api.tatamiSession.get(token),
    // Socket.IO handles real-time updates; 10 s poll is just a safety net
    refetchInterval: 10_000,
    retry: false,
  });

  const session = tatamiQuery.data?.session;
  const tournament = tatamiQuery.data?.tournament;
  const currentMatch = tatamiQuery.data?.currentMatch;
  const queue = tatamiQuery.data?.queue ?? [];
  const stats = tatamiQuery.data?.stats;

  useRealtime(tournament?.id ? [`tournament:${tournament.id}`] : [], {
    "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "match:pendingResult": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "match:finished": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "match:started": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "match:osaekomiStart": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "match:osaekomiEnd": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "tatami:queueUpdate": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
    "bracket:update": () => qc.invalidateQueries({ queryKey: ["tatami-session", token] }),
  });

  const [showResult, setShowResult] = useState(false);
  const [lastFinishedId, setLastFinishedId] = useState<string | null>(null);
  const [forfeitConfirm, setForfeitConfirm] = useState<"RED" | "BLUE" | null>(null);
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

  // ── Sliding expiry: продлеваем сессию каждые 30 минут пока вкладка открыта ──
  useEffect(() => {
    // Немедленный первый heartbeat + каждые 30 минут
    const doHeartbeat = () => {
      api.tatamiSession.heartbeat(token).catch(() => {
        // Молчим — сессия могла быть отозвана, getValidTatamiSession это обнаружит
      });
    };
    doHeartbeat();
    const id = setInterval(doHeartbeat, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [token]);

  const matchId = currentMatch?.id;
  const matchVersion = currentMatch?.version;
  const onErr = (e: unknown) =>
    setActionError(e instanceof ApiError ? e.message : t("error.generic"));

  // ── Мутации с offline-поддержкой ─────────────────────────────────────────
  // Счёт, осаекоми и токета оборачиваются в offline queue — самые критичные.
  // Управление матчем (start/pause/finish) тоже в очереди.
  // confirm/cancel/undo — только онлайн (необратимые действия).
  const startMatch = useMutation({
    mutationFn: () => enqueueOffline("start", () => api.matches.start(matchId!, undefined, token)),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const pauseMatch = useMutation({
    mutationFn: () => enqueueOffline("pause", () => api.matches.pause(matchId!, undefined, token)),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const goldenScore = useMutation({
    mutationFn: () =>
      enqueueOffline("golden", () => api.matches.goldenScore(matchId!, undefined, token)),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const scoreAction = useMutation({
    mutationFn: (p: { type: string; side: "RED" | "BLUE" }) =>
      enqueueOffline(`score_${p.type}_${p.side}`, () =>
        api.matches.score(matchId!, p.type, p.side, undefined, token, matchVersion),
      ),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const osaekomiAct = useMutation({
    mutationFn: (side: "RED" | "BLUE") =>
      enqueueOffline(`osaekomi_${side}`, () =>
        api.matches.osaekomi(matchId!, side, undefined, token, matchVersion),
      ),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const toketaAct = useMutation({
    mutationFn: () =>
      enqueueOffline("toketa", () => api.matches.toketa(matchId!, undefined, token, matchVersion)),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const finishAction = useMutation({
    mutationFn: (p: { winnerSide: "RED" | "BLUE"; reason?: string }) =>
      enqueueOffline(`finish_${p.winnerSide}`, () =>
        api.matches.finish(matchId!, p.winnerSide, p.reason, undefined, token, matchVersion),
      ),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const confirmAction = useMutation({
    mutationFn: () => api.matches.confirm(matchId!, undefined, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const cancelResult = useMutation({
    mutationFn: () => api.matches.cancelResult(matchId!, undefined, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const undoLast = useMutation({
    mutationFn: () => api.matches.undoLast(matchId!, undefined, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: onErr,
  });
  const forfeitAction = useMutation({
    mutationFn: (side: "RED" | "BLUE") =>
      api.matches.forfeit(matchId!, side, "NO_SHOW", undefined, token),
    onMutate: () => {
      setActionError("");
      setForfeitConfirm(null);
    },
    onSuccess: refetch,
    onError: onErr,
  });

  /* ─── Keyboard shortcuts ─── */
  // Keep latest refs so handler always has current state without re-registering
  const actionsRef = useRef({
    canScore: false,
    canOsaekomiRed: false,
    canOsaekomiBlue: false,
    isPending: false,
    isPaused: false,
    isClockRunning: false,
    isFinished: false,
    pendingResult: null as any,
    osaekomiSide: undefined as "RED" | "BLUE" | undefined,
    hasOsaekomi: false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const {
        canScore,
        isPending,
        isPaused,
        isClockRunning,
        isFinished,
        pendingResult,
        osaekomiSide,
        hasOsaekomi,
      } = actionsRef.current;

      switch (e.key.toLowerCase()) {
        // ── WHITE / RED side ──────────────────────────────
        case "q":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "IPPON", side: "RED" });
          }
          break;
        case "w":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "WAZA_ARI", side: "RED" });
          }
          break;
        case "e":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "YUKO", side: "RED" });
          }
          break;
        case "r":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "SHIDO", side: "RED" });
          }
          break;
        case "t": {
          e.preventDefault();
          if (hasOsaekomi && osaekomiSide === "RED") toketaAct.mutate();
          else if (isClockRunning && !pendingResult) osaekomiAct.mutate("RED");
          break;
        }
        // ── BLUE / КӨК side ──────────────────────────────
        case "a":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "IPPON", side: "BLUE" });
          }
          break;
        case "s":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "WAZA_ARI", side: "BLUE" });
          }
          break;
        case "d":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "YUKO", side: "BLUE" });
          }
          break;
        case "f":
          if (canScore) {
            e.preventDefault();
            scoreAction.mutate({ type: "SHIDO", side: "BLUE" });
          }
          break;
        case "g": {
          e.preventDefault();
          if (hasOsaekomi && osaekomiSide === "BLUE") toketaAct.mutate();
          else if (isClockRunning && !pendingResult) osaekomiAct.mutate("BLUE");
          break;
        }
        // ── Match control ─────────────────────────────────
        case " ": {
          e.preventDefault();
          if (!pendingResult && (isPending || isPaused)) startMatch.mutate();
          else if (!pendingResult && isClockRunning) pauseMatch.mutate();
          break;
        }
        case "enter": {
          e.preventDefault();
          if (pendingResult) confirmAction.mutate();
          break;
        }
        case "escape": {
          e.preventDefault();
          if (pendingResult) cancelResult.mutate();
          break;
        }
        case "z": {
          e.preventDefault();
          if (!isFinished) undoLast.mutate();
          break;
        }
        case "?":
        case "h": {
          e.preventDefault();
          setShowHotkeys((v) => !v);
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // register once — reads from ref

  /* ─── Loading ─── */
  if (tatamiQuery.isLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
        }}
      >
        <Loader2 style={{ width: 48, height: 48, color: "#fbbf24" }} className="animate-spin" />
      </div>
    );
  }

  /* ─── Error ─── */
  if (tatamiQuery.error) {
    const msg =
      tatamiQuery.error instanceof ApiError ? tatamiQuery.error.message : t("error.generic");
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 40,
            maxWidth: 400,
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ color: "#ef4444", fontSize: 26, fontWeight: 900, marginBottom: 10 }}>
            {t("judge.unavailable")}
          </div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 15 }}>{msg}</div>
        </div>
      </div>
    );
  }

  /* ─── All done ─── */
  if (!currentMatch) {
    const isTournamentCompleted = tournament?.status === "COMPLETED";
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Trophy style={{ width: 96, height: 96, color: "#fbbf24", margin: "0 auto 20px" }} />
          {isTournamentCompleted ? (
            <>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 42,
                  color: "#fbbf24",
                  letterSpacing: 4,
                  textTransform: "uppercase",
                }}
              >
                {t("tatami.tournament_completed")} 🏆
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 12, fontSize: 18 }}>
                {typeof tournament?.name === "object"
                  ? ((tournament.name as any)?.kk ?? (tournament.name as any)?.ru ?? "")
                  : (tournament?.name ?? "")}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, fontSize: 14 }}>
                {t("tatami.all_matches_done")}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 36,
                  color: "#fbbf24",
                  letterSpacing: 4,
                  textTransform: "uppercase",
                }}
              >
                {t("tatami.all_done")}
              </div>
              <div style={{ color: "rgba(255,255,255,0.55)", marginTop: 10, fontSize: 16 }}>
                {t("common.tatami")} #{session?.tatamiNumber}
              </div>
              {stats && (
                <div style={{ marginTop: 12, color: "#fbbf24", opacity: 0.7 }}>
                  {stats.completed} / {stats.total} {t("tatami.match_word")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ─── Computed ─── */
  const red = currentMatch.redAthlete;
  const blue = currentMatch.blueAthlete;
  const score_ = (currentMatch.scoreSnapshot ?? {
    red: {},
    blue: {},
  }) as import("@/lib/api-types").MatchScoreSnapshot;
  const redS = score_.red ?? {};
  const blueS = score_.blue ?? {};

  const isRunning = currentMatch.status === "IN_PROGRESS";
  const isClockRunning = isRunning && Boolean(score_.clock?.running);
  const isPaused = isRunning && !isClockRunning;
  const isFinished = currentMatch.status === "COMPLETED";
  const isPending = currentMatch.status === "PENDING";
  const winnerId = currentMatch.winnerId;
  const pendingResult = score_.pendingResult;
  const osaekomiSide = score_.osaekomi?.side as "RED" | "BLUE" | undefined;

  const cat = currentMatch.bracket?.category;
  const matchDurationSec = cat?.matchDurationSec ?? 240;
  const weightLabel = cat
    ? `${cat.gender === "MALE" ? t("common.male") : t("tatami.female_short")} ${cat.weightMin}-${cat.weightMax} ${t("common.kg")}`
    : "";
  const tName =
    (typeof tournament?.name === "object" && tournament?.name !== null
      ? (tournament.name.kk ?? tournament.name.ru)
      : (tournament?.name as string | undefined)) ?? "Жарыс";
  const allowYuko = Boolean(cat?.allowYuko);

  const canScore = isRunning && !pendingResult && !scoreAction.isPending;
  const redIpponScored = (redS.ippon ?? 0) >= 1;
  const blueIpponScored = (blueS.ippon ?? 0) >= 1;

  const toggleTimer = () => {
    if (pendingResult || isFinished) return;
    if (isPending || isPaused) {
      if (!startMatch.isPending) startMatch.mutate();
    } else if (isClockRunning) {
      if (!pauseMatch.isPending) pauseMatch.mutate();
    }
  };

  // Sync ref for keyboard handler
  actionsRef.current = {
    canScore,
    isPending,
    isPaused,
    isClockRunning,
    isFinished,
    pendingResult,
    osaekomiSide,
    hasOsaekomi: Boolean(score_.osaekomi),
    canOsaekomiRed:
      (isClockRunning || (Boolean(score_.osaekomi) && osaekomiSide === "RED")) && !pendingResult,
    canOsaekomiBlue:
      (isClockRunning || (Boolean(score_.osaekomi) && osaekomiSide === "BLUE")) && !pendingResult,
  };

  /* ─── Render ─── */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        background: "#f0f2f5",
      }}
    >
      {/* ══ OFFLINE BANNER ══ */}
      {!isOnline && (
        <div
          style={{
            background: "#dc2626",
            color: "#fff",
            textAlign: "center",
            padding: "6px 16px",
            fontSize: compact ? 12 : 14,
            fontWeight: 700,
            letterSpacing: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <WifiOff style={{ width: 16, height: 16 }} />
          {t("tatami.offline_warning")}
          {offlinePending > 0 && (
            <span
              style={{
                background: "rgba(255,255,255,0.2)",
                borderRadius: 4,
                padding: "1px 7px",
                fontSize: 12,
              }}
            >
              {offlinePending} в очереди
            </span>
          )}
        </div>
      )}

      {/* ══ FLUSH BANNER — отправляем накопленные действия ══ */}
      {isOnline && offlineFlushing && (
        <div
          style={{
            background: "#f59e0b",
            color: "#111",
            textAlign: "center",
            padding: "5px 16px",
            fontSize: compact ? 12 : 13,
            fontWeight: 700,
            letterSpacing: 1,
            flexShrink: 0,
          }}
        >
          ⟳ Отправляем {offlinePending} действий после восстановления сети...
        </div>
      )}

      {/* ══ HEADER ══ */}
      <div
        style={{
          background: "#1a1a2e",
          color: "#fff",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: compact ? "8px 14px" : "10px 28px",
          gap: 8,
        }}
      >
        <span
          style={{ fontWeight: 900, letterSpacing: 3, fontSize: compact ? 17 : 24, flexShrink: 0 }}
        >
          ТАТАМИ #{session?.tatamiNumber}
        </span>
        <span
          style={{
            color: "#ccc",
            fontSize: compact ? 12 : 16,
            flex: 1,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tName}
        </span>
        <div
          style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 14, flexShrink: 0 }}
        >
          <div style={{ textAlign: "right" }}>
            {stats && (
              <div style={{ fontSize: compact ? 11 : 14, color: "#fbbf24" }}>
                {stats.completed}/{stats.total}
              </div>
            )}
            {weightLabel && (
              <div style={{ fontSize: compact ? 10 : 12, color: "#aaa" }}>{weightLabel}</div>
            )}
          </div>
          {/* Keyboard shortcuts toggle — hidden on mobile */}
          {!compact && (
            <button
              onClick={() => setShowHotkeys((v) => !v)}
              title="Keyboard shortcuts (H)"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                color: "#aaa",
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 10px",
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              ⌨ ?
            </button>
          )}
        </div>
      </div>

      {/* ══ HOTKEYS OVERLAY ══ */}
      {showHotkeys && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowHotkeys(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              borderRadius: 16,
              padding: 32,
              maxWidth: 520,
              width: "100%",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#fbbf24",
                marginBottom: 20,
                letterSpacing: 2,
              }}
            >
              ⌨ KEYBOARD SHORTCUTS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              {(
                [
                  ["Q", "IPPON — АҚ (Белый)"],
                  ["A", "IPPON — КӨК (Синий)"],
                  ["W", "WAZA-ARI — АҚ"],
                  ["S", "WAZA-ARI — КӨК"],
                  ["E", "ЮКО — АҚ"],
                  ["D", "ЮКО — КӨК"],
                  ["R", "SHIDO — АҚ"],
                  ["F", "SHIDO — КӨК"],
                  ["T", "OSAEKOMI / TOKETA — АҚ"],
                  ["G", "OSAEKOMI / TOKETA — КӨК"],
                  ["Space", "СТАРТ / ПАУЗА"],
                  ["Enter", "Нәтижені растау"],
                  ["Esc", "Нәтижені болдырмау"],
                  ["Z", "Соңғыны болдырмау (Undo)"],
                  ["H / ?", "Бұл терезе"],
                ] as [string, string][]
              ).map(([key, desc]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      background: "#fbbf24",
                      color: "#111",
                      fontWeight: 900,
                      borderRadius: 5,
                      padding: "2px 8px",
                      fontSize: 12,
                      minWidth: 36,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {key}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{desc}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowHotkeys(false)}
              style={{
                marginTop: 20,
                width: "100%",
                background: "#fbbf24",
                color: "#111",
                border: "none",
                borderRadius: 8,
                padding: "10px 0",
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              ЖАБУ (ESC)
            </button>
          </div>
        </div>
      )}

      {/* ══ SCOREBOARD: АҚ card + Timer + КӨК card ══ */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: compact ? "6px 8px" : "10px 14px",
        }}
      >
        {/* АҚ card */}
        <AthleteCard
          side="white"
          athlete={red}
          score={redS}
          compact={compact}
          isWinner={isFinished && winnerId === red?.id}
          isLoser={isFinished && !!winnerId && winnerId !== red?.id}
          canScore={canScore}
          ipponScored={redIpponScored}
          isOsaekomiActive={Boolean(score_.osaekomi) && osaekomiSide === "RED"}
          onIPPON={() => scoreAction.mutate({ type: "IPPON", side: "RED" })}
          onWAZA={() => scoreAction.mutate({ type: "WAZA_ARI", side: "RED" })}
          onYUKO={() => scoreAction.mutate({ type: "YUKO", side: "RED" })}
          onSHIDO={() => scoreAction.mutate({ type: "SHIDO", side: "RED" })}
          onOsaekomi={() =>
            osaekomiSide === "RED" && Boolean(score_.osaekomi)
              ? toketaAct.mutate()
              : osaekomiAct.mutate("RED")
          }
          canOsaekomi={
            (isClockRunning || (Boolean(score_.osaekomi) && osaekomiSide === "RED")) &&
            !pendingResult
          }
          allowYuko={allowYuko}
        />

        {/* Timer */}
        <TimerBar
          scoreSnapshot={score_}
          durationSec={matchDurationSec}
          isRunning={isRunning}
          isGoldenScore={!!score_.isGoldenScore}
          isFinished={isFinished}
          osaekomi={score_.osaekomi ?? null}
          compact={compact}
          onClick={toggleTimer}
        />

        {/* КӨК card */}
        <AthleteCard
          side="blue"
          athlete={blue}
          score={blueS}
          compact={compact}
          isWinner={isFinished && winnerId === blue?.id}
          isLoser={isFinished && !!winnerId && winnerId !== blue?.id}
          canScore={canScore}
          ipponScored={blueIpponScored}
          isOsaekomiActive={Boolean(score_.osaekomi) && osaekomiSide === "BLUE"}
          onIPPON={() => scoreAction.mutate({ type: "IPPON", side: "BLUE" })}
          onWAZA={() => scoreAction.mutate({ type: "WAZA_ARI", side: "BLUE" })}
          onYUKO={() => scoreAction.mutate({ type: "YUKO", side: "BLUE" })}
          onSHIDO={() => scoreAction.mutate({ type: "SHIDO", side: "BLUE" })}
          onOsaekomi={() =>
            osaekomiSide === "BLUE" && Boolean(score_.osaekomi)
              ? toketaAct.mutate()
              : osaekomiAct.mutate("BLUE")
          }
          canOsaekomi={
            (isClockRunning || (Boolean(score_.osaekomi) && osaekomiSide === "BLUE")) &&
            !pendingResult
          }
          allowYuko={allowYuko}
        />
      </div>

      {/* ══ PENDING / WINNER BANNER ══ */}
      {pendingResult && (
        <div
          style={{
            background: "#f59e0b",
            color: "#111",
            textAlign: "center",
            padding: compact ? "8px 0" : "12px 0",
            fontSize: compact ? 16 : 24,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {t("judge.confirm_btn")}:{" "}
          {pendingResult.winnerSide === "RED"
            ? (red?.surname ?? t("judge.side_red"))
            : (blue?.surname ?? t("judge.side_blue"))}
        </div>
      )}
      {isFinished && showResult && winnerId && (
        <div
          style={{
            background: "#16a34a",
            color: "#fff",
            textAlign: "center",
            padding: compact ? "8px 0" : "12px 0",
            fontSize: compact ? 18 : 28,
            fontWeight: 900,
            letterSpacing: 3,
            flexShrink: 0,
          }}
        >
          <Trophy
            style={{
              display: "inline",
              verticalAlign: "middle",
              width: 24,
              height: 24,
              marginRight: 10,
            }}
          />
          {t("common.winner")}:{" "}
          {winnerId === red?.id
            ? (red?.surname ?? t("judge.side_red"))
            : (blue?.surname ?? t("judge.side_blue"))}
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 400, marginTop: 3 }}>
            {t("tatami.next_match_soon")}
          </div>
        </div>
      )}

      {/* ══ QUEUE STRIP ══ */}
      {queue.length > 0 && (
        <div
          style={{
            background: "#e8eaed",
            borderTop: "2px solid #d0d3d8",
            padding: compact ? "5px 10px" : "7px 20px",
            display: "flex",
            alignItems: "center",
            gap: compact ? 10 : 20,
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: compact ? 11 : 13,
              fontWeight: 900,
              color: "#888",
              letterSpacing: 3,
              flexShrink: 0,
            }}
          >
            {t("tatami.queue")}
          </span>
          {queue.slice(0, 6).map((m: import("@/lib/api-types").Match, i: number) => (
            <span
              key={m.id}
              style={{
                fontSize: compact ? 13 : 15,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? "#1a1a2e" : "#666",
                flexShrink: 0,
                background: i === 0 ? "#fff" : "transparent",
                padding: i === 0 ? "3px 10px" : "3px 0",
                borderRadius: 6,
                border: i === 0 ? "2px solid #bbb" : "none",
              }}
            >
              {m.redAthlete?.surname ?? "?"} vs {m.blueAthlete?.surname ?? "?"}
              {m.bracket?.category && (
                <span style={{ fontSize: 11, color: "#999", marginLeft: 5 }}>
                  {m.bracket.category.weightMin}-{m.bracket.category.weightMax}кг
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ══ ERROR ══ */}
      {actionError && (
        <div
          style={{
            background: "#fef2f2",
            borderTop: "2px solid #fca5a5",
            color: "#dc2626",
            padding: "6px 16px",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {actionError}
        </div>
      )}

      {/* ══ CONTROL PANEL — только управление матчем ══ */}
      <div
        style={{
          background: "#fff",
          borderTop: "2px solid #e5e7eb",
          padding: compact ? "8px 10px" : "10px 14px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: compact ? 5 : 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {!pendingResult && (isPending || isPaused) && (
            <Btn
              label={`▶ ${t("scoring.hajime")}`}
              bg="#fbbf24"
              fg="#111"
              bold
              onClick={() => startMatch.mutate()}
              disabled={startMatch.isPending}
              compact={compact}
            />
          )}
          {!pendingResult && isClockRunning && (
            <Btn
              label={`❚❚ ${t("scoring.mate")}`}
              bg="#1a1a2e"
              fg="#fff"
              onClick={() => pauseMatch.mutate()}
              disabled={pauseMatch.isPending}
              compact={compact}
            />
          )}
          {isRunning && !pendingResult && !score_.isGoldenScore && (
            <Btn
              label="GOLDEN SCORE"
              bg="#f59e0b"
              fg="#111"
              onClick={() => goldenScore.mutate()}
              disabled={goldenScore.isPending}
              compact={compact}
            />
          )}
          {/* Finish match — hold 800ms, необратимое завершение */}
          {isRunning && !pendingResult && (
            <>
              <HoldButton
                onHold={() =>
                  finishAction.mutate({ winnerSide: "RED", reason: t("judge.judge_decision") })
                }
                holdMs={800}
                disabled={finishAction.isPending}
                progressColor="#111"
                style={{
                  background: "#e5e7eb",
                  color: "#111",
                  border: "none",
                  borderRadius: 8,
                  padding: compact ? "6px 10px" : "8px 14px",
                  fontSize: compact ? 11 : 13,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  letterSpacing: 0.5,
                  minHeight: 44,
                }}
              >
                {t("judge.red_won")}
                <div style={{ fontSize: 8, opacity: 0.6, fontWeight: 600 }}>HOLD</div>
              </HoldButton>
              <HoldButton
                onHold={() =>
                  finishAction.mutate({ winnerSide: "BLUE", reason: t("judge.judge_decision") })
                }
                holdMs={800}
                disabled={finishAction.isPending}
                progressColor="#fff"
                style={{
                  background: "#1e40af",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: compact ? "6px 10px" : "8px 14px",
                  fontSize: compact ? 11 : 13,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  letterSpacing: 0.5,
                  minHeight: 44,
                }}
              >
                {t("judge.blue_won")}
                <div style={{ fontSize: 8, opacity: 0.6, fontWeight: 600 }}>HOLD</div>
              </HoldButton>
            </>
          )}
          {isRunning && !pendingResult && (
            <Btn
              label={`↩ ${t("tatami.undo")}`}
              bg="#6b7280"
              fg="#fff"
              onClick={() => undoLast.mutate()}
              disabled={undoLast.isPending}
              compact={compact}
            />
          )}
          {/* Forfeit — неявка / отказ. Доступно и в PENDING и в IN_PROGRESS */}
          {!isFinished &&
            !pendingResult &&
            red &&
            blue &&
            (forfeitConfirm ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: compact ? 11 : 13 }}>
                  {t("tatami.forfeit_confirm")}:
                </span>
                <Btn
                  label={`✗ ${red.surname ?? t("judge.side_red")}`}
                  bg="#dc2626"
                  fg="#fff"
                  onClick={() => forfeitAction.mutate("RED")}
                  disabled={forfeitAction.isPending}
                  compact={compact}
                />
                <Btn
                  label={`✗ ${blue.surname ?? t("judge.side_blue")}`}
                  bg="#1e40af"
                  fg="#fff"
                  onClick={() => forfeitAction.mutate("BLUE")}
                  disabled={forfeitAction.isPending}
                  compact={compact}
                />
                <Btn
                  label={t("common.cancel")}
                  bg="#374151"
                  fg="#fff"
                  onClick={() => setForfeitConfirm(null)}
                  disabled={forfeitAction.isPending}
                  compact={compact}
                />
              </div>
            ) : (
              <Btn
                label={`⚠ ${t("tatami.forfeit")}`}
                bg="#78350f"
                fg="#fbbf24"
                onClick={() => setForfeitConfirm("RED")}
                disabled={false}
                compact={compact}
              />
            ))}
          {pendingResult && (
            <>
              <Btn
                label={`✓ ${t("tatami.confirm_short")}`}
                bg="#16a34a"
                fg="#fff"
                bold
                onClick={() => confirmAction.mutate()}
                disabled={confirmAction.isPending || cancelResult.isPending}
                compact={compact}
              />
              <Btn
                label={`↩ ${t("tatami.undo_score")}`}
                bg="#6b7280"
                fg="#fff"
                onClick={() => undoLast.mutate()}
                disabled={undoLast.isPending || confirmAction.isPending || cancelResult.isPending}
                compact={compact}
              />
              <Btn
                label={`✗ ${t("common.cancel").toUpperCase()}`}
                bg="#dc2626"
                fg="#fff"
                bold
                onClick={() => cancelResult.mutate()}
                disabled={cancelResult.isPending || confirmAction.isPending}
                compact={compact}
              />
            </>
          )}
          {isFinished && !showResult && (
            <Btn
              label={`${t("tatami.next_match")} →`}
              bg="#fbbf24"
              fg="#111"
              bold
              onClick={refetch}
              compact={compact}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   AthleteCard — интерактивная карточка с нажимаемыми ячейками очков
   ══════════════════════════════════════════════════════════════════ */

function AthleteCard({
  side,
  athlete,
  score,
  isWinner,
  isLoser,
  compact,
  canScore,
  ipponScored,
  isOsaekomiActive,
  onIPPON,
  onWAZA,
  onYUKO,
  onSHIDO,
  onOsaekomi,
  canOsaekomi,
  allowYuko,
}: {
  side: "white" | "blue";
  athlete: import("@/lib/api-types").User | null | undefined;
  score: import("@/lib/api-types").MatchScoreSnapshot["red"] | null | undefined;
  isWinner: boolean;
  isLoser: boolean;
  compact: boolean;
  canScore: boolean;
  ipponScored: boolean;
  isOsaekomiActive: boolean;
  onIPPON: () => void;
  onWAZA: () => void;
  onYUKO: () => void;
  onSHIDO: () => void;
  onOsaekomi: () => void;
  canOsaekomi: boolean;
  allowYuko: boolean;
}) {
  const { t } = useTranslation();
  const isWhite = side === "white";
  const ippon = score?.ippon ?? 0;
  const wazaari = score?.wazaari ?? 0;
  const yuko = score?.yuko ?? 0;
  const shido = score?.shido ?? 0;

  const bg = isWhite ? "#ffffff" : "#1e40af";
  const textColor = isWhite ? "#111" : "#fff";
  const subColor = isWhite ? "#666" : "rgba(255,255,255,0.65)";
  const borderColor = isWhite ? "#c8ccd4" : "#1e3a8a";
  const sideBarBg = isWhite ? "#d1d5db" : "#2563eb";

  const nameFZ = compact ? 22 : 52;
  const firstFZ = compact ? 14 : 34;
  const cardHeight = compact ? 132 : undefined;

  const osaeLabel = isOsaekomiActive ? "TOKETA" : "OSAEKOMI";
  const osaeStyle: React.CSSProperties = isOsaekomiActive
    ? { background: "#fbbf24", color: "#111", animation: "judgeTimerPulse 1s ease-in-out infinite" }
    : {
        background: isWhite ? "#f3f4f6" : "rgba(255,255,255,0.12)",
        color: isWhite ? "#555" : "rgba(255,255,255,0.7)",
      };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        background: isWinner ? (isWhite ? "#ecfdf5" : "#1e3a5f") : bg,
        borderRadius: 10,
        border: `3px solid ${isWinner ? "#22c55e" : borderColor}`,
        overflow: "hidden",
        opacity: isLoser ? 0.35 : 1,
        flex: compact ? "none" : 1,
        height: cardHeight,
        minHeight: compact ? undefined : 0,
        margin: compact ? "3px 0" : "5px 0",
      }}
    >
      {/* Side bar */}
      <div
        style={{
          width: compact ? 38 : 68,
          background: sideBarBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: compact ? 12 : 20,
            fontWeight: 900,
            color: isWhite ? "#444" : "#fff",
            letterSpacing: 2,
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          {isWhite ? t("judge.side_red") : t("judge.side_blue")}
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top: name + tappable score cells */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            padding: compact ? "6px 8px" : "10px 16px",
            gap: compact ? 6 : 10,
          }}
        >
          {/* Name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: nameFZ,
                fontWeight: 900,
                color: textColor,
                textTransform: "uppercase",
                letterSpacing: 1,
                lineHeight: 1.05,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {athlete?.surname ?? "TBD"}
              {athlete?.name && (
                <span style={{ fontWeight: 400, fontSize: firstFZ, marginLeft: 8, opacity: 0.6 }}>
                  {athlete.name}
                </span>
              )}
            </div>
            {athlete?.club && (
              <div style={{ fontSize: compact ? 11 : 16, color: subColor, marginTop: 2 }}>
                {clubStr(athlete.club)}
              </div>
            )}
          </div>

          {/* Score cells — tappable */}
          <div style={{ display: "flex", gap: compact ? 4 : 8, flexShrink: 0 }}>
            {/* IPPON и HANSOKU-MAKE — требуют удержания 600ms */}
            <TapCell
              label="IPPON"
              value={ippon}
              active={ippon > 0}
              dark={!isWhite}
              compact={compact}
              onClick={onIPPON}
              disabled={!canScore || ipponScored}
              requireHold
            />
            <TapCell
              label="WAZA-ARI"
              value={wazaari}
              active={wazaari > 0}
              dark={!isWhite}
              compact={compact}
              onClick={onWAZA}
              disabled={!canScore || ipponScored}
            />
            <TapCell
              label="YUKO"
              value={yuko}
              active={yuko > 0}
              dark={!isWhite}
              compact={compact}
              onClick={onYUKO}
              disabled={!canScore || ipponScored}
              isYuko
            />
            {/* SHIDO тоже с hold — 3-й шидо = дисквалификация, необратимо */}
            <TapCell
              label="SHIDO"
              value={shido}
              active={shido > 0}
              dark={!isWhite}
              compact={compact}
              onClick={onSHIDO}
              disabled={!canScore}
              isShido
              requireHold
            />
          </div>

          {/* Winner icon */}
          {isWinner && (
            <div
              style={{
                width: compact ? 34 : 50,
                height: compact ? 34 : 50,
                borderRadius: "50%",
                background: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Trophy
                style={{ width: compact ? 18 : 28, height: compact ? 18 : 28, color: "#fff" }}
              />
            </div>
          )}
        </div>

        {/* OSAEKOMI strip — full width */}
        <button
          onClick={onOsaekomi}
          disabled={!canOsaekomi}
          style={{
            ...osaeStyle,
            border: "none",
            width: "100%",
            padding: compact ? "6px 0" : "9px 0",
            fontSize: compact ? 11 : 14,
            fontWeight: 900,
            letterSpacing: 3,
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
function TapCell({
  label,
  value,
  active,
  dark,
  compact,
  onClick,
  disabled,
  isShido,
  isYuko,
  requireHold,
}: {
  label: string;
  value: number;
  active: boolean;
  dark: boolean;
  compact: boolean;
  onClick: () => void;
  disabled: boolean;
  isShido?: boolean;
  isYuko?: boolean;
  /** Если true — требует удержания 600ms (для IPPON, HANSOKU-MAKE) */
  requireHold?: boolean;
}) {
  const w = compact ? 60 : 90; // min 60px — WCAG touch target ≥ 44px
  const h = compact ? 64 : 90;

  const activeBg = isShido ? "#dc2626" : isYuko ? "#16a34a" : "#fbbf24";
  const activeBorder = isShido ? "#b91c1c" : isYuko ? "#15803d" : "#f59e0b";
  const activeText = isShido ? "#fff" : isYuko ? "#fff" : "#111";
  const inactiveBg = dark ? "rgba(255,255,255,0.1)" : "#f3f4f6";
  const inactiveBdr = dark ? "rgba(255,255,255,0.2)" : "#d1d5db";
  const inactiveTxt = dark ? "rgba(255,255,255,0.3)" : "#ccc";

  const cellStyle: React.CSSProperties = {
    width: w,
    height: h,
    borderRadius: 8,
    border: `2px solid ${active ? activeBorder : inactiveBdr}`,
    background: active ? activeBg : inactiveBg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 1,
    pointerEvents: disabled ? "none" : "auto",
    fontFamily: "inherit",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    transition: "transform 0.08s",
  };

  const content = (
    <>
      <span
        style={{
          fontSize: compact ? 8 : 10,
          fontWeight: 800,
          letterSpacing: 1,
          color: active ? activeText : dark ? "rgba(255,255,255,0.45)" : "#aaa",
        }}
      >
        {label}
        {requireHold && (
          <span style={{ fontSize: 7, opacity: 0.7, display: "block", letterSpacing: 0 }}>
            HOLD
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: compact ? 28 : 48,
          fontWeight: 900,
          lineHeight: 1,
          color: active ? activeText : inactiveTxt,
        }}
      >
        {value}
      </span>
    </>
  );

  if (requireHold) {
    return (
      <HoldButton
        onHold={onClick}
        holdMs={600}
        disabled={disabled}
        style={cellStyle}
        progressColor={isShido ? "#fff" : "#111"}
        ariaLabel={label}
      >
        {content}
      </HoldButton>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={cellStyle}
      onPointerDown={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.transform = "scale(0.93)";
      }}
      onPointerUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
      onPointerLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
    >
      {content}
    </button>
  );
}

/* ─── TimerBar ─── */
function TimerBar({
  scoreSnapshot,
  durationSec,
  isRunning,
  isGoldenScore,
  isFinished,
  osaekomi,
  compact,
  onClick,
}: {
  scoreSnapshot?: import("@/lib/api-types").MatchScoreSnapshot;
  durationSec: number;
  isRunning: boolean;
  isGoldenScore: boolean;
  isFinished: boolean;
  osaekomi: import("@/lib/api-types").Match["osaekomi"];
  compact: boolean;
  onClick?: () => void;
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
  let timerStr = isGoldenScore ? fmtTimer(Math.max(0, elapsed - durationSec)) : fmtTimer(Math.max(0, durationSec - elapsed));
  let timerColor = "#6b7280";
  let pulse = false;

  if (!isFinished) {
    if (isGoldenScore) {
      timerColor = "#d97706";
      pulse = isClockRunning;
    } else {
      const rem = Math.max(0, durationSec - elapsed);
      if (isClockRunning) timerColor = rem <= 30 ? "#dc2626" : "#111827";
      if (rem <= 30) pulse = true;
    }
  }
  if (isFinished) {
    timerStr = "0:00";
    timerColor = "#9ca3af";
  }

  const hasOsae = osaekomi?.side && osaekomi?.startedAt;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: compact ? "2px 0" : "6px 0",
        background: "#f0f2f5",
        flexShrink: 0,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          fontSize: compact ? 60 : 110,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          color: timerColor,
          lineHeight: 1,
          letterSpacing: 4,
          animation: pulse ? "judgeTimerPulse 1s ease-in-out infinite" : "none",
        }}
      >
        {timerStr}
      </div>
      {isGoldenScore && (
        <span
          style={{
            position: "absolute",
            top: compact ? 2 : 4,
            right: compact ? 8 : 16,
            background: "#fbbf24",
            color: "#000",
            fontWeight: 900,
            padding: "2px 10px",
            borderRadius: 4,
            fontSize: compact ? 10 : 13,
            letterSpacing: 2,
          }}
        >
          GOLDEN SCORE
        </span>
      )}
      {hasOsae && (
        <OsaekomiBar startedAt={osaekomi.startedAt} side={osaekomi.side} compact={compact} />
      )}
      <style>{`@keyframes judgeTimerPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }`}</style>
    </div>
  );
}

function OsaekomiBar({
  startedAt,
  side,
  compact,
}: {
  startedAt: string;
  side: string;
  compact: boolean;
}) {
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
        left: compact ? 8 : 16,
        background: "#fbbf24",
        borderRadius: 8,
        padding: compact ? "4px 12px" : "6px 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 20px rgba(251,191,36,0.5)",
        animation: "judgeTimerPulse 1s ease-in-out infinite",
      }}
    >
      <span
        style={{ fontSize: compact ? 11 : 14, fontWeight: 900, color: "#111", letterSpacing: 2 }}
      >
        OSAEKOMI {side === "RED" ? t("judge.side_red") : t("judge.side_blue")}
      </span>
      <span
        style={{
          fontSize: compact ? 24 : 36,
          fontWeight: 900,
          color: "#111",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {elapsed}s
      </span>
    </div>
  );
}

/* ─── Btn ─── */
function Btn({
  label,
  bg,
  fg,
  onClick,
  disabled,
  compact,
  bold,
  wide,
}: {
  label: string;
  bg: string;
  fg: string;
  onClick: () => void;
  disabled?: boolean;
  compact: boolean;
  bold?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: fg,
        border: "none",
        borderRadius: 7,
        padding: compact ? "8px 14px" : "10px 20px",
        fontSize: compact ? 13 : 15,
        fontWeight: bold ? 900 : 700,
        letterSpacing: 1.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
        minWidth: wide ? 190 : undefined,
      }}
    >
      {label}
    </button>
  );
}

/* ─── Helpers ─── */
function clockElapsedSec(
  score: import("@/lib/api-types").MatchScoreSnapshot | null | undefined,
  now = Date.now(),
): number {
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

function clubStr(club: import("@/lib/api-types").Club | null | undefined): string {
  if (!club) return "";
  if (club.shortName) return club.shortName;
  const n = club.name;
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.kk ?? n.ru ?? n.en ?? "";
}
