import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { ExternalLink, FileText, Lock, Search, Star, Unlock, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar-image";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Спортшылар — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminUsers />
    </ProtectedRoute>
  ),
});

function AdminUsers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("ATHLETE");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search); // debounce — query only fires after render settles
  const [activeOnly, setActiveOnly] = useState<string>("");
  const [clubFilter, setClubFilter] = useState("");
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-users", role, deferredSearch, activeOnly, clubFilter],
    queryFn: () =>
      api.admin.listUsers({
        role: role || undefined,
        search: deferredSearch || undefined,
        clubId: clubFilter || undefined,
        isActive: activeOnly || undefined,
        limit: 100,
      }),
  });
  const clubsQuery = useQuery({
    queryKey: ["admin-users-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
  });
  const roleCounts = useQuery({
    queryKey: ["admin-users-role-counts", clubFilter, activeOnly],
    queryFn: async () => {
      const [athletes, coaches, admins, all] = await Promise.all([
        api.admin.listUsers({
          role: "ATHLETE",
          clubId: clubFilter || undefined,
          isActive: activeOnly || undefined,
          limit: 1,
        }),
        api.admin.listUsers({
          role: "COACH",
          clubId: clubFilter || undefined,
          isActive: activeOnly || undefined,
          limit: 1,
        }),
        api.admin.listUsers({
          role: "ADMIN",
          clubId: clubFilter || undefined,
          isActive: activeOnly || undefined,
          limit: 1,
        }),
        api.admin.listUsers({
          clubId: clubFilter || undefined,
          isActive: activeOnly || undefined,
          limit: 1,
        }),
      ]);
      return { ATHLETE: athletes.total, COACH: coaches.total, ADMIN: admins.total, ALL: all.total };
    },
  });
  const leaderboard = useQuery({
    queryKey: ["admin-users-leaderboard", clubFilter],
    queryFn: () => api.ratings.leaderboard({ clubId: clubFilter || undefined, limit: 100 }),
  });
  const selectedUserQuery = useQuery({
    queryKey: ["admin-user-modal", selectedUserId],
    queryFn: () => api.admin.getUser(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.admin.toggleUserActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const roleTabs: [string, string][] = [
    ["ATHLETE", t("admin.users_athletes")],
    ["COACH", t("admin.users_coaches")],
    ["ADMIN", t("admin.users_admins")],
    ["", t("admin.users_all")],
  ];

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("admin.users_title")}
    >
      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <Panel
        title={`${query.data?.total ?? 0} ${(role === "ATHLETE" ? t("admin.users_athletes") : role === "COACH" ? t("admin.users_coaches") : role === "ADMIN" ? t("admin.users_admins") : t("admin.users_all")).toLowerCase()}`}
        action={
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-md border border-border bg-card/50 p-0.5">
              {roleTabs.map(([value, label]) => (
                <button
                  key={value || "all"}
                  onClick={() => setRole(value)}
                  className={`rounded px-2.5 py-1.5 text-xs transition-colors ${role === value ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label} <span className="opacity-70">{roleCount(roleCounts.data, value)}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search_placeholder")}
                className="text-sm bg-input border border-border rounded pl-7 pr-3 py-1.5 focus:border-gold focus:outline-none"
              />
            </div>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("common.all_clubs")}</option>
              {(clubsQuery.data?.items ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {localizeName(c.name)}
                </option>
              ))}
            </select>
            <select
              value={activeOnly}
              onChange={(e) => setActiveOnly(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("common.all")}</option>
              <option value="true">{t("common.active")}</option>
              <option value="false">{t("common.blocked")}</option>
            </select>
          </div>
        }
      >
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <EmptyState
            title={t("admin.users_load_error")}
            hint={(query.error as any)?.message ?? t("error.api")}
          />
        ) : (query.data?.items ?? []).length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-sm font-medium">
              {t("admin.user_not_found", {
                role: role === "COACH" ? t("admin.users_coaches") : t("admin.users_athletes"),
              })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {role === "COACH" ? t("admin.users_coach_hint") : t("admin.users_search_hint")}
            </div>
            {role !== "ATHLETE" && (
              <button
                onClick={() => setRole("ATHLETE")}
                className="mt-4 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold"
              >
                {t("admin.users_show_athletes")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="py-2">{t("common.full_name")}</th>
                  <th>Email</th>
                  <th>{t("common.role")}</th>
                  <th>{t("common.club")}</th>
                  <th>{t("common.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(query.data?.items ?? []).map((u: any) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="cursor-pointer hover:bg-gold/5"
                  >
                    <td className="py-2 font-medium">
                      <button type="button" className="text-left hover:text-gold">
                        {u.name} {u.surname}
                      </button>
                    </td>
                    <td className="text-xs text-muted-foreground">{u.email}</td>
                    <td className="text-xs">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {u.club ? localizeName(u.club.name) : "—"}
                    </td>
                    <td>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}
                      >
                        {u.isActive ? t("common.active") : t("common.blocked")}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle.mutate({ id: u.id, active: !u.isActive });
                        }}
                        className="text-xs px-2 py-1 rounded glass border border-border hover:border-gold/40 inline-flex items-center gap-1"
                      >
                        {u.isActive ? (
                          <>
                            <Lock className="h-3 w-3" /> {t("admin.block_user")}
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3" /> {t("admin.unblock_user")}
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <Panel title={t("admin.ratings_title")}>
          {leaderboard.isLoading ? (
            <LoadingState />
          ) : leaderboard.isError ? (
            <EmptyState
              title={t("admin.ratings_load_error")}
              hint={(leaderboard.error as any)?.message ?? t("error.api")}
            />
          ) : (leaderboard.data ?? []).length === 0 ? (
            <EmptyState title={t("admin.ratings_empty")} hint={t("admin.ratings_empty_hint")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("rankings.place")}</th>
                    <th>{t("rankings.athlete")}</th>
                    <th>{t("common.club")}</th>
                    <th className="text-right">{t("common.points")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(leaderboard.data ?? []).map((row: any) => (
                    <tr key={row.athlete.id} className="hover:bg-gold/5">
                      <td className="py-2 font-display text-lg font-bold text-gold">
                        {row.rank <= 3 && <Star className="mr-1 inline h-3 w-3 fill-current" />}
                        {row.rank}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(row.athlete.id)}
                          className="text-left font-medium hover:text-gold"
                        >
                          {row.athlete.name} {row.athlete.surname}
                        </button>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {row.athlete.club ? localizeName(row.athlete.club.name) : "—"}
                      </td>
                      <td className="text-right font-display text-lg text-gradient-gold">
                        {Math.round(row.totalPoints)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={t("admin.clubs_summary")}>
          {(clubsQuery.data?.items ?? []).length === 0 ? (
            <EmptyState title={t("admin.clubs_no")} />
          ) : (
            <div className="space-y-2">
              {(clubsQuery.data?.items ?? []).slice(0, 8).map((c: any) => (
                <Link
                  key={c.id}
                  to="/admin/clubs/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/30 p-3 text-sm hover:border-gold/40"
                >
                  <div>
                    <div className="font-medium">{localizeName(c.name)}</div>
                    <div className="text-xs text-muted-foreground">{c.city}</div>
                  </div>
                  <span className="text-gold">{c._count?.members ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {selectedUserId && (
        <UserDetailsModal
          user={selectedUserQuery.data}
          loading={selectedUserQuery.isLoading}
          error={selectedUserQuery.error}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </DashboardShell>
  );
}

function UserDetailsModal({
  user,
  loading,
  error,
  onClose,
}: {
  user: any;
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const totalPoints = (user?.ratingEntries ?? []).reduce(
    (sum: number, entry: any) => sum + Number(entry.points),
    0,
  );
  const totalMatches = (user?._count?.redmatches ?? 0) + (user?._count?.bluematches ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-5xl sm:rounded-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.user_details")}
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold">
              {user ? `${user.name} ${user.surname}` : t("common.loading")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState
            title={t("admin.users_load_error")}
            hint={(error as any)?.message ?? t("error.api")}
          />
        ) : user ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-4">
              {user.avatarUrl ? (
                <Avatar
                  src={mediaUrl(user.avatarUrl)}
                  name={`${user.name} ${user.surname}`}
                  size={72}
                  className="border border-gold/30"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gold/15 text-xl font-bold text-gold">
                  {user.name?.[0]}
                  {user.surname?.[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold">
                    {user.name} {user.surname}
                  </span>
                  <RoleBadge role={user.role} />
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${user.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}
                  >
                    {user.isActive ? t("common.active") : t("common.blocked")}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm text-muted-foreground">{user.email}</div>
                {user.club && (
                  <Link
                    to="/admin/clubs/$id"
                    params={{ id: user.club.id }}
                    className="mt-1 inline-flex text-sm text-gold hover:underline"
                  >
                    {localizeName(user.club.name)}
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <MiniStat label={t("admin.stat_rating")} value={String(Math.round(totalPoints))} />
              <MiniStat label={t("admin.stat_matches")} value={String(totalMatches)} />
              <MiniStat
                label={t("admin.stat_tournaments")}
                value={String((user.ratingEntries ?? []).length)}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title={t("admin.personal_info")}>
                <div className="space-y-2 text-sm">
                  <InfoField
                    label={t("admin.field_fullname")}
                    value={`${user.name} ${user.surname}`}
                  />
                  <InfoField
                    label={t("admin.field_latin")}
                    value={`${user.nameLatin ?? ""} ${user.surnameLatin ?? ""}`.trim() || "—"}
                  />
                  <InfoField label="Email" value={user.email} />
                  <InfoField
                    label={t("admin.field_gender")}
                    value={
                      user.gender === "MALE"
                        ? t("common.male")
                        : user.gender === "FEMALE"
                          ? t("common.female")
                          : "—"
                    }
                  />
                  <InfoField
                    label={t("admin.field_dob")}
                    value={
                      user.dateOfBirth
                        ? new Date(user.dateOfBirth).toLocaleDateString("kk-KZ")
                        : "—"
                    }
                  />
                  <InfoField
                    label={t("admin.field_weight")}
                    value={user.weightKg ? `${user.weightKg} ${t("common.kg")}` : "—"}
                  />
                  <InfoField label={t("admin.field_belt")} value={user.beltRank ?? "—"} />
                  <InfoField label={t("admin.field_phone")} value={user.phone ?? "—"} />
                  <InfoField
                    label={t("admin.field_club")}
                    value={user.club ? localizeName(user.club.name) : "—"}
                  />
                  <InfoField
                    label={t("profile.language")}
                    value={localeLabel(user.preferredLocale)}
                  />
                  <InfoField
                    label={t("admin.field_registered")}
                    value={new Date(user.createdAt).toLocaleDateString("kk-KZ")}
                  />
                </div>
              </Panel>

              <Panel title={t("documents.title")}>
                <DocumentList documents={user.documents ?? []} />
              </Panel>
            </div>

            <Panel title={t("admin.tournament_results")}>
              {(user.ratingEntries ?? []).length === 0 ? (
                <EmptyState title={t("admin.no_tournament_results")} />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {user.ratingEntries.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border/60 bg-background/35 p-3 text-sm"
                    >
                      <div className="font-medium">{localizeName(entry.tournament?.name)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {placeLabel(entry.place, t)}
                      </div>
                      <div className="mt-2 font-display text-lg text-gold">
                        {Number(entry.points)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DocumentList({ documents }: { documents: any[] }) {
  const { t } = useTranslation();
  const ordered = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "COACH_ID"]
    .map((type) => documents.find((document) => document.type === type))
    .filter(Boolean);

  if (ordered.length === 0) {
    return (
      <EmptyState title={t("documents.no_documents")} hint={t("documents.no_documents_hint")} />
    );
  }

  return (
    <div className="space-y-2">
      {ordered.map((document: any) => (
        <a
          key={document.id}
          href={mediaUrl(document.url)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/35 p-3 text-sm hover:border-gold/40"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 shrink-0 text-gold" />
              {documentTypeLabel(document.type, t)}
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {document.originalName || t("documents.open_file")}
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/35 p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold text-gradient-gold">{value}</div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/20 pb-1.5 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const m: Record<string, string> = {
    ADMIN: "bg-gold/15 text-gold",
    COACH: "bg-sky-500/15 text-sky-300",
    ATHLETE: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${m[role] ?? "bg-muted"}`}>{role}</span>
  );
}

function roleCount(data: any, role: string) {
  if (!data) return "";
  const key = role || "ALL";
  return `(${data[key] ?? 0})`;
}

function placeLabel(place: number, t: any): string {
  const label = t("admin.place_n", { n: place });
  if (place === 1) return `🥇 ${label}`;
  if (place === 2) return `🥈 ${label}`;
  if (place === 3) return `🥉 ${label}`;
  return label;
}

function documentTypeLabel(type: string, t: any): string {
  if (type === "BIRTH_CERTIFICATE") return t("documents.birth_certificate");
  if (type === "STUDY_CERTIFICATE") return t("documents.study_certificate");
  if (type === "COACH_ID") return t("documents.coach_id");
  return type;
}

function localeLabel(locale: string): string {
  if (locale === "kk") return "Қазақша";
  if (locale === "ru") return "Русский";
  if (locale === "en") return "English";
  return locale || "—";
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
