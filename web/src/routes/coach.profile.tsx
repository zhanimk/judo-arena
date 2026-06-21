import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, Save, Upload, MapPin } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { api, ApiError, mediaUrl } from "@/lib/api";
import type { UserDocument } from "@/lib/api-types";
import { ProfilePhoto } from "@/components/ui/profile-photo";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { DocumentViewer } from "@/components/documents/DocumentViewer";

type UserDocumentType = "BIRTH_CERTIFICATE" | "STUDY_CERTIFICATE" | "COACH_ID";

export const Route = createFileRoute("/coach/profile")({
  head: () => ({ meta: [{ title: "Профиль — Жаттықтырушы" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachProfile />
    </ProtectedRoute>
  ),
});

function CoachProfile() {
  const { t } = useTranslation();
  const { user, refreshMe } = useAuth();
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    surname: user?.surname ?? "",
    phone: user?.phone ?? "",
    avatarUrl: user?.avatarUrl ?? "",
    preferredLocale: user?.preferredLocale ?? "kk",
    city: user?.city ?? "",
    education: user?.education ?? "",
    coachCategory: user?.coachCategory ?? "",
    coachExperienceYears: user?.coachExperienceYears ?? "",
    coachTitle: user?.coachTitle ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const saveProfile = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({
        name: form.name.trim(),
        surname: form.surname.trim(),
        phone: form.phone.trim(),
        avatarUrl: form.avatarUrl.trim() || null,
        preferredLocale: form.preferredLocale,
        city: form.city.trim() || null,
        education: form.education.trim() || null,
        coachCategory: form.coachCategory.trim() || null,
        coachExperienceYears: form.coachExperienceYears ? Number(form.coachExperienceYears) : null,
        coachTitle: form.coachTitle.trim() || null,
      }),
    onSuccess: async () => {
      setError("");
      setFieldErrors({});
      await refreshMe();
      toast.success(t("profile.saved"));
    },
    onError: (e: unknown) => {
      let msg = t("profile.save_error");
      if (e instanceof ApiError) {
        msg = e.message;
        if (Array.isArray(e.details) && e.details.length > 0) {
          const fe: Record<string, string> = {};
          for (const issue of e.details) {
            if (issue.path) fe[issue.path] = issue.message;
          }
          setFieldErrors(fe);
        }
      }
      setError(msg);
      toast.error(msg);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await api.uploads.avatar(file);
      await api.auth.updateProfile({ avatarUrl: url });
      return { url };
    },
    onSuccess: async ({ url }) => {
      setAvatarFile(null);
      setForm((current) => ({ ...current, avatarUrl: url }));
      await refreshMe();
      toast.success(t("profile.photo_uploaded"));
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : t("profile.photo_error");
      setError(msg);
      toast.error(msg);
    },
  });

  if (!user) return null;

  return (
    <DashboardShell role={t("coach.role_label")} navItems={nav} accentTitle={t("profile.title")}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title={t("profile.personal_info")}>
          {error && (
            <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field
              label={t("profile.first_name")}
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
              error={fieldErrors?.name}
              required
            />
            <Field
              label={t("profile.last_name")}
              value={form.surname}
              onChange={(surname) => setForm({ ...form, surname })}
              error={fieldErrors?.surname}
              required
            />
            <Field
              label={t("profile.phone")}
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
              error={fieldErrors?.phone}
              type="tel"
              placeholder="+77771234567"
              required
            />
            <Field
              label={t("profile.city") || "Город"}
              value={form.city}
              onChange={(city) => setForm({ ...form, city })}
              error={fieldErrors?.city}
            />
            <Field
              label={t("profile.education") || "Образование"}
              value={form.education}
              onChange={(education) => setForm({ ...form, education })}
              error={fieldErrors?.education}
              className="sm:col-span-2"
            />
            <Field
              label={t("profile.coach_category") || "Тренерская категория"}
              value={form.coachCategory}
              onChange={(coachCategory) => setForm({ ...form, coachCategory })}
              error={fieldErrors?.coachCategory}
            />
            <Field
              label={t("profile.experience_years") || "Стаж работы (лет)"}
              value={form.coachExperienceYears?.toString() || ""}
              onChange={(coachExperienceYears) => setForm({ ...form, coachExperienceYears })}
              type="number"
              min="0"
              max="100"
              error={fieldErrors?.coachExperienceYears}
            />
            <Field
              label={t("profile.coach_title") || "Спортивное звание"}
              value={form.coachTitle}
              onChange={(coachTitle) => setForm({ ...form, coachTitle })}
              error={fieldErrors?.coachTitle}
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("profile.photo")}
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={form.avatarUrl}
                  onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                  placeholder={t("profile.photo_placeholder")}
                  className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  {uploadAvatar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("profile.upload_photo")}
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
              disabled={saveProfile.isPending}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2.5 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {saveProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveProfile.isPending ? t("common.saving") : t("common.save")}
            </button>
          </form>
        </Panel>

        <Panel title={t("profile.preview")}>
          <div className="flex flex-col items-center text-center p-6 bg-card/60 rounded-2xl border border-border/40 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-br from-gold/30 via-gold/10 to-background z-0"></div>

            <div className="z-10 bg-background rounded-full p-1 shadow-xl">
              <ProfilePhoto
                src={form.avatarUrl ? mediaUrl(form.avatarUrl) : null}
                name={`${form.name} ${form.surname}`}
                width={120}
              />
            </div>

            <div className="z-10 mt-5 font-display text-2xl font-bold tracking-tight">
              {form.name} {form.surname}
            </div>
            <div className="z-10 mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground font-medium">
              <span>{user.email}</span>
              {form.phone && (
                <>
                  <span className="text-border">•</span>
                  <span>{form.phone}</span>
                </>
              )}
            </div>

            {form.city && (
              <div className="z-10 mt-3 text-sm text-foreground/80 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gold" />
                {form.city}
              </div>
            )}

            <div className="z-10 mt-4 inline-flex flex-wrap justify-center gap-2">
              <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold shadow-sm">
                {t("coach.role_label")}
              </span>
              {form.coachCategory && (
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                  {form.coachCategory}
                </span>
              )}
            </div>

            {(form.education || form.coachTitle || form.coachExperienceYears) && (
              <div className="z-10 mt-6 w-full text-left space-y-3 pt-5 border-t border-border/40">
                {form.coachTitle && (
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      {t("profile.coach_title") || "Спортивное звание"}
                    </span>
                    <span className="text-sm mt-0.5">{form.coachTitle}</span>
                  </div>
                )}
                {form.education && (
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      {t("profile.education") || "Образование"}
                    </span>
                    <span className="text-sm mt-0.5">{form.education}</span>
                  </div>
                )}
                {form.coachExperienceYears && (
                  <div className="flex flex-col">
                    <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                      {t("profile.experience_years") || "Стаж работы"}
                    </span>
                    <span className="text-sm mt-0.5">
                      {form.coachExperienceYears} {t("common.years_short") || "жыл/лет"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel title={t("documents.coach_documents")}>
          <DocumentUploadRow
            type="COACH_ID"
            label={t("documents.coach_id")}
            hint={t("documents.coach_id_hint")}
            document={findDocument(user.documents, "COACH_ID")}
            refreshMe={refreshMe}
          />
        </Panel>
      </div>
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
      <div className="flex items-start justify-between gap-3">
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
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
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

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
};
function Field({ label, value, onChange, error, className = "", ...rest }: FieldProps) {
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
