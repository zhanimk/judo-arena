import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  EmptyState,
  LoadingState,
  Panel,
  StatCard,
} from "@/components/dashboard/DashboardShell";
import { Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category, MatchSideScore } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useRealtime } from "@/lib/socket";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/athlete/matches/$id")({
  head: () => ({ meta: [{ title: "Жекпе-жек — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <AthleteMatchDetails />
    </ProtectedRoute>
  ),
});

function AthleteMatchDetails() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const athleteId = user?.id ?? "";
  const qc = useQueryClient();

  const matchQuery = useQuery({
    queryKey: ["athlete-match", id],
    queryFn: () => api.matches.get(id),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "IN_PROGRESS" ? 10_000 : false),
  });

  const match = matchQuery.data;
  const tournamentId = match?.tournament?.id;
  const isLive = match?.status === "IN_PROGRESS";

  useRealtime(tournamentId ? [`tournament:${tournamentId}`] : [], {
    "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
    "match:finished": () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
    "match:started": () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
    "match:pendingResult": () => qc.invalidateQueries({ queryKey: ["athlete-match", id] }),
  });

  const isMyMatch =
    !!match && (match.redAthlete?.id === athleteId || match.blueAthlete?.id === athleteId);
  const mySide =
    match?.redAthlete?.id === athleteId
      ? "red"
      : match?.blueAthlete?.id === athleteId
        ? "blue"
        : null;
  const opponent =
    mySide === "red" ? match?.blueAthlete : mySide === "blue" ? match?.redAthlete : null;
  const won = match?.winnerId === athleteId;
  const completed = match?.status === "COMPLETED";
  const myScore = mySide ? match?.scoreSnapshot?.[mySide] : null;
  const opponentScore =
    mySide === "red"
      ? match?.scoreSnapshot?.blue
      : mySide === "blue"
        ? match?.scoreSnapshot?.red
        : null;

  return (
    <DashboardShell
      role={t("roles.ATHLETE")}
      navItems={nav}
      accentTitle={t("matches.match_detail")}
    >
      <div className="mb-4">
        <Link to="/athlete/matches" className="text-sm text-muted-foreground hover:text-gold">
          ← {t("matches.back_to_list")}
        </Link>
      </div>

      {isLive && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-400/40 bg-blue-400/5 px-4 py-2.5 text-sm text-blue-300">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          {t("matches.live_hint")}
        </div>
      )}

      {matchQuery.isLoading ? (
        <LoadingState />
      ) : !match ? (
        <EmptyState title={t("matches.not_found")} hint={t("matches.not_found_hint")} />
      ) : !isMyMatch ? (
        <EmptyState title={t("matches.not_my_match")} hint={t("matches.not_my_match_hint")} />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("matches.result")}
              value={
                completed
                  ? won
                    ? t("matches.win")
                    : t("matches.loss")
                  : String(t(`status.${match.status}`, match.status))
              }
              hint={
                match.tatamiNumber
                  ? `${t("common.tatami")} ${match.tatamiNumber}`
                  : t("matches.no_tatami")
              }
              accent={won}
            />
            <StatCard
              label={t("matches.round")}
              value={String(match.round)}
              hint={sectionLabel(match.bracketSection, t)}
            />
            <StatCard
              label={t("matches.opponent")}
              value={opponent ? `${opponent.name} ${opponent.surname}` : "TBD"}
              hint={opponent ? t("matches.opponent_ready") : t("matches.opponent_tbd")}
            />
            <StatCard
              label={t("common.tournament")}
              value={localizeName(match.tournament?.name)}
              hint={match.tournament?.status ?? "—"}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title={t("matches.match_card")}>
              <div className="grid gap-3 text-sm">
                <Info
                  label={t("common.category")}
                  value={categoryTitle(match.bracket?.category, t)}
                />
                <Info label={t("common.format")} value={match.bracket?.format ?? "—"} />
                <Info label={t("matches.started_at")} value={formatDateTime(match.startedAt)} />
                <Info label={t("matches.finished_at")} value={formatDateTime(match.finishedAt)} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <ScoreBox title={t("matches.me")} score={myScore} active />
                <ScoreBox title={t("matches.opponent")} score={opponentScore} />
              </div>
            </Panel>

            <Panel title={`${t("matches.events")}: ${match.events?.length ?? 0}`}>
              {(match.events ?? []).length === 0 ? (
                <EmptyState title={t("matches.no_events")} hint={t("matches.no_events_hint")} />
              ) : (
                <ol className="space-y-2 text-sm">
                  {(match.events ?? []).map((event) => (
                    <li
                      key={event.id}
                      className="glass flex items-center justify-between gap-3 rounded-md p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{eventLabel(event.type, event.side, t)}</div>
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

function ScoreBox({
  title,
  score,
  active = false,
}: {
  title: string;
  score: MatchSideScore | null | undefined;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${active ? "border-gold/40 bg-gold/10" : "border-border/50 bg-muted/20"}`}
    >
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

function categoryTitle(category: Category | null | undefined, t: (key: string) => string): string {
  if (!category) return t("common.category");
  const gender =
    category.gender === "MALE" ? t("rankings.filter_male") : t("rankings.filter_female");
  return `${gender} ${category.ageMin}-${category.ageMax}, ${category.weightMin}-${category.weightMax} кг`;
}

function localizeName(
  value: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "—";
}

function sectionLabel(section: string | null | undefined, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    main: t("bracket.section_main"),
    repechage: t("bracket.section_repechage"),
    bronze1: t("bracket.section_bronze1"),
    bronze2: t("bracket.section_bronze2"),
    final: t("bracket.section_final"),
  };
  return section ? (labels[section] ?? section) : t("bracket.section_main");
}

function eventLabel(
  type: string,
  side: string | null | undefined,
  t: (key: string) => string,
): string {
  // Proper nouns (Hajime, Ippon, etc.) are NOT translated
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
    REPLAY: t("matches.event_replay"),
    END: t("matches.event_end"),
  };
  const sideLabel =
    side === "RED" ? t("matches.side_red") : side === "BLUE" ? t("matches.side_blue") : "";
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
