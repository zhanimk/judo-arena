/**
 * Судейская панель по одноразовому токену.
 *
 *  Открывается на URL /judge/<token>, БЕЗ авторизации.
 *  Большие кнопки для мобильника. Серверная проверка таймера osaekomi.
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "@/lib/api";
import { Loader2, Trophy, Play, Pause, Timer } from "lucide-react";
import { useRealtime } from "@/lib/socket";

export const Route = createFileRoute("/judge/$token")({
  head: () => ({ meta: [{ title: "Төреші панелі — Judo-Arena" }] }),
  component: JudgePanel,
});

function JudgePanel() {
  const { t } = useTranslation();
  const { token } = useParams({ from: "/judge/$token" });
  const qc = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["judge-session", token],
    queryFn: () => api.matches.judgeByToken(token),
    retry: false,
  });

  const matchId = sessionQuery.data?.match?.id;
  const match = sessionQuery.data?.match;
  const matchVersion: number | undefined = match?.version;

  // Real-time подписка на изменения этого матча
  useRealtime(
    match?.tournamentId ? [`tournament:${match.tournamentId}`] : [],
    {
      "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:pendingResult": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:finished": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:osaekomiStart": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:osaekomiEnd": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
    },
  );

  // Локальный таймер удержания
  const [osaeStartedLocal, setOsaeStartedLocal] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [, force] = useState({});

  useEffect(() => {
    if (osaeStartedLocal === null) return;
    const id = setInterval(() => force({}), 250);
    return () => clearInterval(id);
  }, [osaeStartedLocal]);

  useEffect(() => {
    if (!match?.scoreSnapshot?.clock?.running) return;
    const id = setInterval(() => force({}), 250);
    return () => clearInterval(id);
  }, [match?.scoreSnapshot?.clock?.running, match?.scoreSnapshot?.clock?.runningStartedAt]);

  // Снимать таймер если на сервере не активен
  useEffect(() => {
    const osa = match?.scoreSnapshot?.osaekomi;
    if (!osa && osaeStartedLocal !== null) setOsaeStartedLocal(null);
    else if (osa && osaeStartedLocal === null) {
      setOsaeStartedLocal(new Date(osa.startedAt).getTime());
    }
  }, [match?.scoreSnapshot?.osaekomi, osaeStartedLocal]);

  const refetch = () => qc.invalidateQueries({ queryKey: ["judge-session", token] });

  const startMatch = useMutation({
    mutationFn: () => api.matches.start(matchId!, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.action_error")),
  });
  const pauseMatch = useMutation({
    mutationFn: () => api.matches.pause(matchId!, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.action_error")),
  });
  const score = useMutation({
    mutationFn: (params: { type: string; side: "RED" | "BLUE" }) =>
      api.matches.score(matchId!, params.type, params.side, token, undefined, matchVersion),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.score_error")),
  });
  const osaekomi = useMutation({
    mutationFn: (side: "RED" | "BLUE") => api.matches.osaekomi(matchId!, side, token, undefined, matchVersion),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.osaekomi_error")),
  });
  const toketa = useMutation({
    mutationFn: () => api.matches.toketa(matchId!, token, undefined, matchVersion),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.toketa_error")),
  });
  const goldenScore = useMutation({
    mutationFn: () => api.matches.goldenScore(matchId!, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.golden_score_error")),
  });
  const confirmResult = useMutation({
    mutationFn: () => api.matches.confirm(matchId!, token),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.confirm_error")),
  });
  const finishMatch = useMutation({
    mutationFn: (params: { winnerSide: "RED" | "BLUE"; reason?: string }) =>
      api.matches.finish(matchId!, params.winnerSide, params.reason, token, undefined, matchVersion),
    onMutate: () => setActionError(""),
    onSuccess: refetch,
    onError: (e: any) => setActionError(e instanceof ApiError ? e.message : t("judge.finish_error")),
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (sessionQuery.error) {
    const msg = sessionQuery.error instanceof ApiError ? sessionQuery.error.message : t("error.generic");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-destructive font-display text-2xl mb-2">{t("judge.unavailable")}</div>
          <div className="text-sm text-muted-foreground">{msg}</div>
        </div>
      </div>
    );
  }

  const red = match?.redAthlete;
  const blue = match?.blueAthlete;
  const score_ = match?.scoreSnapshot ?? { red: {}, blue: {} };
  const redS = score_.red ?? {};
  const blueS = score_.blue ?? {};
  const isRunning = match?.status === "IN_PROGRESS";
  const isClockRunning = isRunning && Boolean(score_.clock?.running);
  const isPaused = isRunning && !isClockRunning;
  const isFinished = match?.status === "COMPLETED";
  const winnerId = match?.winnerId;
  const pendingResult = score_.pendingResult;
  const durationSec = match?.bracket?.category?.matchDurationSec ?? 240;
  const elapsedSec = getClockElapsedSec(score_);
  const displaySec = score_.isGoldenScore ? elapsedSec : Math.max(0, durationSec - elapsedSec);

  const osaekomiActive = osaeStartedLocal !== null;
  const osaekomiDurationSec = osaekomiActive
    ? Math.floor((Date.now() - osaeStartedLocal) / 1000)
    : 0;
  const osaekomiSide = score_.osaekomi?.side as "RED" | "BLUE" | undefined;
  const osaekomiSideLabel = osaekomiSide === "RED" ? t("judge.side_red") : osaekomiSide === "BLUE" ? t("judge.side_blue") : "";

  return (
    <div className="min-h-screen bg-gradient-hero text-foreground p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Шапка */}
        <div className="mb-4 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("judge.panel_title")}
          </div>
          <div className="text-sm text-gold">
            {match?.tournament?.name?.kk ?? match?.tournament?.name?.ru ?? t("common.tournament")}
            {match?.tatamiNumber ? ` · ${t("common.tatami")} #${match.tatamiNumber}` : ""}
          </div>
        </div>

        {/* Победитель */}
        {isFinished && winnerId && (
          <div className="mb-6 glass rounded-2xl border-2 border-gold/60 p-6 text-center">
            <Trophy className="h-12 w-12 text-gold mx-auto mb-2" />
            <div className="text-xs uppercase tracking-widest text-gold/80">{t("common.winner")}</div>
            <div className="font-display text-3xl text-gradient-gold mt-2">
              {winnerId === red?.id ? `${red.name} ${red.surname}` : `${blue?.name} ${blue?.surname}`}
            </div>
          </div>
        )}

        {/* Osaekomi баннер */}
        {osaekomiActive && (
          <div className="mb-4 glass rounded-xl border-2 border-gold/60 p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-gold flex items-center gap-2">
                <Timer className="h-4 w-4" /> OSAEKOMI · {osaekomiSideLabel}
              </span>
              <span className="font-display text-4xl text-gold tabular-nums">
                {String(Math.floor(osaekomiDurationSec / 60)).padStart(2, "0")}:
                {String(osaekomiDurationSec % 60).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground text-center">
              5 сек → Yuko · 10 сек → Waza-ari · 20 сек → Ippon
            </div>
          </div>
        )}

        <div className="mb-4 glass rounded-2xl border border-border/60 p-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {pendingResult ? t("judge.confirm_needed") : score_.isGoldenScore ? "Golden Score" : isPaused ? "Mate" : isClockRunning ? t("judge.time_running") : t("judge.waiting")}
          </div>
          <div className={`font-display text-6xl font-black tabular-nums ${
            score_.isGoldenScore ? "text-gold" : displaySec <= 30 && isClockRunning ? "text-destructive" : "text-foreground"
          }`}>
            {fmtTimer(displaySec)}
          </div>
        </div>

        {actionError && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
            {actionError}
          </div>
        )}

        {pendingResult && (
          <div className="mb-5 glass rounded-2xl border-2 border-gold/70 bg-gold/10 p-5 text-center">
            <Trophy className="h-10 w-10 text-gold mx-auto mb-2" />
            <div className="text-xs uppercase tracking-widest text-gold/80">{t("judge.match_finished")}</div>
            <div className="font-display text-2xl text-gradient-gold mt-1">
              {pendingResult.winnerSide === "RED" ? `${red?.name} ${red?.surname}` : `${blue?.name} ${blue?.surname}`}
            </div>
            <button
              onClick={() => confirmResult.mutate()}
              disabled={confirmResult.isPending}
              className="mt-4 rounded-lg bg-gradient-gold px-8 py-3 font-bold text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {t("judge.confirm_btn")}
            </button>
          </div>
        )}

        {/* Контрол матча */}
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          {!pendingResult && (!isRunning || isPaused) && !isFinished && (
            <button
              onClick={() => startMatch.mutate()}
              disabled={startMatch.isPending}
              className="bg-gradient-gold text-gold-foreground px-6 py-3 rounded-lg font-bold shadow-gold flex items-center gap-2"
            >
              <Play className="h-5 w-5" /> ХАДЖИМЕ
            </button>
          )}
          {!pendingResult && isClockRunning && (
            <button
              onClick={() => pauseMatch.mutate()}
              disabled={pauseMatch.isPending}
              className="glass border border-gold/40 px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Pause className="h-5 w-5" /> МАТЕ
            </button>
          )}
          {!pendingResult && isRunning && !score_.isGoldenScore && (
            <button
              onClick={() => goldenScore.mutate()}
              disabled={goldenScore.isPending}
              className="glass border border-gold/40 px-6 py-3 rounded-lg font-medium text-gold"
            >
              GOLDEN SCORE
            </button>
          )}
          {isRunning && !pendingResult && (
            <>
              <button
                onClick={() => finishMatch.mutate({ winnerSide: "RED", reason: t("judge.judge_decision") })}
                disabled={finishMatch.isPending}
                className="rounded-lg border border-gray-400/50 bg-gray-500/10 px-6 py-3 font-bold text-gray-200 disabled:opacity-50"
              >
                {t("judge.red_won")}
              </button>
              <button
                onClick={() => finishMatch.mutate({ winnerSide: "BLUE", reason: t("judge.judge_decision") })}
                disabled={finishMatch.isPending}
                className="rounded-lg border border-sky-400/50 bg-sky-500/10 px-6 py-3 font-bold text-sky-200 disabled:opacity-50"
              >
                {t("judge.blue_won")}
              </button>
            </>
          )}
        </div>

        {/* Стороны: АҚ / КӨК */}
        <div className="grid gap-4 md:grid-cols-2">
          {(["RED", "BLUE"] as const).map((side) => {
            const a = side === "RED" ? red : blue;
            const s: any = side === "RED" ? redS : blueS;
            const isOsae = osaekomiActive && osaekomiSide === side;
            return (
              <div
                key={side}
                className={`glass rounded-2xl p-5 border-2 ${
                  side === "RED" ? "border-gray-400/40" : "border-sky-400/40"
                } ${winnerId === a?.id ? "shadow-gold" : ""}`}
              >
                {/* Имя */}
                <div className="mb-3">
                  <div className={`text-xs uppercase tracking-widest ${side === "RED" ? "text-gray-300" : "text-sky-300"}`}>
                    {side === "RED" ? `⬜ ${t("judge.side_red")}` : `🔵 ${t("judge.side_blue")}`}
                  </div>
                  <div className="font-display text-2xl font-semibold leading-tight">
                    {a ? `${a.name} ${a.surname}` : "—"}
                  </div>
                </div>

                {/* Очки */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  {[
                    { l: "IPPON", v: s.ippon ?? 0, c: "text-gold" },
                    { l: "WAZA", v: s.wazaari ?? 0, c: "text-gold/80" },
                    { l: "YUKO", v: s.yuko ?? 0, c: "text-gold/60" },
                    { l: "SHIDO", v: s.shido ?? 0, c: "text-destructive" },
                  ].map((m) => (
                    <div key={m.l} className="glass rounded-md p-2">
                      <div className="text-[10px] text-muted-foreground">{m.l}</div>
                      <div className={`font-display text-2xl font-bold ${m.c}`}>{m.v}</div>
                    </div>
                  ))}
                </div>

                {/* Кнопки */}
                <div className="grid grid-cols-2 gap-2">
                  <ScoreBtn
                    label="IPPON"
	                    color="bg-gradient-gold text-gold-foreground"
	                    onClick={() => score.mutate({ type: "IPPON", side })}
	                    disabled={!isClockRunning || Boolean(pendingResult)}
	                  />
                  <ScoreBtn
                    label="WAZA-ARI"
	                    color="glass border border-gold/40 text-gold"
	                    onClick={() => score.mutate({ type: "WAZA_ARI", side })}
	                    disabled={!isClockRunning || Boolean(pendingResult)}
	                  />
                  <ScoreBtn
                    label={isOsae ? "TOKETA" : "OSAEKOMI"}
                    color={isOsae ? "bg-gold text-gold-foreground animate-pulse" : "glass border border-gold/30 text-gold/80"}
                    onClick={() => {
	                      if (isOsae) toketa.mutate();
	                      else osaekomi.mutate(side);
	                    }}
	                    disabled={Boolean(pendingResult) || (!isClockRunning && !isOsae)}
	                  />
                  <ScoreBtn
                    label="SHIDO"
	                    color="bg-destructive/20 text-destructive border border-destructive/40"
	                    onClick={() => score.mutate({ type: "SHIDO", side })}
	                    disabled={!isClockRunning || Boolean(pendingResult)}
	                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          {t("judge.session_expires")}: {sessionQuery.data?.expiresAt
            ? new Date(sessionQuery.data.expiresAt).toLocaleString("kk-KZ")
            : "—"}
        </div>
      </div>
    </div>
  );
}

function ScoreBtn({
  label, color, onClick, disabled,
}: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${color} py-4 rounded-lg font-bold text-sm tracking-wider transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100`}
    >
      {label}
    </button>
  );
}

function getClockElapsedSec(score: any): number {
  const clock = score?.clock;
  const base = Math.max(0, Number(clock?.elapsedSec ?? 0));
  if (!clock?.running || !clock.runningStartedAt) return base;
  const startedMs = new Date(clock.runningStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return base;
  return Math.max(0, base + Math.floor((Date.now() - startedMs) / 1000));
}

function fmtTimer(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
