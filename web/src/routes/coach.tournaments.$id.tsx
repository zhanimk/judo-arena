import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  ClipboardList,
  Download,
  GitBranch,
  LayoutDashboard,
  Loader2,
  MapPin,
  Plus,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardShell, EmptyState, LoadingState, Panel } from "@/components/dashboard/DashboardShell";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс санаттары — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachTournamentDetail />
    </ProtectedRoute>
  ),
});

const nav = [
  { to: "/coach", label: "Шолу", icon: LayoutDashboard },
  { to: "/coach/club", label: "Клуб", icon: Building2 },
  { to: "/coach/athletes", label: "Спортшылар", icon: Users },
  { to: "/coach/applications", label: "Өтінімдер", icon: ClipboardList },
  { to: "/coach/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/coach/notifications", label: "Хабарландырулар", icon: Bell },
];

type GroupFilter = "ALL" | "MALE" | "FEMALE";

function CoachTournamentDetail() {
  const { id } = useParams({ from: "/coach/tournaments/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<GroupFilter>("ALL");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [error, setError] = useState("");

  const tQuery = useQuery({ queryKey: ["coach-tournament", id], queryFn: () => api.tournaments.get(id) });
  const appsQuery = useQuery({
    queryKey: ["coach-tournament-application", id],
    queryFn: () => api.tournaments.applications(id),
  });
  const membersQuery = useQuery({
    queryKey: ["club-members", user?.clubId],
    queryFn: () => (user?.clubId ? api.clubs.members(user.clubId) : []),
    enabled: !!user?.clubId,
  });
  const bracketsQuery = useQuery({
    queryKey: ["coach-tournament-brackets", id],
    queryFn: () => api.brackets.forTournament(id),
  });
  const matchesQuery = useQuery({
    queryKey: ["coach-tournament-matches", id],
    queryFn: () => api.matches.list({ tournamentId: id }),
  });

  const createApplication = useMutation({
    mutationFn: () => api.tournaments.createApplication(id),
    onSuccess: (app) => {
      setError("");
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
      navigate({ to: "/coach/applications/$id", params: { id: app.id } });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Өтінім ашылмады"),
  });

  const addEntry = useMutation({
    mutationFn: async ({ athleteId, categoryId }: { athleteId: string; categoryId: string }) => {
      const app = ownApplication ?? await api.tournaments.createApplication(id);
      return api.applications.addEntry(app.id, athleteId, categoryId);
    },
    onMutate: ({ athleteId, categoryId }) => {
      setAdding(`${athleteId}:${categoryId}`);
      setError("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Спортшы қосылмады"),
    onSettled: () => setAdding(null),
  });
  const addEligible = useMutation({
    mutationFn: async ({ athletes, categoryId }: { athletes: any[]; categoryId: string }) => {
      const app = ownApplication ?? await api.tournaments.createApplication(id);
      for (const athlete of athletes) {
        await api.applications.addEntry(app.id, athlete.id, categoryId);
      }
      return app;
    },
    onMutate: ({ categoryId }) => {
      setAdding(`all:${categoryId}`);
      setError("");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Спортшылар қосылмады"),
    onSettled: () => setAdding(null),
  });
  const submitApplication = useMutation({
    mutationFn: () => {
      if (!ownApplication) throw new Error("NO_APPLICATION");
      return api.applications.submit(ownApplication.id);
    },
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["coach-tournament-application", id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Өтінім жіберілмеді"),
  });

  const ownApplication = appsQuery.data?.[0] ?? null;
  const entries = ownApplication?.entries ?? [];
  const enteredByCategory = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const entry of entries) {
      const list = map.get(entry.categoryId) ?? [];
      list.push(entry);
      map.set(entry.categoryId, list);
    }
    return map;
  }, [entries]);

  if (tQuery.isLoading) {
    return (
      <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Жарыс">
        <LoadingState />
      </DashboardShell>
    );
  }

  const tournament = tQuery.data;
  if (!tournament) {
    return (
      <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Жарыс табылмады">
        <EmptyState title="Жарыс жоқ" />
      </DashboardShell>
    );
  }

  const categories = (tournament.categories ?? []).filter((category: any) => filter === "ALL" || category.gender === filter);
  const deadline = tournament.applicationDeadline ?? tournament.startDate;
  const deadlinePassed = new Date(deadline).getTime() < Date.now();
  const myAthleteIds = new Set((membersQuery.data ?? []).map((athlete: any) => athlete.id));
  const clubMatches = (matchesQuery.data ?? []).filter((match: any) =>
    (match.redAthlete?.id && myAthleteIds.has(match.redAthlete.id)) ||
    (match.blueAthlete?.id && myAthleteIds.has(match.blueAthlete.id)),
  );

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle={localizeName(tournament.name)}>
      <Link to="/coach/tournaments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Барлық жарыстар
      </Link>

      {error && <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="mb-6 glass rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusBadge status={tournament.status} />
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <Info icon={Calendar}>{dateRange(tournament.startDate, tournament.endDate)}</Info>
              <Info icon={Calendar}>Дедлайн: {new Date(deadline).toLocaleString("kk-KZ")}</Info>
              <Info icon={MapPin}>{tournament.location}, {tournament.city}</Info>
              <Info icon={Clock}>{formatWeighIn(tournament)}</Info>
              <Info icon={Users}>{entries.length} менің спортшым</Info>
              <Info icon={GitBranch}>{bracketsQuery.data?.length ?? 0} сетка</Info>
            </div>
            {tournament.posterUrl && (
              <a
                href={tournament.posterUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
              >
                <ClipboardList className="h-4 w-4" />
                Турнир положение / фото
              </a>
            )}
            {tournament.mapUrl && (
              <a
                href={tournament.mapUrl}
                target="_blank"
                rel="noopener"
                className="ml-2 mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm hover:border-gold/40"
              >
                <MapPin className="h-4 w-4" />
                Карта
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ownApplication ? (
              <Link
                to="/coach/applications/$id"
                params={{ id: ownApplication.id }}
                className="inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
              >
                <ClipboardList className="h-4 w-4" /> Өтінімді ашу
              </Link>
            ) : tournament.status === "REGISTRATION_OPEN" && !deadlinePassed ? (
              <button
                onClick={() => createApplication.mutate()}
                disabled={createApplication.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm text-gold-foreground shadow-gold disabled:opacity-60"
              >
                {createApplication.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Өтінім ашу
              </button>
            ) : tournament.status === "REGISTRATION_OPEN" && deadlinePassed ? (
              <span className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">Өтінім дедлайны өтті</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Турнир туралы толық ақпарат">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Info icon={Calendar}>{dateRange(tournament.startDate, tournament.endDate)}</Info>
            <Info icon={Calendar}>Өтінім дедлайны: {new Date(deadline).toLocaleString("kk-KZ")}</Info>
            <Info icon={MapPin}>{tournament.location}, {tournament.city}</Info>
            <Info icon={Clock}>{formatWeighIn(tournament)}</Info>
          </div>
          {localizeName(tournament.description) && (
            <p className="mt-4 border-t border-border/30 pt-4 text-sm leading-relaxed text-muted-foreground">
              {localizeName(tournament.description)}
            </p>
          )}
        </Panel>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <iframe
            title="Tournament map"
            src={mapEmbedUrl(tournament)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MiniStat label="Санаттар" value={tournament.categories?.length ?? 0} />
        <MiniStat label="Ер балалар" value={(tournament.categories ?? []).filter((c: any) => c.gender === "MALE").length} />
        <MiniStat label="Қыздар" value={(tournament.categories ?? []).filter((c: any) => c.gender === "FEMALE").length} />
        <MiniStat label="Матчтар" value={clubMatches.length} />
      </div>

      <Panel
        title="Санаттар және подгруппалар"
        action={
          <div className="flex gap-2">
            {(["ALL", "MALE", "FEMALE"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  filter === value ? "border-gold/50 bg-gold/15 text-gold" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "ALL" ? "Бәрі" : value === "MALE" ? "Ер" : "Қыз"}
              </button>
            ))}
          </div>
        }
      >
        {categories.length === 0 ? (
          <EmptyState title="Санаттар жоқ" />
        ) : (
          <div className="space-y-4">
            {categories.map((category: any) => {
              const bracket = bracketsQuery.data?.find((b: any) => b.categoryId === category.id);
              const categoryEntries = enteredByCategory.get(category.id) ?? [];
              const eligible = (membersQuery.data ?? []).filter((athlete: any) => fitsCategory(athlete, category));
              const ineligiblePreview = (membersQuery.data ?? []).filter((athlete: any) => !fitsCategory(athlete, category)).slice(0, 4);
              const enteredIds = new Set(categoryEntries.map((entry: any) => entry.athleteId));
              const eligibleToAdd = eligible.filter((athlete: any) => !enteredIds.has(athlete.id));
              const categoryMatches = clubMatches.filter((match: any) => match.bracket?.categoryId === category.id);
              const isOpenDraft = tournament.status === "REGISTRATION_OPEN" && !deadlinePassed && (!ownApplication || ownApplication.status === "DRAFT");

              return (
                <div key={category.id} className="rounded-xl border border-border/60 bg-background/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-lg font-semibold">{categoryTitle(category)}</div>
                        <FormatBadge format={category.format} />
                        {bracket && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">Сетка дайын</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {category.gender === "MALE" ? "Ер" : "Қыз"} · {category.ageMin}-{category.ageMax} жас · ({category.weightMin}, {category.weightMax}] кг · {category.matchDurationSec}с
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bracket && (
                        <>
                          <button
                            onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
                          >
                            <GitBranch className="h-3.5 w-3.5" /> {selectedCategoryId === category.id ? "Жабу" : "Сетка"}
                          </button>
                          <a
                            href={api.admin.bracketPdfUrl(bracket.id)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-gold"
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Менің спортшыларым</div>
                      {isOpenDraft && eligibleToAdd.length > 1 && (
                        <button
                          type="button"
                          onClick={() => addEligible.mutate({ athletes: eligibleToAdd, categoryId: category.id })}
                          disabled={!!adding}
                          className="mb-3 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold hover:bg-gold/15 disabled:opacity-50"
                        >
                          {adding === `all:${category.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Барлық сай спортшыларды қосу ({eligibleToAdd.length})
                        </button>
                      )}
                      {eligible.length === 0 ? (
                        <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                          <div>Бұл категорияға сай спортшы жоқ.</div>
                          {ineligiblePreview.length > 0 && (
                            <div className="mt-3 space-y-1 text-xs">
                              {ineligiblePreview.map((athlete: any) => (
                                <div key={athlete.id}>
                                  {athlete.name} {athlete.surname}: {categoryMismatchReason(athlete, category)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {eligible.map((athlete: any) => {
                            const alreadyIn = enteredIds.has(athlete.id);
                            const isAdding = adding === `${athlete.id}:${category.id}`;
                            return (
                              <div key={athlete.id} className="rounded-md border border-border/50 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-medium text-sm">{athlete.name} {athlete.surname}</div>
                                    <div className="text-xs text-muted-foreground">{getAge(athlete.dateOfBirth)} жас · {athlete.weightKg} кг · {athlete.beltRank ?? "—"}</div>
                                  </div>
                                  {alreadyIn ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                                      <CheckCircle2 className="h-3 w-3" /> Заявлен
                                    </span>
                                  ) : isOpenDraft ? (
                                    <button
                                      onClick={() => addEntry.mutate({ athleteId: athlete.id, categoryId: category.id })}
                                      disabled={!!adding}
                                      className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
                                    >
                                      {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                      Қосу
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Матчтар</div>
                      {categoryMatches.length === 0 ? (
                        <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">Бұл категория бойынша клуб матчтары әлі жоқ.</div>
                      ) : (
                        <div className="space-y-2">
                          {categoryMatches.map((match: any) => (
                            <div key={match.id} className="rounded-md border border-border/50 p-3 text-xs">
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Татами {match.tatamiNumber ?? "—"} · R{match.round}</span>
                                <MatchStatusBadge status={match.status} />
                              </div>
                              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                                <span className={myAthleteIds.has(match.redAthlete?.id) ? "font-medium text-gold" : ""}>{athleteName(match.redAthlete)}</span>
                                <span className="text-muted-foreground">vs</span>
                                <span className={myAthleteIds.has(match.blueAthlete?.id) ? "font-medium text-gold" : ""}>{athleteName(match.blueAthlete)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedCategoryId === category.id && bracket && (
                    <div className="mt-4 rounded-lg border border-gold/20 p-4">
                      <LiveBracket tournamentId={id} categoryId={category.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {ownApplication?.status === "DRAFT" && (
        <Panel title="Өтінімді аяқтау">
          <div className="rounded-lg border border-gold/25 bg-gold/5 p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={responsibilityAccepted}
                onChange={(e) => setResponsibilityAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 accent-gold"
              />
              <span className="text-muted-foreground">
                Мен өтінімдегі спортшылардың медициналық рұқсаты, салмағы, жасы және құжаттары дұрыс екенін растаймын.
                Жарысқа қатысу жауапкершілігін клуб/жаттықтырушы өз мойнына алады.
              </span>
            </label>
            <button
              onClick={() => submitApplication.mutate()}
              disabled={submitApplication.isPending || entries.length === 0 || !responsibilityAccepted || deadlinePassed}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {submitApplication.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Өтінімді жіберу
            </button>
            {entries.length === 0 && <div className="mt-2 text-xs text-muted-foreground">Алдымен кемінде бір спортшы қосыңыз.</div>}
            {deadlinePassed && <div className="mt-2 text-xs text-destructive">Өтінім дедлайны өтті.</div>}
            {!responsibilityAccepted && entries.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Жіберу үшін жауапкершілік келісімін белгілеңіз.</div>}
          </div>
        </Panel>
      )}
    </DashboardShell>
  );
}

function Info({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-gold/70" /> {children}</span>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const item = map[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs ${item.c}`}>{item.l}</span>;
}

function MatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; l: string }> = {
    PENDING: { c: "bg-muted text-muted-foreground", l: "Күтіп тұр" },
    IN_PROGRESS: { c: "bg-gold/15 text-gold border border-gold/30", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const item = map[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.c}`}>{item.l}</span>;
}

function FormatBadge({ format }: { format: string }) {
  const map: Record<string, string> = {
    SE_IJF: "Olympic / IJF",
    ROUND_ROBIN: "Round-robin",
    MIXED: "Mixed",
  };
  return <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{map[format] ?? format}</span>;
}

function categoryTitle(category: any): string {
  const custom = localizeName(category.name);
  if (custom) return custom;
  return `${category.gender === "MALE" ? "Ер" : "Қыз"} ${category.ageMin}-${category.ageMax} жас ${category.weightMin}-${category.weightMax} кг`;
}

function fitsCategory(athlete: any, category: any): boolean {
  if (!athlete.dateOfBirth || !athlete.weightKg) return false;
  const age = getAge(athlete.dateOfBirth);
  return athlete.gender === category.gender &&
    age >= category.ageMin &&
    age <= category.ageMax &&
    athlete.weightKg > category.weightMin &&
    athlete.weightKg <= category.weightMax;
}

function categoryMismatchReason(athlete: any, category: any): string {
  if (!athlete.gender) return "жыныс көрсетілмеген";
  if (athlete.gender !== category.gender) return "жынысы сәйкес емес";
  if (!athlete.dateOfBirth) return "туған күні жоқ";
  if (!athlete.weightKg) return "салмақ жоқ";
  const age = getAge(athlete.dateOfBirth);
  if (age < category.ageMin || age > category.ageMax) return `жасы ${age}, керек ${category.ageMin}-${category.ageMax}`;
  if (athlete.weightKg <= category.weightMin || athlete.weightKg > category.weightMax) {
    return `салмағы ${athlete.weightKg} кг, керек (${category.weightMin}, ${category.weightMax}]`;
  }
  return "сәйкес емес";
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function athleteName(athlete: any): string {
  if (!athlete) return "TBD";
  return `${athlete.name ?? ""} ${athlete.surname ?? ""}`.trim() || "TBD";
}

function dateRange(start: string, end: string): string {
  return `${new Date(start).toLocaleDateString("kk-KZ")} - ${new Date(end).toLocaleDateString("kk-KZ")}`;
}

function formatWeighIn(tournament: any): string {
  const place = tournament.weighInLocation || tournament.location;
  const start = tournament.weighInStart ? new Date(tournament.weighInStart).toLocaleString("kk-KZ") : "";
  const end = tournament.weighInEnd ? new Date(tournament.weighInEnd).toLocaleString("kk-KZ") : "";
  const time = start && end ? `${start} - ${end}` : start || "уақыты кейін жарияланады";
  return `Взвешивание: ${place}, ${time}`;
}

function mapEmbedUrl(tournament: any): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${tournament.location}, ${tournament.city}`)}&output=embed`;
}

function localizeName(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "";
}
