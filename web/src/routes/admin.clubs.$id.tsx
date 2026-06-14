import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { ArrowLeft, ChevronDown, Edit2, FileText, Lock, Mail, Phone, Plus, Trash2, Unlock, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { Club, User, ClubGroup, Application, UserDocument } from "@/lib/api-types";
import { Avatar } from "@/components/ui/avatar-image";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import React from "react";

export const Route = createFileRoute("/admin/clubs/$id")({
  head: () => ({ meta: [{ title: "Клуб — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminClubDetail />
    </ProtectedRoute>
  ),
});

const EMPTY_MEMBER_FORM = {
  email: "",
  password: "",
  role: "ATHLETE" as "ATHLETE" | "COACH",
  clubRole: "COACH" as "COACH" | "OWNER",
  name: "",
  surname: "",
  nameLatin: "",
  surnameLatin: "",
  dateOfBirth: "",
  gender: "" as "" | "MALE" | "FEMALE",
  weightKg: "",
  beltRank: "",
  phone: "",
};

function AdminClubDetail() {
  const { t } = useTranslation();
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
  const [eform, setEform] = useState({
    nameRu: "",
    nameKk: "",
    city: "",
    country: "KZ",
    shortName: "",
  });
  // Add member form
  const [mform, setMform] = useState(EMPTY_MEMBER_FORM);
  // Group form
  const [gform, setGform] = useState({ name: "", ageMin: "", ageMax: "" });

  const query = useQuery({
    queryKey: ["admin-club", id],
    queryFn: () => api.admin.getClub(id),
  });

  // Sync edit form когда данные загрузились
  const initEditForm = (c: Club) => {
    const localizedName = typeof c.name === "object" && c.name ? c.name : null;
    setEform({
      nameRu: localizedName?.ru ?? localizeName(c.name),
      nameKk: localizedName?.kk ?? "",
      city: c.city ?? "",
      country: c.country ?? "KZ",
      shortName: c.shortName ?? "",
    });
  };

  const editMut = useMutation({
    mutationFn: () =>
      api.admin.updateClub(id, {
        name: { ru: eform.nameRu, kk: eform.nameKk || undefined },
        city: eform.city,
        country: eform.country,
        shortName: eform.shortName || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setShowEdit(false);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.admin.deleteClub(id),
    onSuccess: () => navigate({ to: "/admin/clubs" }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const blockMut = useMutation({
    mutationFn: (blocked: boolean) => api.admin.blockClub(id, blocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-club", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const addMemberMut = useMutation({
    mutationFn: () =>
      api.admin.createUser({
        email: mform.email,
        password: mform.password,
        role: mform.role,
        clubRole: mform.role === "COACH" ? mform.clubRole : undefined,
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
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const addGroupMut = useMutation({
    mutationFn: () =>
      api.admin.createGroup(id, {
        name: gform.name,
        ageMin: parseInt(gform.ageMin),
        ageMax: parseInt(gform.ageMax),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setShowAddGroup(false);
      setGform({ name: "", ageMin: "", ageMax: "" });
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const editGroupMut = useMutation({
    mutationFn: () =>
      api.admin.updateGroup(editGroup!.id, {
        name: gform.name,
        ageMin: parseInt(gform.ageMin),
        ageMax: parseInt(gform.ageMax),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setEditGroup(null);
      setGform({ name: "", ageMin: "", ageMax: "" });
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const deleteGroupMut = useMutation({
    mutationFn: () => api.admin.deleteGroup(deleteGroup!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-club", id] });
      setDeleteGroup(null);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  if (query.isLoading)
    return (
      <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("common.loading")}>
        <LoadingState />
      </DashboardShell>
    );
  if (query.isError)
    return (
      <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("error.generic")}>
        <div className="glass rounded-xl p-6 text-sm text-destructive border border-destructive/30">
          <div className="font-medium mb-1">{t("error.api")}</div>
          <div className="text-muted-foreground">
            {((query.error as Error))?.message ?? t("admin.club_load_error")}
          </div>
          <button
            onClick={() => query.refetch()}
            className="mt-3 text-xs px-3 py-1.5 rounded glass border border-border"
          >
            {t("common.retry")}
          </button>
        </div>
      </DashboardShell>
    );
  const c = query.data;
  if (!c)
    return (
      <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle="—">
        <EmptyState title={t("admin.club_not_found")} />
      </DashboardShell>
    );
  const coaches = (c.members ?? []).filter((m: User) => m.role === "COACH");
  const athletes = (c.members ?? []).filter((m: User) => m.role === "ATHLETE");

  const fi = (f: keyof typeof eform) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEform((p) => ({ ...p, [f]: e.target.value }));
  const mfi =
    (f: keyof typeof EMPTY_MEMBER_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setMform((p) => ({ ...p, [f]: e.target.value }));
  const gfi = (f: keyof typeof gform) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setGform((p) => ({ ...p, [f]: e.target.value }));

  return (
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={localizeName(c.name)}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <Link
          to="/admin/clubs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> {t("admin.back_to_clubs")}
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              initEditForm(c);
              setShowEdit(true);
              setError("");
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded glass border border-gold/40 hover:border-gold"
          >
            <Edit2 className="h-3.5 w-3.5" /> {t("common.edit")}
          </button>
          {c.isBlocked ? (
            <button
              onClick={() => blockMut.mutate(false)}
              disabled={blockMut.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 disabled:opacity-50"
            >
              <Unlock className="h-3.5 w-3.5" /> {t("admin.unblock_club")}
            </button>
          ) : (
            <button
              onClick={() => blockMut.mutate(true)}
              disabled={blockMut.isPending}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" /> {t("admin.block_club")}
            </button>
          )}
          <button
            onClick={() => {
              setShowDeleteClub(true);
              setError("");
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:border-destructive/60"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <div className="grid gap-5 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label={t("dashboard.athletes")} value={String(athletes.length)} accent />
        <StatCard label={t("dashboard.coaches")} value={String(coaches.length)} />
        <StatCard label={t("admin.club_stat_groups")} value={String(c.groups?.length ?? 0)} />
        <StatCard
          label={t("admin.applications_title")}
          value={String(c.applications?.length ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Club info */}
        <Panel title={t("admin.club_about")}>
          <div className="space-y-2 text-sm">
            <Field label={t("admin.club_name_ru")} value={(typeof c.name === "object" && c.name !== null ? c.name.ru : undefined) ?? localizeName(c.name)} />
            <Field label={t("admin.club_name_kk")} value={(typeof c.name === "object" && c.name !== null ? c.name.kk : undefined) ?? "—"} />
            <Field label={t("admin.club_short_name")} value={c.shortName ?? "—"} />
            <Field label={t("admin.club_city")} value={`${c.city}, ${c.country}`} />
            <Field
              label={t("admin.club_created_by")}
              value={c.createdBy ? `${c.createdBy.name} ${c.createdBy.surname}` : "—"}
            />
            <Field label="Email" value={c.createdBy?.email ?? "—"} />
            <Field
              label={t("admin.field_registered")}
              value={new Date(c.createdAt).toLocaleDateString("kk-KZ")}
            />
            <Field
              label={t("common.status")}
              value={c.isBlocked ? t("admin.blocked_status") : t("admin.active")}
            />
            {c.blockedReason && (
              <div className="text-xs text-destructive/80 border-l-2 border-destructive/40 pl-2 mt-2">
                {c.blockedReason}
              </div>
            )}
          </div>
        </Panel>

        {/* Coaches */}
        <Panel
          title={`${t("dashboard.coaches")} (${coaches.length})`}
          action={
            <button
              onClick={() => {
                setMform({ ...EMPTY_MEMBER_FORM, role: "COACH" });
                setShowAddMember(true);
                setError("");
              }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-gradient-gold text-gold-foreground shadow-gold"
            >
              <UserPlus className="h-3.5 w-3.5" /> {t("common.add")}
            </button>
          }
        >
          {coaches.length === 0 ? (
            <EmptyState title={t("admin.no_coaches")} hint={t("admin.add_btn_hint")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {coaches.map((m: User) => <MemberCard key={m.id} member={m} t={t} />)}
            </ul>
          )}
        </Panel>

        {/* Athletes */}
        <Panel
          title={`${t("dashboard.athletes")} (${athletes.length})`}
          action={
            <button
              onClick={() => {
                setMform({ ...EMPTY_MEMBER_FORM, role: "ATHLETE" });
                setShowAddMember(true);
                setError("");
              }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-gradient-gold text-gold-foreground shadow-gold"
            >
              <UserPlus className="h-3.5 w-3.5" /> {t("common.add")}
            </button>
          }
        >
          {athletes.length === 0 ? (
            <EmptyState title={t("admin.no_athletes")} hint={t("admin.add_btn_hint")} />
          ) : (
            <ul className="space-y-2 text-sm max-h-[600px] overflow-y-auto">
              {athletes.map((m: User) => <MemberCard key={m.id} member={m} t={t} />)}
            </ul>
          )}
        </Panel>

        {/* Groups */}
        <Panel
          title={`${t("admin.groups_panel")} (${c.groups?.length ?? 0})`}
          action={
            <button
              onClick={() => {
                setGform({ name: "", ageMin: "", ageMax: "" });
                setShowAddGroup(true);
                setError("");
              }}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-gradient-gold text-gold-foreground shadow-gold"
            >
              <Plus className="h-3.5 w-3.5" /> {t("admin.add_group")}
            </button>
          }
        >
          {(c.groups ?? []).length === 0 ? (
            <EmptyState title={t("admin.no_groups")} />
          ) : (
            <div className="space-y-2 text-sm">
              {(c.groups ?? []).map((g: ClubGroup) => (
                <div
                  key={g.id}
                  className="flex justify-between items-center rounded-md border border-border/60 bg-background/30 p-3"
                >
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.ageMin}–{g.ageMax} {t("common.years_short")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditGroup(g);
                        setGform({
                          name: g.name,
                          ageMin: String(g.ageMin),
                          ageMax: String(g.ageMax),
                        });
                        setError("");
                      }}
                      className="text-xs p-1.5 rounded glass border border-border hover:border-gold/40"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteGroup(g);
                        setError("");
                      }}
                      className="text-xs p-1.5 rounded bg-destructive/10 text-destructive border border-destructive/30"
                    >
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
        <Panel title={`${t("admin.applications_title")} (${c.applications?.length ?? 0})`}>
          {(c.applications ?? []).length === 0 ? (
            <EmptyState title={t("admin.applications_no")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {(c.applications ?? []).map((a: Application) => (
                <li key={a.id} className="flex justify-between glass rounded p-3">
                  <div>
                    <div className="font-medium">{localizeName(a.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString("kk-KZ")} · {a._count?.entries ?? 0}{" "}
                      {t("dashboard.athletes").toLowerCase()}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full self-start ${
                      a.status === "APPROVED"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : a.status === "REJECTED"
                          ? "bg-destructive/15 text-destructive"
                          : a.status === "SUBMITTED"
                            ? "bg-gold/15 text-gold"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ===== MODALS ===== */}

      {/* Edit club */}
      {showEdit && (
        <Modal title={t("admin.edit_club")} onClose={() => setShowEdit(false)}>
          {Boolean(editMut.error) && <ErrBox msg={(editMut.error as Error)?.message} />}
          <div className="space-y-3">
            <Field2 label={`${t("admin.club_name_ru")} *`}>
              <input
                value={eform.nameRu}
                onChange={fi("nameRu")}
                required
                className={INPUT}
                placeholder="Алматы Дзюдо"
              />
            </Field2>
            <Field2 label={t("admin.club_name_kk")}>
              <input
                value={eform.nameKk}
                onChange={fi("nameKk")}
                className={INPUT}
                placeholder="Алматы Дзюдо"
              />
            </Field2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label={`${t("admin.club_city")} *`}>
                <input
                  value={eform.city}
                  onChange={fi("city")}
                  required
                  className={INPUT}
                  placeholder="Алматы"
                />
              </Field2>
              <Field2 label={t("admin.club_country")}>
                <input
                  value={eform.country}
                  onChange={fi("country")}
                  className={INPUT}
                  placeholder="KZ"
                />
              </Field2>
            </div>
            <Field2 label={t("admin.club_short_name")}>
              <input
                value={eform.shortName}
                onChange={fi("shortName")}
                className={INPUT}
                placeholder="АДС"
              />
            </Field2>
          </div>
          <ModalFooter
            onCancel={() => setShowEdit(false)}
            onConfirm={() => editMut.mutate()}
            loading={editMut.isPending}
            disabled={!eform.nameRu || !eform.city}
            label={t("common.save")}
          />
        </Modal>
      )}

      {/* Add member */}
      {showAddMember && (
        <Modal
          title={mform.role === "COACH" ? t("admin.add_coach") : t("admin.add_athlete")}
          onClose={() => setShowAddMember(false)}
        >
          {Boolean(addMemberMut.error) && <ErrBox msg={(addMemberMut.error as Error)?.message} />}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label={`${t("profile.first_name")} *`}>
                <input
                  value={mform.name}
                  onChange={mfi("name")}
                  required
                  className={INPUT}
                  placeholder="Асылхан"
                />
              </Field2>
              <Field2 label={`${t("profile.last_name")} *`}>
                <input
                  value={mform.surname}
                  onChange={mfi("surname")}
                  required
                  className={INPUT}
                  placeholder="Бекжанов"
                />
              </Field2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label={t("profile.first_name_latin")}>
                <input
                  value={mform.nameLatin}
                  onChange={mfi("nameLatin")}
                  className={INPUT}
                  placeholder="Assylkhan"
                />
              </Field2>
              <Field2 label={t("profile.last_name_latin")}>
                <input
                  value={mform.surnameLatin}
                  onChange={mfi("surnameLatin")}
                  className={INPUT}
                  placeholder="Bekzhanov"
                />
              </Field2>
            </div>
            <Field2 label={`Email *`}>
              <input
                type="email"
                value={mform.email}
                onChange={mfi("email")}
                required
                className={INPUT}
                placeholder="user@example.com"
              />
            </Field2>
            <Field2 label={`${t("admin.password_label")} *`}>
              <input
                type="password"
                value={mform.password}
                onChange={mfi("password")}
                required
                className={INPUT}
                placeholder={t("admin.password_min_hint")}
              />
            </Field2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field2 label={t("admin.field_gender")}>
                <select value={mform.gender} onChange={mfi("gender")} className={INPUT}>
                  <option value="">—</option>
                  <option value="MALE">{t("common.male")}</option>
                  <option value="FEMALE">{t("common.female")}</option>
                </select>
              </Field2>
              <Field2 label={t("admin.field_dob")}>
                <input
                  type="date"
                  value={mform.dateOfBirth}
                  onChange={mfi("dateOfBirth")}
                  className={INPUT}
                />
              </Field2>
            </div>
            {mform.role === "COACH" && (
              <Field2 label={t("admin.field_club_role")}>
                <select value={mform.clubRole} onChange={mfi("clubRole")} className={INPUT}>
                  <option value="COACH">{t("admin.club_role_coach")}</option>
                  <option value="OWNER">{t("admin.club_role_owner")}</option>
                </select>
              </Field2>
            )}
            {mform.role === "ATHLETE" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field2 label={t("admin.field_weight_kg")}>
                  <input
                    type="number"
                    step="0.1"
                    value={mform.weightKg}
                    onChange={mfi("weightKg")}
                    className={INPUT}
                    placeholder="73.0"
                  />
                </Field2>
                <Field2 label={t("admin.field_belt")}>
                  <input
                    value={mform.beltRank}
                    onChange={mfi("beltRank")}
                    className={INPUT}
                    placeholder="1 dan"
                  />
                </Field2>
              </div>
            )}
            <Field2 label={t("admin.field_phone")}>
              <input
                value={mform.phone}
                onChange={mfi("phone")}
                className={INPUT}
                placeholder="+7 700 000 00 00"
              />
            </Field2>
          </div>
          <ModalFooter
            onCancel={() => setShowAddMember(false)}
            onConfirm={() => addMemberMut.mutate()}
            loading={addMemberMut.isPending}
            disabled={!mform.name || !mform.surname || !mform.email || !mform.password}
            label={t("common.add")}
          />
        </Modal>
      )}

      {/* Add / Edit group */}
      {(showAddGroup || editGroup) && (
        <Modal
          title={editGroup ? t("admin.edit_group") : t("admin.add_group")}
          onClose={() => {
            setShowAddGroup(false);
            setEditGroup(null);
          }}
        >
          {Boolean(addGroupMut.error || editGroupMut.error) && (
            <ErrBox msg={((addGroupMut.error || editGroupMut.error) as Error)?.message} />
          )}
          <div className="space-y-3">
            <Field2 label={`${t("admin.group_name")} *`}>
              <input
                value={gform.name}
                onChange={gfi("name")}
                required
                className={INPUT}
                placeholder="Жасөспірімдер"
              />
            </Field2>
            <div className="grid grid-cols-2 gap-3">
              <Field2 label={t("admin.age_from")}>
                <input
                  type="number"
                  value={gform.ageMin}
                  onChange={gfi("ageMin")}
                  className={INPUT}
                  placeholder="10"
                />
              </Field2>
              <Field2 label={t("admin.age_to")}>
                <input
                  type="number"
                  value={gform.ageMax}
                  onChange={gfi("ageMax")}
                  className={INPUT}
                  placeholder="17"
                />
              </Field2>
            </div>
          </div>
          <ModalFooter
            onCancel={() => {
              setShowAddGroup(false);
              setEditGroup(null);
            }}
            onConfirm={() => (editGroup ? editGroupMut.mutate() : addGroupMut.mutate())}
            loading={addGroupMut.isPending || editGroupMut.isPending}
            disabled={!gform.name}
            label={editGroup ? t("common.save") : t("common.add")}
          />
        </Modal>
      )}

      {/* Delete group confirm */}
      {deleteGroup && (
        <Modal title={t("admin.delete_group")} onClose={() => setDeleteGroup(null)}>
          <p className="text-sm text-muted-foreground">
            {t("admin.delete_group_confirm", { name: deleteGroup.name })}
          </p>
          {Boolean(deleteGroupMut.error) && <ErrBox msg={(deleteGroupMut.error as Error)?.message} />}
          <ModalFooter
            onCancel={() => setDeleteGroup(null)}
            onConfirm={() => deleteGroupMut.mutate()}
            loading={deleteGroupMut.isPending}
            label={t("common.delete")}
            danger
          />
        </Modal>
      )}

      {/* Delete club confirm */}
      {showDeleteClub && (
        <Modal title={t("admin.delete_club")} onClose={() => setShowDeleteClub(false)}>
          <p className="text-sm text-muted-foreground mb-1">
            {t("admin.delete_club_confirm", { name: localizeName(c.name) })}
          </p>
          <p className="text-xs text-destructive/80">{t("admin.delete_club_warning")}</p>
          {Boolean(deleteMut.error) && <ErrBox msg={(deleteMut.error as Error)?.message} />}
          <ModalFooter
            onCancel={() => setShowDeleteClub(false)}
            onConfirm={() => deleteMut.mutate()}
            loading={deleteMut.isPending}
            label={t("common.delete")}
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
const INPUT =
  "mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, disabled, label, danger }: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onCancel} className="text-sm px-4 py-2 rounded glass border border-border">
        {t("common.cancel")}
      </button>
      <button
        onClick={onConfirm}
        disabled={loading || disabled}
        className={`text-sm px-4 py-2 rounded disabled:opacity-50 ${
          danger
            ? "bg-destructive/20 text-destructive border border-destructive/40"
            : "bg-gradient-gold text-gold-foreground shadow-gold"
        }`}
      >
        {loading ? t("common.saving") : label}
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

function StatCard({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-xl p-5 ${accent ? "border-gold/40" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent ? "text-gradient-gold" : ""}`}>
        {value}
      </div>
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

function localizeName(n: import("@/lib/api-types").LocalizedName | string | null | undefined): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

function docTypeLabel(type: string): string {
  if (type === "BIRTH_CERTIFICATE") return "Туу туралы";
  if (type === "STUDY_CERTIFICATE") return "Оқу куәлігі";
  if (type === "COACH_ID") return "Тренер куәлігі";
  return "Құжат";
}

function MemberCard({ member: m, t }: { member: User; t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const docs: UserDocument[] = (m as any).documents ?? [];

  return (
    <li className={`glass rounded-lg overflow-hidden transition-colors ${open ? "border border-gold/30" : ""}`}>
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gold/5 transition-colors text-left"
      >
        <Avatar
          src={(m as any).avatarUrl ? mediaUrl((m as any).avatarUrl) : null}
          name={`${m.name} ${m.surname}`}
          size={36}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{m.name} {m.surname}</div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
            {m.gender === "MALE" ? t("common.male") : m.gender === "FEMALE" ? t("common.female") : null}
            {(m as any).weightKg ? <span>· {(m as any).weightKg} {t("common.kg")}</span> : null}
            {(m as any).beltRank ? <span>· {(m as any).beltRank}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(m as any).totalPoints ? (
            <span className="font-display font-bold text-gold text-sm">{Math.round((m as any).totalPoints)}</span>
          ) : null}
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
            {m.isActive ? t("admin.active") : t("admin.blocked_status")}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180 text-gold" : ""}`} />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-border/30 bg-gold/5 px-4 py-3 space-y-3">
          {/* Contact + personal info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {m.email && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" /> {m.email}
              </div>
            )}
            {(m as any).phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" /> {(m as any).phone}
              </div>
            )}
            {(m as any).dateOfBirth && (
              <div className="text-muted-foreground">
                {t("admin.born_label")}: {new Date((m as any).dateOfBirth).toLocaleDateString("kk-KZ")}
              </div>
            )}
            {(m as any).nameLatin && (m as any).surnameLatin && (
              <div className="text-muted-foreground">
                {(m as any).nameLatin} {(m as any).surnameLatin}
              </div>
            )}
          </div>

          {/* Documents */}
          {docs.length > 0 ? (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {t("documents.title")}
              </div>
              <div className="flex flex-wrap gap-2">
                {docs.map((doc) => (
                  <a
                    key={doc.id}
                    href={mediaUrl(doc.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="group block overflow-hidden rounded-lg border border-border/60 hover:border-gold/50 transition-colors"
                    title={docTypeLabel(doc.type)}
                  >
                    {doc.mimeType?.startsWith("image/") ? (
                      <img
                        src={mediaUrl(doc.url)}
                        alt={docTypeLabel(doc.type)}
                        className="h-24 w-24 object-cover group-hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 bg-card/60 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                        <span className="text-[9px] text-center px-1 leading-tight">{docTypeLabel(doc.type)}</span>
                      </div>
                    )}
                    <div className="bg-card/80 px-1.5 py-1 text-[9px] text-center text-muted-foreground truncate w-24">
                      {docTypeLabel(doc.type)}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">{t("documents.no_documents")}</div>
          )}
        </div>
      )}
    </li>
  );
}
