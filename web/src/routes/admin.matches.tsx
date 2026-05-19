import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Gavel,
  GripVertical,
  MonitorPlay,
  Unlink,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DashboardShell, EmptyState, LoadingState, Panel } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useRealtime } from "@/lib/socket";

type Match = any;

export const Route = createFileRoute("/admin/matches")({
  validateSearch: (search: Record<string, unknown>) => ({
    tournamentId: typeof search.tournamentId === "string" ? search.tournamentId : undefined,
  }),
  head: () => ({ meta: [{ title: "Табло басқару — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminScoreboard />
    </ProtectedRoute>
  ),
});

function AdminScoreboard() {
  const search = Route.useSearch();
  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Табло және татами басқару">
      <TournamentScoreboardPanel initialTournamentId={search.tournamentId} />
    </DashboardShell>
  );
}

export function TournamentScoreboardPanel({
  initialTournamentId,
  fixedTournamentId,
}: {
  initialTournamentId?: string;
  fixedTournamentId?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedTournamentId, setSelectedTournamentId] = useState(fixedTournamentId ?? initialTournamentId ?? "");
  const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);
  const [sessionFor, setSessionFor] = useState<{ id: string; players: string } | null>(null);
  const [judgeName, setJudgeName] = useState("");
  const [sessionResult, setSessionResult] = useState<{ url: string; copied: boolean } | null>(null);
  const [wallCopied, setWallCopied] = useState(false);
  const [error, setError] = useState("");

  const tournamentsQuery = useQuery({
    queryKey: ["admin-scoreboard-tournaments"],
    queryFn: () => api.tournaments.list(),
  });

  const tournaments = tournamentsQuery.data?.items ?? [];
  const selectedTournament = tournaments.find((t: any) => t.id === selectedTournamentId);
  const tatamiCount = Math.max(3, Number(selectedTournament?.tatamiCount ?? 3));

  useEffect(() => {
    if (fixedTournamentId && fixedTournamentId !== selectedTournamentId) {
      setSelectedTournamentId(fixedTournamentId);
    } else if (!fixedTournamentId && initialTournamentId && initialTournamentId !== selectedTournamentId) {
      setSelectedTournamentId(initialTournamentId);
    }
  }, [fixedTournamentId, initialTournamentId, selectedTournamentId]);

  useEffect(() => {
    if (!fixedTournamentId && !selectedTournamentId && tournaments.length > 0) {
      const live = tournaments.find((t: any) => t.status === "IN_PROGRESS");
      const ready = tournaments.find((t: any) => t.status === "REGISTRATION_CLOSED");
      const nextId = (live ?? ready ?? tournaments[0]).id;
      setSelectedTournamentId(nextId);
      navigate({ to: "/admin/matches", search: { tournamentId: nextId }, replace: true });
    }
  }, [fixedTournamentId, navigate, selectedTournamentId, tournaments]);

  const invalidateBoard = () => {
    qc.invalidateQueries({ queryKey: ["admin-scoreboard-matches", selectedTournamentId] });
  };

  useRealtime(selectedTournamentId ? [`tournament:${selectedTournamentId}`] : [], {
    "match:started": invalidateBoard,
    "match:event": invalidateBoard,
    "match:scoreUpdate": invalidateBoard,
    "match:finished": invalidateBoard,
    "match:osaekomiStart": invalidateBoard,
    "match:osaekomiEnd": invalidateBoard,
  });

  const matchesQuery = useQuery({
    queryKey: ["admin-scoreboard-matches", selectedTournamentId],
    enabled: Boolean(selectedTournamentId),
    queryFn: () => api.matches.list({ tournamentId: selectedTournamentId, limit: 500 }),
    refetchInterval: 2500,
  });

  const assignTatami = useMutation({
    mutationFn: ({ matchId, tatamiNumber }: { matchId: string; tatamiNumber: number | null }) =>
      api.matches.assignTatami(matchId, tatamiNumber),
    onMutate: () => setError(""),
    onSuccess: invalidateBoard,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Татами тағайындау кезінде қате шықты"),
  });

  const createSession = useMutation({
    mutationFn: ({ matchId, judgeName }: { matchId: string; judgeName: string }) =>
      api.matches.createJudgeSession(matchId, judgeName),
    onSuccess: (s) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setSessionResult({ url: `${origin}/judge/${s.token}`, copied: false });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Төреші сілтемесін құру кезінде қате шықты"),
  });

  const matches = matchesQuery.data ?? [];
  const board = useMemo(() => buildTatamiBoard(matches, tatamiCount), [matches, tatamiCount]);
  const unassigned = board.unassigned;
  const completed = matches.filter((m: Match) => m.status === "COMPLETED").slice(0, 12);
  const liveCount = matches.filter((m: Match) => m.status === "IN_PROGRESS").length;
  const wallPath = selectedTournamentId ? `/live-wall/${selectedTournamentId}` : "";

  const changeTournament = (id: string) => {
    if (fixedTournamentId) return;
    setSelectedTournamentId(id);
    setWallCopied(false);
    navigate({ to: "/admin/matches", search: { tournamentId: id }, replace: true });
  };

  const dropOnTatami = (tatamiNumber: number | null) => {
    if (!draggedMatchId) return;
    assignTatami.mutate({ matchId: draggedMatchId, tatamiNumber });
    setDraggedMatchId(null);
  };

  const copyWall = async () => {
    if (!wallPath || typeof window === "undefined") return;
    await navigator.clipboard.writeText(`${window.location.origin}${wallPath}`);
    setWallCopied(true);
    window.setTimeout(() => setWallCopied(false), 1400);
  };

  return (
    <>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Panel
        title="Жалпы басқару панелі"
        action={selectedTournamentId && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyWall}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-sm hover:bg-muted/60"
            >
              {wallCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Табло сілтемесі
            </button>
            <Link
              to="/live-wall/$tournamentId"
              params={{ tournamentId: selectedTournamentId }}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm font-medium text-gold-foreground shadow-gold"
            >
              <MonitorPlay className="h-4 w-4" />
              Проекторға ашу
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,360px)_1fr]">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Жарыс</label>
            {fixedTournamentId ? (
              <div className="mt-1 rounded-md border border-border bg-card/60 px-3 py-2 text-sm">
                {selectedTournament ? `${localizeName(selectedTournament.name)} · ${statusLabel(selectedTournament.status)}` : "Жүктелуде..."}
              </div>
            ) : (
              <select
                value={selectedTournamentId}
                onChange={(e) => changeTournament(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Жарысты таңдаңыз</option>
                {tournaments.map((t: any) => (
                  <option key={t.id} value={t.id}>{localizeName(t.name)} · {statusLabel(t.status)}</option>
                ))}
              </select>
            )}
            {selectedTournament && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label="Татами" value={String(tatamiCount)} />
                <Metric label="LIVE" value={String(liveCount)} accent />
                <Metric label="Матч" value={String(matches.length)} />
              </div>
            )}
          </div>

          <DropZone
            title="Тағайындалмаған матчтар"
            hint="Карточканы 1, 2 немесе 3 татамиге сүйреп апарыңыз"
            onDrop={() => dropOnTatami(null)}
            active={Boolean(draggedMatchId)}
          >
            {matchesQuery.isLoading ? (
              <LoadingState />
            ) : unassigned.length === 0 ? (
              <EmptyState title="Бәрі татамиге қойылған" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {unassigned.slice(0, 18).map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    compact
                    onDragStart={() => setDraggedMatchId(m.id)}
                    onDragEnd={() => setDraggedMatchId(null)}
                    onJudge={() => openJudgeModal(m, setSessionFor, setSessionResult, setJudgeName, setError)}
                  />
                ))}
              </div>
            )}
          </DropZone>
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {board.tatamis.map((tatami) => (
          <DropZone
            key={tatami.number}
            title={`Татами ${tatami.number}`}
            hint={`${tatami.live.length} live · ${tatami.queue.length} кезекте`}
            action={
              <button
                onClick={() => openJudgeForTatami(tatami, createSession.mutate, setSessionFor, setSessionResult, setJudgeName, setError)}
                disabled={!firstPlayableMatch(tatami)}
                className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1.5 text-xs text-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Gavel className="h-3.5 w-3.5" />
                Судья ноут
              </button>
            }
            onDrop={() => dropOnTatami(tatami.number)}
            active={Boolean(draggedMatchId)}
          >
            <div className="space-y-3">
              {tatami.live.length > 0 && (
                <div className="space-y-3">
                  {tatami.live.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      live
                      onDragStart={() => setDraggedMatchId(m.id)}
                      onDragEnd={() => setDraggedMatchId(null)}
                      onJudge={() => openJudgeModal(m, setSessionFor, setSessionResult, setJudgeName, setError)}
                      onUnassign={() => assignTatami.mutate({ matchId: m.id, tatamiNumber: null })}
                    />
                  ))}
                </div>
              )}

              {tatami.queue.length === 0 && tatami.live.length === 0 ? (
                <EmptyState title="Бұл татамиде матч жоқ" hint="Матчты осында сүйреп әкеліңіз" />
              ) : (
                <div className="space-y-2">
                  {tatami.queue.map((m, index) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      queueIndex={index + 1}
                      onDragStart={() => setDraggedMatchId(m.id)}
                      onDragEnd={() => setDraggedMatchId(null)}
                      onJudge={() => openJudgeModal(m, setSessionFor, setSessionResult, setJudgeName, setError)}
                      onUnassign={() => assignTatami.mutate({ matchId: m.id, tatamiNumber: null })}
                    />
                  ))}
                </div>
              )}
            </div>
          </DropZone>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Соңғы аяқталған матчтар">
          {completed.length === 0 ? (
            <EmptyState title="Әлі аяқталған матч жоқ" />
          ) : (
            <div className="space-y-2">
              {completed.map((m: Match) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card/50 p-3 text-sm">
                  <span className="min-w-0 truncate">{athleteName(m.redAthlete)} vs {athleteName(m.blueAthlete)}</span>
                  <span className="shrink-0 text-xs text-gold">Жеңімпаз: {winnerName(m)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Қалай беру керек">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Админ осы бетте турнирді таңдайды және матчтарды татамиге сүйреп қояды.</p>
            <p>2. Әр матчтан төрешіге жеке сілтеме шығарады. Төреші сол сілтемеден HAJIME, MATE, IPPON енгізеді.</p>
            <p>3. “Проекторға ашу” батырмасы барлық 3 татамиді бір экранда көрсетеді. Ол бет автоматты жаңарып тұрады.</p>
          </div>
        </Panel>
      </div>

      {sessionFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => setSessionFor(null)}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">Төреші сессиясын құру</h3>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">{sessionFor.players}</p>

            {sessionResult ? (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Төреші URL</label>
                <div className="mt-1 flex gap-2">
                  <input readOnly value={sessionResult.url} className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-xs" />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sessionResult.url);
                      setSessionResult({ ...sessionResult, copied: true });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/15 px-3 py-2 text-xs text-gold"
                  >
                    {sessionResult.copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {sessionResult.copied ? "Көшірілді" : "Көшіру"}
                  </button>
                </div>
                <button onClick={() => setSessionFor(null)} className="mt-4 w-full rounded-md bg-gradient-gold py-2 font-medium text-gold-foreground shadow-gold">
                  Дайын
                </button>
              </div>
            ) : (
              <>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Төреші аты</label>
                <input
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="Мысалы Берік Сериков"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setSessionFor(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/60">
                    Болдырмау
                  </button>
                  <button
                    onClick={() => createSession.mutate({ matchId: sessionFor.id, judgeName })}
                    disabled={createSession.isPending}
                    className="rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
                  >
                    Сілтеме құру
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DropZone({
  title,
  hint,
  action,
  active,
  onDrop,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  active: boolean;
  onDrop: () => void;
  children: ReactNode;
}) {
  return (
    <section
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`min-h-48 rounded-lg border p-3 transition-colors ${
        active ? "border-gold/70 bg-gold/10" : "border-border/70 bg-card/35"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MatchCard({
  match,
  live,
  compact,
  queueIndex,
  onDragStart,
  onDragEnd,
  onJudge,
  onUnassign,
}: {
  match: Match;
  live?: boolean;
  compact?: boolean;
  queueIndex?: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onJudge: () => void;
  onUnassign?: () => void;
}) {
  const hasPair = Boolean(match.redAthlete && match.blueAthlete);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", match.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-background/70 p-3 shadow-sm transition hover:border-gold/50 ${
        live ? "border-destructive/50" : "border-border/70"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {queueIndex ? `Кезек #${queueIndex} · ` : ""}R{match.round}.{match.position}
            </div>
            <div className="truncate text-sm font-medium">{athleteName(match.redAthlete)} vs {athleteName(match.blueAthlete)}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${live ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {statusLabel(match.status)}
        </span>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2">
          <ScoreSide side="RED" athlete={match.redAthlete} score={match.scoreSnapshot?.red} />
          <ScoreSide side="BLUE" athlete={match.blueAthlete} score={match.scoreSnapshot?.blue} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {hasPair && (
          <button
            onClick={onJudge}
            className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1.5 text-xs text-gold"
          >
            <Gavel className="h-3.5 w-3.5" />
            Төреші
          </button>
        )}
        {onUnassign && (
          <button onClick={onUnassign} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60">
            <Unlink className="h-3.5 w-3.5" />
            Алу
          </button>
        )}
      </div>
    </article>
  );
}

function ScoreSide({ side, athlete, score }: { side: "RED" | "BLUE"; athlete: any; score: any }) {
  return (
    <div className={`rounded-md border p-2 ${side === "RED" ? "border-rose-400/30 bg-rose-500/10" : "border-sky-400/30 bg-sky-500/10"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{side === "RED" ? "Қызыл" : "Көк"}</div>
      <div className="truncate text-sm font-medium">{athleteName(athlete)}</div>
      <div className="mt-1 text-xs">I:{score?.ippon ?? 0} W:{score?.wazaari ?? 0} S:{score?.shido ?? 0}</div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

function buildTatamiBoard(matches: Match[], tatamiCount: number) {
  const playable = matches.filter((m) => m.status === "PENDING" || m.status === "IN_PROGRESS");
  const unassigned = playable.filter((m) => !m.tatamiNumber).sort(matchSort);
  const tatamis = Array.from({ length: tatamiCount }, (_, index) => {
    const number = index + 1;
    const assigned = playable.filter((m) => Number(m.tatamiNumber) === number).sort(matchSort);
    return {
      number,
      live: assigned.filter((m) => m.status === "IN_PROGRESS"),
      queue: assigned.filter((m) => m.status !== "IN_PROGRESS"),
    };
  });
  return { unassigned, tatamis };
}

function matchSort(a: Match, b: Match) {
  if (a.status === "IN_PROGRESS" && b.status !== "IN_PROGRESS") return -1;
  if (a.status !== "IN_PROGRESS" && b.status === "IN_PROGRESS") return 1;
  return (a.round ?? 0) - (b.round ?? 0) || (a.position ?? 0) - (b.position ?? 0);
}

function openJudgeModal(
  match: Match,
  setSessionFor: (value: { id: string; players: string } | null) => void,
  setSessionResult: (value: { url: string; copied: boolean } | null) => void,
  setJudgeName: (value: string) => void,
  setError: (value: string) => void,
) {
  setSessionFor({ id: match.id, players: `${athleteName(match.redAthlete)} vs ${athleteName(match.blueAthlete)}` });
  setSessionResult(null);
  setJudgeName("");
  setError("");
}

function firstPlayableMatch(tatami: { live: Match[]; queue: Match[] }) {
  return [...tatami.live, ...tatami.queue].find((m) => m.redAthlete && m.blueAthlete) ?? null;
}

function openJudgeForTatami(
  tatami: { number: number; live: Match[]; queue: Match[] },
  createSession: (value: { matchId: string; judgeName: string }) => void,
  setSessionFor: (value: { id: string; players: string } | null) => void,
  setSessionResult: (value: { url: string; copied: boolean } | null) => void,
  setJudgeName: (value: string) => void,
  setError: (value: string) => void,
) {
  const match = firstPlayableMatch(tatami);
  if (!match) {
    setError(`Татами ${tatami.number}: төрешіге беретін дайын матч жоқ`);
    return;
  }
  setSessionFor({ id: match.id, players: `Татами ${tatami.number} · ${athleteName(match.redAthlete)} vs ${athleteName(match.blueAthlete)}` });
  setSessionResult(null);
  setJudgeName(`Tatami ${tatami.number}`);
  setError("");
  createSession({ matchId: match.id, judgeName: `Tatami ${tatami.number}` });
}

function athleteName(athlete: any) {
  if (!athlete) return "TBD";
  return [athlete.name, athlete.surname].filter(Boolean).join(" ") || "TBD";
}

function winnerName(m: Match): string {
  if (!m.winnerId) return "—";
  if (m.redAthlete?.id === m.winnerId) return athleteName(m.redAthlete);
  if (m.blueAthlete?.id === m.winnerId) return athleteName(m.blueAthlete);
  return "—";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Жоба",
    REGISTRATION_OPEN: "Тіркеу ашық",
    REGISTRATION_CLOSED: "Дайын",
    IN_PROGRESS: "LIVE",
    COMPLETED: "Аяқталды",
    CANCELLED: "Тоқтатылды",
    PENDING: "Күтуде",
  };
  return labels[status] ?? status;
}

function localizeName(value: any) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.kk ?? value.ru ?? value.en ?? Object.values(value)[0] ?? "—";
}
