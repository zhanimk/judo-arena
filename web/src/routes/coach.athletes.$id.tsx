import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DashboardShell, EmptyState, LoadingState, Panel, StatCard } from "@/components/dashboard/DashboardShell";
import { Loader2, Trash2 } from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/athletes/$id")({
  head: () => ({ meta: [{ title: "Спортшы — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachAthleteDetails />
    </ProtectedRoute>
  ),
});


function CoachAthleteDetails() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const clubId = user?.clubId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDetachConfirm, setShowDetachConfirm] = useState(false);
  const [detachError, setDetachError] = useState("");

  const membersQuery = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => (clubId ? api.clubs.members(clubId) : []),
    enabled: !!clubId,
  });

  const matchesQuery = useQuery({
    queryKey: ["coach-athlete-matches", id],
    queryFn: () => api.matches.list({ athleteId: id, limit: 200 }),
    enabled: !!id,
  });

  const athlete = (membersQuery.data ?? []).find((member: any) => member.id === id);
  const matches = matchesQuery.data ?? [];
  const completed = matches.filter((match: any) => match.status === "COMPLETED");
  const wins = completed.filter((match: any) => match.winnerId === id).length;
  const upcoming = matches.filter((match: any) => match.status !== "COMPLETED").length;

  const detachMutation = useMutation({
    mutationFn: () => api.athletes.detachFromClub(id),
    onSuccess: () => {
      if (clubId) queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
      navigate({ to: "/coach/athletes" });
    },
    onError: (error: unknown) => {
      setDetachError(error instanceof ApiError ? error.message : "Спортшыны клубтан шығару мүмкін болмады.");
    },
  });

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle={athlete ? `${athlete.name} ${athlete.surname}` : "Спортшы"}>
      <div className="mb-4">
        <Link to="/coach/athletes" className="text-sm text-muted-foreground hover:text-gold">
          ← Спортшылар тізіміне қайту
        </Link>
      </div>

      {membersQuery.isLoading ? (
        <LoadingState />
      ) : !athlete ? (
        <EmptyState title="Спортшы табылмады" hint="Бұл спортшы сіздің клуб тізімінде жоқ." />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Жасы" value={athlete.dateOfBirth ? String(getAge(athlete.dateOfBirth)) : "—"} hint={athlete.gender === "MALE" ? "Ер" : "Әйел"} />
            <StatCard label="Салмақ" value={athlete.weightKg ? `${athlete.weightKg} кг` : "—"} hint={athlete.beltRank ?? "Белбеу көрсетілмеген"} />
            <StatCard label="Жеңіс" value={`${wins} / ${completed.length}`} hint={upcoming > 0 ? `${upcoming} алдағы жекпе-жек` : "аяқталған жекпе-жектер"} accent />
            <StatCard label="Email" value={athlete.email ?? "—"} hint={athlete.isActive ? "белсенді" : "бұғатталған"} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Panel title="Профиль">
              <dl className="grid gap-3 text-sm">
                <Info label="Аты-жөні" value={`${athlete.name} ${athlete.surname}`} />
                <Info label="Туған күні" value={athlete.dateOfBirth ? new Date(athlete.dateOfBirth).toLocaleDateString("kk-KZ") : "—"} />
                <Info label="Жыныс" value={athlete.gender === "MALE" ? "Ер" : "Әйел"} />
                <Info label="Салмақ" value={athlete.weightKg ? `${athlete.weightKg} кг` : "—"} />
                <Info label="Белбеу" value={athlete.beltRank ?? "—"} />
              </dl>

              <div className="mt-5 border-t border-border/40 pt-4">
                {!showDetachConfirm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetachError("");
                      setShowDetachConfirm(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Клубтан шығару
                  </button>
                ) : (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">Спортшы клуб құрамынан шығарылады.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Оның аккаунты сақталады, бірақ клуб тізімінде көрінбейді.
                    </p>
                    {detachError && <p className="mt-2 text-xs text-destructive">{detachError}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDetachConfirm(false)}
                        disabled={detachMutation.isPending}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
                      >
                        Болдырмау
                      </button>
                      <button
                        type="button"
                        onClick={() => detachMutation.mutate()}
                        disabled={detachMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                      >
                        {detachMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Шығару
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title={`Жекпе-жектер: ${matches.length}`}>
              {matchesQuery.isLoading ? (
                <LoadingState />
              ) : matches.length === 0 ? (
                <EmptyState title="Жекпе-жектер жоқ" hint="Өтінім мақұлданып, сетка дайындалғанда осында көрінеді." />
              ) : (
                <ul className="space-y-2 text-sm">
                  {matches.map((match: any) => {
                    const opponent = match.redAthlete?.id === id ? match.blueAthlete : match.redAthlete;
                    const won = match.winnerId === id;
                    const isCompleted = match.status === "COMPLETED";
                    return (
                      <li key={match.id} className="glass flex items-center justify-between rounded-md p-3">
                        <div>
                          <div className="font-medium">vs {opponent ? `${opponent.name} ${opponent.surname}` : "TBD"}</div>
                          <div className="text-xs text-muted-foreground">
                            {localizeName(match.tournament?.name) ?? "Турнир"} · {categoryTitle(match.bracket?.category)} · Раунд {match.round}
                          </div>
                        </div>
                        <span className={`text-xs ${isCompleted ? (won ? "text-gold" : "text-destructive") : "text-muted-foreground"}`}>
                          {isCompleted ? (won ? "Жеңіс" : "Жеңіліс") : statusLabel(match.status)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </DashboardShell>
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

function localizeName(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || null;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Күтуде",
    IN_PROGRESS: "LIVE",
    CANCELLED: "Болмады",
  };
  return labels[status] ?? status;
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
