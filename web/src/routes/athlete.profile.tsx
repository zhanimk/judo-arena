import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Save,
  Search,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useState, useEffect, type InputHTMLAttributes } from "react";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { Club, UserDocument } from "@/lib/api-types";
import { ProfilePhoto } from "@/components/ui/profile-photo";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { toast } from "sonner";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";
import { useTranslation } from "react-i18next";

type UserDocumentType = "BIRTH_CERTIFICATE" | "STUDY_CERTIFICATE" | "COACH_ID";
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const BELT_RANKS = [
  {
    value: "6 КЮ",
    labelKey: "athlete_dashboard.belt_white",
    gradient: "from-zinc-100 to-zinc-300",
  },
  {
    value: "5 КЮ",
    labelKey: "athlete_dashboard.belt_yellow",
    gradient: "from-yellow-300 to-yellow-500",
  },
  {
    value: "4 КЮ",
    labelKey: "athlete_dashboard.belt_orange",
    gradient: "from-orange-400 to-orange-600",
  },
  {
    value: "3 КЮ",
    labelKey: "athlete_dashboard.belt_green",
    gradient: "from-green-500 to-emerald-700",
  },
  { value: "2 КЮ", labelKey: "athlete_dashboard.belt_blue", gradient: "from-sky-500 to-blue-700" },
  {
    value: "1 КЮ",
    labelKey: "athlete_dashboard.belt_brown",
    gradient: "from-amber-700 to-amber-950",
  },
  {
    value: "1 ДАН",
    labelKey: "athlete_dashboard.belt_black",
    gradient: "from-gray-800 to-gray-950",
  },
  {
    value: "2 ДАН",
    labelKey: "athlete_dashboard.belt_black",
    gradient: "from-gray-800 to-gray-950",
  },
  {
    value: "3 ДАН",
    labelKey: "athlete_dashboard.belt_black",
    gradient: "from-gray-800 to-gray-950",
  },
  {
    value: "4 ДАН",
    labelKey: "athlete_dashboard.belt_black",
    gradient: "from-gray-800 to-gray-950",
  },
  {
    value: "5 ДАН",
    labelKey: "athlete_dashboard.belt_black",
    gradient: "from-gray-800 to-gray-950",
  },
];

// Normalize any belt rank string to our canonical form "N КЮ" / "N ДАН"
function normalizeBelt(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim().toUpperCase();
  // "5 KYU" → "5 КЮ", "1 DAN" → "1 ДАН"
  return s
    .replace(/\bKYU\b/, "КЮ")
    .replace(/\bDAN\b/, "ДАН")
    .replace(/\bKU\b/, "КЮ");
}

const NEXT_LEVEL_TECHNIQUES: Record<string, { next: string; techniques: string[] }> = {
  "6 КЮ": {
    next: "5 КЮ (Сары)",
    techniques: [
      "De-ashi-barai",
      "Hiza-guruma",
      "Sasae-tsurikomi-ashi",
      "O-goshi",
      "O-soto-gari",
      "O-uchi-gari",
      "Seoi-nage",
    ],
  },
  "5 КЮ": {
    next: "4 КЮ (Қызғылт сары)",
    techniques: [
      "Ko-soto-gari",
      "Ko-uchi-gari",
      "Koshi-guruma",
      "Tsurikomi-goshi",
      "Okuri-ashi-barai",
      "Tai-otoshi",
      "Harai-goshi",
      "Uchi-mata",
    ],
  },
  "4 КЮ": {
    next: "3 КЮ (Жасыл)",
    techniques: [
      "Ko-soto-gake",
      "Tsuri-goshi",
      "Yoko-otoshi",
      "Ashi-guruma",
      "Hane-goshi",
      "Harai-tsurikomi-ashi",
      "Tomoe-nage",
      "Kata-guruma",
    ],
  },
  "3 КЮ": {
    next: "2 КЮ (Көк)",
    techniques: [
      "Sumi-gaeshi",
      "Tani-otoshi",
      "Hane-makikomi",
      "Sukui-nage",
      "Utsuri-goshi",
      "O-guruma",
      "Soto-makikomi",
      "Uki-otoshi",
    ],
  },
  "2 КЮ": {
    next: "1 КЮ (Қоңыр)",
    techniques: [
      "O-soto-guruma",
      "Uki-waza",
      "Yoko-wakare",
      "Yoko-guruma",
      "Ushiro-goshi",
      "Ura-nage",
      "Sumi-otoshi",
      "Yoko-gake",
    ],
  },
  "1 КЮ": {
    next: "1 ДАН (Қара)",
    techniques: [
      "Барлық алдыңғы техниканы кемелдендіру",
      "Комбинация жасау",
      "Не-вадза меңгеру",
      "Жарыста тұрақты нәтиже",
    ],
  },
};

function nextLevelLabel(belt: string, t: TranslateFn): string {
  const keyByBelt: Record<string, string> = {
    "6 КЮ": "athlete_dashboard.next_5_kyu",
    "5 КЮ": "athlete_dashboard.next_4_kyu",
    "4 КЮ": "athlete_dashboard.next_3_kyu",
    "3 КЮ": "athlete_dashboard.next_2_kyu",
    "2 КЮ": "athlete_dashboard.next_1_kyu",
    "1 КЮ": "athlete_dashboard.next_1_dan",
  };
  return t(keyByBelt[belt] ?? "athlete_dashboard.next_5_kyu");
}

function techniqueLabel(technique: string, t: TranslateFn): string {
  const keyByTechnique: Record<string, string> = {
    "Барлық алдыңғы техниканы кемелдендіру": "athlete_dashboard.technique_master_previous",
    "Комбинация жасау": "athlete_dashboard.technique_combinations",
    "Не-вадза меңгеру": "athlete_dashboard.technique_ne_waza",
    "Жарыста тұрақты нәтиже": "athlete_dashboard.technique_competition_consistency",
  };
  return keyByTechnique[technique] ? t(keyByTechnique[technique]) : technique;
}

export const Route = createFileRoute("/athlete/profile")({
  head: () => ({ meta: [{ title: "Профиль — Judo Child League" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <Profile />
    </ProtectedRoute>
  ),
});

function Profile() {
  const { t } = useTranslation();
  const { user, refreshMe } = useAuth();
  const [editing, setEditing] = useState(false);

  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();

  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    surname: user?.surname ?? "",
    nameLatin: user?.nameLatin ?? "",
    surnameLatin: user?.surnameLatin ?? "",
    dateOfBirth: toDateInput(user?.dateOfBirth),
    gender: user?.gender ?? "MALE",
    weightKg: user?.weightKg ? String(user.weightKg) : "",
    beltRank: normalizeBelt(user?.beltRank),
    phone: user?.phone ?? "",
    avatarUrl: user?.avatarUrl ?? "",
  }));

  const saveProfile = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("NO_USER");
      return api.athletes.update(user.id, {
        name: form.name.trim(),
        surname: form.surname.trim(),
        nameLatin: form.nameLatin.trim() || undefined,
        surnameLatin: form.surnameLatin.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        gender: form.gender,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        beltRank: form.beltRank.trim() || undefined,
        phone: form.phone.trim() || undefined,
        avatarUrl: form.avatarUrl.trim() || null,
      });
    },
    onSuccess: async () => {
      setError("");
      await refreshMe();
      setEditing(false);
      toast.success(t("profile.profile_saved"));
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : t("profile.profile_save_error");
      setError(msg);
      toast.error(msg);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("NO_USER");
      const { url } = await api.uploads.avatar(file);
      await api.athletes.update(user.id, { avatarUrl: url });
      return { url };
    },
    onSuccess: async ({ url }) => {
      setAvatarFile(null);
      setForm((current) => ({ ...current, avatarUrl: url }));
      await refreshMe();
      toast.success(t("profile.photo_uploaded"));
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : t("profile.avatar_upload_error");
      setError(msg);
      toast.error(msg);
    },
  });

  if (!user) return null;

  const fullName = `${user.name} ${user.surname}`;
  const beltEntry = BELT_RANKS.find((b) => b.value === normalizeBelt(user.beltRank));

  return (
    <DashboardShell
      role={t("athlete.role_label")}
      navItems={nav}
      accentTitle={t("profile.my_profile")}
    >
      <div className="space-y-5">
        {/* ── Hero card ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-sky-500/5 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative shrink-0 self-center sm:self-auto">
              <ProfilePhoto
                src={user.avatarUrl ? mediaUrl(user.avatarUrl) : null}
                name={fullName}
                width={80}
              />
              {beltEntry && (
                <div
                  className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-b ${beltEntry.gradient} border-2 border-card shadow`}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h2 className="text-xl font-display font-bold leading-tight">{fullName}</h2>
              {(user.nameLatin || user.surnameLatin) && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {user.nameLatin} {user.surnameLatin}
                </p>
              )}
              <div className="mt-3 sm:mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                {user.beltRank && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium">
                    {beltEntry && (
                      <span
                        className={`h-2.5 w-2.5 rounded-full bg-gradient-to-b ${beltEntry.gradient} shrink-0`}
                      />
                    )}
                    {user.beltRank}
                  </span>
                )}
                {user.gender && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${user.gender === "MALE" ? "bg-sky-500" : "bg-pink-500"}`}
                    />
                    {user.gender === "MALE" ? t("common.male") : t("common.female")}
                  </span>
                )}
                {user.weightKg && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    ⚖ {user.weightKg} {t("common.kg")}
                  </span>
                )}
                {user.club && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    🏛 {localizeName(user.club.name)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0 self-stretch sm:self-start mt-2 sm:mt-0">
              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" /> {t("common.cancel")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-sm font-medium text-gold-foreground shadow-gold"
                >
                  {t("common.edit")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr] lg:items-start">
          <Panel title={t("profile.personal_info")}>
            {error && (
              <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveProfile.mutate();
                }}
                className="grid gap-3 grid-cols-1 sm:grid-cols-2"
              >
                <Input
                  label={t("common.name")}
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  required
                />
                <Input
                  label={t("common.surname")}
                  value={form.surname}
                  onChange={(v) => setForm({ ...form, surname: v })}
                  required
                />
                <Input
                  label={t("profile.name_latin")}
                  value={form.nameLatin}
                  onChange={(v) => setForm({ ...form, nameLatin: v })}
                />
                <Input
                  label={t("profile.surname_latin")}
                  value={form.surnameLatin}
                  onChange={(v) => setForm({ ...form, surnameLatin: v })}
                />
                <Input
                  label={t("auth.date_of_birth")}
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(v) => setForm({ ...form, dateOfBirth: v })}
                />
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("common.gender")}
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className={`h-9 w-2.5 shrink-0 rounded-full ${form.gender === "MALE" ? "bg-sky-500" : "bg-pink-500"}`}
                    />
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm({ ...form, gender: e.target.value as "MALE" | "FEMALE" })
                      }
                      className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      <option value="MALE">{t("common.male")}</option>
                      <option value="FEMALE">{t("common.female")}</option>
                    </select>
                  </div>
                </div>
                <Input
                  label={t("profile.weight_kg")}
                  type="number"
                  step="0.1"
                  min="1"
                  max="300"
                  value={form.weightKg}
                  onChange={(v) => setForm({ ...form, weightKg: v })}
                />
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("common.belt")}
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    {form.beltRank &&
                      (() => {
                        const belt = BELT_RANKS.find((b) => b.value === form.beltRank);
                        return belt ? (
                          <div
                            className={`h-9 w-2.5 shrink-0 rounded-full bg-gradient-to-b ${belt.gradient}`}
                          />
                        ) : null;
                      })()}
                    <select
                      value={form.beltRank}
                      onChange={(e) => setForm({ ...form, beltRank: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      <option value="">{t("profile.belt_placeholder")}</option>
                      {BELT_RANKS.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.value} — {t(b.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  label={t("profile.phone")}
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  required
                />
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("profile.avatar")}
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      value={form.avatarUrl}
                      onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                      placeholder={t("profile.avatar_placeholder")}
                      className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                      {uploadAvatar.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setAvatarFile(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("profile.photo_requirements")}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={saveProfile.isPending}
                  className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2.5 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
                >
                  {saveProfile.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("common.save")}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <Field label={t("common.full_name")} value={fullName} />
                <Field
                  label={t("profile.latin_label")}
                  value={`${user.nameLatin ?? "—"} ${user.surnameLatin ?? ""}`}
                />
                <Field label={t("common.email")} value={user.email} />
                <Field
                  label={t("auth.date_of_birth")}
                  value={
                    user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("kk-KZ") : "—"
                  }
                />
                <div className="flex items-center justify-between pb-2 border-b border-border/20">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("common.gender")}
                  </span>
                  <div className="flex items-center gap-2">
                    {user.gender && (
                      <div
                        className={`h-4 w-4 rounded-full ${user.gender === "MALE" ? "bg-sky-500" : "bg-pink-500"}`}
                      />
                    )}
                    <span className="text-sm font-medium">
                      {user.gender === "MALE"
                        ? t("common.male")
                        : user.gender === "FEMALE"
                          ? t("common.female")
                          : "—"}
                    </span>
                  </div>
                </div>
                <Field
                  label={t("common.weight")}
                  value={user.weightKg ? `${user.weightKg} ${t("common.kg")}` : "—"}
                />
                <div className="flex items-center justify-between pb-2 border-b border-border/20">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t("common.belt")}
                  </span>
                  <div className="flex items-center gap-2">
                    {user.beltRank &&
                      (() => {
                        const belt = BELT_RANKS.find(
                          (b) => b.value === normalizeBelt(user.beltRank),
                        );
                        return belt ? (
                          <div
                            className={`h-5 w-2.5 rounded-full bg-gradient-to-b ${belt.gradient}`}
                          />
                        ) : null;
                      })()}
                    <span className="text-sm font-medium">{user.beltRank ?? "—"}</span>
                  </div>
                </div>
                <Field label={t("profile.phone")} value={user.phone ?? "—"} />
              </div>
            )}
          </Panel>

          <div className="space-y-4">
            <Panel title={t("common.club")}>
              {user.club ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{localizeName(user.club.name)}</p>
                      <p className="text-xs text-muted-foreground">{user.club.city}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <ClubJoinSection userId={user.id} refreshMe={refreshMe} />
              )}
            </Panel>

            {/* Next level techniques card */}
            <NextLevelCard beltRank={user.beltRank} />

            <Panel title={t("documents.title")}>
              <div className="space-y-3">
                <DocumentUploadRow
                  type="BIRTH_CERTIFICATE"
                  label={t("documents.birth_certificate")}
                  hint={t("documents.birth_certificate_hint")}
                  document={findDocument(user.documents, "BIRTH_CERTIFICATE")}
                  refreshMe={refreshMe}
                />
                <DocumentUploadRow
                  type="STUDY_CERTIFICATE"
                  label={t("documents.study_certificate")}
                  hint={t("documents.study_certificate_hint")}
                  document={findDocument(user.documents, "STUDY_CERTIFICATE")}
                  refreshMe={refreshMe}
                />
              </div>
            </Panel>

            <Panel title={t("dashboard.settings")}>
              <div className="space-y-3">
                <Field
                  label={t("profile.registered_at")}
                  value={new Date(user.createdAt).toLocaleDateString("kk-KZ")}
                />
                <Field
                  label={t("profile.account_status")}
                  value={user.isActive ? t("common.active") : t("profile.blocked")}
                />

                {/* Push-уведомления */}
                {pushSupported && (
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-xs text-muted-foreground mb-2">
                      {t("profile.push_notifications") ?? "Push-хабарламалар"}
                    </div>
                    <button
                      onClick={pushSubscribed ? unsubscribePush : subscribePush}
                      disabled={pushLoading}
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        pushSubscribed
                          ? "border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
                          : "border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
                      } disabled:opacity-50`}
                    >
                      {pushLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : pushSubscribed ? (
                        "🔕 " + (t("profile.push_disable") ?? "Өшіру")
                      ) : (
                        "🔔 " + (t("profile.push_enable") ?? "Қосу")
                      )}
                    </button>
                    {pushSubscribed && (
                      <p className="mt-1 text-[11px] text-emerald-500">
                        ✓ {t("profile.push_active") ?? "Матч хабарламалары қосылған"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>
        {/* closes 2-col grid */}
      </div>
      {/* closes space-y-5 */}
      <AvatarCropDialog
        file={avatarFile}
        busy={uploadAvatar.isPending}
        onCancel={() => setAvatarFile(null)}
        onConfirm={(file) => uploadAvatar.mutate(file)}
      />
    </DashboardShell>
  );
}

function DocumentUploadRow({
  type,
  label,
  hint,
  document,
  refreshMe,
}: {
  type: UserDocumentType;
  label: string;
  hint: string;
  document?: UserDocument;
  refreshMe: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [showViewer, setShowViewer] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await api.uploads.document(file);
      return api.auth.saveDocument({
        type,
        url: uploaded.url,
        originalName: uploaded.fileName || file.name,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.size,
      });
    },
    onSuccess: async () => {
      setError("");
      await refreshMe();
      toast.success(t("documents.saved"));
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : t("documents.upload_error");
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <div className="rounded-lg border border-border/60 bg-background/35 p-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-gold" />
            {label}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          {document ? (
            <>
              <button
                type="button"
                onClick={() => setShowViewer(true)}
                className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-gold hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {document.originalName || t("documents.open_file")}
                </span>
              </button>
              {showViewer && (
                <DocumentViewer
                  document={document}
                  documents={[document]}
                  onClose={() => setShowViewer(false)}
                  onNavigate={() => {}}
                  t={t}
                />
              )}
            </>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">{t("documents.not_uploaded")}</div>
          )}
          {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
        </div>
        <label className="inline-flex shrink-0 w-full sm:w-auto justify-center cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {document ? t("documents.replace") : t("documents.upload")}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function findDocument(documents: UserDocument[] | undefined, type: UserDocumentType) {
  return documents?.find((document) => document.type === type);
}

function NextLevelCard({ beltRank }: { beltRank?: string | null }) {
  const { t } = useTranslation();
  const key = normalizeBelt(beltRank);
  const data = NEXT_LEVEL_TECHNIQUES[key];
  if (!data) return null;
  return (
    <Panel title={t("athlete_dashboard.next_level_preparation")}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("athlete_dashboard.target")}:</span>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold">
            {nextLevelLabel(key, t)}
          </span>
        </div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("athlete_dashboard.learn_techniques")}:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.techniques.map((tech, i) => (
            <span
              key={tech}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-[11px] font-medium"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold/20 text-[8px] font-bold text-gold">
                {i + 1}
              </span>
              {techniqueLabel(tech, t)}
            </span>
          ))}
        </div>
        <div className="rounded-lg border border-gold/15 bg-gold/5 p-2.5 text-xs text-muted-foreground">
          💡 {t("athlete_dashboard.practice_hint_profile")}
        </div>
      </div>
    </Panel>
  );
}

function ClubJoinSection({
  userId,
  refreshMe,
}: {
  userId: string;
  refreshMe: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clubError, setClubError] = useState("");

  const requestsQuery = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: () => api.joinRequests.myList(),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r: { status: string }) => r.status === "PENDING") ? 10_000 : false,
  });

  useEffect(() => {
    if ((requestsQuery.data ?? []).some((r: { status: string }) => r.status === "APPROVED")) {
      refreshMe();
    }
  }, [requestsQuery.data, refreshMe]);

  const clubsQuery = useQuery({
    queryKey: ["clubs-search", search],
    queryFn: () => api.clubs.list({ search }),
    enabled: search.length >= 2,
  });

  const sendRequest = useMutation({
    mutationFn: (clubId: string) => api.clubs.joinRequest(clubId),
    onSuccess: () => {
      setClubError("");
      qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    },
    onError: async (e: unknown) => {
      if (e instanceof ApiError && e.code === "ALREADY_IN_CLUB") {
        await refreshMe();
        return;
      }
      setClubError(e instanceof ApiError ? e.message : t("error.generic"));
    },
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.joinRequests.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-join-requests"] }),
  });

  const pending = (requestsQuery.data ?? []).filter((request) => request.status === "PENDING");

  return (
    <div className="space-y-4">
      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("profile.sent_requests")}
          </p>
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold shrink-0" />
                <div>
                  <p className="text-sm font-medium">{localizeName(r.club?.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.club?.city} · {t("profile.pending")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => cancelRequest.mutate(r.id)}
                disabled={cancelRequest.isPending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/20 sm:border-transparent py-2 sm:py-0 text-xs text-destructive sm:text-muted-foreground hover:text-destructive transition-colors"
              >
                <XCircle className="h-4 w-4" />
                <span className="sm:hidden">{t("common.cancel")}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Club search */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {t("profile.search_club")}
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("profile.search_club_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        {clubError && <p className="mt-1.5 text-xs text-destructive">{clubError}</p>}
      </div>

      {search.length >= 2 && (
        <div className="space-y-1.5">
          {clubsQuery.isLoading && (
            <p className="text-xs text-muted-foreground">{t("common.search")}...</p>
          )}
          {(clubsQuery.data?.items ?? []).length === 0 &&
            !clubsQuery.isLoading &&
            search.length >= 2 && (
              <p className="text-xs text-muted-foreground">{t("profile.club_not_found")}</p>
            )}
          {(clubsQuery.data?.items ?? []).map((club: Club) => {
            const alreadySent = (requestsQuery.data ?? []).some(
              (r: { clubId?: string; status: string }) =>
                r.clubId === club.id && r.status === "PENDING",
            );
            return (
              <div
                key={club.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 rounded-lg border border-border bg-input/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{localizeName(club.name)}</p>
                    <p className="text-xs text-muted-foreground">{club.city}</p>
                  </div>
                </div>
                {alreadySent ? (
                  <span className="text-xs text-gold text-center sm:text-left">
                    {t("profile.request_sent")}
                  </span>
                ) : (
                  <button
                    onClick={() => sendRequest.mutate(club.id)}
                    disabled={sendRequest.isPending}
                    className="w-full sm:w-auto inline-flex justify-center items-center text-xs bg-gradient-gold text-gold-foreground px-3 py-2 sm:py-1.5 rounded-md shadow-gold disabled:opacity-50"
                  >
                    {t("profile.send_request")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
function Input({ label, value, onChange, ...rest }: InputProps) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold"
        {...rest}
      />
    </div>
  );
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center pb-2 border-b border-border/20 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function localizeName(
  name: import("@/lib/api-types").LocalizedName | string | null | undefined,
): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}
