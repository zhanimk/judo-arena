import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  //   Building2,
  Check,
  Crown,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  Phone,
  Mail,
  MapPin,
  Instagram,
} from "lucide-react";
import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import {
  DashboardShell,
  EmptyState,
  LoadingState,
  Panel,
} from "@/components/dashboard/DashboardShell";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { AddAthleteInput, Club, ClubGroup, ClubJoinRequest, User } from "@/lib/api-types";
import { Avatar, LazyImage } from "@/components/ui/avatar-image";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/club")({
  head: () => ({ meta: [{ title: "Клуб — Judo-Arena" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachClub />
    </ProtectedRoute>
  ),
});

type Locale = "kk" | "ru" | "en";
type ClubForm = {
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  shortName: string;
  city: string;
  country: string;
  logoUrl: string;
};

const emptyForm: ClubForm = {
  name: { kk: "", ru: "", en: "" },
  description: { kk: "", ru: "", en: "" },
  shortName: "",
  city: "",
  country: "KZ",
  logoUrl: "",
};

const showAdvancedClubTools = false;

function CoachClub() {
  const { t } = useTranslation();
  const { user, refreshMe } = useAuth();
  const clubId = user?.clubId;
  const isOwner = user?.clubRole === "OWNER";
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const clubQuery = useQuery({
    queryKey: ["coach-club", clubId],
    queryFn: () => (clubId ? api.clubs.get(clubId) : null),
    enabled: !!clubId,
  });

  const groupsQuery = useQuery({
    queryKey: ["club-groups", clubId],
    queryFn: () => (clubId ? api.clubs.groups(clubId) : []),
    enabled: !!clubId,
  });

  const coachRequestsQuery = useQuery({
    queryKey: ["coach-club-join-requests", user?.id],
    queryFn: () => api.coachClubRequests.myList(),
    enabled: !!user && !clubId,
  });

  const incomingCoachRequestsQuery = useQuery({
    queryKey: ["incoming-coach-club-join-requests", clubId],
    queryFn: () => api.coachClubRequests.incoming(),
    enabled: !!clubId && isOwner,
  });

  const formInitial = useMemo(() => toClubForm(clubQuery.data), [clubQuery.data]);

  const saveClub = useMutation({
    mutationFn: (form: ClubForm) => {
      const payload = fromClubForm(form);
      return clubId ? api.clubs.update(clubId, payload) : api.clubs.create(payload);
    },
    onSuccess: async () => {
      setError("");
      await refreshMe();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["coach-club"] }),
        qc.invalidateQueries({ queryKey: ["club"] }),
        qc.invalidateQueries({ queryKey: ["club-groups"] }),
        qc.invalidateQueries({ queryKey: ["auth-me"] }),
        qc.invalidateQueries({ queryKey: ["coach-club-join-requests"] }),
      ]);
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach_club.save_error")),
  });

  return (
    <DashboardShell
      role={t("dashboard.coach")}
      navItems={nav}
      accentTitle={t("coach_club.my_club")}
    >
      {!clubId && (
        <div className="mb-6 rounded-md border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
          {t("coach_club.no_club_hint")}
        </div>
      )}

      {!clubId && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Panel title={t("coach_club.create_club")}>
            <ClubEditor
              initial={formInitial}
              isSaving={saveClub.isPending}
              error={error}
              onSubmit={(form) => saveClub.mutate(form)}
            />
          </Panel>
          <Panel title={t("coach_club.join_club")}>
            <CoachJoinClubPanel
              requests={coachRequestsQuery.data ?? []}
              isLoading={coachRequestsQuery.isLoading}
              onChanged={async () => {
                await Promise.all([
                  qc.invalidateQueries({ queryKey: ["coach-club-join-requests"] }),
                  qc.invalidateQueries({ queryKey: ["auth-me"] }),
                ]);
                await refreshMe();
              }}
            />
          </Panel>
        </div>
      )}

      {clubId && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <Panel title={clubId ? t("coach_club.club_card") : t("coach_club.create_club")}>
            {clubQuery.isLoading ? (
              <LoadingState />
            ) : (
              <ClubEditor
                initial={formInitial}
                isSaving={saveClub.isPending}
                error={error}
                onSubmit={(form) => saveClub.mutate(form)}
                readOnly={!isOwner}
              />
            )}
          </Panel>

          <Panel title={t("coach_club.preview")}>
            <ClubPreview club={clubQuery.data} fallback={formInitial} />
            <div className="mt-5 border-t border-border/40 pt-5">
              <h3 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                {t("coach_club.club_coaches")}
              </h3>
              <ClubCoaches
                clubId={clubId}
                currentUserId={user?.id}
                canManage={isOwner}
                coaches={clubQuery.data?.members ?? (user ? [user] : [])}
                onChanged={async () => {
                  await Promise.all([
                    qc.invalidateQueries({ queryKey: ["coach-club"] }),
                    qc.invalidateQueries({ queryKey: ["auth-me"] }),
                  ]);
                  await refreshMe();
                }}
              />
            </div>
          </Panel>
        </div>
      )}

      {clubId && isOwner && (
        <div className="mt-6">
          <Panel
            title={`${t("coach_club.coach_requests")} ${incomingCoachRequestsQuery.data?.length ?? 0}`}
          >
            <IncomingCoachRequests
              requests={incomingCoachRequestsQuery.data ?? []}
              isLoading={incomingCoachRequestsQuery.isLoading}
              onChanged={async () => {
                await Promise.all([
                  qc.invalidateQueries({ queryKey: ["incoming-coach-club-join-requests", clubId] }),
                  qc.invalidateQueries({ queryKey: ["coach-club", clubId] }),
                ]);
              }}
            />
          </Panel>
        </div>
      )}

      {clubId && showAdvancedClubTools && (
        <div className="mt-6">
          <Panel title={`${t("coach_club.age_groups")} ${groupsQuery.data?.length ?? 0}`}>
            {!clubId ? (
              <EmptyState
                title={t("coach_club.create_club_first")}
                hint={t("coach_club.groups_after_save")}
              />
            ) : groupsQuery.isLoading ? (
              <LoadingState />
            ) : (
              <GroupsManager
                clubId={clubId}
                groups={groupsQuery.data ?? []}
                onChanged={() => qc.invalidateQueries({ queryKey: ["club-groups", clubId] })}
              />
            )}
          </Panel>
        </div>
      )}

      {clubId && showAdvancedClubTools && (
        <div className="mt-6">
          <BulkImportPanel
            clubId={clubId}
            onImported={() => qc.invalidateQueries({ queryKey: ["club-members", clubId] })}
          />
        </div>
      )}
    </DashboardShell>
  );
}

function BulkImportPanel({ clubId, onImported }: { clubId: string; onImported: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: { row: number; email: string; reason: string }[];
  } | null>(null);
  //   const _qc = useQueryClient();

  const importMut = useMutation({
    mutationFn: (rows: AddAthleteInput[]) => api.clubs.bulkImportAthletes(clubId, rows),
    onSuccess: (r) => {
      setResult(r);
      onImported();
      import("sonner").then(({ toast }) =>
        toast.success(t("coach_club.import_success", { count: r.created })),
      );
    },
    onError: (e: unknown) => {
      import("sonner").then(({ toast }) =>
        toast.error(e instanceof ApiError ? (e as ApiError).message : t("error.generic")),
      );
    },
  });

  function parseCsv(text: string): AddAthleteInput[] {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = vals[i] ?? "";
      });
      const normalizedGender = obj.gender?.toUpperCase();
      const gender =
        normalizedGender === "MALE" || normalizedGender === "FEMALE" ? normalizedGender : undefined;
      return {
        email: obj.email,
        password: obj.password,
        name: obj.name,
        surname: obj.surname,
        nameLatin: obj.namelatin || obj.name_latin || undefined,
        surnameLatin: obj.surnamelatin || obj.surname_latin || undefined,
        dateOfBirth: obj.dateofbirth || obj.date_of_birth || undefined,
        gender,
        weightKg: obj.weightkg || obj.weight ? parseFloat(obj.weightkg || obj.weight) : undefined,
        beltRank: obj.beltrank || obj.belt_rank || undefined,
        phone: obj.phone || undefined,
      };
    });
  }

  const TEMPLATE = `email,password,name,surname,nameLatin,surnameLatin,dateOfBirth,gender,weightKg,beltRank
athlete1@club.kz,Pass1234!,Айбек,Сейткали,Aibek,Seitkali,2005-03-15,MALE,73,6 КЮ
athlete2@club.kz,Pass1234!,Дина,Байжан,Dina,Baizan,2006-07-22,FEMALE,57,5 КЮ`;

  return (
    <Panel title={t("coach_club.csv_import_title")}>
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm text-gold hover:underline">
          {t("coach_club.csv_import_open")} →
        </button>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            {t("coach_club.csv_format_label")}:{" "}
            <code className="bg-muted px-1 rounded">
              email, password, name, surname, nameLatin, surnameLatin, dateOfBirth, gender,
              weightKg, beltRank
            </code>
          </div>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
              a.download = "athletes_template.csv";
              a.click();
            }}
            className="text-xs text-gold hover:underline"
          >
            {t("coach_club.csv_download_template")}
          </button>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder={t("coach_club.csv_paste_hint")}
            className="w-full bg-input border border-border rounded px-3 py-2 text-xs font-mono focus:border-gold focus:outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                const rows = parseCsv(csvText);
                if (!rows.length) {
                  import("sonner").then(({ toast }) =>
                    toast.error(t("coach_club.csv_parse_error")),
                  );
                  return;
                }
                importMut.mutate(rows);
              }}
              disabled={importMut.isPending || !csvText.trim()}
              className="bg-gradient-gold text-gold-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            >
              {importMut.isPending ? t("coach_club.importing") : t("coach_club.import_btn")}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setResult(null);
                setCsvText("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("common.close")}
            </button>
          </div>

          {result && (
            <div className="glass rounded p-3 text-sm space-y-1">
              <div className="text-emerald-400">
                ✓ {t("coach_club.import_created")}: {result.created}
              </div>
              {result.skipped > 0 && (
                <div className="text-yellow-400">
                  ↷ {t("coach_club.import_skipped")}: {result.skipped}
                </div>
              )}
              {result.errors.length > 0 && (
                <details className="text-xs text-destructive">
                  <summary className="cursor-pointer">
                    {result.errors.length} {t("coach_club.import_errors")}
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        {t("coach_club.import_row")} {e.row}: {e.email} — {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function ClubEditor({
  initial,
  isSaving,
  error,
  onSubmit,
  readOnly = false,
}: {
  initial: ClubForm;
  isSaving: boolean;
  error: string;
  onSubmit: (form: ClubForm) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [locale, setLocale] = useState<Locale>("kk");

  useEffect(() => setForm(initial), [initial]);

  const uploadLogo = useMutation({
    mutationFn: (file: File) => api.uploads.image(file),
    onSuccess: ({ url }) => setForm((current) => ({ ...current, logoUrl: url })),
  });

  const updateLocale = (key: "name" | "description", value: string) => {
    setForm((current) => ({ ...current, [key]: { ...current[key], [locale]: value } }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly) onSubmit(form);
      }}
      className="space-y-5"
    >
      {readOnly && (
        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          {t("coach_club.readonly_hint")}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(["kk", "ru", "en"] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => setLocale(lng)}
            disabled={readOnly}
            className={`rounded-md border px-3 py-1.5 text-xs uppercase transition-colors ${
              locale === lng
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {lng}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={`${t("coach_club.name_label")} (${locale.toUpperCase()})`}
          value={form.name[locale]}
          onChange={(value) => updateLocale("name", value)}
          required={locale === "kk"}
          disabled={readOnly}
        />
        <Field
          label={t("coach_club.short_name")}
          value={form.shortName}
          onChange={(shortName) => setForm({ ...form, shortName })}
          placeholder="JCL Almaty"
          disabled={readOnly}
        />
        <Field
          label={t("admin.club_city")}
          value={form.city}
          onChange={(city) => setForm({ ...form, city })}
          required
          disabled={readOnly}
        />
        <Field
          label={t("admin.club_country")}
          value={form.country}
          onChange={(country) => setForm({ ...form, country: country.toUpperCase().slice(0, 2) })}
          required
          maxLength={2}
          disabled={readOnly}
        />
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("coach_club.logo_label")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              disabled={readOnly}
              placeholder="/uploads/... or https://..."
              className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
            <label
              className={`inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground ${readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-foreground"}`}
            >
              {uploadLogo.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("coach_club.upload_btn")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={readOnly}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo.mutate(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("coach_club.description_label")} ({locale.toUpperCase()})
        </label>
        <textarea
          value={form.description[locale]}
          onChange={(e) => updateLocale("description", e.target.value)}
          disabled={readOnly}
          rows={5}
          className="mt-1.5 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
          placeholder={t("coach_club.description_placeholder")}
        />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {!readOnly && (
        <button
          disabled={isSaving}
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2.5 font-medium text-gold-foreground shadow-gold disabled:opacity-50 sm:w-auto"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("common.save")}
        </button>
      )}
    </form>
  );
}

function GroupsManager({
  clubId,
  groups,
  onChanged,
}: {
  clubId: string;
  groups: ClubGroup[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ name: "", ageMin: "6", ageMax: "8" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const createGroup = useMutation({
    mutationFn: () => api.clubs.createGroup(clubId, toGroupPayload(draft)),
    onSuccess: () => {
      setDraft({ name: "", ageMin: "6", ageMax: "8" });
      setError("");
      onChanged();
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach_club.group_add_error")),
  });

  const updateGroup = useMutation({
    mutationFn: (group: EditableClubGroup) =>
      api.clubs.updateGroup(group.id, toGroupPayload(group)),
    onSuccess: () => {
      setEditingId(null);
      setError("");
      onChanged();
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach_club.group_save_error")),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.clubs.deleteGroup(id),
    onSuccess: onChanged,
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach_club.group_delete_error")),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createGroup.mutate();
        }}
        className="grid gap-3 rounded-md border border-border/60 bg-background/30 p-3 md:grid-cols-[minmax(180px,1fr)_110px_110px_auto]"
      >
        <Field
          label={t("admin.group_name")}
          value={draft.name}
          onChange={(name) => setDraft({ ...draft, name })}
          required
        />
        <Field
          label={t("admin.age_from")}
          type="number"
          value={draft.ageMin}
          onChange={(ageMin) => setDraft({ ...draft, ageMin })}
          required
        />
        <Field
          label={t("admin.age_to")}
          type="number"
          value={draft.ageMax}
          onChange={(ageMax) => setDraft({ ...draft, ageMax })}
          required
        />
        <button
          disabled={createGroup.isPending}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gold/15 px-4 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {createGroup.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("common.add")}
        </button>
      </form>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {groups.length === 0 ? (
        <EmptyState title={t("coach_club.no_groups")} hint="U10, U12, Junior" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              isEditing={editingId === group.id}
              isBusy={updateGroup.isPending || deleteGroup.isPending}
              onEdit={() => setEditingId(group.id)}
              onCancel={() => setEditingId(null)}
              onSave={(next) => updateGroup.mutate(next)}
              onDelete={() => deleteGroup.mutate(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  isEditing,
  isBusy,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  group: ClubGroup;
  isEditing: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: EditableClubGroup) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    ...group,
    ageMin: String(group.ageMin),
    ageMax: String(group.ageMax),
  });

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="rounded-md border border-gold/30 bg-gold/5 p-4"
      >
        <div className="space-y-3">
          <Field
            label={t("admin.group_name")}
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Min"
              type="number"
              value={form.ageMin}
              onChange={(ageMin) => setForm({ ...form, ageMin })}
              required
            />
            <Field
              label="Max"
              type="number"
              value={form.ageMax}
              onChange={(ageMax) => setForm({ ...form, ageMax })}
              required
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            disabled={isBusy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm text-gold-foreground shadow-gold disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {t("common.save")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{group.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {group.ageMin}-{group.ageMax} {t("common.years_short")}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label={t("common.edit")}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isBusy}
            className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type EditableClubGroup = Omit<ClubGroup, "ageMin" | "ageMax"> & {
  ageMin: string;
  ageMax: string;
};

function ClubPreview({ club, fallback }: { club: Club | null | undefined; fallback: ClubForm }) {
  const { t } = useTranslation();
  const logo = club?.logoUrl || fallback.logoUrl;
  const name =
    localizeName(club?.name) ||
    fallback.name.kk ||
    fallback.name.ru ||
    fallback.name.en ||
    "Judo Club";
  const description =
    localizeName(club?.description) ||
    fallback.description.kk ||
    fallback.description.ru ||
    fallback.description.en ||
    t("coach_club.description_preview_hint");

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/30">
      <div className="flex aspect-[16/9] items-center justify-center bg-muted/30">
        {logo ? (
          <LazyImage src={mediaUrl(logo)} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <div className="p-4">
        <div className="font-display text-xl font-semibold">{name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          {club?.city || fallback.city || t("admin.club_city")} ·{" "}
          {(() => {
            const code = club?.country || fallback.country || "KZ";
            const c = COUNTRIES.find((x) => x.code === code);
            return c ? `${c.flag} ${c.name}` : code;
          })()}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CoachJoinClubPanel({
  requests,
  isLoading,
  onChanged,
}: {
  requests: ClubJoinRequest[];
  isLoading: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const clubsQuery = useQuery({
    queryKey: ["clubs-for-coach-join", search],
    queryFn: () => api.clubs.list({ search: search.trim() || undefined }),
  });

  const pending = requests.find((request) => request.status === "PENDING");
  const requestClub = useMutation({
    mutationFn: (clubId: string) => api.clubs.coachJoinRequest(clubId),
    onSuccess: async () => {
      setError("");
      await onChanged();
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach_club.request_error")),
  });
  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.coachClubRequests.cancel(id),
    onSuccess: async () => {
      setError("");
      await onChanged();
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : t("coach_club.cancel_error")),
  });

  return (
    <div className="space-y-4">
      {pending && (
        <div className="rounded-md border border-gold/30 bg-gold/10 p-4">
          <div className="text-sm font-semibold text-gold">{t("coach_club.request_sent")}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {localizeName(pending.club?.name)} · {pending.club?.city}
          </div>
          <button
            type="button"
            disabled={cancelRequest.isPending}
            onClick={() => cancelRequest.mutate(pending.id)}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {cancelRequest.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {t("common.cancel")}
          </button>
        </div>
      )}

      <Field
        label={t("coach_club.search_club")}
        value={search}
        onChange={setSearch}
        placeholder={t("coach_club.search_club_placeholder")}
      />
      {error && <div className="text-sm text-destructive">{error}</div>}

      {isLoading || clubsQuery.isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-2">
          {(clubsQuery.data?.items ?? []).map((club: Club) => {
            const isCurrentPending = pending?.clubId === club.id;
            return (
              <div
                key={club.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/30 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{localizeName(club.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {club.city} · {club._count?.members ?? 0} {t("coach_club.members")}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(pending) || requestClub.isPending}
                  onClick={() => requestClub.mutate(club.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gold/15 px-3 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
                >
                  {requestClub.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isCurrentPending ? t("coach_club.sent") : t("coach_club.join_btn")}
                </button>
              </div>
            );
          })}
          {(clubsQuery.data?.items ?? []).length === 0 && (
            <EmptyState title={t("admin.club_not_found")} hint={t("coach_club.search_hint")} />
          )}
        </div>
      )}
    </div>
  );
}

function IncomingCoachRequests({
  requests,
  isLoading,
  onChanged,
}: {
  requests: ClubJoinRequest[];
  isLoading: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.coachClubRequests.review(id, approve),
    onSuccess: onChanged,
  });

  if (isLoading) return <LoadingState />;
  if (requests.length === 0)
    return (
      <EmptyState title={t("coach_club.no_requests")} hint={t("coach_club.no_requests_hint")} />
    );

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-background/30 p-3"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {request.coach?.name} {request.coach?.surname}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {request.coach?.email}
              {request.coach?.phone ? ` · ${request.coach.phone}` : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: request.id, approve: true })}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {t("common.approve")}
            </button>
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: request.id, approve: false })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              {t("common.reject")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClubCoaches({
  clubId,
  currentUserId,
  canManage,
  coaches,
  onChanged,
}: {
  clubId: string;
  currentUserId?: string;
  canManage: boolean;
  coaches: User[];
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const unique = Array.from(new Map(coaches.map((coach) => [coach.id, coach])).values());
  const removeCoach = useMutation({
    mutationFn: (coachId: string) => api.clubs.removeCoach(clubId, coachId),
    onSuccess: onChanged,
  });
  const transferOwner = useMutation({
    mutationFn: (coachId: string) => api.clubs.transferOwner(clubId, coachId),
    onSuccess: onChanged,
  });

  if (unique.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("coach_club.no_coaches_yet")}</p>;
  }

  return (
    <div className="space-y-2">
      {unique.map((coach) => (
        <div
          key={coach.id}
          className="flex items-center gap-3 rounded-md border border-border/60 bg-background/30 p-3"
        >
          <Avatar
            src={coach.avatarUrl ? mediaUrl(coach.avatarUrl) : null}
            name={`${coach.name ?? ""} ${coach.surname ?? ""}`}
            size={36}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="truncate text-sm font-semibold">
                {coach.name} {coach.surname}
              </div>
              {coach.clubRole === "OWNER" ? (
                <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />
              ) : (
                <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{coach.email}</div>
          </div>
          {canManage && coach.id !== currentUserId && coach.clubRole !== "OWNER" && (
            <div className="ml-auto flex shrink-0 gap-1">
              <button
                type="button"
                disabled={transferOwner.isPending}
                onClick={() => transferOwner.mutate(coach.id)}
                className="rounded-md p-2 text-muted-foreground hover:bg-gold/10 hover:text-gold disabled:opacity-50"
                aria-label={t("coach_club.make_owner")}
                title={t("coach_club.make_owner")}
              >
                <Crown className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={removeCoach.isPending}
                onClick={() => removeCoach.mutate(coach.id)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={t("coach_club.remove_coach")}
                title={t("coach_club.remove_coach")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};
function Field({ label, value, onChange, className = "", ...rest }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </div>
  );
}

function toClubForm(club: Club | null | undefined): ClubForm {
  if (!club) return emptyForm;
  return {
    name: normalizeI18n(club.name),
    description: normalizeI18n(club.description),
    shortName: club.shortName ?? "",
    city: club.city ?? "",
    country: club.country ?? "KZ",
    logoUrl: club.logoUrl ?? "",
  };
}

function fromClubForm(form: ClubForm) {
  return {
    name: compactI18n(form.name),
    description: compactI18n(form.description),
    shortName: form.shortName.trim() || undefined,
    city: form.city.trim(),
    country: form.country.trim() || "KZ",
    logoUrl: form.logoUrl.trim() || undefined,
  };
}

function normalizeI18n(value: import("@/lib/api-types").LocalizedName): Record<Locale, string> {
  if (!value) return { kk: "", ru: "", en: "" };
  if (typeof value === "string") return { kk: value, ru: "", en: "" };
  return { kk: value.kk ?? "", ru: value.ru ?? "", en: value.en ?? "" };
}

function compactI18n(value: Record<Locale, string>) {
  return {
    kk: value.kk.trim() || undefined,
    ru: value.ru.trim() || undefined,
    en: value.en.trim() || undefined,
  };
}

function toGroupPayload(group: { name: string; ageMin: string | number; ageMax: string | number }) {
  return {
    name: group.name.trim(),
    ageMin: Number(group.ageMin),
    ageMax: Number(group.ageMax),
  };
}

function localizeName(value: import("@/lib/api-types").LocalizedName): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "";
}
