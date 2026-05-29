import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { DashboardShell, StatCard, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Award, Building2, ChevronDown, ChevronUp,
  Lock, Medal, Plus, Search, Shield, Star, Trash2, Trophy, Unlock, User, Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/admin/clubs")({
  head: () => ({ meta: [{ title: "Пайдаланушылар — Әкімші" }] }),
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
  const [tab, setTab] = useState<Tab>("clubs");

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Пайдаланушылар">
      {/* Tab switcher */}
      <div className="mb-6 flex gap-2 rounded-xl border border-border/60 bg-card/40 p-1.5 w-fit overflow-x-auto max-w-full">
        {([
          { id: "clubs" as Tab, label: "Клубтар", icon: Building2 },
          { id: "users" as Tab, label: "Спортшылар", icon: Users },
          { id: "ratings" as Tab, label: "Рейтинг", icon: Star },
        ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
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
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [blockModal, setBlockModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteClubModal, setDeleteClubModal] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nameRu: "", nameKk: "", city: "", country: "KZ", shortName: "" });

  const query = useQuery({ queryKey: ["admin-clubs"], queryFn: () => api.clubs.list() });

  const blockMut = useMutation({
    mutationFn: ({ id, blocked, reason }: { id: string; blocked: boolean; reason?: string }) =>
      api.admin.blockClub(id, blocked, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-clubs"] }); setBlockModal(null); setReason(""); },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const deleteClubMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteClub(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-clubs"] }); setDeleteClubModal(null); },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const createMut = useMutation({
    mutationFn: () => api.admin.createClub({
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
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const fi = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      <Panel
        title={`${query.data?.total ?? 0} клуб`}
        action={
          <button onClick={() => { setShowCreate(true); setError(""); }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-gradient-gold text-gold-foreground shadow-gold">
            <Plus className="h-4 w-4" /> Клуб қосу
          </button>
        }
      >
        {query.isLoading ? <LoadingState /> :
          (query.data?.items ?? []).length === 0 ? <EmptyState title="Клубтар жоқ" hint="«Клуб қосу» батырмасын басыңыз" /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {query.data!.items.map((c: any) => (
                <div key={c.id} className={`glass rounded-xl p-5 ${c.isBlocked ? "border-destructive/40" : ""}`}>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <Link to="/admin/clubs/$id" params={{ id: c.id }}
                      className="font-display text-lg font-semibold hover:text-gold">
                      {localizeName(c.name)}
                    </Link>
                    {c.isBlocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Блок</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.city}{c.country ? `, ${c.country}` : ""}</div>
                  {c.blockedReason && (
                    <div className="mt-2 text-xs text-destructive/80 border-l-2 border-destructive/40 pl-2">
                      {c.blockedReason}
                    </div>
                  )}
                  <div className="mt-3 flex justify-between items-center">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Спортшы: </span>
                      <span className="text-gold font-display text-lg">{c._count?.members ?? 0}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Link to="/admin/clubs/$id" params={{ id: c.id }}
                        className="text-xs px-2.5 py-1 rounded glass border border-border hover:border-gold/40">
                        Толық
                      </Link>
                      {c.isBlocked ? (
                        <button onClick={() => blockMut.mutate({ id: c.id, blocked: false })}
                          className="text-xs px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                          <Unlock className="h-3 w-3" /> Ашу
                        </button>
                      ) : (
                        <button onClick={() => { setBlockModal({ id: c.id, name: localizeName(c.name) }); setError(""); }}
                          className="text-xs px-2.5 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Блок
                        </button>
                      )}
                      <button onClick={() => { setDeleteClubModal({ id: c.id, name: localizeName(c.name) }); setError(""); }}
                        className="text-xs px-2.5 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 inline-flex items-center gap-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Panel>

      {/* Модал: создание клуба */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}>
          <div className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-4">Жаңа клуб қосу</h3>
            {createMut.error && (
              <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {(createMut.error as any)?.message ?? "Қате"}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Атауы (орысша) *</label>
                <input value={form.nameRu} onChange={fi("nameRu")} required
                  className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="Алматы Дзюдо" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Атауы (қазақша)</label>
                <input value={form.nameKk} onChange={fi("nameKk")}
                  className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="Алматы Дзюдо" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Қала *</label>
                  <input value={form.city} onChange={fi("city")} required
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="Алматы" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Ел</label>
                  <input value={form.country} onChange={fi("country")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="KZ" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Қысқаша атауы</label>
                <input value={form.shortName} onChange={fi("shortName")}
                  className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="АДС" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.nameRu || !form.city}
                className="text-sm px-4 py-2 rounded bg-gradient-gold text-gold-foreground shadow-gold disabled:opacity-50">
                {createMut.isPending ? "Сақтауда..." : "Қосу"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: блокировка клуба */}
      {blockModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setBlockModal(null)}>
          <div className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-3">«{blockModal.name}» клубын блоктау</h3>
            <p className="text-xs text-muted-foreground mb-4">Блокталған клуб жаңа өтінімдер жібере алмайды.</p>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Себебі</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder="Блоктау себебі..." />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setBlockModal(null); setReason(""); }}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => blockMut.mutate({ id: blockModal.id, blocked: true, reason })}
                disabled={blockMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive/20 text-destructive border border-destructive/40 disabled:opacity-50">
                Блоктау
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: удаление клуба */}
      {deleteClubModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDeleteClubModal(null)}>
          <div className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-2 text-destructive">«{deleteClubModal.name}» клубын жою</h3>
            <p className="text-sm text-muted-foreground mb-1">Клубты жою үшін алдымен барлық мүшелерді шығарыңыз.</p>
            <p className="text-xs text-destructive/80 mb-4">Бұл әрекетті кері қайтаруға болмайды.</p>
            {deleteClubMut.error && (
              <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {(deleteClubMut.error as any)?.message ?? "Қате"}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteClubModal(null)}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => deleteClubMut.mutate(deleteClubModal.id)}
                disabled={deleteClubMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive text-white disabled:opacity-50 inline-flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" />
                {deleteClubMut.isPending ? "Жойылуда..." : "Жою"}
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
  email: "", password: "", role: "ATHLETE" as "ATHLETE" | "COACH" | "ADMIN",
  name: "", surname: "", nameLatin: "", surnameLatin: "",
  dateOfBirth: "", gender: "" as "" | "MALE" | "FEMALE",
  weightKg: "", beltRank: "", phone: "", clubId: "",
};

function UsersTab() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("ATHLETE");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState<string>("");
  const [clubFilter, setClubFilter] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteUserModal, setDeleteUserModal] = useState<{ id: string; name: string } | null>(null);
  const [uform, setUform] = useState(EMPTY_USER_FORM);

  const query = useQuery({
    queryKey: ["admin-users", role, search, activeOnly, clubFilter],
    queryFn: () => api.admin.listUsers({
      role: role || undefined,
      search: search || undefined,
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

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.admin.toggleUserActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-users-role-counts"] });
      setDeleteUserModal(null);
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const createMut = useMutation({
    mutationFn: () => api.admin.createUser({
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
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const ufi = (f: keyof typeof EMPTY_USER_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setUform((p) => ({ ...p, [f]: e.target.value }));

  return (
    <>
      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      <Panel
        title={`${query.data?.total ?? 0} ${roleLabel(role).toLowerCase()}`}
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setShowCreate(true); setError(""); }}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-gradient-gold text-gold-foreground shadow-gold">
              <Plus className="h-4 w-4" /> Пайдаланушы қосу
            </button>
            <div className="inline-flex rounded-md border border-border bg-card/50 p-0.5">
              {([
                ["ATHLETE", "Спортшылар"],
                ["COACH", "Тренерлер"],
                ["ADMIN", "Админдер"],
                ["", "Барлығы"],
              ] as [string, string][]).map(([value, label]) => (
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Іздеу..."
                className="text-sm bg-input border border-border rounded pl-7 pr-3 py-1.5 focus:border-gold focus:outline-none" />
            </div>
            <select value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">Барлық клубтар</option>
              {(clubsQuery.data?.items ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{localizeName(c.name)}</option>
              ))}
            </select>
            <select value={activeOnly} onChange={(e) => setActiveOnly(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">Барлығы</option>
              <option value="true">Белсенді</option>
              <option value="false">Блок</option>
            </select>
          </div>
        }
      >
        {query.isLoading ? <LoadingState /> :
          query.isError ? <EmptyState title="Пайдаланушылар жүктелмеді" hint={(query.error as any)?.message ?? "API қатесі"} /> :
          (query.data?.items ?? []).length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-sm font-medium">{roleLabel(role)} табылмады</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {role === "COACH"
                  ? "Бұл клубтарда тренер аккаунттары байланыспаған болуы мүмкін."
                  : "Іздеу немесе фильтрді өзгертіп көріңіз."}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="py-2">Аты-жөні</th>
                    <th>Email</th>
                    <th>Рөл</th>
                    <th>Клуб</th>
                    <th>Күй</th>
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
                      <td className="text-xs"><RoleBadge role={u.role} /></td>
                      <td className="text-xs text-muted-foreground">{u.club ? localizeName(u.club.name) : "—"}</td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
                          {u.isActive ? "Белсенді" : "Блок"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggle.mutate({ id: u.id, active: !u.isActive })}
                            className="text-xs px-2 py-1 rounded glass border border-border hover:border-gold/40 inline-flex items-center gap-1">
                            {u.isActive ? <><Lock className="h-3 w-3" /> Блок</> : <><Unlock className="h-3 w-3" /> Ашу</>}
                          </button>
                          <button onClick={() => setDeleteUserModal({ id: u.id, name: `${u.name} ${u.surname}` })}
                            className="text-xs p-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20">
                            <Trash2 className="h-3 w-3" />
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

      {/* Модал: удаление пользователя */}
      {deleteUserModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDeleteUserModal(null)}>
          <div className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-2 text-destructive">«{deleteUserModal.name}» жою</h3>
            <p className="text-sm text-muted-foreground mb-1">Пайдаланушы деректері толығымен жойылады.</p>
            <p className="text-xs text-destructive/80 mb-4">Бұл әрекетті кері қайтаруға болмайды.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteUserModal(null)}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => deleteUserMut.mutate(deleteUserModal.id)}
                disabled={deleteUserMut.isPending}
                className="text-sm px-4 py-2 rounded bg-destructive text-white disabled:opacity-50 inline-flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" />
                {deleteUserMut.isPending ? "Жойылуда..." : "Жою"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: создание пользователя */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}>
          <div className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-4">Жаңа пайдаланушы қосу</h3>
            {createMut.error && (
              <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                {(createMut.error as any)?.message ?? "Қате"}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Аты *</label>
                  <input value={uform.name} onChange={ufi("name")} required
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="Асылхан" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Тегі *</label>
                  <input value={uform.surname} onChange={ufi("surname")} required
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="Бекжанов" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Аты (лат.)</label>
                  <input value={uform.nameLatin} onChange={ufi("nameLatin")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="Assylkhan" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Тегі (лат.)</label>
                  <input value={uform.surnameLatin} onChange={ufi("surnameLatin")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="Bekzhanov" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Email *</label>
                <input type="email" value={uform.email} onChange={ufi("email")} required
                  className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Құпия сөз *</label>
                <input type="password" value={uform.password} onChange={ufi("password")} required
                  className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder="кемінде 6 таңба" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Рөл *</label>
                  <select value={uform.role} onChange={ufi("role")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none">
                    <option value="ATHLETE">Спортшы</option>
                    <option value="COACH">Тренер</option>
                    <option value="ADMIN">Админ</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Жынысы</label>
                  <select value={uform.gender} onChange={ufi("gender")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none">
                    <option value="">—</option>
                    <option value="MALE">Ер</option>
                    <option value="FEMALE">Әйел</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Туған күн</label>
                  <input type="date" value={uform.dateOfBirth} onChange={ufi("dateOfBirth")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Салмақ (кг)</label>
                  <input type="number" step="0.1" value={uform.weightKg} onChange={ufi("weightKg")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="73.0" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Белбеу</label>
                  <input value={uform.beltRank} onChange={ufi("beltRank")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="1 dan" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Телефон</label>
                  <input value={uform.phone} onChange={ufi("phone")}
                    className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    placeholder="+7 700 000 00 00" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Клуб</label>
                <select value={uform.clubId} onChange={ufi("clubId")}
                  className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none">
                  <option value="">— клубсыз —</option>
                  {(clubsQuery.data?.items ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{localizeName(c.name)} ({c.city})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2 rounded glass border border-border">Болдырмау</button>
              <button onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !uform.name || !uform.surname || !uform.email || !uform.password}
                className="text-sm px-4 py-2 rounded bg-gradient-gold text-gold-foreground shadow-gold disabled:opacity-50">
                {createMut.isPending ? "Сақтауда..." : "Қосу"}
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
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");
  const [gender, setGender] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const clubsQuery = useQuery({
    queryKey: ["admin-ratings-clubs"],
    queryFn: () => api.clubs.list(),
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

  const rows: any[] = leaderboardQuery.data ?? [];
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
    ].join(" ").toLowerCase().includes(q);
  });

  const top3 = rows.slice(0, 3);
  const totalAthletes = rows.length;
  const topPoints = rows[0]?.totalPoints ?? 0;
  const activeClubName = clubId
    ? localizeName((clubsQuery.data?.items ?? []).find((c: any) => c.id === clubId)?.name)
    : null;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Рейтингтегі спортшылар" value={String(totalAthletes)} accent />
        <StatCard label="Клубтар" value={String(clubsQuery.data?.total ?? "…")} />
        <StatCard label="Жетекші ұпай" value={topPoints ? String(Math.round(topPoints)) : "—"} hint="1-орын" />
        <StatCard
          label={activeClubName ? `Клуб: ${activeClubName}` : "Клуб рейтингі"}
          value={String(clubLeaderboardQuery.data?.length ?? "…")}
          hint="клуб"
        />
      </div>

      {/* Top-3 athletes */}
      {!leaderboardQuery.isLoading && top3.length > 0 && (
        <Panel title="Топ-3 спортшылар">
          <div className="grid gap-4 sm:grid-cols-3">
            {top3.map((row, i) => {
              const a = row.athlete;
              const icons = [
                <Trophy key="1" className="h-7 w-7 text-yellow-400" />,
                <Medal key="2" className="h-7 w-7 text-zinc-300" />,
                <Award key="3" className="h-7 w-7 text-amber-600" />,
              ];
              return (
                <div key={a.id}
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
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">ұпай</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Top clubs */}
      {!clubLeaderboardQuery.isLoading && (clubLeaderboardQuery.data ?? []).length > 0 && (
        <div className="mt-6">
          <Panel title="Клуб рейтингі">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="py-2 w-16">Орын</th>
                    <th>Клуб</th>
                    <th>Қала</th>
                    <th className="text-center">Спортшылар</th>
                    <th className="text-right">Ұпай</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(clubLeaderboardQuery.data ?? []).map((row: any) => {
                    const medal =
                      row.rank === 1 ? "text-yellow-400" :
                      row.rank === 2 ? "text-zinc-300" :
                      row.rank === 3 ? "text-amber-600" :
                      "text-muted-foreground";
                    return (
                      <tr key={row.club.id} className="hover:bg-gold/5">
                        <td className={`py-2 font-display text-lg font-bold ${medal}`}>
                          {row.rank <= 3 && <Star className="mr-1 inline h-3 w-3 fill-current" />}
                          {row.rank}
                        </td>
                        <td className="font-medium">
                          <Link to="/admin/clubs/$id" params={{ id: row.club.id }} className="hover:text-gold">
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

      {/* Athlete leaderboard */}
      {/* Gender filter */}
      <div className="mt-6 mb-3 flex gap-1.5 rounded-xl border border-border/60 bg-card/40 p-1 w-fit">
        {([
          { value: "ALL",    label: "Барлығы" },
          { value: "MALE",   label: "Ер балалар" },
          { value: "FEMALE", label: "Қыз балалар" },
        ] as { value: "ALL" | "MALE" | "FEMALE"; label: string }[]).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setGender(value); setExpandedId(null); }}
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
            placeholder="Спортшы, клуб, қала немесе салмақ іздеу..."
            className="w-full rounded-xl border border-border/60 bg-card/70 py-3 pl-11 pr-4 outline-none transition-colors focus:border-gold"
          />
        </label>
        <select
          value={clubId}
          onChange={(e) => setClubId(e.target.value)}
          className="rounded-xl border border-border/60 bg-card/70 px-4 py-3 outline-none transition-colors focus:border-gold"
        >
          <option value="">Барлық клубтар</option>
          {(clubsQuery.data?.items ?? []).map((club: any) => (
            <option key={club.id} value={club.id}>{localizeName(club.name)}</option>
          ))}
        </select>
      </div>

      {leaderboardQuery.isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState title="Рейтинг жазбалары жоқ" hint="Жарыс аяқталғаннан кейін рейтинг автоматты есептеледі." />
      ) : (
        <div className="glass rounded-2xl border border-gold/20 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[72px_1fr_1fr_90px_90px_110px_36px] gap-3 px-6 py-4 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-background/30">
            <div>Орын</div><div>Спортшы</div><div>Клуб</div>
            <div>Жынысы</div><div>Салмақ</div>
            <div className="text-right">Ұпай</div><div />
          </div>
          <div className="divide-y divide-border/40">
            {filtered.map((row, idx) => {
              const a = row.athlete;
              const isExpanded = expandedId === a.id;
              const displayRank = gender !== "ALL" ? idx + 1 : row.rank;
              const mc =
                displayRank === 1 ? "text-yellow-400" :
                displayRank === 2 ? "text-zinc-300" :
                displayRank === 3 ? "text-amber-600" :
                "text-muted-foreground";
              return (
                <div key={a.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="w-full text-left grid gap-3 px-4 py-4 hover:bg-gold/5 transition-colors sm:grid-cols-[72px_1fr_1fr_90px_90px_110px_36px] sm:px-6 sm:items-center"
                  >
                    <div className={`flex items-center gap-1.5 font-display text-2xl font-bold ${mc}`}>
                      {displayRank <= 3 && <Star className="h-3.5 w-3.5 fill-current shrink-0" />}
                      {displayRank}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-gradient-gold flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-gold-foreground" />
                      </div>
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
                      {a.gender === "MALE" ? "Ер" : a.gender === "FEMALE" ? "Әйел" : "—"}
                    </div>
                    <div className="hidden sm:block text-sm text-muted-foreground">
                      {a.weightKg ? `−${a.weightKg} кг` : "—"}
                    </div>
                    <div className="text-right font-display text-xl font-bold text-gradient-gold tabular-nums">
                      {Math.round(row.totalPoints)}
                    </div>
                    <div className="hidden sm:flex items-center justify-center text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
        Барлығы: {filtered.length} спортшы
        {gender !== "ALL" && <> · {gender === "MALE" ? "Ер балалар" : "Қыз балалар"}</>}
        {search && ` (іздеу: "${search}")`}
      </div>
    </>
  );
}

// ============================================================
// Athlete tournament history (expand row)
// ============================================================
function AthleteHistory({ athleteId }: { athleteId: string }) {
  const q = useQuery({
    queryKey: ["admin-athlete-rating", athleteId],
    queryFn: () => api.ratings.athlete(athleteId),
  });

  if (q.isLoading) {
    return <div className="px-6 py-4 bg-background/30 border-t border-border/30"><LoadingState /></div>;
  }

  const entries: any[] = q.data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <div className="px-6 py-4 bg-background/30 border-t border-border/30 text-sm text-muted-foreground">
        Аяқталған жарыстар жоқ.
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-4 bg-background/30 border-t border-border/30">
      <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Жарыс тарихы</div>
      <div className="space-y-2">
        {entries.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between gap-4 text-sm rounded-lg glass px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                <Link to="/admin/tournaments/$id" params={{ id: e.tournament?.id }}
                  className="hover:text-gold transition-colors">
                  {localizeName(e.tournament?.name)}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {categoryTitle(e.category)}
                {e.tournament?.startDate && (
                  <> · {new Date(e.tournament.startDate).toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" })}</>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">{placeLabel(e.place)}</div>
              <div className="font-display font-bold text-gradient-gold">{Math.round(e.points)} ұпай</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-right text-xs text-muted-foreground">
        Жалпы: <span className="font-bold text-gold">{Math.round(q.data?.totalPoints ?? 0)}</span> ұпай
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
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
  return `(${data[role || "ALL"] ?? 0})`;
}

function roleLabel(role: string) {
  if (role === "ATHLETE") return "Спортшы";
  if (role === "COACH") return "Тренер";
  if (role === "ADMIN") return "Админ";
  return "Адам";
}

function placeLabel(place: number): string {
  if (place === 1) return "🥇 1-орын";
  if (place === 2) return "🥈 2-орын";
  if (place === 3) return "🥉 3-орын";
  if (place === 99) return "Қатысушы";
  return `${place}-орын`;
}

function categoryTitle(cat: any): string {
  if (!cat) return "—";
  const name = localizeName(cat.name);
  const weight = cat.weightMin != null && cat.weightMax != null ? `${cat.weightMin}–${cat.weightMax} кг` : "";
  const gender = cat.gender === "MALE" ? "Ер" : cat.gender === "FEMALE" ? "Әйел" : "";
  return [name, gender, weight].filter(Boolean).join(" · ");
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
