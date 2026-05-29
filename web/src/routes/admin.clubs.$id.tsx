import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { ArrowLeft, Edit2, Lock, Mail, Phone, Plus, Trash2, Unlock, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/admin/clubs/$id")({
  head: () => ({ meta: [{ title: "Клуб — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminClubDetail />
    </ProtectedRoute>
  ),
});

const EMPTY_MEMBER_FORM = {
  email: "", password: "", role: "ATHLETE" as "ATHLETE" | "COACH",
  name: "", surname: "", nameLatin: "", surnameLatin: "",
  dateOfBirth: "", gender: "" as "" | "MALE" | "FEMALE",
  weightKg: "", beltRank: "", phone: "",
};

function AdminClubDetail() {
  const { id } = useParams({ from: "/admin/clubs/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showDeleteClub, setShowDeleteClub] = useState(false);
  const [editGroup, setEditGroup] = useState<any | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<any | null>(null);

  // Edit club form
  const [eform, setEform] = useState({ nameRu: "", nameKk: "", city: "", country: "KZ", shortName: "" });
  // Add member form
  const [mform, setMform] = useState(EMPTY_MEMBER_FORM);
  // Group form
  const [gform, setGform] = useState({ name: "", ageMin: "", ageMax: "" });

  const query = useQuery({
    queryKey: ["admin-club", id],
    queryFn: () => api.admin.getClub(id),
  });

  // Sync edit form когда данные загрузились
  const initEditForm = (c: any) => {
    setEform({
      nameRu: c.name?.ru ?? localizeName(c.name),
      nameKk: c.name?.kk ?? "",
      city: c.city ?? "",
      country: c.country ?? "KZ",
      shortName: c.shortName ?? "",
    });
  };

  const editMut = useMutation({
    mutationFn: () => api.admin.updateClub(id, {
      name: { ru: eform.nameRu, kk: eform.nameKk || undefined },
      city: eform.city,
      country: eform.country,
      shortName: eform.shortName || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-club", id] }); setShowEdit(false); },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.admin.deleteClub(id),
    onSuccess: () => navigate({ to: "/admin/clubs" }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const blockMut = useMutation({
    mutationFn: (blocked: boolean) => api.admin.blockClub(id, blocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-club", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const addMemberMut = useMutation({
    mutationFn: () => api.admin.createUser({
      email: mform.email,
      password: mform.password,
      role: mform.role,
      name: mform.name,
      surname: mform.surname,
      nameLatin: mform.nameLatin || undefined,
      surnameLatin: mform.surnameLatin || undefined,
      dateOfBirth: mform.dateOfBirth || undefined,
      gender: mform.gender || undefined,
      weightKg: mform.weightKg ? parseFloat(mform.weightKg) : undefined,
      beltRank: mform.beltRank || undefined,
      phone: mform.phone || undefined,
      clubId: id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setShowAddMember(false);
      setMform(EMPTY_MEMBER_FORM);
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const addGroupMut = useMutation({
    mutationFn: () => api.admin.createGroup(id, {
      name: gform.name,
      ageMin: parseInt(gform.ageMin),
      ageMax: parseInt(gform.ageMax),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setShowAddGroup(false);
      setGform({ name: "", ageMin: "", ageMax: "" });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const editGroupMut = useMutation({
    mutationFn: () => api.admin.updateGroup(editGroup!.id, {
      name: gform.name,
      ageMin: parseInt(gform.ageMin),
      ageMax: parseInt(gform.ageMax),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setEditGroup(null);
      setGform({ name: "", ageMin: "", ageMax: "" });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const deleteGroupMut = useMutation({
    mutationFn: () => api.admin.deleteGroup(deleteGroup!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setDeleteGroup(null);
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  if (query.isLoading) return <DashboardShell role="Әкімші" navItems={nav} accentTitle="..."><LoadingState /></DashboardShell>;
  if (query.isError) return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Қате">
      <div className="glass rounded-xl p-6 text-sm text-destructive border border-destructive/30">
        <div className="font-medium mb-1">API қатесі</div>
        <div className="text-muted-foreground">{(query.error as any)?.message ?? "Клуб жүктелмеді"}</div>
        <button onClick={() => query.refetch()} className="mt-3 text-xs px-3 py-1.5 rounded glass border border-border">Қайталау</button>
      </div>
    </DashboardShell>
  );
  const c = query.data;
  if (!c) return <DashboardShell role="Әкімші" navItems={nav} accentTitle="—"><EmptyState title="Клуб табылмады" /></DashboardShell>;
  const coaches = (c.members ?? []).filter((m: any) => m.role === "COACH");
  const athletes = (c.members ?? []).filter((m: any) => m.role === "ATHLETE");

  const fi = (f: keyof typeof eform) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEform((p) => ({ ...p, [f]: e.target.value }));
  const mfi = (f: keyof typeof EMPTY_MEMBER_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setMform((p) => ({ ...p, [f]: e.target.value }));
  const gfi = (f: keyof typeof gform) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGform((p) => ({ ...p, [f]: e.target.value }));

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle={localizeName(c.name)}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <Link to="/admin/clubs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold">
          <ArrowLeft className="h-4 w-4" /> Барлық клубтар
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { initEditForm(c); setShowEdit(true); setError(""); }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded glass border border-gold/40 hover:border-gold">
            <Edit2 className="h-3.5 w-3.5" /> Өңдеу
          </button>
          {c.isBlocked ? (
            <button onClick={() => blockMut.mutate(false)} disabled={blockMut.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 disabled:opacity-50">
              <Unlock className="h-3.5 w-3.5" /> Блокты алу
            </button>
          ) : (
            <button onClick={() => blockMut.mutate(true)} disabled={blockMut.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 disabled:opacity-50">
              <Lock className="h-3.5 w-3.5" /> Блоктау
            </button>
          )}
          <button onClick={() => { setShowDeleteClub(true); setError(""); }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:border-destructive/60">
            <Trash2 className="h-3.5 w-3.5" /> Жою
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      <div className="grid gap-5 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Спортшы" value={String(athletes.length)} accent />
        <StatCard label="Тренер" value={String(coaches.length)} />
        <StatCard label="Топ" value={String(c.groups?.length ?? 0)} />
        <StatCard label="Өтінімдер" value={String(c.applications?.length ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Club info */}
        <Panel title="Клуб туралы">
          <div className="space-y-2 text-sm">
            <Field label="Атауы (рус)" value={c.name?.ru ?? localizeName(c.name)} />
            <Field label="Атауы (қаз)" value={c.name?.kk ?? "—"} />
            <Field label="Қысқаша" value={c.shortName ?? "—"} />
            <Field label="Қала" value={`${c.city}, ${c.country}`} />
            <Field label="Жасаған" value={c.createdBy ? `${c.createdBy.name} ${c.createdBy.surname}` : "—"} />
            <Field label="Email" value={c.createdBy?.email ?? "—"} />
            <Field label="Тіркелген" value={new Date(c.createdAt).toLocaleDateString("kk-KZ")} />
            <Field label="Күй" value={c.isBlocked ? "Блокталған" : "Белсенді"} />
            {c.blockedReason && (
              <div className="text-xs text-destructive/80 border-l-2 border-destructive/40 pl-2 mt-2">{c.blockedReason}</div>
            )}
          </div>
        </Panel>

        {/* Coaches */}
        <Panel
          title={`Тренерлер (${coaches.length})`}
          action={
            <button onClick={() => { setMform({ ...EMPTY_MEMBER_FORM, role: "COACH" }); setShowAddMember(true); setError(""); }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-gradient-gold text-gold-foreground shadow-gold">
              <UserPlus className="h-3.5 w-3.5" /> Қосу
            </button>
          }
        >
          {coaches.length === 0 ? <EmptyState title="Тренер жоқ" hint="«Қосу» батырмасын басыңыз" /> : (
            <ul className="space-y-2 text-sm">
              {coaches.map((m: any) => (
                <li key={m.id} className="glass rounded p-3">
                  <div className="flex justify-between items-start">
                    <Link to="/admin/users/$id" params={{ id: m.id }} className="hover:text-gold font-medium">
                      {m.name} {m.surname}
                    </Link>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
                      {m.isActive ? "Белсенді" : "Блок"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {m.email && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {m.email}
                      </span>
                    )}
                    {m.phone && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {m.phone}
                      </span>
                    )}
                    {m.dateOfBirth && (
                      <span className="text-xs text-muted-foreground">
                        Туған: {new Date(m.dateOfBirth).toLocaleDateString("kk-KZ")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Athletes */}
        <Panel
          title={`Спортшылар (${athletes.length})`}
          action={
            <button onClick={() => { setMform({ ...EMPTY_MEMBER_FORM, role: "ATHLETE" }); setShowAddMember(true); setError(""); }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-gradient-gold text-gold-foreground shadow-gold">
              <UserPlus className="h-3.5 w-3.5" /> Қосу
            </button>
          }
        >
          {athletes.length === 0 ? <EmptyState title="Спортшылар жоқ" hint="«Қосу» батырмасын басыңыз" /> : (
            <ul className="space-y-2 text-sm max-h-[480px] overflow-y-auto">
              {athletes.map((m: any) => (
                <li key={m.id} className="glass rounded p-3">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <Link to="/admin/users/$id" params={{ id: m.id }} className="font-medium hover:text-gold">
                        {m.name} {m.surname}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m.gender === "MALE" ? "Ер" : m.gender === "FEMALE" ? "Қыз" : "—"} ·{" "}
                        {m.weightKg ? `${m.weightKg} кг` : "салмақ жоқ"} ·{" "}
                        {m.beltRank ?? "белбеу жоқ"}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-display text-gold font-bold">{Math.round(m.totalPoints ?? 0)}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${m.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
                        {m.isActive ? "Белсенді" : "Блок"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {m.email && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {m.email}
                      </span>
                    )}
                    {m.phone && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {m.phone}
                      </span>
                    )}
                    {m.dateOfBirth && (
                      <span className="text-xs text-muted-foreground">
                        Туған: {new Date(m.dateOfBirth).toLocaleDateString("kk-KZ")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Groups */}
        <Panel
          title={`Топтар (${c.groups?.length ?? 0})`}
          action={
            <button onClick={() => { setGform({ name: "", ageMin: "", ageMax: "" }); setShowAddGroup(true); setError(""); }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-gradient-gold text-gold-foreground shadow-gold">
              <Plus className="h-3.5 w-3.5" /> Топ қосу
            </button>
          }
        >
          {(c.groups ?? []).length === 0 ? <EmptyState title="Топтар жоқ" /> : (
            <div className="space-y-2 text-sm">
              {c.groups.map((g: any) => (
                <div key={g.id} className="flex justify-between items-center rounded-md border border-border/60 bg-background/30 p-3">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.ageMin}–{g.ageMax} жас</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditGroup(g); setGform({ name: g.name, ageMin: String(g.ageMin), ageMax: String(g.ageMax) }); setError(""); }}
                      className="text-xs p-1.5 rounded glass border border-border hover:border-gold/40">
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button onClick={() => { setDeleteGroup(g); setError(""); }}
                      className="text-xs p-1.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Applications */}
      <div className="mt-6">
        <Panel title={`Өтінімдер (${c.applications?.length ?? 0})`}>
          {(c.applications ?? []).length === 0 ? <EmptyState title="Әзірше өтінім жоқ" /> : (
            <ul className="space-y-2 text-sm">
              {c.applications.map((a: any) => (
                <li key={a.id} className="flex justify-between glass rounded p-3">
                  <div>
                    <div className="font-medium">{localizeName(a.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString("kk-KZ")} · {a._count?.entries ?? 0} спортшы
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full self-start ${
                    a.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-300" :
                    a.status === "REJECTED" ? "bg-destructive/15 text-destructive" :
                    a.status === "SUBMITTED" ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
                  }`}>{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ===== MODALS ===== */}

      {/* Edit club */}
      {showEdit && (
        <Modal title="Клубты өңдеу" onClose={() => setShowEdit(false)}>
          {editMut.error && <ErrBox msg={(editMut.error as any)?.message} />}
          <div className="space-y-3">
            <Field2 label="Атауы (орысша) *">
              <input value={eform.nameRu} onChange={fi("nameRu")} required
                className={INPUT} placeholder="Алматы Дзюдо" />
            </Field2>
            <Field2 label="Атауы (қазақша)">
              <input value={eform.nameKk} onChange={fi("nameKk")}
                className={INPUT} placeholder="Алматы Дзюдо" />
            </Field2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label="Қала *">
                <input value={eform.city} onChange={fi("city")} required className={INPUT} placeholder="Алматы" />
              </Field2>
              <Field2 label="Ел">
                <input value={eform.country} onChange={fi("country")} className={INPUT} placeholder="KZ" />
              </Field2>
            </div>
            <Field2 label="Қысқаша атауы">
              <input value={eform.shortName} onChange={fi("shortName")} className={INPUT} placeholder="АДС" />
            </Field2>
          </div>
          <ModalFooter
            onCancel={() => setShowEdit(false)}
            onConfirm={() => editMut.mutate()}
            loading={editMut.isPending}
            disabled={!eform.nameRu || !eform.city}
            label="Сақтау"
          />
        </Modal>
      )}

      {/* Add member */}
      {showAddMember && (
        <Modal title={mform.role === "COACH" ? "Тренер қосу" : "Спортшы қосу"} onClose={() => setShowAddMember(false)}>
          {addMemberMut.error && <ErrBox msg={(addMemberMut.error as any)?.message} />}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label="Аты *">
                <input value={mform.name} onChange={mfi("name")} required className={INPUT} placeholder="Асылхан" />
              </Field2>
              <Field2 label="Тегі *">
                <input value={mform.surname} onChange={mfi("surname")} required className={INPUT} placeholder="Бекжанов" />
              </Field2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label="Аты (лат.)">
                <input value={mform.nameLatin} onChange={mfi("nameLatin")} className={INPUT} placeholder="Assylkhan" />
              </Field2>
              <Field2 label="Тегі (лат.)">
                <input value={mform.surnameLatin} onChange={mfi("surnameLatin")} className={INPUT} placeholder="Bekzhanov" />
              </Field2>
            </div>
            <Field2 label="Email *">
              <input type="email" value={mform.email} onChange={mfi("email")} required className={INPUT} placeholder="user@example.com" />
            </Field2>
            <Field2 label="Құпия сөз *">
              <input type="password" value={mform.password} onChange={mfi("password")} required className={INPUT} placeholder="кемінде 6 таңба" />
            </Field2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label="Жынысы">
                <select value={mform.gender} onChange={mfi("gender")} className={INPUT}>
                  <option value="">—</option>
                  <option value="MALE">Ер</option>
                  <option value="FEMALE">Әйел</option>
                </select>
              </Field2>
              <Field2 label="Туған күн">
                <input type="date" value={mform.dateOfBirth} onChange={mfi("dateOfBirth")} className={INPUT} />
              </Field2>
            </div>
            {mform.role === "ATHLETE" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field2 label="Салмақ (кг)">
                  <input type="number" step="0.1" value={mform.weightKg} onChange={mfi("weightKg")} className={INPUT} placeholder="73.0" />
                </Field2>
                <Field2 label="Белбеу">
                  <input value={mform.beltRank} onChange={mfi("beltRank")} className={INPUT} placeholder="1 dan" />
                </Field2>
              </div>
            )}
            <Field2 label="Телефон">
              <input value={mform.phone} onChange={mfi("phone")} className={INPUT} placeholder="+7 700 000 00 00" />
            </Field2>
          </div>
          <ModalFooter
            onCancel={() => setShowAddMember(false)}
            onConfirm={() => addMemberMut.mutate()}
            loading={addMemberMut.isPending}
            disabled={!mform.name || !mform.surname || !mform.email || !mform.password}
            label="Қосу"
          />
        </Modal>
      )}

      {/* Add / Edit group */}
      {(showAddGroup || editGroup) && (
        <Modal title={editGroup ? "Топты өңдеу" : "Жаңа топ қосу"} onClose={() => { setShowAddGroup(false); setEditGroup(null); }}>
          {(addGroupMut.error || editGroupMut.error) && (
            <ErrBox msg={((addGroupMut.error || editGroupMut.error) as any)?.message} />
          )}
          <div className="space-y-3">
            <Field2 label="Топ атауы *">
              <input value={gform.name} onChange={gfi("name")} required className={INPUT} placeholder="Жасөспірімдер" />
            </Field2>
            <div className="grid grid-cols-2 gap-3">
              <Field2 label="Жас (бастап)">
                <input type="number" value={gform.ageMin} onChange={gfi("ageMin")} className={INPUT} placeholder="10" />
              </Field2>
              <Field2 label="Жас (дейін)">
                <input type="number" value={gform.ageMax} onChange={gfi("ageMax")} className={INPUT} placeholder="17" />
              </Field2>
            </div>
          </div>
          <ModalFooter
            onCancel={() => { setShowAddGroup(false); setEditGroup(null); }}
            onConfirm={() => editGroup ? editGroupMut.mutate() : addGroupMut.mutate()}
            loading={addGroupMut.isPending || editGroupMut.isPending}
            disabled={!gform.name}
            label={editGroup ? "Сақтау" : "Қосу"}
          />
        </Modal>
      )}

      {/* Delete group confirm */}
      {deleteGroup && (
        <Modal title="Топты жою" onClose={() => setDeleteGroup(null)}>
          <p className="text-sm text-muted-foreground">«{deleteGroup.name}» тобын жойғыңыз келе ме?</p>
          {deleteGroupMut.error && <ErrBox msg={(deleteGroupMut.error as any)?.message} />}
          <ModalFooter
            onCancel={() => setDeleteGroup(null)}
            onConfirm={() => deleteGroupMut.mutate()}
            loading={deleteGroupMut.isPending}
            label="Жою"
            danger
          />
        </Modal>
      )}

      {/* Delete club confirm */}
      {showDeleteClub && (
        <Modal title="Клубты жою" onClose={() => setShowDeleteClub(false)}>
          <p className="text-sm text-muted-foreground mb-1">
            «{localizeName(c.name)}» клубын жойғыңыз келе ме?
          </p>
          <p className="text-xs text-destructive/80">Клубта мүшелер болмауы тиіс.</p>
          {deleteMut.error && <ErrBox msg={(deleteMut.error as any)?.message} />}
          <ModalFooter
            onCancel={() => setShowDeleteClub(false)}
            onConfirm={() => deleteMut.mutate()}
            loading={deleteMut.isPending}
            label="Жою"
            danger
          />
        </Modal>
      )}
    </DashboardShell>
  );
}

// ============================================================
// Shared UI helpers
// ============================================================
const INPUT = "mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, disabled, label, danger }: any) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onCancel} className="text-sm px-4 py-2 rounded glass border border-border">
        Болдырмау
      </button>
      <button onClick={onConfirm} disabled={loading || disabled}
        className={`text-sm px-4 py-2 rounded disabled:opacity-50 ${
          danger
            ? "bg-destructive/20 text-destructive border border-destructive/40"
            : "bg-gradient-gold text-gold-foreground shadow-gold"
        }`}>
        {loading ? "Жүктелуде..." : label}
      </button>
    </div>
  );
}

function ErrBox({ msg }: { msg?: string }) {
  return (
    <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
      {msg ?? "Қате орын алды"}
    </div>
  );
}

function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, hint, accent }: any) {
  return (
    <div className={`glass rounded-xl p-5 ${accent ? "border-gold/40" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/20 pb-1.5 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
