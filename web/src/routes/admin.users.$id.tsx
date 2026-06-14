import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  ArrowLeft,
  Edit2,
  ExternalLink,
  FileText,
  Key,
  Lock,
  RefreshCw,
  Unlock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { Club, User, RatingEntry, UserDocument } from "@/lib/api-types";
import { Avatar } from "@/components/ui/avatar-image";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordStrength, isPasswordStrong } from "@/components/ui/PasswordStrength";

export const Route = createFileRoute("/admin/users/$id")({
  head: () => ({ meta: [{ title: "Пайдаланушы — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminUserDetail />
    </ProtectedRoute>
  ),
});

const INPUT =
  "mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none";

function AdminUserDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/admin/users/$id" });
  const qc = useQueryClient();
  const [error, setError] = useState("");

  // Modal state
  const [showEdit, setShowEdit] = useState(false);
  const [showChangeClub, setShowChangeClub] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);

  // Edit form
  const [eform, setEform] = useState({
    name: "",
    surname: "",
    nameLatin: "",
    surnameLatin: "",
    email: "",
    dateOfBirth: "",
    gender: "" as "" | "MALE" | "FEMALE",
    weightKg: "",
    beltRank: "",
    phone: "",
  });
  const [newClubId, setNewClubId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const query = useQuery({ queryKey: ["admin-user", id], queryFn: () => api.admin.getUser(id) });
  const clubsQuery = useQuery({
    queryKey: ["admin-clubs-list"],
    queryFn: () => api.clubs.list({ limit: 1000 }),
  });

  const initEditForm = (u: User) => {
    setEform({
      name: u.name ?? "",
      surname: u.surname ?? "",
      nameLatin: u.nameLatin ?? "",
      surnameLatin: u.surnameLatin ?? "",
      email: u.email ?? "",
      dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString().split("T")[0] : "",
      gender: u.gender ?? "",
      weightKg: u.weightKg != null ? String(u.weightKg) : "",
      beltRank: u.beltRank ?? "",
      phone: u.phone ?? "",
    });
  };

  const toggleMut = useMutation({
    mutationFn: () => api.admin.toggleUserActive(id, !query.data?.isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-user", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const editMut = useMutation({
    mutationFn: () =>
      api.admin.updateUser(id, {
        name: eform.name || undefined,
        surname: eform.surname || undefined,
        nameLatin: eform.nameLatin || null,
        surnameLatin: eform.surnameLatin || null,
        email: eform.email || undefined,
        dateOfBirth: eform.dateOfBirth || null,
        gender: eform.gender || undefined,
        weightKg: eform.weightKg ? parseFloat(eform.weightKg) : null,
        beltRank: eform.beltRank || null,
        phone: eform.phone || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      setShowEdit(false);
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const changeClubMut = useMutation({
    mutationFn: () => api.admin.changeUserClub(id, newClubId || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      setShowChangeClub(false);
      setNewClubId("");
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const resetPwdMut = useMutation({
    mutationFn: () => api.admin.resetUserPassword(id, newPassword),
    onSuccess: () => {
      setShowResetPwd(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  if (query.isLoading)
    return (
      <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("common.loading")}>
        <LoadingState />
      </DashboardShell>
    );
  const u = query.data;
  if (!u)
    return (
      <DashboardShell
        role={t("admin.role_label")}
        navItems={nav}
        accentTitle={t("common.not_found")}
      >
        <EmptyState title="—" />
      </DashboardShell>
    );

  const totalPoints = (u.ratingEntries ?? []).reduce(
    (s: number, e: RatingEntry) => s + Number(e.points),
    0,
  );
  const totalMatches = (u._count?.redmatches ?? 0) + (u._count?.bluematches ?? 0);

  const fi =
    (f: keyof typeof eform) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEform((p) => ({ ...p, [f]: e.target.value }));

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={`${u.name} ${u.surname}`}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> {t("admin.back_to_users")}
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              initEditForm(u);
              setShowEdit(true);
              setError("");
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded glass border border-gold/40 hover:border-gold"
          >
            <Edit2 className="h-3.5 w-3.5" /> {t("common.edit")}
          </button>
          <button
            onClick={() => {
              setNewClubId(u.clubId ?? "");
              setShowChangeClub(true);
              setError("");
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded glass border border-border hover:border-gold/40"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t("admin.change_club")}
          </button>
          <button
            onClick={() => {
              setShowResetPwd(true);
              setError("");
            }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded glass border border-amber-500/40 text-amber-300 hover:border-amber-500/70"
          >
            <Key className="h-3.5 w-3.5" /> {t("admin.reset_password")}
          </button>
          <button
            onClick={() => toggleMut.mutate()}
            disabled={toggleMut.isPending}
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded disabled:opacity-50 ${
              u.isActive
                ? "bg-destructive/15 text-destructive border border-destructive/40"
                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
            }`}
          >
            {u.isActive ? (
              <>
                <Lock className="h-3.5 w-3.5" /> {t("admin.block_user")}
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" /> {t("admin.unblock_user")}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      {/* Status bar */}
      <div className="glass rounded-xl p-4 mb-6 flex items-center gap-3 flex-wrap">
        <span
          className={`text-[11px] px-2.5 py-1 rounded font-medium ${
            u.role === "ADMIN"
              ? "bg-gold/15 text-gold"
              : u.role === "COACH"
                ? "bg-sky-500/15 text-sky-300"
                : "bg-emerald-500/15 text-emerald-300"
          }`}
        >
          {u.role}
        </span>
        <span
          className={`text-[11px] px-2.5 py-1 rounded-full ${u.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}
        >
          {u.isActive ? t("admin.active") : t("admin.blocked_status")}
        </span>
        <span className="text-sm text-muted-foreground">{u.email}</span>
        {u.club && (
          <Link
            to="/admin/clubs/$id"
            params={{ id: u.club.id }}
            className="text-sm text-gold hover:underline"
          >
            {localizeName(u.club.name)}
          </Link>
        )}
      </div>

      <div className="grid gap-5 grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard label={t("admin.stat_rating")} value={String(Math.round(totalPoints))} accent />
        <StatCard
          label={t("admin.stat_matches")}
          value={String(totalMatches)}
          hint={`${u._count?.wonMatches ?? 0} ${t("admin.stat_wins")}`}
        />
        <StatCard
          label={t("admin.stat_tournaments")}
          value={String((u.ratingEntries ?? []).length)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("admin.personal_info")}>
          <div className="space-y-2 text-sm">
            {u.avatarUrl && (
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-border/50 bg-background/35 p-3">
                <Avatar
                  src={mediaUrl(u.avatarUrl)}
                  name={`${u.name} ${u.surname}`}
                  size={56}
                  className="border border-gold/30"
                />
                <div>
                  <div className="text-sm font-semibold">{t("profile.avatar")}</div>
                  <a
                    href={mediaUrl(u.avatarUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gold hover:underline"
                  >
                    {t("documents.open_file")}
                  </a>
                </div>
              </div>
            )}
            <Field label={t("admin.field_fullname")} value={`${u.name} ${u.surname}`} />
            <Field
              label={t("admin.field_latin")}
              value={`${u.nameLatin ?? ""} ${u.surnameLatin ?? ""}`.trim() || "—"}
            />
            <Field
              label={t("admin.field_gender")}
              value={
                u.gender === "MALE"
                  ? t("common.male")
                  : u.gender === "FEMALE"
                    ? t("common.female")
                    : "—"
              }
            />
            <Field
              label={t("admin.field_dob")}
              value={u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString("kk-KZ") : "—"}
            />
            <Field
              label={t("admin.field_weight")}
              value={u.weightKg ? `${u.weightKg} ${t("common.kg")}` : "—"}
            />
            <Field label={t("admin.field_belt")} value={u.beltRank ?? "—"} />
            <Field label={t("admin.field_phone")} value={u.phone ?? "—"} />
            <Field label={t("admin.field_club")} value={u.club ? localizeName(u.club.name) : "—"} />
            <Field
              label={t("admin.field_registered")}
              value={new Date(u.createdAt).toLocaleDateString("kk-KZ")}
            />
          </div>
        </Panel>

        <Panel title={t("documents.title")}>
          <DocumentList documents={u.documents ?? []} />
        </Panel>

        <Panel title={t("admin.tournament_results")}>
          {(u.ratingEntries ?? []).length === 0 ? (
            <EmptyState title={t("admin.no_tournament_results")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {(u.ratingEntries ?? []).map((e: RatingEntry) => (
                <li key={e.id} className="flex justify-between glass rounded-md p-3">
                  <div>
                    <div className="font-medium">{localizeName(e.tournament?.name)}</div>
                    <div className="text-xs text-muted-foreground">{placeLabel(e.place, t)}</div>
                  </div>
                  <span className="text-gold font-display text-lg">{Number(e.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ===== MODALS ===== */}

      {/* Edit profile */}
      {showEdit && (
        <Modal title={t("admin.edit_profile")} onClose={() => setShowEdit(false)}>
          {Boolean(editMut.error) && <ErrBox msg={(editMut.error as Error)?.message} />}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("profile.first_name")} *
                </label>
                <input value={eform.name} onChange={fi("name")} required className={INPUT} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("profile.last_name")} *
                </label>
                <input value={eform.surname} onChange={fi("surname")} required className={INPUT} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("profile.first_name_latin")}
                </label>
                <input value={eform.nameLatin} onChange={fi("nameLatin")} className={INPUT} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("profile.last_name_latin")}
                </label>
                <input value={eform.surnameLatin} onChange={fi("surnameLatin")} className={INPUT} />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input type="email" value={eform.email} onChange={fi("email")} className={INPUT} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.field_gender")}
                </label>
                <select value={eform.gender} onChange={fi("gender")} className={INPUT}>
                  <option value="">—</option>
                  <option value="MALE">{t("common.male")}</option>
                  <option value="FEMALE">{t("common.female")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.field_dob")}
                </label>
                <input
                  type="date"
                  value={eform.dateOfBirth}
                  onChange={fi("dateOfBirth")}
                  className={INPUT}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.field_weight_kg")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={eform.weightKg}
                  onChange={fi("weightKg")}
                  className={INPUT}
                  placeholder="73.0"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("admin.field_belt")}
                </label>
                <input
                  value={eform.beltRank}
                  onChange={fi("beltRank")}
                  className={INPUT}
                  placeholder="1 dan"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("admin.field_phone")}
              </label>
              <input
                value={eform.phone}
                onChange={fi("phone")}
                className={INPUT}
                placeholder="+7 700 000 00 00"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowEdit(false)}
              className="text-sm px-4 py-2 rounded glass border border-border"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => editMut.mutate()}
              disabled={editMut.isPending || !eform.name || !eform.surname}
              className="text-sm px-4 py-2 rounded bg-gradient-gold text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {editMut.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </Modal>
      )}

      {/* Change club */}
      {showChangeClub && (
        <Modal title={t("admin.change_club")} onClose={() => setShowChangeClub(false)}>
          {Boolean(changeClubMut.error) && <ErrBox msg={(changeClubMut.error as Error)?.message} />}
          <p className="text-sm text-muted-foreground mb-3">
            {t("admin.current_club_label")}:{" "}
            <strong>{u.club ? localizeName(u.club.name) : t("admin.no_club")}</strong>
          </p>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("admin.new_club_label")}
            </label>
            <select
              value={newClubId}
              onChange={(e) => setNewClubId(e.target.value)}
              className={INPUT}
            >
              <option value="">— {t("admin.no_club")} —</option>
              {(clubsQuery.data?.items ?? []).map((c: Club) => (
                <option key={c.id} value={c.id}>
                  {localizeName(c.name)} ({c.city})
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowChangeClub(false)}
              className="text-sm px-4 py-2 rounded glass border border-border"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => changeClubMut.mutate()}
              disabled={changeClubMut.isPending}
              className="text-sm px-4 py-2 rounded bg-gradient-gold text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {changeClubMut.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset password */}
      {showResetPwd && (
        <Modal
          title={t("admin.reset_password")}
          onClose={() => {
            setShowResetPwd(false);
            setNewPassword("");
            setConfirmPassword("");
          }}
        >
          {Boolean(resetPwdMut.error) && <ErrBox msg={(resetPwdMut.error as Error)?.message} />}
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("admin.new_password_label")} *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT}
                placeholder={t("admin.password_min_hint")}
              />
              <PasswordStrength password={newPassword} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("admin.confirm_password_label")} *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT}
                placeholder={t("admin.password_reenter_hint")}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive mt-1">{t("admin.password_mismatch")}</p>
              )}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowResetPwd(false);
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="text-sm px-4 py-2 rounded glass border border-border"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => resetPwdMut.mutate()}
              disabled={
                resetPwdMut.isPending ||
                !isPasswordStrong(newPassword) ||
                newPassword !== confirmPassword
              }
              className="text-sm px-4 py-2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 disabled:opacity-50"
            >
              {resetPwdMut.isPending ? t("common.saving") : t("admin.reset_password")}
            </button>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}

function DocumentList({ documents }: { documents: UserDocument[] }) {
  const { t } = useTranslation();
  const ordered = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "COACH_ID"]
    .map((type) => documents.find((document) => document.type === type))
    .filter((document): document is UserDocument => Boolean(document));

  if (ordered.length === 0) {
    return (
      <EmptyState title={t("documents.no_documents")} hint={t("documents.no_documents_hint")} />
    );
  }

  return (
    <div className="space-y-2">
      {ordered.map((document: UserDocument) => (
        <button
          type="button"
          key={document.id}
          onClick={() => api.auth.downloadDocument(document).catch(() => undefined)}
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
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Shared UI
// ============================================================
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

function ErrBox({ msg }: { msg?: string }) {
  return (
    <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
      {msg ?? "Қате орын алды"}
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

function placeLabel(p: number, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const place = t("admin.place_n", { n: p });
  if (p === 1) return `🥇 ${place}`;
  if (p === 2) return `🥈 ${place}`;
  if (p === 3) return `🥉 ${place}`;
  return place;
}

function documentTypeLabel(type: string, t: (k: string) => string): string {
  if (type === "BIRTH_CERTIFICATE") return t("documents.birth_certificate");
  if (type === "STUDY_CERTIFICATE") return t("documents.study_certificate");
  if (type === "COACH_ID") return t("documents.coach_id");
  return type;
}

function localizeName(n: import("@/lib/api-types").LocalizedName | string | null | undefined): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
