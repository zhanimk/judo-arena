import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, MonitorPlay } from "lucide-react";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/socket";

type Match = any;

export const Route = createFileRoute("/live-wall/$tournamentId")({
  head: () => ({ meta: [{ title: "Live Wall — Judo-Arena" }] }),
  component: LiveWall,
});

function LiveWall() {
  const { tournamentId } = Route.useParams();
  const qc = useQueryClient();

  const tournamentQuery = useQuery({
    queryKey: ["live-wall-tournament", tournamentId],
    queryFn: () => api.tournaments.get(tournamentId),
  });

  const matchesQuery = useQuery({
    queryKey: ["live-wall-matches", tournamentId],
    queryFn: () => api.matches.list({ tournamentId, limit: 500 }),
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
  });

  const tournament = tournamentQuery.data;
  const matches = matchesQuery.data ?? [];
  const tatamiCount = Math.max(3, Number(tournament?.tatamiCount ?? 3));
  const tatamis = useMemo(() => buildTatamis(matches, tatamiCount), [matches, tatamiCount]);

  const openFullscreen = () => {
    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <main className="min-h-screen bg-[#05070f] text-white">
      <header className="border-b border-white/10 bg-[#071026] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-gold">
              <MonitorPlay className="h-4 w-4" />
              Live табло
            </div>
            <h1 className="truncate font-display text-2xl font-bold md:text-4xl">
              {localizeName(tournament?.name) ?? "Жарыс"}
            </h1>
          </div>
          <button
            onClick={openFullscreen}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            <Maximize2 className="h-4 w-4" />
            Толық экран
          </button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-96px)] gap-4 p-4 lg:grid-cols-3">
        {tatamis.map((tatami) => (
          <TatamiWall key={tatami.number} tatami={tatami} />
        ))}
      </section>
    </main>
  );
}

function TatamiWall({ tatami }: { tatami: { number: number; current: Match | null; queue: Match[]; completed: Match[] } }) {
  const current = tatami.current;
  return (
    <section className="flex min-h-[560px] flex-col rounded-lg border border-white/10 bg-[#0a1228]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Tatami</div>
          <h2 className="font-display text-4xl font-bold text-gold">{tatami.number}</h2>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-semibold ${current ? "bg-red-500/20 text-red-200" : "bg-white/10 text-white/60"}`}>
          {current ? "LIVE" : "Күтуде"}
        </div>
      </div>

      <div className="flex-1 p-5">
        {current ? (
          <div className="rounded-lg border border-red-400/35 bg-red-500/10 p-5">
            <div className="mb-4 flex items-center justify-between text-sm text-white/55">
              <span>R{current.round}.{current.position}</span>
              <span>{current.scoreSnapshot?.isGoldenScore ? "Golden Score" : "Негізгі уақыт"}</span>
            </div>
            <div className="grid gap-4">
              <BigSide color="red" athlete={current.redAthlete} score={current.scoreSnapshot?.red} />
              <BigSide color="blue" athlete={current.blueAthlete} score={current.scoreSnapshot?.blue} />
            </div>
          </div>
        ) : (
          <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-center">
            <div>
              <div className="font-display text-2xl font-semibold text-white/70">Матч жоқ</div>
              <div className="mt-1 text-sm text-white/40">Келесі матч админ панелінен қойылады</div>
            </div>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-[0.22em] text-white/45">Келесі</div>
          <div className="space-y-2">
            {tatami.queue.slice(0, 4).map((m, index) => (
              <div key={m.id} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gold/20 text-sm font-bold text-gold">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{athleteName(m.redAthlete)} vs {athleteName(m.blueAthlete)}</div>
                  <div className="text-xs text-white/45">R{m.round}.{m.position}</div>
                </div>
              </div>
            ))}
            {tatami.queue.length === 0 && <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-white/45">Кезек бос</div>}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs uppercase tracking-[0.22em] text-white/45">Соңғы нәтиже</div>
        {tatami.completed[0] ? (
          <div className="truncate text-sm text-white/70">
            {athleteName(tatami.completed[0].redAthlete)} vs {athleteName(tatami.completed[0].blueAthlete)}
          </div>
        ) : (
          <div className="text-sm text-white/35">Әзірге жоқ</div>
        )}
      </div>
    </section>
  );
}

function BigSide({ color, athlete, score }: { color: "red" | "blue"; athlete: any; score: any }) {
  const colorClass = color === "red" ? "border-red-400/40 bg-red-500/15" : "border-blue-400/40 bg-blue-500/15";
  const label = color === "red" ? "Қызыл" : "Көк";
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="text-xs uppercase tracking-[0.22em] text-white/50">{label}</div>
      <div className="mt-1 truncate font-display text-3xl font-bold">{athleteName(athlete)}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <ScoreBox label="I" value={score?.ippon ?? 0} />
        <ScoreBox label="W" value={score?.wazaari ?? 0} />
        <ScoreBox label="S" value={score?.shido ?? 0} />
      </div>
    </div>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-black/25 p-2">
      <div className="text-xs text-white/45">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

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
  return (a.round ?? 0) - (b.round ?? 0) || (a.position ?? 0) - (b.position ?? 0);
}

function athleteName(athlete: any) {
  if (!athlete) return "TBD";
  return [athlete.name, athlete.surname].filter(Boolean).join(" ") || "TBD";
}

function localizeName(value: any) {
  if (!value) return "Жарыс";
  if (typeof value === "string") return value;
  return value.kk ?? value.ru ?? value.en ?? Object.values(value)[0] ?? "Жарыс";
}
