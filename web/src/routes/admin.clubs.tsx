import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  DashboardShell,
  StatCard,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Award,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lock,
  Medal,
  Plus,
  Search,
  Star,
  Trash2,
  Trophy,
  Unlock,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DocumentList } from "@/components/documents/DocumentViewer";
import { api, ApiError } from "@/lib/api";
import type {
  AthleteLeaderboardEntry,
  Category,
  Club,
  ClubLeaderboardEntry,
  RatingEntry,
  User as ApiUser,
  UserRole,
} from "@/lib/api-types";
import { Avatar } from "@/components/ui/avatar-image";
import { mediaUrl } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import React from "react";
import { PasswordStrength, isPasswordStrong } from "@/components/ui/PasswordStrength";

export const Route = createFileRoute("/admin/clubs")({
  head: () => ({ meta: [{ title: "Пайдаланушылар — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminClubsRoute />
    </ProtectedRoute>
  ),
});

function AdminClubsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (normalizedPath !== "/admin/clubs") {
    return <Outlet />;
  }
  return <AdminClubsPage />;
}

type Tab = "clubs" | "users" | "ratings";

function AdminClubsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("clubs");

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("admin.clubs_title")}
    >
      {/* Tab switcher */}
      <div className="mb-6 flex gap-2 rounded-xl border border-border/60 bg-card/40 p-1.5 w-fit overflow-x-auto max-w-full">
        {(
          [
            { id: "clubs" as Tab, label: t("admin.clubs_title"), icon: Building2 },
            { id: "users" as Tab, label: t("admin.users_athletes"), icon: Users },
            { id: "ratings" as Tab, label: t("admin.ratings_title"), icon: Star },
          ] as { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === id
                ? "bg-gradient-gold text-gold-foreground shadow-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "clubs" && <ClubsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "ratings" && <RatingsTab />}
    </DashboardShell>
  );
}

// ============================================================
// TAB: КЛУБТАР
// ============================================================
function ClubsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [blockModal, setBlockModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteClubModal, setDeleteClubModal] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    nameRu: "",
    nameKk: "",
    city: "",
    country: "KZ",
    shortName: "",
  });

  const query = useQuery({
    queryKey: ["admin-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
  });

  const blockMut = useMutation({
    mutationFn: ({ id, blocked, reason }: { id: string; blocked: boolean; reason?: string }) =>
      api.admin.blockClub(id, blocked, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clubs"] });
      setBlockModal(null);
      setReason("");
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const deleteClubMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteClub(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clubs"] });
      setDeleteClubModal(null);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.admin.createClub({
        name: { ru: form.nameRu, kk: form.nameKk || undefined },
        city: form.city,
        country: form.country,
        shortName: form.shortName || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clubs"] });
      setShowCreate(false);
      setForm({ nameRu: "", nameKk: "", city: "", country: "KZ", shortName: "" });
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const fi = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const INPUT =
    "mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none";

  return (
    <>
      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <Panel
        title={`${query.data?.total ?? 0} ${t("admin.clubs_title").toLowerCase()}`}
        action={
          <button
            onClick={() => {
              setShowCreate(true);
              setError("");
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-gradient-gold text-gold-foreground shadow-gold"
          >
            <Plus className="h-4 w-4" /> {t("admin.clubs_new")}
          </button>
        }
      >
        {query.isLoading ? (
          <LoadingState />
        ) : (query.data?.items ?? []).length === 0 ? (
          <EmptyState title={t("admin.clubs_no")} hint={t("admin.add_btn_hint")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {query.data!.items.map((c: Club) => (
              <div
                key={c.id}
                className={`glass rounded-xl p-5 ${c.isBlocked ? "border border-destructive/40" : ""}`}
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={c.logoUrl ? mediaUrl(c.logoUrl) : null}
                      name={localizeName(c.name)}
                      size={36}
                      className="shrink-0 rounded-lg"
                    />
                    <Link
                      to="/admin/clubs/$id"
                      params={{ id: c.id }}
                      className="font-display text-lg font-semibold hover:text-gold truncate"
                    >
                      {localizeName(c.name)}
                    </Link>
                  </div>
                  {c.isBlocked && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                      {t("admin.blocked_status")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.city}
                  {c.country ? `, ${c.country}` : ""}
                </div>
                {c.blockedReason && (
                  <div className="mt-2 text-xs text-destructive/80 border-l-2 border-destructive/40 pl-2">
                    {c.blockedReason}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">
                      {t("dashboard.athletes")}:{" "}
                    </span>
                    <span className="text-gold font-display text-lg">{c._count?.members ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      to="/admin/clubs/$id"
                      params={{ id: c.id }}
                      className="text-xs px-2.5 py-1.5 rounded glass border border-border hover:border-gold/40 whitespace-nowrap"
                    >
                      {t("common.details")}
                    </Link>
                    {c.isBlocked ? (
                      <button
                        onClick={() => blockMut.mutate({ id: c.id, blocked: false })}
                        title={t("admin.unblock_club")}
                        className="p-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setBlockModal({ id: c.id, name: localizeName(c.name) });
                          setError("");
                        }}
                        title={t("admin.block_club")}
                        className="p-1.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDeleteClubModal({ id: c.id, name: localizeName(c.name) });
                        setError("");
                      }}
                      title={t("common.delete")}
                      className="p-1.5 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Create club modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold mb-4">{t("admin.clubs_new")}</h3>
            {Boolean(createMut.error) && (
              <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {(createMut.error as Error)?.message ?? t("error.generic")}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.club_name_ru")} *
                </label>
                <input
                  value={form.nameRu}
                  onChange={fi("nameRu")}
                  required
                  className={INPUT}
                  placeholder="Алматы Дзюдо"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.club_name_kk")}
                </label>
                <input
                  value={form.nameKk}
                  onChange={fi("nameKk")}
                  className={INPUT}
                  placeholder="Алматы Дзюдо"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.club_city")} *
                  </label>
                  <input
                    value={form.city}
                    onChange={fi("city")}
                    required
                    className={INPUT}
                    placeholder="Алматы"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.club_country")}
                  </label>
                  <input
                    value={form.country}
                    onChange={fi("country")}
                    className={INPUT}
                    placeholder="KZ"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.club_short_name")}
                </label>
                <input
                  value={form.shortName}
                  onChange={fi("shortName")}
                  className={INPUT}
                  placeholder="АДС"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 rounded glass border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !form.nameRu || !form.city}
                className="text-sm px-4 py-2 rounded bg-gradient-gold text-gold-foreground shadow-gold disabled:opacity-50"
              >
                {createMut.isPending ? t("common.saving") : t("common.add")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block club modal */}
      {blockModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setBlockModal(null)}
        >
          <div
            className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold mb-3">
              {t("admin.delete_club_confirm", { name: blockModal.name })}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{t("admin.block_club_hint")}</p>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.block_reason")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder={t("admin.block_reason_placeholder")}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setBlockModal(null);
                  setReason("");
                }}
                className="text-sm px-4 py-2 rounded glass border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => blockMut.mutate({ id: blockModal.id, blocked: true, reason })}
                disabled={blockMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive/20 text-destructive border border-destructive/40 disabled:opacity-50"
              >
                {t("admin.block_club")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete club modal */}
      {deleteClubModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDeleteClubModal(null)}
        >
          <div
            className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold mb-2 text-destructive">
              {t("admin.delete_club_confirm", { name: deleteClubModal.name })}
            </h3>
            <p className="text-sm text-muted-foreground mb-1">{t("admin.delete_club_warning")}</p>
            <p className="text-xs text-destructive/80 mb-4">{t("common.irreversible")}</p>
            {Boolean(deleteClubMut.error) && (
              <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {(deleteClubMut.error as Error)?.message ?? t("error.generic")}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteClubModal(null)}
                className="text-sm px-4 py-2 rounded glass border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => deleteClubMut.mutate(deleteClubModal.id)}
                disabled={deleteClubMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive text-white disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                {deleteClubMut.isPending ? t("common.saving") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TAB: СПОРТШЫЛАР
// ============================================================
const EMPTY_USER_FORM = {
  email: "",
  password: "",
  role: "ATHLETE" as "ATHLETE" | "COACH" | "ADMIN",
  name: "",
  surname: "",
  nameLatin: "",
  surnameLatin: "",
  dateOfBirth: "",
  gender: "" as "" | "MALE" | "FEMALE",
  weightKg: "",
  beltRank: "",
  phone: "",
  clubId: "",
};

const PAGE_SIZE = 50;

function UsersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("ATHLETE");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState<string>("");
  const [clubFilter, setClubFilter] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteUserModal, setDeleteUserModal] = useState<{ id: string; name: string } | null>(null);
  const [viewUser, setViewUser] = useState<ApiUser | null>(null);
  const [uform, setUform] = useState(EMPTY_USER_FORM);
  const [page, setPage] = useState(0);
  const selectedRole = (["ATHLETE", "COACH", "ADMIN"] as const).find((value) => value === role);
  const selectedActive = activeOnly === "" ? undefined : activeOnly === "true";

  const query = useQuery({
    queryKey: ["admin-users", role, search, activeOnly, clubFilter, page],
    queryFn: () =>
      api.admin.listUsers({
        role: selectedRole as UserRole | undefined,
        search: search || undefined,
        clubId: clubFilter || undefined,
        isActive: selectedActive,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });
  const clubsQuery = useQuery({
    queryKey: ["admin-users-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
  });
  const totalPages = Math.ceil((query.data?.total ?? 0) / PAGE_SIZE);

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

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.admin.toggleUserActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-users-role-counts"] });
      setDeleteUserModal(null);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.admin.createUser({
        email: uform.email,
        password: uform.password,
        role: uform.role,
        name: uform.name,
        surname: uform.surname,
        nameLatin: uform.nameLatin || undefined,
        surnameLatin: uform.surnameLatin || undefined,
        dateOfBirth: uform.dateOfBirth || undefined,
        gender: uform.gender || undefined,
        weightKg: uform.weightKg ? parseFloat(uform.weightKg) : undefined,
        beltRank: uform.beltRank || undefined,
        phone: uform.phone || undefined,
        clubId: uform.clubId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-users-role-counts"] });
      setShowCreate(false);
      setUform(EMPTY_USER_FORM);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const ufi =
    (f: keyof typeof EMPTY_USER_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setUform((p) => ({ ...p, [f]: e.target.value }));

  const INPUT =
    "mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none";

  const roleLabelT = (r: string) => {
    if (r === "ATHLETE") return t("admin.users_athletes");
    if (r === "COACH") return t("admin.users_coaches");
    if (r === "ADMIN") return t("admin.users_admins");
    return t("admin.users_all");
  };

  return (
    <>
      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <Panel
        title={`${query.data?.total ?? 0} ${roleLabelT(role).toLowerCase()}`}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowCreate(true);
                setError("");
              }}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-gradient-gold text-gold-foreground shadow-gold"
            >
              <Plus className="h-4 w-4" /> {t("admin.users_title")}
            </button>
            <div className="inline-flex rounded-md border border-border bg-card/50 p-0.5">
              {(
                [
                  ["ATHLETE", t("admin.users_athletes")],
                  ["COACH", t("admin.users_coaches")],
                  ["ADMIN", t("admin.users_admins")],
                  ["", t("admin.users_all")],
                ] as [string, string][]
              ).map(([value, label]) => (
                <button
                  key={value || "all"}
                  onClick={() => {
                    setRole(value);
                    setPage(0);
                  }}
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={`${t("common.search")}...`}
                className="text-sm bg-input border border-border rounded pl-7 pr-3 py-1.5 focus:border-gold focus:outline-none"
              />
            </div>
            <select
              value={clubFilter}
              onChange={(e) => {
                setClubFilter(e.target.value);
                setPage(0);
              }}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("admin.clubs_title")}</option>
              {(clubsQuery.data?.items ?? []).map((c: Club) => (
                <option key={c.id} value={c.id}>
                  {localizeName(c.name)}
                </option>
              ))}
            </select>
            <select
              value={activeOnly}
              onChange={(e) => {
                setActiveOnly(e.target.value);
                setPage(0);
              }}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("admin.users_all")}</option>
              <option value="true">{t("admin.active")}</option>
              <option value="false">{t("admin.blocked_status")}</option>
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
              {roleLabelT(role)} {t("common.not_found").toLowerCase()}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {role === "COACH" ? t("admin.users_coach_hint") : t("admin.users_search_hint")}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="py-2" colSpan={2}>
                    {t("admin.field_fullname")}
                  </th>
                  <th>Email</th>
                  <th>{t("common.role")}</th>
                  <th>{t("admin.field_club")}</th>
                  <th>{t("common.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.items ?? []).map((u: ApiUser) => {
                  const expanded = viewUser?.id === u.id;
                  const docs: import("@/lib/api-types").UserDocument[] = (u as any).documents ?? [];
                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        className={`border-b border-border/30 cursor-pointer transition-colors ${expanded ? "bg-gold/8 border-gold/30" : "hover:bg-gold/5"}`}
                        onClick={() => setViewUser(expanded ? null : u)}
                      >
                        <td className="py-2 pr-3" colSpan={2}>
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={u.avatarUrl ? mediaUrl(u.avatarUrl) : null}
                              name={`${u.name} ${u.surname}`}
                              size={32}
                            />
                            <span className={`font-medium ${expanded ? "text-gold" : ""}`}>
                              {u.name} {u.surname}
                            </span>
                          </div>
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
                            {u.isActive ? t("admin.active") : t("admin.blocked_status")}
                          </span>
                        </td>
                        <td>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180 text-gold" : ""}`}
                          />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-gold/20 bg-gold/5">
                          <td colSpan={7} className="px-3 pb-4 pt-3">
                            <div className="flex flex-col sm:flex-row gap-5">
                              {/* Avatar + basic info */}
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <Avatar
                                  src={u.avatarUrl ? mediaUrl(u.avatarUrl) : null}
                                  name={`${u.name} ${u.surname}`}
                                  size={64}
                                  className="shrink-0"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs flex-1 min-w-0">
                                  {u.email && <InfoRow label="Email" value={u.email} />}
                                  {(u as any).phone && (
                                    <InfoRow
                                      label={t("admin.field_phone")}
                                      value={(u as any).phone}
                                    />
                                  )}
                                  {(u as any).dateOfBirth && (
                                    <InfoRow
                                      label={t("admin.field_dob")}
                                      value={new Date((u as any).dateOfBirth).toLocaleDateString()}
                                    />
                                  )}
                                  {(u as any).weightKg && (
                                    <InfoRow
                                      label={t("admin.field_weight_kg")}
                                      value={`${(u as any).weightKg} ${t("common.kg")}`}
                                    />
                                  )}
                                  {(u as any).gender && (
                                    <InfoRow
                                      label={t("common.gender")}
                                      value={
                                        (u as any).gender === "MALE"
                                          ? t("common.male")
                                          : t("common.female")
                                      }
                                    />
                                  )}
                                  {(u as any).beltRank && (
                                    <InfoRow
                                      label={t("admin.field_belt")}
                                      value={(u as any).beltRank}
                                    />
                                  )}
                                  {u.club && (
                                    <InfoRow
                                      label={t("admin.field_club")}
                                      value={localizeName(u.club.name)}
                                    />
                                  )}
                                </div>
                              </div>
                              {/* Documents */}
                              <div className="shrink-0 max-w-sm">
                                <div className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                                  {t("documents.title")}
                                </div>
                                <DocumentList documents={docs} />
                              </div>
                              {/* Actions */}
                              <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle.mutate({ id: u.id, active: !u.isActive });
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-gold/40 whitespace-nowrap"
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
                                    setDeleteUserModal({
                                      id: u.id,
                                      name: `${u.name} ${u.surname}`,
                                    });
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 whitespace-nowrap"
                                >
                                  <Trash2 className="h-3 w-3" /> {t("common.delete")}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, query.data?.total ?? 0)} /{" "}
              {query.data?.total ?? 0}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded glass border border-border hover:border-gold/40 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded glass border border-border hover:border-gold/40 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Delete user modal */}
      {deleteUserModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDeleteUserModal(null)}
        >
          <div
            className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold mb-2 text-destructive">
              {t("admin.delete_user_confirm", { name: deleteUserModal.name })}
            </h3>
            <p className="text-sm text-muted-foreground mb-1">{t("admin.delete_user_desc")}</p>
            <p className="text-xs text-destructive/80 mb-4">{t("common.irreversible")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteUserModal(null)}
                className="text-sm px-4 py-2 rounded glass border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => deleteUserMut.mutate(deleteUserModal.id)}
                disabled={deleteUserMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive text-white disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                {deleteUserMut.isPending ? t("common.saving") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold mb-4">
              {t("admin.create_user_title")}
            </h3>
            {Boolean(createMut.error) && (
              <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {(createMut.error as Error)?.message ?? t("error.generic")}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("profile.first_name")} *
                  </label>
                  <input
                    value={uform.name}
                    onChange={ufi("name")}
                    required
                    className={INPUT}
                    placeholder="Асылхан"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("profile.last_name")} *
                  </label>
                  <input
                    value={uform.surname}
                    onChange={ufi("surname")}
                    required
                    className={INPUT}
                    placeholder="Бекжанов"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("profile.first_name_latin")}
                  </label>
                  <input
                    value={uform.nameLatin}
                    onChange={ufi("nameLatin")}
                    className={INPUT}
                    placeholder="Assylkhan"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("profile.last_name_latin")}
                  </label>
                  <input
                    value={uform.surnameLatin}
                    onChange={ufi("surnameLatin")}
                    className={INPUT}
                    placeholder="Bekzhanov"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Email *
                </label>
                <input
                  type="email"
                  value={uform.email}
                  onChange={ufi("email")}
                  required
                  className={INPUT}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.password_label")} *
                </label>
                <input
                  type="password"
                  value={uform.password}
                  onChange={ufi("password")}
                  required
                  className={INPUT}
                  placeholder={t("admin.password_min_hint")}
                />
                <PasswordStrength password={uform.password} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("common.role")} *
                  </label>
                  <select value={uform.role} onChange={ufi("role")} className={INPUT}>
                    <option value="ATHLETE">{t("admin.users_athletes")}</option>
                    <option value="COACH">{t("admin.users_coaches")}</option>
                    <option value="ADMIN">{t("admin.users_admins")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.field_gender")}
                  </label>
                  <select value={uform.gender} onChange={ufi("gender")} className={INPUT}>
                    <option value="">—</option>
                    <option value="MALE">{t("common.male")}</option>
                    <option value="FEMALE">{t("common.female")}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.field_dob")}
                  </label>
                  <input
                    type="date"
                    value={uform.dateOfBirth}
                    onChange={ufi("dateOfBirth")}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.field_weight_kg")}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={uform.weightKg}
                    onChange={ufi("weightKg")}
                    className={INPUT}
                    placeholder="73.0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.field_belt")}
                  </label>
                  <input
                    value={uform.beltRank}
                    onChange={ufi("beltRank")}
                    className={INPUT}
                    placeholder="1 dan"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("admin.field_phone")}
                  </label>
                  <input
                    value={uform.phone}
                    onChange={ufi("phone")}
                    className={INPUT}
                    placeholder="+7 700 000 00 00"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.field_club")}
                </label>
                <select value={uform.clubId} onChange={ufi("clubId")} className={INPUT}>
                  <option value="">— {t("admin.no_club")} —</option>
                  {(clubsQuery.data?.items ?? []).map((c: Club) => (
                    <option key={c.id} value={c.id}>
                      {localizeName(c.name)} ({c.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 rounded glass border border-border"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={
                  createMut.isPending ||
                  !uform.name ||
                  !uform.surname ||
                  !uform.email ||
                  !isPasswordStrong(uform.password)
                }
                className="text-sm px-4 py-2 rounded bg-gradient-gold text-gold-foreground shadow-gold disabled:opacity-50"
              >
                {createMut.isPending ? t("common.saving") : t("common.add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TAB: РЕЙТИНГ
// ============================================================
function RatingsTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");
  const [gender, setGender] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const clubsQuery = useQuery({
    queryKey: ["admin-ratings-clubs"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
    staleTime: 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["admin-leaderboard", clubId],
    queryFn: () => api.ratings.leaderboard({ clubId: clubId || undefined, limit: 200 }),
    staleTime: 30_000,
  });
  const clubLeaderboardQuery = useQuery({
    queryKey: ["admin-club-leaderboard"],
    queryFn: () => api.ratings.clubLeaderboard({ limit: 50 }),
    staleTime: 30_000,
  });

  const rows: AthleteLeaderboardEntry[] = leaderboardQuery.data ?? [];
  const filtered = rows.filter((row) => {
    const a = row.athlete;
    if (gender !== "ALL" && a?.gender !== gender) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      `${a?.name ?? ""} ${a?.surname ?? ""}`,
      a?.club ? localizeName(a.club.name) : "",
      a?.club?.city ?? "",
      a?.weightKg ? `${a.weightKg}` : "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const top3 = rows.slice(0, 3);
  const totalAthletes = rows.length;
  const topPoints = rows[0]?.totalPoints ?? 0;
  const activeClubName = clubId
    ? localizeName((clubsQuery.data?.items ?? []).find((c: Club) => c.id === clubId)?.name)
    : null;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label={t("admin.ratings_title")} value={String(totalAthletes)} accent />
        <StatCard label={t("admin.clubs_title")} value={String(clubsQuery.data?.total ?? "…")} />
        <StatCard
          label={t("admin.ratings_top_points")}
          value={topPoints ? String(Math.round(topPoints)) : "—"}
          hint={t("admin.place_n", { n: 1 })}
        />
        <StatCard
          label={
            activeClubName
              ? `${t("admin.field_club")}: ${activeClubName}`
              : t("admin.ratings_club_rating")
          }
          value={String(clubLeaderboardQuery.data?.length ?? "…")}
          hint={t("admin.clubs_title").toLowerCase()}
        />
      </div>

      {/* Top-3 athletes */}
      {!leaderboardQuery.isLoading && top3.length > 0 && (
        <Panel title={t("admin.ratings_top3")}>
          <div className="grid gap-4 sm:grid-cols-3">
            {top3.map((row, i) => {
              const a = row.athlete;
              const icons = [
                <Trophy key="1" className="h-7 w-7 text-yellow-400" />,
                <Medal key="2" className="h-7 w-7 text-zinc-300" />,
                <Award key="3" className="h-7 w-7 text-amber-600" />,
              ];
              return (
                <div
                  key={a.id}
                  className={`glass rounded-xl p-5 flex flex-col items-center text-center border ${i === 0 ? "border-yellow-400/40" : i === 1 ? "border-zinc-300/30" : "border-amber-600/30"}`}
                >
                  {icons[i]}
                  <div className="mt-3 font-display text-lg font-bold">
                    {`${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {a.club ? localizeName(a.club.name) : "—"}
                    {a.club?.city && ` · ${a.club.city}`}
                  </div>
                  <div className="mt-3 font-display text-2xl font-bold text-gradient-gold">
                    {Math.round(row.totalPoints)}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("admin.stat_rating").toLowerCase()}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Top clubs */}
      {!clubLeaderboardQuery.isLoading && (clubLeaderboardQuery.data ?? []).length > 0 && (
        <div className="mt-6">
          <Panel title={t("admin.ratings_club_rating")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="py-2 w-16">{t("common.place")}</th>
                    <th>{t("admin.field_club")}</th>
                    <th>{t("admin.club_city")}</th>
                    <th className="text-center">{t("dashboard.athletes")}</th>
                    <th className="text-right">{t("admin.stat_rating")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(clubLeaderboardQuery.data ?? []).map((row: ClubLeaderboardEntry) => {
                    const medal =
                      row.rank === 1
                        ? "text-yellow-400"
                        : row.rank === 2
                          ? "text-zinc-300"
                          : row.rank === 3
                            ? "text-amber-600"
                            : "text-muted-foreground";
                    return (
                      <tr key={row.club.id} className="hover:bg-gold/5">
                        <td className={`py-2 font-display text-lg font-bold ${medal}`}>
                          {row.rank <= 3 && <Star className="mr-1 inline h-3 w-3 fill-current" />}
                          {row.rank}
                        </td>
                        <td className="font-medium">
                          <Link
                            to="/admin/clubs/$id"
                            params={{ id: row.club.id }}
                            className="hover:text-gold"
                          >
                            {localizeName(row.club.name)}
                          </Link>
                        </td>
                        <td className="text-xs text-muted-foreground">{row.club.city || "—"}</td>
                        <td className="text-center text-muted-foreground">{row.athleteCount}</td>
                        <td className="text-right font-display text-lg text-gradient-gold">
                          {Math.round(row.totalPoints)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* Gender filter */}
      <div className="mt-6 mb-3 flex gap-1.5 rounded-xl border border-border/60 bg-card/40 p-1 w-fit">
        {(
          [
            { value: "ALL", label: t("admin.users_all") },
            { value: "MALE", label: t("admin.gender_male_filter") },
            { value: "FEMALE", label: t("admin.gender_female_filter") },
          ] as { value: "ALL" | "MALE" | "FEMALE"; label: string }[]
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => {
              setGender(value);
              setExpandedId(null);
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              gender === value
                ? value === "MALE"
                  ? "bg-sky-500/20 text-sky-300 shadow-sm"
                  : value === "FEMALE"
                    ? "bg-rose-500/20 text-rose-300 shadow-sm"
                    : "bg-gradient-gold text-gold-foreground shadow-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_18rem]">
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.ratings_search_hint")}
            className="w-full rounded-xl border border-border/60 bg-card/70 py-3 pl-11 pr-4 outline-none transition-colors focus:border-gold"
          />
        </label>
        <select
          value={clubId}
          onChange={(e) => setClubId(e.target.value)}
          className="rounded-xl border border-border/60 bg-card/70 px-4 py-3 outline-none transition-colors focus:border-gold"
        >
          <option value="">{t("admin.clubs_title")}</option>
          {(clubsQuery.data?.items ?? []).map((club: Club) => (
            <option key={club.id} value={club.id}>
              {localizeName(club.name)}
            </option>
          ))}
        </select>
      </div>

      {leaderboardQuery.isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("admin.ratings_empty")} hint={t("admin.ratings_empty_hint")} />
      ) : (
        <div className="glass rounded-2xl border border-gold/20 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_90px_90px_110px_36px] gap-3 px-6 py-4 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-background/30">
            <div>{t("common.place")}</div>
            <div>{t("admin.field_fullname")}</div>
            <div>{t("admin.field_club")}</div>
            <div>{t("admin.field_gender")}</div>
            <div>{t("admin.field_weight")}</div>
            <div className="text-right">{t("admin.stat_rating")}</div>
            <div />
          </div>
          <div className="divide-y divide-border/40">
            {filtered.map((row, idx) => {
              const a = row.athlete;
              const isExpanded = expandedId === a.id;
              const displayRank = gender !== "ALL" ? idx + 1 : row.rank;
              const mc =
                displayRank === 1
                  ? "text-yellow-400"
                  : displayRank === 2
                    ? "text-zinc-300"
                    : displayRank === 3
                      ? "text-amber-600"
                      : "text-muted-foreground";
              return (
                <div key={a.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="w-full text-left grid gap-3 px-4 py-4 hover:bg-gold/5 transition-colors sm:grid-cols-[72px_1fr_1fr_90px_90px_110px_36px] sm:px-6 sm:items-center"
                  >
                    <div
                      className={`flex items-center gap-1.5 font-display text-2xl font-bold ${mc}`}
                    >
                      {displayRank <= 3 && <Star className="h-3.5 w-3.5 fill-current shrink-0" />}
                      {displayRank}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        src={a.avatarUrl ? mediaUrl(a.avatarUrl) : null}
                        name={`${a.name ?? ""} ${a.surname ?? ""}`}
                        size={36}
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {`${a?.name ?? ""} ${a?.surname ?? ""}`.trim() || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground sm:hidden truncate">
                          {a.club ? localizeName(a.club.name) : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="hidden sm:block text-sm text-muted-foreground truncate">
                      {a.club ? localizeName(a.club.name) : "—"}
                      {a.club?.city && <span className="text-xs"> · {a.club.city}</span>}
                    </div>
                    <div className="hidden sm:block text-sm text-muted-foreground">
                      {a.gender === "MALE"
                        ? t("common.male")
                        : a.gender === "FEMALE"
                          ? t("common.female")
                          : "—"}
                    </div>
                    <div className="hidden sm:block text-sm text-muted-foreground">
                      {a.weightKg ? `−${a.weightKg} ${t("common.kg")}` : "—"}
                    </div>
                    <div className="text-right font-display text-xl font-bold text-gradient-gold tabular-nums">
                      {Math.round(row.totalPoints)}
                    </div>
                    <div className="hidden sm:flex items-center justify-center text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  {isExpanded && <AthleteHistory athleteId={a.id} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground text-right">
        {t("common.total")}: {filtered.length} {t("dashboard.athletes").toLowerCase()}
        {gender !== "ALL" && (
          <>
            {" "}
            · {gender === "MALE" ? t("admin.gender_male_filter") : t("admin.gender_female_filter")}
          </>
        )}
        {search && ` (${t("common.search").toLowerCase()}: "${search}")`}
      </div>
    </>
  );
}

// ============================================================
// Athlete tournament history (expand row)
// ============================================================
function AthleteHistory({ athleteId }: { athleteId: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["admin-athlete-rating", athleteId],
    queryFn: () => api.ratings.athlete(athleteId),
  });

  if (q.isLoading) {
    return (
      <div className="px-6 py-4 bg-background/30 border-t border-border/30">
        <LoadingState />
      </div>
    );
  }

  const entries: RatingEntry[] = q.data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <div className="px-6 py-4 bg-background/30 border-t border-border/30 text-sm text-muted-foreground">
        {t("admin.no_tournament_results")}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-4 bg-background/30 border-t border-border/30">
      <div className="text-[11px] uppercase tracking-widest text-gold mb-3">
        {t("admin.tournament_results")}
      </div>
      <div className="space-y-2">
        {entries.map((e: RatingEntry) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-4 text-sm rounded-lg glass px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                <Link
                  to="/admin/tournaments/$id"
                  params={{ id: e.tournamentId }}
                  className="hover:text-gold transition-colors"
                >
                  {localizeName(e.tournament?.name)}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {categoryTitle(e.category, t)}
                {e.tournament?.startDate && (
                  <>
                    {" "}
                    ·{" "}
                    {new Date(e.tournament.startDate).toLocaleDateString("kk-KZ", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">{placeLabel(e.place, t)}</div>
              <div className="font-display font-bold text-gradient-gold">
                {Math.round(e.points)} {t("admin.stat_rating").toLowerCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-right text-xs text-muted-foreground">
        {t("common.total")}:{" "}
        <span className="font-bold text-gold">{Math.round(q.data?.totalPoints ?? 0)}</span>{" "}
        {t("admin.stat_rating").toLowerCase()}
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0 text-xs uppercase tracking-widest pt-0.5">
        {label}
      </span>
      <span className="font-medium break-all">{value}</span>
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

function roleCount(data: Record<string, number> | undefined | null, role: string) {
  if (!data) return "";
  return `(${data[role || "ALL"] ?? 0})`;
}

function placeLabel(
  place: number,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const label = t("admin.place_n", { n: place });
  if (place === 1) return `🥇 ${label}`;
  if (place === 2) return `🥈 ${label}`;
  if (place === 3) return `🥉 ${label}`;
  if (place === 99) return t("common.participant");
  return label;
}

function categoryTitle(cat: Category | null | undefined, t: (k: string) => string): string {
  if (!cat) return "—";
  const name = localizeName(cat.name);
  const weight =
    cat.weightMin != null && cat.weightMax != null
      ? `${cat.weightMin}–${cat.weightMax} ${t("common.kg")}`
      : "";
  const gender =
    cat.gender === "MALE" ? t("common.male") : cat.gender === "FEMALE" ? t("common.female") : "";
  return [name, gender, weight].filter(Boolean).join(" · ");
}

function localizeName(
  n: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
