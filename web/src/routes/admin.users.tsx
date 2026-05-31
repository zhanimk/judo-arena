import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { Search, Lock, Unlock, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
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

  const query = useQuery({
    queryKey: ["admin-users", role, deferredSearch, activeOnly, clubFilter],
    queryFn: () => api.admin.listUsers({
      role: role || undefined,
      search: deferredSearch || undefined,
      clubId: clubFilter || undefined,
      isActive: activeOnly || undefined,
      limit: 100,
    }),
  });
  const clubsQuery = useQuery({ queryKey: ["admin-users-clubs"], queryFn: () => api.clubs.list() });
  const roleCounts = useQuery({
    queryKey: ["admin-users-role-counts", clubFilter, activeOnly],
    queryFn: async () => {
      const [athletes, coaches, admins, all] = await Promise.all([
        api.admin.listUsers({ role: "ATHLETE", clubId: clubFilter || undefined, isActive: activeOnly || undefined, limit: 1 }),
        api.admin.listUsers({ role: "COACH", clubId: clubFilter || undefined, isActive: activeOnly || undefined, limit: 1 }),
        api.admin.listUsers({ role: "ADMIN", clubId: clubFilter || undefined, isActive: activeOnly || undefined, limit: 1 }),
        api.admin.listUsers({ clubId: clubFilter || undefined, isActive: activeOnly || undefined, limit: 1 }),
      ]);
      return { ATHLETE: athletes.total, COACH: coaches.total, ADMIN: admins.total, ALL: all.total };
    },
  });
  const leaderboard = useQuery({
    queryKey: ["admin-users-leaderboard", clubFilter],
    queryFn: () => api.ratings.leaderboard({ clubId: clubFilter || undefined, limit: 100 }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.admin.toggleUserActive(id, active),
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
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("admin.users_title")}>
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search_placeholder")}
                className="text-sm bg-input border border-border rounded pl-7 pr-3 py-1.5 focus:border-gold focus:outline-none" />
            </div>
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">{t("common.all_clubs")}</option>
              {(clubsQuery.data?.items ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{localizeName(c.name)}</option>
              ))}
            </select>
            <select value={activeOnly} onChange={(e) => setActiveOnly(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">{t("common.all")}</option>
              <option value="true">{t("common.active")}</option>
              <option value="false">{t("common.blocked")}</option>
            </select>
          </div>
        }
      >
        {query.isLoading ? <LoadingState /> :
          query.isError ? <EmptyState title={t("admin.users_load_error")} hint={(query.error as any)?.message ?? t("error.api")} /> :
          (query.data?.items ?? []).length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-sm font-medium">{t("admin.user_not_found", { role: role === "COACH" ? t("admin.users_coaches") : t("admin.users_athletes") })}</div>
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
                    <tr key={u.id} className="hover:bg-gold/5">
                      <td className="py-2 font-medium">
                        <Link to="/admin/users/$id" params={{ id: u.id }} className="hover:text-gold">
                          {u.name} {u.surname}
                        </Link>
                      </td>
                      <td className="text-xs text-muted-foreground">{u.email}</td>
                      <td className="text-xs">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {u.club ? localizeName(u.club.name) : "—"}
                      </td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
                          {u.isActive ? t("common.active") : t("common.blocked")}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => toggle.mutate({ id: u.id, active: !u.isActive })}
                          className="text-xs px-2 py-1 rounded glass border border-border hover:border-gold/40 inline-flex items-center gap-1">
                          {u.isActive
                            ? <><Lock className="h-3 w-3" /> {t("admin.block_user")}</>
                            : <><Unlock className="h-3 w-3" /> {t("admin.unblock_user")}</>}
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
          {leaderboard.isLoading ? <LoadingState /> :
            leaderboard.isError ? <EmptyState title={t("admin.ratings_load_error")} hint={(leaderboard.error as any)?.message ?? t("error.api")} /> :
            (leaderboard.data ?? []).length === 0 ? (
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
                          <Link to="/admin/users/$id" params={{ id: row.athlete.id }} className="font-medium hover:text-gold">
                            {row.athlete.name} {row.athlete.surname}
                          </Link>
                        </td>
                        <td className="text-xs text-muted-foreground">{row.athlete.club ? localizeName(row.athlete.club.name) : "—"}</td>
                        <td className="text-right font-display text-lg text-gradient-gold">{Math.round(row.totalPoints)}</td>
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

    </DashboardShell>
  );
}

function RoleBadge({ role }: { role: string }) {
  const m: Record<string, string> = {
    ADMIN: "bg-gold/15 text-gold",
    COACH: "bg-sky-500/15 text-sky-300",
    ATHLETE: "bg-emerald-500/15 text-emerald-300",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${m[role] ?? "bg-muted"}`}>{role}</span>;
}

function roleCount(data: any, role: string) {
  if (!data) return "";
  const key = role || "ALL";
  return `(${data[key] ?? 0})`;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
