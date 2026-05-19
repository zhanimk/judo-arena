/**
 * Страница управления одной заявкой тренера.
 * Можно добавлять/удалять спортсменов в категории и отправлять заявку.
 */

import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Clock3,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  MapPin,
  Plus,
  Send,
  Trash2,
  Trophy,
  Undo2,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/coach/applications/$id")({
  head: () => ({ meta: [{ title: "Өтінім — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <ApplicationDetail />
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

function ApplicationDetail() {
  const { id } = useParams({ from: "/coach/applications/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [onlyEligible, setOnlyEligible] = useState(false);

  const appQuery = useQuery({
    queryKey: ["application", id],
    queryFn: () => api.applications.get(id),
  });

  const membersQuery = useQuery({
    queryKey: ["club-members-for-app", user?.clubId],
    queryFn: () => (user?.clubId ? api.clubs.members(user.clubId) : []),
    enabled: !!user?.clubId,
  });

  const categoriesQuery = useQuery({
    queryKey: ["tournament-categories", appQuery.data?.tournamentId],
    queryFn: () => api.tournaments.categories(appQuery.data!.tournamentId),
    enabled: !!appQuery.data?.tournamentId,
  });
  const matchesQuery = useQuery({
    queryKey: ["coach-application-matches", appQuery.data?.tournamentId],
    queryFn: () => api.matches.list({ tournamentId: appQuery.data!.tournamentId }),
    enabled: !!appQuery.data?.tournamentId,
  });

  const addEntry = useMutation({
    mutationFn: (params: { athleteId: string; categoryId: string }) =>
      api.applications.addEntry(id, params.athleteId, params.categoryId),
    onMutate: (p) => { setAdding(p.athleteId); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
    onSettled: () => setAdding(null),
  });

  const submit = useMutation({
    mutationFn: () => api.applications.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });
  const removeEntry = useMutation({
    mutationFn: (entryId: string) => api.applications.removeEntry(id, entryId),
    onMutate: (entryId) => { setRemoving(entryId); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
    onSettled: () => setRemoving(null),
  });
  const withdraw = useMutation({
    mutationFn: () => api.applications.withdraw(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["application", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  if (appQuery.isLoading) {
    return (
      <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Өтінім">
        <LoadingState />
      </DashboardShell>
    );
  }

  const app = appQuery.data;
  if (!app) {
    return (
      <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Өтінім табылмады">
        <Panel title="Қате"><EmptyState title="Өтінім жоқ" /></Panel>
      </DashboardShell>
    );
  }

  const isEditable = app.status === "DRAFT";
  const entriesCount = app.entries?.length ?? 0;
  const rosterIds = new Set((app.entries ?? []).map((e: any) => e.athleteId));
  const deadline = app.tournament?.applicationDeadline ?? app.tournament?.startDate;
  const deadlinePassed = deadline ? new Date(deadline).getTime() < Date.now() : false;
  const canEditRoster = isEditable && !deadlinePassed;
  const categories = categoriesQuery.data ?? [];
  const filteredAthletes = (() => {
    const search = athleteSearch.trim().toLowerCase();
    return (membersQuery.data ?? []).filter((athlete: any) => {
      const fullName = `${athlete.name ?? ""} ${athlete.surname ?? ""}`.toLowerCase();
      if (search && !fullName.includes(search)) return false;
      if (genderFilter !== "ALL" && athlete.gender !== genderFilter) return false;
      const relevantCategories = categoryFilter === "ALL"
        ? categories
        : categories.filter((category: any) => category.id === categoryFilter);
      const hasMatch = relevantCategories.some((category: any) => fitsCategory(athlete, category));
      if (onlyEligible && !hasMatch) return false;
      return true;
    });
  })();
  const clubMatches = (matchesQuery.data ?? []).filter((m: any) =>
    (m.redAthlete?.id && rosterIds.has(m.redAthlete.id)) ||
    (m.blueAthlete?.id && rosterIds.has(m.blueAthlete.id)),
  );

  return (
    <DashboardShell
      role="Жаттықтырушы"
      navItems={nav}
      accentTitle={localizeName(app.tournament?.name) || "Өтінім"}
    >
      <Link to="/coach/applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowLeft className="h-4 w-4" /> Барлық өтінімдер
      </Link>

      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      {app.status === "REJECTED" && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Өтінім қайтарылды, түзету керек
          </div>
          {app.reviewerNotes && <div className="mt-2 text-muted-foreground">{app.reviewerNotes}</div>}
        </div>
      )}

      {app.status === "APPROVED" && app.reviewerNotes && (
        <div className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-emerald-300">Админ ескертуі:</span> {app.reviewerNotes}
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Турнир туралы">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoItem icon={Trophy} label="Турнир" value={localizeName(app.tournament?.name) || "—"} />
            <InfoItem icon={CalendarDays} label="Басталуы" value={app.tournament?.startDate ? new Date(app.tournament.startDate).toLocaleDateString("kk-KZ") : "—"} />
            <InfoItem icon={Clock3} label="Өтінім дедлайны" value={deadline ? new Date(deadline).toLocaleString("kk-KZ") : "—"} />
            <InfoItem icon={MapPin} label="Өтетін орны" value={app.tournament?.location ? `${app.tournament.location}, ${app.tournament.city}` : app.tournament?.status ?? "—"} />
            <InfoItem icon={Users} label="Клуб спортшылары" value={String(entriesCount)} />
          </div>
          {app.tournament?.posterUrl && (
            <a
              href={app.tournament.posterUrl}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
            >
              <ClipboardList className="h-4 w-4" />
              Турнир положение / фото ашу
            </a>
          )}
        </Panel>

        <Panel
          title="Әрекеттер"
          action={<StatusBadge status={app.status} />}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              {isEditable
                ? "Жоба ашық: спортшыларды қосып/өшіріп, дайын болғанда жіберіңіз."
                : `Өңдеуге болмайды. Ағымдағы мәртебе: ${statusLabel(app.status)}.`}
            </div>
            {app.submittedAt && <div>Жіберілген: {new Date(app.submittedAt).toLocaleString("kk-KZ")}</div>}
            {app.reviewedAt && <div>Қаралған: {new Date(app.reviewedAt).toLocaleString("kk-KZ")}</div>}
            {(app.status === "DRAFT" || app.status === "SUBMITTED") && (
              <button
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {withdraw.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                Өтінімді қайтарып алу
              </button>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title={`Өтінім · ${app.status}`}
      >
        <div className="text-sm text-muted-foreground mb-4">
          {entriesCount} спортшы өтінімде
          {!isEditable && " · өңдеуге болмайды (мәртебесі: " + app.status + ")"}
          {isEditable && deadlinePassed && " · дедлайн өтті, өзгертуге болмайды"}
        </div>

        {/* Текущие entries */}
        {entriesCount > 0 && (
          <div className="space-y-2 mb-6">
            {app.entries.map((e: any) => (
              <div key={e.id} className="flex justify-between items-center glass rounded-md p-3">
                <div>
                  <div className="font-medium text-sm">
                    {e.athlete.name} {e.athlete.surname}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.athlete.weightKg ? `${e.athlete.weightKg} кг` : ""}
                    {" · "}
                    {e.category?.gender === "MALE" ? "Ер" : "Әйел"} {e.category?.weightMin}-{e.category?.weightMax} кг
                    {e.category?.ageMin ? ` · ${e.category.ageMin}-${e.category.ageMax} жас` : ""}
                  </div>
                </div>
                {canEditRoster && (
                  <button
                    onClick={() => removeEntry.mutate(e.id)}
                    disabled={removing === e.id}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label="Өшіру"
                  >
                    {removing === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Форма добавления */}
        {canEditRoster && categoriesQuery.data && membersQuery.data && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-medium text-sm">Спортшы қосу</h4>
              <div className="text-xs text-muted-foreground">
                {filteredAthletes.length} / {(membersQuery.data ?? []).length} көрсетілді
              </div>
            </div>
            <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(180px,1fr)_140px_minmax(180px,220px)_auto]">
              <input
                value={athleteSearch}
                onChange={(e) => setAthleteSearch(e.target.value)}
                placeholder="Аты-жөні бойынша іздеу"
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-gold/60"
              />
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as "ALL" | "MALE" | "FEMALE")}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-gold/60"
              >
                <option value="ALL">Бәрі</option>
                <option value="MALE">Ер</option>
                <option value="FEMALE">Әйел</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-gold/60"
              >
                <option value="ALL">Барлық категория</option>
                {categories.map((category: any) => (
                  <option key={category.id} value={category.id}>{categoryLabel(category)}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} className="accent-gold" />
                Тек сәйкес
              </label>
            </div>
            {(categoriesQuery.data ?? []).length === 0 ? (
              <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                Бұл турнирде категориялар әлі енгізілмеген. Админ алдымен жас/салмақ/жыныс категорияларын қосуы керек.
              </div>
            ) : (membersQuery.data ?? []).length === 0 ? (
              <div className="rounded-md border border-border/50 p-3 text-sm text-muted-foreground">
                Клубта спортшылар жоқ. Алдымен «Спортшылар» бөлімінен оқушыларды қосыңыз.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAthletes.map((athlete: any) => {
                const alreadyIn = app.entries.some((e: any) => e.athleteId === athlete.id);
                const relevantCategories = categoryFilter === "ALL"
                  ? categoriesQuery.data!
                  : categoriesQuery.data!.filter((category: any) => category.id === categoryFilter);
                const matching = relevantCategories.filter((c: any) => fitsCategory(athlete, c));
                const issues = athleteEligibilityIssues(athlete, relevantCategories);

                return (
                  <div key={athlete.id} className={`glass rounded-md p-3 ${alreadyIn ? "border-emerald-500/25" : matching.length === 0 ? "opacity-80" : ""}`}>
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div>
                        <div className="font-medium text-sm">{athlete.name} {athlete.surname}</div>
                        <div className="text-xs text-muted-foreground">
                          {athleteMeta(athlete)}
                        </div>
                      </div>
                      {alreadyIn && <StatusPill value="APPROVED" />}
                    </div>
                    {alreadyIn ? (
                      <div className="mt-2 text-xs text-emerald-300">Бұл спортшы өтінімге қосылған.</div>
                    ) : matching.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {matching.map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => addEntry.mutate({ athleteId: athlete.id, categoryId: c.id })}
                            disabled={adding === athlete.id}
                            className="text-xs px-2 py-1 rounded bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            {c.gender === "MALE" ? "Ер" : "Әйел"} {c.weightMin}-{c.weightMax} кг
                            <span className="text-gold/70">{c.ageMin}-{c.ageMax} жас</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded border border-border/40 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                        Қосу мүмкін емес: {issues.join("; ")}
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>
        )}

        {isEditable && (
          <div className="mt-6 rounded-lg border border-gold/25 bg-gold/5 p-4">
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
              onClick={() => submit.mutate()}
              disabled={submit.isPending || entriesCount === 0 || !responsibilityAccepted || deadlinePassed}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" /> Өтінімді жіберу
            </button>
            {entriesCount === 0 && <div className="mt-2 text-xs text-muted-foreground">Алдымен кемінде бір спортшы қосыңыз.</div>}
            {deadlinePassed && <div className="mt-2 text-xs text-destructive">Өтінім дедлайны өтті.</div>}
            {!responsibilityAccepted && entriesCount > 0 && <div className="mt-2 text-xs text-muted-foreground">Жіберу үшін жауапкершілік келісімін белгілеңіз.</div>}
          </div>
        )}
      </Panel>

      <div className="mt-6">
        <Panel title={`Клуб матчтарының кестесі ${clubMatches.length}`}>
          {matchesQuery.isLoading ? (
            <LoadingState />
          ) : clubMatches.length === 0 ? (
            <EmptyState title="Матч кестесі әлі жоқ" hint="Сетка жасалғаннан кейін клуб спортшыларының матчтары осында шығады" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="py-2">Татами</th>
                    <th>Раунд</th>
                    <th>Қызыл</th>
                    <th>Көк</th>
                    <th>Мәртебе</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {clubMatches.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gold/5">
                      <td className="py-2.5">{m.tatamiNumber ?? "—"}</td>
                      <td className="text-xs text-muted-foreground">{m.bracketSection ?? "main"} · {m.round}</td>
                      <td className={rosterIds.has(m.redAthlete?.id) ? "font-medium text-gold" : ""}>{athleteName(m.redAthlete)}</td>
                      <td className={rosterIds.has(m.blueAthlete?.id) ? "font-medium text-gold" : ""}>{athleteName(m.blueAthlete)}</td>
                      <td><StatusPill value={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-gold" />
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const x = statusMap(status);
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${x.c}`}>{x.l}</span>;
}

function StatusPill({ value }: { value: string }) {
  const x = statusMap(value);
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${x.c}`}>{x.l}</span>;
}

function statusMap(status: string): { c: string; l: string } {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    SUBMITTED: { c: "bg-gold/15 text-gold border border-gold/30", l: "Қарауда" },
    APPROVED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Бекітілді" },
    REJECTED: { c: "bg-destructive/15 text-destructive border border-destructive/40", l: "Қайтарылды" },
    WITHDRAWN: { c: "bg-muted text-muted-foreground", l: "Алынды" },
    PENDING: { c: "bg-muted text-muted-foreground", l: "Күтіп тұр" },
    IN_PROGRESS: { c: "bg-gold/15 text-gold border border-gold/30", l: "Жүріп жатыр" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  return m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
}

function statusLabel(status: string): string {
  return statusMap(status).l;
}

function athleteName(a: any): string {
  if (!a) return "—";
  return `${a.name ?? ""} ${a.surname ?? ""}`.trim() || "—";
}

function fitsCategory(athlete: any, category: any): boolean {
  if (athlete.gender !== category.gender) return false;
  if (!athlete.weightKg) return false;
  if (!athlete.dateOfBirth) return false;
  const age = getAge(athlete.dateOfBirth);
  return age >= category.ageMin &&
    age <= category.ageMax &&
    athlete.weightKg > category.weightMin &&
    athlete.weightKg <= category.weightMax;
}

function athleteEligibilityIssues(athlete: any, categories: any[]): string[] {
  const issues: string[] = [];
  if (!athlete.gender) issues.push("жыныс көрсетілмеген");
  if (!athlete.dateOfBirth) issues.push("туған күні жоқ");
  if (!athlete.weightKg) issues.push("салмақ жоқ");
  if (issues.length > 0) return issues;

  const sameGender = categories.filter((category: any) => category.gender === athlete.gender);
  if (sameGender.length === 0) return ["осы жынысқа категория жоқ"];

  const age = getAge(athlete.dateOfBirth);
  const ageMatches = sameGender.filter((category: any) => age >= category.ageMin && age <= category.ageMax);
  if (ageMatches.length === 0) return [`жасы ${age}, категория жасына сәйкес емес`];

  const weightMatches = ageMatches.filter((category: any) => athlete.weightKg > category.weightMin && athlete.weightKg <= category.weightMax);
  if (weightMatches.length === 0) return [`салмағы ${athlete.weightKg} кг, категория салмағына сәйкес емес`];

  return ["сәйкес категория табылмады"];
}

function athleteMeta(athlete: any): string {
  const gender = athlete.gender === "MALE" ? "Ер" : athlete.gender === "FEMALE" ? "Әйел" : "Жыныс жоқ";
  const weight = athlete.weightKg ? `${athlete.weightKg} кг` : "салмақ жоқ";
  const age = athlete.dateOfBirth ? `${getAge(athlete.dateOfBirth)} жас` : "туған күні жоқ";
  return `${gender} · ${weight} · ${age}`;
}

function categoryLabel(category: any): string {
  return `${category.gender === "MALE" ? "Ер" : "Әйел"} ${category.ageMin}-${category.ageMax} жас ${category.weightMin}-${category.weightMax} кг`;
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function localizeName(n: any): string { if (!n) return ""; if (typeof n === "string") return n; return n.kk || n.ru || n.en || ""; }
