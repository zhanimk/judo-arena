import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DashboardShell, EmptyState, LoadingState, Panel, StatCard } from "@/components/dashboard/DashboardShell";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { User, Match, Category, UserDocument } from "@/lib/api-types";
import { Avatar } from "@/components/ui/avatar-image";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/athletes/$id")({
  head: () => ({ meta: [{ title: "Спортшы — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachAthleteDetails />
    </ProtectedRoute>
  ),
});


function CoachAthleteDetails() {
  const { t } = useTranslation();
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

  const athlete = (membersQuery.data ?? []).find((member: User) => member.id === id);
  const matches = matchesQuery.data ?? [];
  const completed = matches.filter((match: Match) => match.status === "COMPLETED");
  const wins = completed.filter((match: Match) => match.winnerId === id).length;
  const upcoming = matches.filter((match: Match) => match.status !== "COMPLETED").length;

  const detachMutation = useMutation({
    mutationFn: () => api.athletes.detachFromClub(id),
    onSuccess: () => {
      if (clubId) queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
      navigate({ to: "/coach/athletes" });
    },
    onError: (error: unknown) => {
      setDetachError(error instanceof ApiError ? error.message : t("coach.detach_error"));
    },
  });

  return (
    <DashboardShell role={t("roles.COACH")} navItems={nav} accentTitle={athlete ? `${athlete.name} ${athlete.surname}` : t("roles.athlete")}>
      <div className="mb-4">
        <Link to="/coach/athletes" className="text-sm text-muted-foreground hover:text-gold">
          ← {t("coach.back_to_athletes")}
        </Link>
      </div>

      {membersQuery.isLoading ? (
        <LoadingState />
      ) : !athlete ? (
        <EmptyState title={t("coach.athlete_not_found")} hint={t("coach.athlete_not_in_club")} />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("common.age")} value={athlete.dateOfBirth ? String(getAge(athlete.dateOfBirth)) : "—"} hint={athlete.gender === "MALE" ? t("common.male") : t("common.female")} />
            <StatCard label={t("common.weight")} value={athlete.weightKg ? `${athlete.weightKg} кг` : "—"} hint={athlete.beltRank ?? t("coach.no_belt")} />
            <StatCard label={t("matches.win")} value={`${wins} / ${completed.length}`} hint={upcoming > 0 ? t("common.athletes_count", { count: upcoming }) : t("coach.all_completed")} accent />
            <StatCard label="Email" value={athlete.email ?? "—"} hint={athlete.isActive ? t("common.active") : t("common.blocked")} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Panel title={t("dashboard.profile")}>
              {/* Avatar */}
              {athlete.avatarUrl && (
                <div className="mb-4 flex justify-center">
                  <Avatar
                    src={mediaUrl(athlete.avatarUrl)}
                    name={`${athlete.name} ${athlete.surname}`}
                    size={80}
                  />
                </div>
              )}

              <dl className="grid gap-3 text-sm">
                <Info label={t("common.full_name")} value={`${athlete.name} ${athlete.surname}`} />
                {athlete.nameLatin && athlete.surnameLatin && (
                  <Info label="Latin" value={`${athlete.nameLatin} ${athlete.surnameLatin}`} />
                )}
                <Info label={t("auth.date_of_birth")} value={athlete.dateOfBirth ? new Date(athlete.dateOfBirth).toLocaleDateString("kk-KZ") : "—"} />
                <Info label={t("common.gender")} value={athlete.gender === "MALE" ? t("common.male") : athlete.gender === "FEMALE" ? t("common.female") : "—"} />
                <Info label={t("common.weight")} value={athlete.weightKg ? `${athlete.weightKg} кг` : "—"} />
                <Info label={t("common.belt")} value={athlete.beltRank ?? "—"} />
                {athlete.phone && <Info label={t("admin.field_phone")} value={athlete.phone} />}
                {athlete.email && <Info label="Email" value={athlete.email} />}
              </dl>

              {/* Documents */}
              {((athlete as any).documents as UserDocument[] | undefined)?.length ? (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    {t("documents.title")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {((athlete as any).documents as UserDocument[]).map((doc) => (
                      <a
                        key={doc.id}
                        href={mediaUrl(doc.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block overflow-hidden rounded-lg border border-border/60 hover:border-gold/50 transition-colors"
                        title={docLabel(doc.type)}
                      >
                        {doc.mimeType?.startsWith("image/") ? (
                          <img
                            src={mediaUrl(doc.url)}
                            alt={docLabel(doc.type)}
                            className="h-24 w-24 object-cover group-hover:opacity-90"
                          />
                        ) : (
                          <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 bg-card/60 text-muted-foreground">
                            <FileText className="h-6 w-6" />
                          </div>
                        )}
                        <div className="bg-card/80 px-1 py-1 text-[9px] text-center text-muted-foreground truncate w-24">
                          {docLabel(doc.type)}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

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
                    {t("coach.remove_from_club")}
                  </button>
                ) : (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">{t("coach.detach_confirm_title")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("coach.detach_confirm_hint")}
                    </p>
                    {detachError && <p className="mt-2 text-xs text-destructive">{detachError}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDetachConfirm(false)}
                        disabled={detachMutation.isPending}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => detachMutation.mutate()}
                        disabled={detachMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                      >
                        {detachMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t("coach.detach_confirm_btn")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title={`${t("dashboard.matches")}: ${matches.length}`}>
              {matchesQuery.isLoading ? (
                <LoadingState />
              ) : matches.length === 0 ? (
                <EmptyState title={t("athlete.no_matches")} hint={t("coach.matches_hint")} />
              ) : (
                <ul className="space-y-2 text-sm">
                  {matches.map((match: Match) => {
                    const opponent = match.redAthlete?.id === id ? match.blueAthlete : match.redAthlete;
                    const won = match.winnerId === id;
                    const isCompleted = match.status === "COMPLETED";
                    return (
                      <li key={match.id} className="glass flex items-center justify-between rounded-md p-3">
                        <div>
                          <div className="font-medium">vs {opponent ? `${opponent.name} ${opponent.surname}` : "TBD"}</div>
                          <div className="text-xs text-muted-foreground">
                            {localizeName(match.tournament?.name) ?? t("common.tournament")} · {categoryTitle(match.bracket?.category, t)} · {t("matches.round")} {match.round}
                          </div>
                        </div>
                        <span className={`text-xs ${isCompleted ? (won ? "text-gold" : "text-destructive") : "text-muted-foreground"}`}>
                          {isCompleted ? (won ? t("matches.win") : t("matches.loss")) : String(t(`status.${match.status}`, match.status))}
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

function categoryTitle(category: Category | null | undefined, t: (key: string) => string): string {
  if (!category) return t("common.category");
  const gender = category.gender === "MALE" ? t("rankings.filter_male") : t("rankings.filter_female");
  return `${gender} ${category.ageMin}-${category.ageMax}, ${category.weightMin}-${category.weightMax} кг`;
}

function localizeName(value: import("@/lib/api-types").LocalizedName | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || null;
}

function getAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function docLabel(type: string): string {
  if (type === "BIRTH_CERTIFICATE") return "Туу туралы";
  if (type === "STUDY_CERTIFICATE") return "Оқу куәлігі";
  if (type === "COACH_ID") return "Тренер куәлігі";
  return "Құжат";
}
