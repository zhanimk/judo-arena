import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  GripVertical,
  MonitorPlay,
  RotateCcw,
  Tv,
  Unlink,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DashboardShell, EmptyState, LoadingState, Panel } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useRealtime } from "@/lib/socket";
import { buildTatamiState, hasPendingResult, matchOrder } from "@/lib/tatami-state";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const search = Route.useSearch();
  return (
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("admin.matches_title")}>
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
  const [wallCopied, setWallCopied] = useState(false);
  const [copiedTatamiSessionId, setCopiedTatamiSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [overrideDialog, setOverrideDialog] = useState<{
    matchId: string;
    redName: string;
    blueName: string;
    side: "RED" | "BLUE" | null;
    reason: string;
  } | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ["admin-scoreboard-tournaments"],
    queryFn: () => api.tournaments.list(),
  });

  const tournaments = useMemo(() => tournamentsQuery.data?.items ?? [], [tournamentsQuery.data]);
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
    "match:pendingResult": invalidateBoard,
    "match:finished": invalidateBoard,
    "match:osaekomiStart": invalidateBoard,
    "match:osaekomiEnd": invalidateBoard,
    "tatami:queueUpdate": invalidateBoard,
    "bracket:update": invalidateBoard,
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
  const reorderQueue = useMutation({
    mutationFn: ({ matchId, direction }: { matchId: string; direction: "up" | "down" }) =>
      api.matches.reorderQueue(matchId, direction),
    onMutate: () => setError(""),
    onSuccess: invalidateBoard,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Кезекті өзгерту кезінде қате шықты"),
  });

  const resetMatchMutation = useMutation({
    mutationFn: (matchId: string) => api.matches.reset(matchId),
    onMutate: () => setError(""),
    onSuccess: invalidateBoard,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Матчты қайта бастау кезінде қате"),
  });

  const overrideMatch = useMutation({
    mutationFn: ({ matchId, winnerSide, reason }: { matchId: string; winnerSide: "RED" | "BLUE"; reason: string }) =>
      api.admin.override(matchId, winnerSide, reason),
    onMutate: () => setError(""),
    onSuccess: invalidateBoard,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Override кезінде қате"),
  });


  // Татами сессия (1 ссылка на весь татами)
  const [tatamiSessionFor, setTatamiSessionFor] = useState<{ tatamiNumber: number } | null>(null);
  const [tatamiSessionResult, setTatamiSessionResult] = useState<{ url: string; copied: boolean } | null>(null);
  const [tatamiJudgeName, setTatamiJudgeName] = useState("");

  const tatamiSessionsQuery = useQuery({
    queryKey: ["admin-tatami-sessions", selectedTournamentId],
    enabled: Boolean(selectedTournamentId),
    queryFn: () => api.tatamiSession.list(selectedTournamentId),
  });

  const createTatamiSession = useMutation({
    mutationFn: ({ tournamentId, tatamiNumber, judgeName }: { tournamentId: string; tatamiNumber: number; judgeName: string }) =>
      api.tatamiSession.create(tournamentId, tatamiNumber, judgeName || undefined),
    onSuccess: (s) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setTatamiSessionResult({
        url: `${origin}/tatami/${s.token}`,
        copied: false,
      });
      qc.invalidateQueries({ queryKey: ["admin-tatami-sessions", selectedTournamentId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Татами сессиясын құру кезінде қате шықты"),
  });

  const revokeTatamiSession = useMutation({
    mutationFn: (sessionId: string) => api.tatamiSession.revoke(sessionId),
    onMutate: () => setError(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tatami-sessions", selectedTournamentId] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Татами сессиясын өшіру кезінде қате шықты"),
  });

  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const tatamiSessions = useMemo(() => tatamiSessionsQuery.data ?? [], [tatamiSessionsQuery.data]);
  const board = useMemo(() => buildTatamiBoard(matches, tatamiCount), [matches, tatamiCount]);
  const unassigned = board.unassigned;
  const completed = matches
    .filter((m: Match) => m.status === "COMPLETED")
    .sort((a: Match, b: Match) => new Date(b.finishedAt ?? 0).getTime() - new Date(a.finishedAt ?? 0).getTime());
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

  const copyTatamiSession = async (session: any) => {
    if (!session?.token || typeof window === "undefined") return;
    await navigator.clipboard.writeText(`${window.location.origin}/tatami/${session.token}`);
    setCopiedTatamiSessionId(session.id);
    window.setTimeout(() => setCopiedTatamiSessionId(null), 1400);
  };

  const isTournamentCompleted = selectedTournament?.status === "COMPLETED";

  return (
    <>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {/* Completed tournament banner */}
      {isTournamentCompleted && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="text-3xl">🏆</div>
          <div>
            <div className="font-display text-lg font-bold text-emerald-300">ЖАРЫС АЯҚТАЛДЫ</div>
            <div className="text-sm text-muted-foreground">
              {localizeName(selectedTournament?.name)} — барлық матчтар аяқталды.{" "}
              <Link to="/admin/tournaments/$id" params={{ id: selectedTournamentId }} className="text-gold hover:underline">
                Нәтижелерді қарау →
              </Link>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-display text-2xl font-bold text-emerald-300">{completed.length}</div>
            <div className="text-xs text-muted-foreground">аяқталған матч</div>
          </div>
        </div>
      )}

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
                    onReset={() => { if (window.confirm("Матчты қайта бастайсыз ба?")) resetMatchMutation.mutate(m.id); }}
                    onOverride={(side) => setOverrideDialog({ matchId: m.id, redName: athleteName(m.redAthlete), blueName: athleteName(m.blueAthlete), side, reason: "" })}
                  />
                ))}
              </div>
            )}
          </DropZone>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {board.tatamis.map((tatami) => {
            const session = tatamiSessions.find((s: any) => Number(s.tatamiNumber) === tatami.number);
            return (
              <DropZone
                key={tatami.number}
                title={`Татами ${tatami.number}`}
                hint={`${tatami.live.length} live · ${tatami.queue.length} кезекте${tatami.pendingResult ? " · нәтиже күтіп тұр" : ""}${session ? ` · судья: ${session.judgeName || "сілтеме дайын"}` : ""}`}
                action={
                  <div className="flex flex-wrap gap-1.5">
                    {session && (
                      <button
                        onClick={() => copyTatamiSession(session)}
                        className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1.5 text-xs text-gold"
                      >
                        {copiedTatamiSessionId === session.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTatamiSessionId === session.id ? "Көшірілді" : "Сілтеме"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setTatamiSessionFor({ tatamiNumber: tatami.number });
                        setTatamiSessionResult(null);
                        setTatamiJudgeName(session?.judgeName || `Татами ${tatami.number}`);
                        setError("");
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {session ? "Жаңарту" : "Құру"}
                    </button>
                    {session ? (
                      <Link
                        to="/tatami/$token"
                        params={{ token: session.token }}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs text-gold hover:bg-gold/15"
                      >
                        <Tv className="h-3.5 w-3.5" />
                        Табло
                      </Link>
                    ) : null}
                  </div>
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
                          onUnassign={() => assignTatami.mutate({ matchId: m.id, tatamiNumber: null })}
                          onMoveUp={() => reorderQueue.mutate({ matchId: m.id, direction: "up" })}
                          onMoveDown={() => reorderQueue.mutate({ matchId: m.id, direction: "down" })}
                          onReset={() => { if (window.confirm("Матчты қайта бастайсыз ба?")) resetMatchMutation.mutate(m.id); }}
                          onOverride={(side) => setOverrideDialog({ matchId: m.id, redName: athleteName(m.redAthlete), blueName: athleteName(m.blueAthlete), side, reason: "" })}
                        />
                      ))}
                    </div>
                  )}

                  {tatami.queue.length === 0 && tatami.live.length === 0 ? (
                    <EmptyState title="Бұл татамиде матч жоқ" hint="Матчты осында сүйреп әкеліңіз" />
                  ) : (() => {
                    // First match visible in judge panel = first with both athletes set
                    const firstReadyIdx = tatami.live.length === 0
                      ? tatami.queue.findIndex((m: Match) => m.redAthleteId && m.blueAthleteId)
                      : -1;
                    return (
                      <div className="space-y-2">
                        {tatami.queue.map((m: Match, index: number) => {
                          const isMissingAthlete = !m.redAthleteId || !m.blueAthleteId;
                          const isJudgeNext = index === firstReadyIdx;
                          return (
                            <div key={m.id}>
                              {isJudgeNext && (
                                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                                  <span>▶</span> Судья панелінде осы
                                </div>
                              )}
                              {isMissingAthlete && (
                                <div className="mb-1 text-[10px] text-amber-500 opacity-70">⚠ Спортшы тағайындалмаған — судья өткізіп жібереді</div>
                              )}
                              <MatchCard
                                match={m}
                                queueIndex={index + 1}
                                onDragStart={() => setDraggedMatchId(m.id)}
                                onDragEnd={() => setDraggedMatchId(null)}
                                onUnassign={() => assignTatami.mutate({ matchId: m.id, tatamiNumber: null })}
                                onReset={() => { if (window.confirm("Матчты қайта бастайсыз ба?")) resetMatchMutation.mutate(m.id); }}
                                onOverride={(side) => setOverrideDialog({ matchId: m.id, redName: athleteName(m.redAthlete), blueName: athleteName(m.blueAthlete), side, reason: "" })}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </DropZone>
            );
          })}
        </div>
      </Panel>

      <div className="mt-6">
        <Panel title={`Аяқталған матчтар тарихы (${completed.length})`}>
          {completed.length === 0 ? (
            <EmptyState title="Әлі аяқталған матч жоқ" />
          ) : (
            <div className="space-y-2">
              {completed.map((m: Match) => {
                const redScore  = m.scoreSnapshot?.red  ?? {};
                const blueScore = m.scoreSnapshot?.blue ?? {};
                const redWon  = m.winnerId === m.redAthlete?.id;
                const blueWon = m.winnerId === m.blueAthlete?.id;
                const finishedAt = m.finishedAt ? new Date(m.finishedAt).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <div key={m.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
                    {/* Header row */}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded bg-muted/60 px-1.5 py-px font-mono">R{m.round}.{m.position}</span>
                        {m.bracket?.category && (
                          <span className="rounded bg-gold/10 px-1.5 py-px text-gold font-medium">{categoryShort(m.bracket.category)}</span>
                        )}
                        {m.bracketSection && <span className="opacity-60">{m.bracketSection}</span>}
                        {finishedAt && <span className="opacity-50">{finishedAt}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Override: change winner */}
                        {m.redAthlete && m.blueAthlete && (
                          <div className="inline-flex overflow-hidden rounded-md border border-sky-500/40">
                            <button
                              onClick={() => setOverrideDialog({ matchId: m.id, redName: athleteName(m.redAthlete), blueName: athleteName(m.blueAthlete), side: "RED", reason: "" })}
                              disabled={m.winnerId === m.redAthlete?.id}
                              className="px-2 py-1 text-xs text-foreground hover:bg-muted/60 disabled:opacity-30"
                              title="АҚ жеңді деп белгілеу"
                            >АҚ</button>
                            <button
                              onClick={() => setOverrideDialog({ matchId: m.id, redName: athleteName(m.redAthlete), blueName: athleteName(m.blueAthlete), side: "BLUE", reason: "" })}
                              disabled={m.winnerId === m.blueAthlete?.id}
                              className="border-l border-sky-500/40 px-2 py-1 text-xs text-sky-400 hover:bg-sky-500/15 disabled:opacity-30"
                              title="КӨК жеңді деп белгілеу"
                            >КӨК</button>
                          </div>
                        )}
                        {/* Reset */}
                        <button
                          onClick={() => {
                            if (window.confirm(`"${athleteName(m.redAthlete)} vs ${athleteName(m.blueAthlete)}" матчын қайта бастайсыз ба? Нәтиже өшіріледі.`)) {
                              resetMatchMutation.mutate(m.id);
                            }
                          }}
                          disabled={resetMatchMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-500 hover:bg-amber-500/20 disabled:opacity-40"
                          title="Матчты қайта бастау — нәтиже өшіріліп, спортшылар алдыңғы орнына оралады"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Қайтару
                        </button>
                      </div>
                    </div>
                    {/* Scores */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-md border p-2 ${redWon ? "border-gold/50 bg-gold/8" : "border-border/50 bg-muted/20"}`}>
                        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          <span>АҚ</span>{redWon && <span className="text-gold">★ Жеңді</span>}
                        </div>
                        <div className="truncate text-sm font-semibold">{athleteName(m.redAthlete)}</div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          I:{redScore.ippon ?? 0} W:{redScore.wazaari ?? 0} Y:{redScore.yuko ?? 0} S:{redScore.shido ?? 0}
                        </div>
                      </div>
                      <div className={`rounded-md border p-2 ${blueWon ? "border-sky-500/50 bg-sky-500/8" : "border-border/50 bg-muted/20"}`}>
                        <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                          <span>КӨК</span>{blueWon && <span className="text-sky-400">★ Жеңді</span>}
                        </div>
                        <div className="truncate text-sm font-semibold">{athleteName(m.blueAthlete)}</div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          I:{blueScore.ippon ?? 0} W:{blueScore.wazaari ?? 0} Y:{blueScore.yuko ?? 0} S:{blueScore.shido ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Татами сессиясы модалы */}
      {/* Override диалогы — жеңімпазды өзгерту */}
      {overrideDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => setOverrideDialog(null)}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display text-lg font-bold">Нәтижені өзгерту</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Жеңімпаз: <b className={overrideDialog.side === "RED" ? "text-foreground" : "text-sky-400"}>
                {overrideDialog.side === "RED" ? overrideDialog.redName : overrideDialog.blueName}
              </b>
            </p>
            <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-widest">Себебі *</div>
            <textarea
              autoFocus
              value={overrideDialog.reason}
              onChange={(e) => setOverrideDialog({ ...overrideDialog, reason: e.target.value })}
              placeholder="Мысалы: судья қатесі, видео қайта қарау..."
              rows={3}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold resize-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setOverrideDialog(null)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted/60"
              >Болдырмау</button>
              <button
                disabled={overrideDialog.reason.trim().length < 3 || overrideMatch.isPending}
                onClick={() => {
                  if (!overrideDialog.side) return;
                  overrideMatch.mutate(
                    { matchId: overrideDialog.matchId, winnerSide: overrideDialog.side, reason: overrideDialog.reason.trim() },
                    { onSuccess: () => setOverrideDialog(null) },
                  );
                }}
                className="flex-1 rounded-lg bg-sky-500/20 py-2 text-sm font-semibold text-sky-400 hover:bg-sky-500/30 disabled:opacity-40"
              >
                {overrideMatch.isPending ? "Сақталуда..." : "Растау"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tatamiSessionFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => setTatamiSessionFor(null)}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">Татами #{tatamiSessionFor.tatamiNumber} — Табло және басқару</h3>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              Бір сілтеме — бүкіл күн. Осы жерде табло да, басқару батырмалары да бірге ашылады.
            </p>

            {tatamiSessionResult ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Табло және басқару сілтемесі</label>
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={tatamiSessionResult.url} className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 font-mono text-xs" />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tatamiSessionResult.url);
                        setTatamiSessionResult({ ...tatamiSessionResult, copied: true });
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/15 px-3 py-2 text-xs text-gold"
                    >
                      {tatamiSessionResult.copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {tatamiSessionResult.copied ? "Көшірілді" : "Көшіру"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    window.open(tatamiSessionResult.url, "_blank", "noopener,noreferrer");
                    setTatamiSessionFor(null);
                  }}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-gold py-2 font-medium text-gold-foreground shadow-gold"
                >
                  <ExternalLink className="h-4 w-4" />
                  Таблоны ашу
                </button>
              </div>
            ) : (
              <>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Төреші аты (міндетті емес)</label>
                <input
                  value={tatamiJudgeName}
                  onChange={(e: any) => setTatamiJudgeName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="Мысалы Берік Сериков"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setTatamiSessionFor(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/60">
                    Болдырмау
                  </button>
                  {tatamiSessions.find((s: any) => Number(s.tatamiNumber) === tatamiSessionFor.tatamiNumber) && (
                    <button
                      onClick={() => {
                        const session = tatamiSessions.find((s: any) => Number(s.tatamiNumber) === tatamiSessionFor.tatamiNumber);
                        if (session) revokeTatamiSession.mutate(session.id);
                        setTatamiSessionFor(null);
                      }}
                      disabled={revokeTatamiSession.isPending}
                      className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive hover:bg-destructive/15 disabled:opacity-50"
                    >
                      Өшіру
                    </button>
                  )}
                  <button
                    onClick={() => createTatamiSession.mutate({
                      tournamentId: selectedTournamentId,
                      tatamiNumber: tatamiSessionFor.tatamiNumber,
                      judgeName: tatamiJudgeName,
                    })}
                    disabled={createTatamiSession.isPending || !selectedTournamentId}
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
  onUnassign,
  onMoveUp,
  onMoveDown,
  onReset,
  onOverride,
}: {
  match: Match;
  live?: boolean;
  compact?: boolean;
  queueIndex?: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onUnassign?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onReset?: () => void;
  onOverride?: (winnerSide: "RED" | "BLUE") => void;
}) {
  const catName = match.bracket?.category
    ? categoryShort(match.bracket.category)
    : "";
  const isDone = match.status === "COMPLETED";
  const pendingResult = match.scoreSnapshot?.pendingResult;

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", match.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-background/70 p-3 shadow-sm transition hover:border-gold/50 ${
        pendingResult ? "border-amber-400/70 bg-amber-400/10" : live ? "border-gold/60 bg-gold/5" : isDone ? "border-green-500/30" : "border-border/70"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              {queueIndex ? <span>#{queueIndex}</span> : null}
              <span>R{match.round}.{match.position}</span>
              {catName && (
                <span className="normal-case tracking-normal rounded bg-gold/10 px-1.5 py-px text-[10px] text-gold font-medium">
                  {catName}
                </span>
              )}
            </div>
            <div className="truncate text-sm font-medium">{athleteName(match.redAthlete)} vs {athleteName(match.blueAthlete)}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
          pendingResult ? "bg-amber-400/15 text-amber-500" :
          live ? "bg-gold/15 text-gold" :
          isDone ? "bg-green-500/15 text-green-500" :
          "bg-muted text-muted-foreground"
        }`}>
          {pendingResult ? "Бекіту керек" : statusLabel(match.status)}
        </span>
      </div>

      {pendingResult && (
        <div className="mb-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-600">
          Жеңімпаз: <b>{pendingResult.winnerSide === "RED" ? athleteName(match.redAthlete) : athleteName(match.blueAthlete)}</b>
          <span className="text-muted-foreground"> · {pendingResult.reason}</span>
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-2 gap-2">
          <ScoreSide side="RED" athlete={match.redAthlete} score={match.scoreSnapshot?.red} isWinner={isDone && match.winnerId === match.redAthlete?.id} />
          <ScoreSide side="BLUE" athlete={match.blueAthlete} score={match.scoreSnapshot?.blue} isWinner={isDone && match.winnerId === match.blueAthlete?.id} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {(onMoveUp || onMoveDown) && match.status === "PENDING" && (
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="px-2 py-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
              title="Кезекте жоғары"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="border-l border-border px-2 py-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
              title="Кезекте төмен"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {pendingResult && (
          <div className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-600">
            Судья бекітуін күтуде
          </div>
        )}
        {onReset && (match.status === "IN_PROGRESS" || isDone) && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-500"
            title="Матчты қайта бастау (барлығын тазалау)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Қайта
          </button>
        )}
        {onOverride && isDone && match.redAthlete && match.blueAthlete && (
          <div className="inline-flex overflow-hidden rounded-md border border-sky-500/40">
            <button
              onClick={() => onOverride("RED")}
              disabled={match.winnerId === match.redAthlete?.id}
              className="px-2 py-1.5 text-xs text-foreground hover:bg-muted/60 disabled:opacity-30"
              title={`АҚ: ${athleteName(match.redAthlete)} жеңді деп белгілеу`}
            >
              АҚ
            </button>
            <button
              onClick={() => onOverride("BLUE")}
              disabled={match.winnerId === match.blueAthlete?.id}
              className="border-l border-sky-500/40 px-2 py-1.5 text-xs text-sky-400 hover:bg-sky-500/15 disabled:opacity-30"
              title={`КӨК: ${athleteName(match.blueAthlete)} жеңді деп белгілеу`}
            >
              КӨК
            </button>
          </div>
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

function categoryShort(cat: any): string {
  if (!cat) return "";
  const g = cat.gender === "MALE" ? "Ер" : cat.gender === "FEMALE" ? "Қыз" : "";
  const w = cat.weightMax >= 200 ? `+${cat.weightMin}` : `-${cat.weightMax}`;
  return `${g} ${w}кг`.trim();
}

function ScoreSide({ side, athlete, score, isWinner }: { side: "RED" | "BLUE"; athlete: any; score: any; isWinner?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${
      isWinner
        ? "border-gold/50 bg-gold/10"
        : side === "RED" ? "border-gray-400/30 bg-gray-500/10" : "border-sky-400/30 bg-sky-500/10"
    }`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {side === "RED" ? "АҚ" : "КӨК"}
        {isWinner && <span className="ml-1 text-gold">★</span>}
      </div>
      <div className="truncate text-sm font-medium">{athleteName(athlete)}</div>
      <div className="mt-1 text-xs">I:{score?.ippon ?? 0} W:{score?.wazaari ?? 0} Y:{score?.yuko ?? 0} S:{score?.shido ?? 0}</div>
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
  const unassigned = playable.filter((m) => !m.tatamiNumber).sort(matchOrder);
  const tatamis = buildTatamiState(playable, tatamiCount).map((tatami) => ({
    ...tatami,
    live: tatami.current ? [tatami.current] : [],
  }));
  return { unassigned, tatamis };
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
