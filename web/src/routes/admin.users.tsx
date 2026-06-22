import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { DocumentList } from "@/components/documents/DocumentViewer";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { Bell, Loader2, Lock, Search, Send, Star, Unlock, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { AthleteLeaderboardEntry, Club, User, UserRole, RatingEntry } from "@/lib/api-types";
import { Avatar } from "@/components/ui/avatar-image";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useDeferredValue, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Спортшылар — Әкімші" }] }),
  errorComponent: RouteErrorUI,
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
  const [notifyUser, setNotifyUser] = useState<User | null>(null);
  const selectedRole = (["ATHLETE", "COACH", "ADMIN"] as const).find((value) => value === role);
  const selectedActive = activeOnly === "" ? undefined : activeOnly === "true";

  const query = useQuery({
    queryKey: ["admin-users", role, deferredSearch, activeOnly, clubFilter],
    queryFn: () =>
      api.admin.listUsers({
        role: selectedRole as UserRole | undefined,
        search: deferredSearch || undefined,
        clubId: clubFilter || undefined,
        isActive: selectedActive,
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
          isActive: selectedActive,
          limit: 1,
        }),
        api.admin.listUsers({
          role: "COACH",
          clubId: clubFilter || undefined,
          isActive: selectedActive,
          limit: 1,
        }),
        api.admin.listUsers({
          role: "ADMIN",
          clubId: clubFilter || undefined,
          isActive: selectedActive,
          limit: 1,
        }),
        api.admin.listUsers({
          clubId: clubFilter || undefined,
          isActive: selectedActive,
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
  // Берём базовые данные из уже загруженного списка — модалка открывается мгновенно,
  // полные данные (документы, рейтинг) догружаются в фоне
  const userFromList = (query.data?.items ?? []).find((u: User) => u.id === selectedUserId);

  const selectedUserQuery = useQuery({
    queryKey: ["admin-user-modal", selectedUserId],
    queryFn: () => api.admin.getUser(selectedUserId!),
    enabled: Boolean(selectedUserId),
    placeholderData: userFromList,
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.admin.toggleUserActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
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
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <div className="inline-flex flex-wrap rounded-md border border-border bg-card/50 p-0.5">
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
            <div className="relative flex-1 min-w-[150px] max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search_placeholder")}
                className="w-full text-sm bg-input border border-border rounded pl-7 pr-3 py-1.5 focus:border-gold focus:outline-none"
              />
            </div>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              aria-label={t("common.all_clubs")}
              className="text-sm glass border border-border/60 hover:border-gold/40 rounded-md px-3 py-1.5 transition-colors focus:border-gold focus:outline-none outline-none cursor-pointer"
            >
              <option value="">{t("common.all_clubs")}</option>
              {(clubsQuery.data?.items ?? []).map((c: Club) => (
                <option key={c.id} value={c.id}>
                  {localizeName(c.name)}
                </option>
              ))}
            </select>
            <select
              value={activeOnly}
              onChange={(e) => setActiveOnly(e.target.value)}
              aria-label={t("common.status")}
              className="text-sm glass border border-border/60 hover:border-gold/40 rounded-md px-3 py-1.5 transition-colors focus:border-gold focus:outline-none outline-none cursor-pointer"
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
            hint={(query.error as Error)?.message ?? t("error.api")}
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
                {(query.data?.items ?? []).map((u: User) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="cursor-pointer hover:bg-gold/5"
                  >
                    <td className="py-2 font-medium">
                      <button
                        type="button"
                        className="flex items-center gap-3 text-left hover:text-gold"
                      >
                        <Avatar
                          src={u.avatarUrl ? mediaUrl(u.avatarUrl) : null}
                          name={`${u.name} ${u.surname}`}
                          size={36}
                          className="border border-border/60"
                        />
                        <span className="whitespace-nowrap">
                          {u.name} {u.surname}
                        </span>
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
                      <div className="flex items-center gap-1.5">
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotifyUser(u);
                          }}
                          title={t("admin.send_notification")}
                          className="p-1.5 rounded glass border border-border hover:border-gold/40 text-muted-foreground hover:text-gold"
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
              hint={(leaderboard.error as Error)?.message ?? t("error.api")}
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
                  {(leaderboard.data ?? []).map((row: AthleteLeaderboardEntry) => (
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
              {(clubsQuery.data?.items ?? []).slice(0, 8).map((c: Club) => (
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
          fetching={selectedUserQuery.isFetching}
          error={selectedUserQuery.error}
          onClose={() => setSelectedUserId(null)}
          onNotify={(u) => {
            setSelectedUserId(null);
            setNotifyUser(u);
          }}
        />
      )}

      {notifyUser && (
        <SendNotificationModal user={notifyUser} onClose={() => setNotifyUser(null)} />
      )}
    </DashboardShell>
  );
}

function UserDetailsModal({
  user,
  loading,
  fetching,
  error,
  onClose,
  onNotify,
}: {
  user?: User;
  loading: boolean;
  fetching?: boolean;
  error: unknown;
  onClose: () => void;
  onNotify?: (u: User) => void;
}) {
  const { t } = useTranslation();

  // Закрытие по Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const totalPoints = (user?.ratingEntries ?? []).reduce(
    (sum: number, entry: RatingEntry) => sum + Number(entry.points),
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
        {/* Тонкая полоска пока грузятся детали (документы, рейтинг) */}
        {fetching && !loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-2xl sm:rounded-t-xl">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gold" />
          </div>
        )}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.user_details")}
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold">
              {user ? `${user.name} ${user.surname}` : t("common.loading")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {user && onNotify && (
              <button
                type="button"
                onClick={() => onNotify(user)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20"
              >
                <Bell className="h-3.5 w-3.5" />
                {t("admin.send_notification")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState
            title={t("admin.users_load_error")}
            hint={(error as Error)?.message ?? t("error.api")}
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
                  {(user.ratingEntries ?? []).map((entry: RatingEntry) => (
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

function roleCount(data: Record<string, number> | null | undefined, role: string) {
  if (!data) return "";
  const key = role || "ALL";
  return `(${data[key] ?? 0})`;
}

function placeLabel(
  place: number,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const label = t("admin.place_n", { n: place });
  if (place === 1) return `🥇 ${label}`;
  if (place === 2) return `🥈 ${label}`;
  if (place === 3) return `🥉 ${label}`;
  return label;
}

function SendNotificationModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () =>
      api.notifications.broadcast({
        title,
        body,
        type: "announcement",
        kind: "user",
        userId: user.id,
      }),
    onSuccess: () => {
      toast.success(t("admin.notification_sent_user", { name: `${user.name} ${user.surname}` }));
      onClose();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof ApiError ? e.message : t("error.api"));
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-lg rounded-t-2xl p-5 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.send_notification")}
            </p>
            <h3 className="mt-0.5 font-display text-base font-semibold">
              {user.name} {user.surname}
            </h3>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.notification_subject")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.notification_body")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              maxLength={1000}
              className="mt-1.5 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={send.isPending}
            className="w-full bg-gradient-gold text-gold-foreground py-2.5 rounded font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("admin.notification_send")}
          </button>
        </form>
      </div>
    </div>
  );
}

function localeLabel(locale: string): string {
  if (locale === "kk") return "Қазақша";
  if (locale === "ru") return "Русский";
  if (locale === "en") return "English";
  return locale || "—";
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
