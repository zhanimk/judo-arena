/**
 * Судейская панель по одноразовому токену.
 *
 *  Открывается на URL /judge/<token>, БЕЗ авторизации.
 *  Большие кнопки для мобильника. Серверная проверка таймера osaekomi.
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Loader2, Trophy, Play, Pause, Timer } from "lucide-react";
import { useRealtime } from "@/lib/socket";

export const Route = createFileRoute("/judge/$token")({
  head: () => ({ meta: [{ title: "Төреші панелі — Judo-Arena" }] }),
  component: JudgePanel,
});

function JudgePanel() {
  const { token } = useParams({ from: "/judge/$token" });
  const qc = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["judge-session", token],
    queryFn: () => api.matches.judgeByToken(token),
    retry: false,
  });

  const matchId = sessionQuery.data?.match?.id;
  const match = sessionQuery.data?.match;

  // Real-time подписка на изменения этого матча
  useRealtime(
    match?.tournamentId ? [`tournament:${match.tournamentId}`] : [],
    {
      "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:finished": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:osaekomiStart": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
      "match:osaekomiEnd": () => qc.invalidateQueries({ queryKey: ["judge-session", token] }),
    },
  );

  // Локальный таймер удержания
  const [osaeStartedLocal, setOsaeStartedLocal] = useState<number | null>(null);
  const [, force] = useState({});

  useEffect(() => {
    if (osaeStartedLocal === null) return;
    const id = setInterval(() => force({}), 250);
    return () => clearInterval(id);
  }, [osaeStartedLocal]);

  // Снимать таймер если на сервере не активен
  useEffect(() => {
    const osa = match?.scoreSnapshot?.osaekomi;
    if (!osa && osaeStartedLocal !== null) setOsaeStartedLocal(null);
    else if (osa && osaeStartedLocal === null) {
      setOsaeStartedLocal(new Date(osa.startedAt).getTime());
    }
  }, [match?.scoreSnapshot?.osaekomi]);

  const refetch = () => qc.invalidateQueries({ queryKey: ["judge-session", token] });

  const startMatch = useMutation({
    mutationFn: () => api.matches.start(matchId!, token),
    onSuccess: refetch,
  });
  const pauseMatch = useMutation({
    mutationFn: () => api.matches.pause(matchId!, token),
    onSuccess: refetch,
  });
  const score = useMutation({
    mutationFn: (params: { type: string; side: "RED" | "BLUE" }) =>
      api.matches.score(matchId!, params.type, params.side, token),
    onSuccess: refetch,
  });
  const osaekomi = useMutation({
    mutationFn: (side: "RED" | "BLUE") => api.matches.osaekomi(matchId!, side, token),
    onSuccess: refetch,
  });
  const toketa = useMutation({
    mutationFn: () => api.matches.toketa(matchId!, token),
    onSuccess: refetch,
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (sessionQuery.error) {
    const msg = sessionQuery.error instanceof ApiError ? sessionQuery.error.message : "Қате орын алды";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <div className="text-destructive font-display text-2xl mb-2">Қол жетімсіз</div>
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
  const isFinished = match?.status === "COMPLETED";
  const winnerId = match?.winnerId;

  const osaekomiActive = osaeStartedLocal !== null;
  const osaekomiDurationSec = osaekomiActive
    ? Math.floor((Date.now() - osaeStartedLocal) / 1000)
    : 0;
  const osaekomiSide = score_.osaekomi?.side as "RED" | "BLUE" | undefined;

  return (
    <div className="min-h-screen bg-gradient-hero text-foreground p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Шапка */}
        <div className="mb-4 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Төреші панелі
          </div>
          <div className="text-sm text-gold">
            {match?.tournament?.name?.kk ?? match?.tournament?.name?.ru ?? "Жарыс"}
            {match?.tatamiNumber ? ` · Татами #${match.tatamiNumber}` : ""}
          </div>
        </div>

        {/* Победитель */}
        {isFinished && winnerId && (
          <div className="mb-6 glass rounded-2xl border-2 border-gold/60 p-6 text-center">
            <Trophy className="h-12 w-12 text-gold mx-auto mb-2" />
            <div className="text-xs uppercase tracking-widest text-gold/80">Жеңімпаз</div>
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
                <Timer className="h-4 w-4" /> OSAEKOMI · {osaekomiSide}
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

        {/* Контрол матча */}
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          {!isRunning && !isFinished && (
            <button
              onClick={() => startMatch.mutate()}
              disabled={startMatch.isPending}
              className="bg-gradient-gold text-gold-foreground px-6 py-3 rounded-lg font-bold shadow-gold flex items-center gap-2"
            >
              <Play className="h-5 w-5" /> ХАДЖИМЕ
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => pauseMatch.mutate()}
              disabled={pauseMatch.isPending}
              className="glass border border-gold/40 px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            >
              <Pause className="h-5 w-5" /> МАТЕ
            </button>
          )}
        </div>

        {/* Стороны RED / BLUE */}
        <div className="grid gap-4 md:grid-cols-2">
          {(["RED", "BLUE"] as const).map((side) => {
            const a = side === "RED" ? red : blue;
            const s: any = side === "RED" ? redS : blueS;
            const isOsae = osaekomiActive && osaekomiSide === side;
            return (
              <div
                key={side}
                className={`glass rounded-2xl p-5 border-2 ${
                  side === "RED" ? "border-rose-400/40" : "border-sky-400/40"
                } ${winnerId === a?.id ? "shadow-gold" : ""}`}
              >
                {/* Имя */}
                <div className="mb-3">
                  <div className={`text-xs uppercase tracking-widest ${side === "RED" ? "text-rose-300" : "text-sky-300"}`}>
                    {side === "RED" ? "🔴 Қызыл" : "🔵 Көк"}
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
                    disabled={!isRunning}
                  />
                  <ScoreBtn
                    label="WAZA-ARI"
                    color="glass border border-gold/40 text-gold"
                    onClick={() => score.mutate({ type: "WAZA_ARI", side })}
                    disabled={!isRunning}
                  />
                  <ScoreBtn
                    label={isOsae ? "TOKETA" : "OSAEKOMI"}
                    color={isOsae ? "bg-gold text-gold-foreground animate-pulse" : "glass border border-gold/30 text-gold/80"}
                    onClick={() => {
                      if (isOsae) toketa.mutate();
                      else osaekomi.mutate(side);
                    }}
                    disabled={!isRunning}
                  />
                  <ScoreBtn
                    label="SHIDO"
                    color="bg-destructive/20 text-destructive border border-destructive/40"
                    onClick={() => score.mutate({ type: "SHIDO", side })}
                    disabled={!isRunning}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Сессия аяқталу уақыты: {sessionQuery.data?.expiresAt
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
