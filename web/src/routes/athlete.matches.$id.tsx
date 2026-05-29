import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, EmptyState, LoadingState, Panel, StatCard } from "@/components/dashboard/DashboardShell";
import { Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useRealtime } from "@/lib/socket";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";

export const Route = createFileRoute("/athlete/matches/$id")({
  head: () => ({ meta: [{ title: "Жекпе-жек — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteMatchDetails />
    </ProtectedRoute>
  ),
});

function AthleteMatchDetails() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const athleteId = user?.id ?? "";
  const qc = useQueryClient();

  const matchQuery = useQuery({
    queryKey: ["athlete-match", id],
    queryFn: () => api.matches.get(id),
    enabled: !!id,
    // 10 s fallback poll when socket is unavailable during live match
    refetchInterval: (q) => (q.state.data?.status === "IN_PROGRESS" ? 10_000 : false),
  });

  const match = matchQuery.data;
  const tournamentId = match?.tournament?.id;
  const isLive = match?.status === "IN_PROGRESS";

  // Socket.IO: instant updates during live match
  useRealtime(
    tournamentId ? [`tournament:${tournamentId}`] : [],
    {
      "match:scoreUpdate":   () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
      "match:finished":      () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
      "match:started":       () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
      "match:pendingResult": () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
    },
  );

  const isMyMatch = !!match && (match.redAthlete?.id === athleteId || match.blueAthlete?.id === athleteId);
  const mySide = match?.redAthlete?.id === athleteId ? "red" : match?.blueAthlete?.id === athleteId ? "blue" : null;
  const opponent = mySide === "red" ? match?.blueAthlete : mySide === "blue" ? match?.redAthlete : null;
  const won = match?.winnerId === athleteId;
  const completed = match?.status === "COMPLETED";
  const myScore = mySide ? match?.scoreSnapshot?.[mySide] : null;
  const opponentScore = mySide === "red" ? match?.scoreSnapshot?.blue : mySide === "blue" ? match?.scoreSnapshot?.red : null;

  return (
    <DashboardShell role="Спортшы" navItems={nav} accentTitle="Жекпе-жек">
      <div className="mb-4">
        <Link to="/athlete/matches" className="text-sm text-muted-foreground hover:text-gold">
          ← Жекпе-жектер тізіміне қайту
        </Link>
      </div>

      {/* Live badge */}
      {isLive && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-400/40 bg-blue-400/5 px-4 py-2.5 text-sm text-blue-300">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          Матч қазір жүруде — нәтиже нақты уақытта жаңарып тұрады
        </div>
      )}

      {matchQuery.isLoading ? (
        <LoadingState />
      ) : !match ? (
        <EmptyState title="Матч табылмады" hint="Бұл жекпе-жек жүйеде жоқ немесе жойылған." />
      ) : !isMyMatch ? (
        <EmptyState title="Бұл сіздің матчыңыз емес" hint="Өз жекпе-жектеріңіз нәтижелер бөлімінде көрінеді." />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Нәтиже" value={completed ? (won ? "Жеңіс" : "Жеңіліс") : statusLabel(match.status)} hint={match.tatamiNumber ? `Татами ${match.tatamiNumber}` : "татами белгіленбеген"} accent={won} />
            <StatCard label="Раунд" value={String(match.round)} hint={sectionLabel(match.bracketSection)} />
            <StatCard label="Қарсылас" value={opponent ? `${opponent.name} ${opponent.surname}` : "TBD"} hint={opponent ? "дайын" : "әлі анықталмаған"} />
            <StatCard label="Турнир" value={localizeName(match.tournament?.name)} hint={match.tournament?.status ?? "—"} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Матч картасы">
              <div className="grid gap-3 text-sm">
                <Info label="Санат" value={categoryTitle(match.bracket?.category)} />
                <Info label="Формат" value={match.bracket?.format ?? "—"} />
                <Info label="Басталды" value={formatDateTime(match.startedAt)} />
                <Info label="Аяқталды" value={formatDateTime(match.finishedAt)} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <ScoreBox title="Мен" score={myScore} active />
                <ScoreBox title="Қарсылас" score={opponentScore} />
              </div>
            </Panel>

            <Panel title={`Оқиғалар: ${match.events?.length ?? 0}`}>
              {(match.events ?? []).length === 0 ? (
                <EmptyState title="Оқиғалар жоқ" hint="Судья матчты жүргізген кезде оқиғалар осында түседі." />
              ) : (
                <ol className="space-y-2 text-sm">
                  {(match.events ?? []).map((event: any) => (
                    <li key={event.id} className="glass flex items-center justify-between gap-3 rounded-md p-3">
                      <div className="min-w-0">
                        <div className="font-medium">{eventLabel(event.type, event.side)}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateTime(event.occurredAt)}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md border border-border/50 px-2 py-1 text-xs text-muted-foreground">
                        {event.side ?? "SYSTEM"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function ScoreBox({ title, score, active = false }: { title: string; score: any; active?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${active ? "border-gold/40 bg-gold/10" : "border-border/50 bg-muted/20"}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
        <ScoreValue label="Ippon" value={score?.ippon ?? 0} />
        <ScoreValue label="Waza" value={score?.wazaari ?? 0} />
        <ScoreValue label="Yuko" value={score?.yuko ?? 0} />
        <ScoreValue label="Shido" value={score?.shido ?? 0} />
      </div>
    </div>
  );
}

function ScoreValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-2">
      <div className="font-display text-lg text-gold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/30 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function categoryTitle(category: any): string {
  if (!category) return "Санат";
  const gender = category.gender === "MALE" ? "Ер" : "Әйел";
  return `${gender} ${category.ageMin}-${category.ageMax}, ${category.weightMin}-${category.weightMax} кг`;
}

function localizeName(value: any): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "—";
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Күтуде",
    IN_PROGRESS: "LIVE",
    COMPLETED: "Аяқталды",
    CANCELLED: "Болмады",
  };
  return labels[status] ?? status;
}

function sectionLabel(section?: string | null): string {
  const labels: Record<string, string> = {
    main: "негізгі сетка",
    repechage: "жұбату",
    bronze1: "қола 1",
    bronze2: "қола 2",
    final: "финал",
  };
  return section ? labels[section] ?? section : "негізгі";
}

function eventLabel(type: string, side?: string | null): string {
  const labels: Record<string, string> = {
    HAJIME: "Hajime",
    MATE: "Mate",
    SORE_MADE: "Sore made",
    IPPON: "Ippon",
    WAZA_ARI: "Waza-ari",
    YUKO: "Yuko",
    SHIDO: "Shido",
    HANSOKU_MAKE: "Hansoku-make",
    GOLDEN_SCORE: "Golden Score",
    REPLAY: "Видео-қайталау",
    END: "Аяқталды",
  };
  const sideLabel = side === "RED" ? "қызыл" : side === "BLUE" ? "көк" : "";
  return `${labels[type] ?? type}${sideLabel ? ` · ${sideLabel}` : ""}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("kk-KZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
