import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  //   Building2,
  Check,
  Crown,
  MapPin,
  Phone,
  Instagram as InstagramIcon,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  X,
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

const COUNTRIES = [
  { code: "KZ", name: "Қазақстан", flag: "🇰🇿" },
  { code: "UZ", name: "Өзбекстан", flag: "🇺🇿" },
  { code: "KG", name: "Қырғызстан", flag: "🇰🇬" },
  { code: "RU", name: "Ресей", flag: "🇷🇺" },
];

export const Route = createFileRoute("/coach/club")({
  head: () => ({ meta: [{ title: "Клуб — Judo Child League" }] }),
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
  address: string;
  phone: string;
  instagram: string;
  logoUrl: string;
};

const emptyForm: ClubForm = {
  name: { kk: "", ru: "", en: "" },
  description: { kk: "", ru: "", en: "" },
  shortName: "",
  city: "",
  country: "KZ",
  address: "",
  phone: "",
  instagram: "",
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const incomingAthleteRequestsQuery = useQuery({
    queryKey: ["coach-join-requests"],
    queryFn: () => api.joinRequests.coachList(),
    enabled: !!clubId,
  });

  const formInitial = useMemo(() => toClubForm(clubQuery.data), [clubQuery.data]);
  const [isEditing, setIsEditing] = useState(false);
  const [noClubTab, setNoClubTab] = useState<"join" | "create">("join");

  const saveClub = useMutation({
    mutationFn: (form: ClubForm) => {
      const payload = fromClubForm(form);
      return clubId ? api.clubs.update(clubId, payload) : api.clubs.create(payload);
    },
    onSuccess: async () => {
      setError("");
      setFieldErrors({});
      setIsEditing(false);
      await refreshMe();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["coach-club"] }),
        qc.invalidateQueries({ queryKey: ["club"] }),
        qc.invalidateQueries({ queryKey: ["club-groups"] }),
        qc.invalidateQueries({ queryKey: ["auth-me"] }),
        qc.invalidateQueries({ queryKey: ["coach-club-join-requests"] }),
      ]);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        setError(e.message || t("coach_club.save_error"));
        if (Array.isArray(e.details)) {
          const fe: Record<string, string> = {};
          for (const issue of e.details) {
            if (issue.path) fe[issue.path] = issue.message;
          }
          setFieldErrors(fe);
        }
      } else {
        setError(t("coach_club.save_error"));
      }
    },
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
        <div className="mx-auto max-w-2xl mt-4">
          {!coachRequestsQuery.data?.some((r) => r.status === "PENDING") && (
            <div className="flex gap-1 p-1 bg-muted/40 rounded-lg mb-6 w-fit mx-auto border border-border/50">
              <button
                onClick={() => setNoClubTab("join")}
                className={`px-6 py-2.5 text-sm font-medium rounded-md transition-all ${noClubTab === "join" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("coach_club.join_club")}
              </button>
              <button
                onClick={() => setNoClubTab("create")}
                className={`px-6 py-2.5 text-sm font-medium rounded-md transition-all ${noClubTab === "create" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("coach_club.create_club")}
              </button>
            </div>
          )}

          {noClubTab === "join" || coachRequestsQuery.data?.some((r) => r.status === "PENDING") ? (
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
          ) : (
            <Panel title={t("coach_club.create_club")}>
              <ClubEditor
                initial={formInitial}
                isSaving={saveClub.isPending}
                error={error}
                onSubmit={(form) => saveClub.mutate(form)}
                fieldErrors={fieldErrors}
              />
            </Panel>
          )}
        </div>
      )}

      {clubId && (
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <h2 className="text-2xl font-semibold tracking-tight">{t("coach_club.my_club")}</h2>
            <div className="flex gap-2">
              {isOwner && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-gold/10 text-gold hover:bg-gold/20 px-4 py-2 text-sm font-medium transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  {t("common.edit")}
                </button>
              )}
              {isOwner && isEditing && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background hover:bg-muted px-4 py-2 text-sm font-medium text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                  {t("common.cancel")}
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <Panel title={t("coach_club.edit_club") || "Edit Club"}>
              <ClubEditor
                initial={formInitial}
                isSaving={saveClub.isPending}
                error={error}
                onSubmit={(form) => saveClub.mutate(form)}
                readOnly={!isOwner}
                fieldErrors={fieldErrors}
              />
            </Panel>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_320px] items-start">
              <div className="space-y-6">
                <ClubPreview club={clubQuery.data} fallback={formInitial} />
              </div>
              <div className="space-y-6">
                <Panel title={t("coach_club.club_coaches")}>
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
                </Panel>

                {isOwner && (
                  <Panel
                    title={`${t("coach_club.coach_requests")} ${incomingCoachRequestsQuery.data?.length ?? 0}`}
                  >
                    <IncomingCoachRequests
                      requests={incomingCoachRequestsQuery.data ?? []}
                      isLoading={incomingCoachRequestsQuery.isLoading}
                      onChanged={async () => {
                        await Promise.all([
                          qc.invalidateQueries({
                            queryKey: ["incoming-coach-club-join-requests", clubId],
                          }),
                          qc.invalidateQueries({ queryKey: ["coach-club", clubId] }),
                        ]);
                      }}
                    />
                  </Panel>
                )}

                <Panel
                  title={`${t("coach_club.athlete_requests")} ${incomingAthleteRequestsQuery.data?.length ?? 0}`}
                >
                  <IncomingAthleteRequests
                    requests={incomingAthleteRequestsQuery.data ?? []}
                    isLoading={incomingAthleteRequestsQuery.isLoading}
                    onChanged={async () => {
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: ["coach-join-requests"] }),
                        qc.invalidateQueries({ queryKey: ["club-members", clubId] }),
                      ]);
                    }}
                  />
                </Panel>
              </div>
            </div>
          )}
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
  fieldErrors,
}: {
  initial: ClubForm;
  isSaving: boolean;
  error: string;
  onSubmit: (form: ClubForm) => void;
  readOnly?: boolean;
  fieldErrors?: Record<string, string>;
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
      className="space-y-6"
    >
      {readOnly && (
        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground mb-4">
          {t("coach_club.readonly_hint")}
        </div>
      )}

      <div className="p-4 rounded-xl border border-border/40 bg-muted/10 space-y-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="text-sm font-medium text-foreground">
            {t("coach_club.language_details") || "Details"}
          </div>
          <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-md border border-border/50">
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={`${t("coach_club.name_label")} (${locale.toUpperCase()})`}
            value={form.name[locale]}
            onChange={(value) => updateLocale("name", value)}
            required={locale === "kk"}
            disabled={readOnly}
            error={fieldErrors?.[`name.${locale}`] || fieldErrors?.name}
          />
          <Field
            label={t("coach_club.short_name")}
            value={form.shortName}
            onChange={(shortName) => setForm({ ...form, shortName })}
            placeholder="JCL Almaty"
            disabled={readOnly}
            error={fieldErrors?.shortName}
          />
          <Field
            label={t("admin.club_city")}
            value={form.city}
            onChange={(city) => setForm({ ...form, city })}
            required
            disabled={readOnly}
            error={fieldErrors?.city}
          />
          <Field
            label={t("admin.club_country")}
            value={form.country}
            onChange={(country) => setForm({ ...form, country: country.toUpperCase().slice(0, 2) })}
            required
            maxLength={2}
            disabled={readOnly}
          />
          <Field
            label={t("coach_club.club_address") || "Address"}
            value={form.address}
            onChange={(address) => setForm({ ...form, address })}
            disabled={readOnly}
            className="md:col-span-2"
            error={fieldErrors?.address}
          />
          <div className="md:col-span-2 border-t border-border/40 my-2 pt-4">
            <div className="text-sm font-medium text-foreground mb-3">
              {t("coach_club.club_contacts") || "Contacts"}
            </div>
          </div>
          <Field
            label={t("coach_club.club_phone") || "Phone"}
            value={form.phone}
            onChange={(phone) => setForm({ ...form, phone })}
            disabled={readOnly}
            type="tel"
            error={fieldErrors?.phone}
          />
          <Field
            label={t("coach_club.club_instagram") || "Instagram"}
            value={form.instagram}
            onChange={(instagram) => setForm({ ...form, instagram })}
            placeholder="@judoclub"
            disabled={readOnly}
            className="md:col-span-2"
            error={fieldErrors?.instagram}
          />
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("coach_club.description_label")} ({locale.toUpperCase()})
            </label>
            <textarea
              value={form.description[locale]}
              onChange={(e) => updateLocale("description", e.target.value)}
              disabled={readOnly}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
              placeholder={t("coach_club.description_placeholder")}
            />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border/40 bg-muted/10 space-y-4">
        <div className="text-sm font-medium text-foreground border-b border-border/40 pb-3 mb-4">
          {t("coach_club.logo_label") || "Logo"}
        </div>
        <div className="flex gap-4 items-center">
          {form.logoUrl ? (
            <img
              src={mediaUrl(form.logoUrl)}
              alt="Logo"
              className="w-16 h-16 rounded-md object-cover bg-background border border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center border border-border/50 text-muted-foreground">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <input
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                disabled={readOnly}
                placeholder="/uploads/... or https://..."
                className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
              <label
                className={`inline-flex items-center gap-1.5 rounded-md bg-secondary hover:bg-secondary/80 px-4 py-2 text-sm text-secondary-foreground transition-colors ${readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
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
            <p className="text-xs text-muted-foreground">
              {t("coach_club.upload_hint") || "PNG, JPG, WebP up to 5MB"}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {!readOnly && (
        <div className="pt-2">
          <button
            disabled={isSaving}
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-gold px-6 py-2.5 font-medium text-gold-foreground shadow-gold disabled:opacity-50 sm:w-auto hover:brightness-110 transition-all"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </button>
        </div>
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
    fallback.description.en;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md shadow-sm relative">
      <div className="h-32 w-full bg-gradient-to-r from-gold/40 via-gold/20 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>

      <div className="px-6 relative flex justify-between items-end">
        <div className="-mt-12 h-24 w-24 overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-xl z-10 flex-shrink-0">
          {logo ? (
            <LazyImage src={mediaUrl(logo)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted/30">
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="pb-2">
          <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold shadow-sm">
            {t("coach_club.club_card") || "Club Card"}
          </span>
        </div>
      </div>

      <div className="p-6 pt-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{name}</h2>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground/80 font-medium">
            <MapPin className="h-4 w-4 shrink-0 text-gold/70" />
            {club?.city || fallback.city || t("admin.club_city")}
            <span className="text-border mx-1">•</span>
            {(() => {
              const code = club?.country || fallback.country || "KZ";
              const c = COUNTRIES.find((x) => x.code === code);
              return c ? `${c.flag} ${c.name}` : code;
            })()}
          </div>
        </div>

        {description && (
          <div className="mt-5 rounded-xl bg-muted/30 p-4 border border-border/30">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {description}
            </p>
          </div>
        )}

        {(club?.address ||
          fallback.address ||
          club?.phone ||
          fallback.phone ||
          club?.instagram ||
          fallback.instagram) && (
          <div className="mt-6 border-t border-border/40 pt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {t("coach_club.club_contacts") || "Contacts"}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {(club?.address || fallback.address) && (
                <div className="flex items-start gap-3 text-foreground/80">
                  <div className="mt-0.5 rounded-md bg-gold/10 p-1.5 text-gold shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span className="leading-snug">{club?.address || fallback.address}</span>
                </div>
              )}
              {(club?.phone || fallback.phone) && (
                <div className="flex items-center gap-3 text-foreground/80">
                  <div className="rounded-md bg-gold/10 p-1.5 text-gold shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <span>{club?.phone || fallback.phone}</span>
                </div>
              )}
              {(club?.instagram || fallback.instagram) && (
                <div className="flex items-center gap-3 text-foreground/80">
                  <div className="rounded-md bg-gold/10 p-1.5 text-gold shrink-0">
                    <InstagramIcon className="w-3.5 h-3.5" />
                  </div>
                  <span>{club?.instagram || fallback.instagram}</span>
                </div>
              )}
            </div>
          </div>
        )}
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

function IncomingAthleteRequests({
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
      api.joinRequests.review(id, approve),
    onSuccess: onChanged,
  });

  if (isLoading) return <LoadingState />;
  if (requests.length === 0)
    return (
      <EmptyState
        title={t("coach_club.no_athlete_requests")}
        hint={t("coach_club.no_athlete_requests_hint")}
      />
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
              {request.athlete?.name} {request.athlete?.surname}
            </div>
            <div className="truncate text-xs text-muted-foreground">{request.athlete?.email}</div>
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
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive hover:bg-destructive/20 disabled:opacity-50"
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
  error?: string;
};
function Field({ label, value, onChange, className = "", error, ...rest }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        className={`mt-1.5 w-full rounded-md border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none ${
          error ? "border-destructive text-destructive" : "border-border"
        }`}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
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
    address: club.address ?? "",
    phone: club.phone ?? "",
    instagram: club.instagram ?? "",
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
    address: form.address.trim() || undefined,
    phone: form.phone.trim() || undefined,
    instagram: form.instagram.trim() || undefined,
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
