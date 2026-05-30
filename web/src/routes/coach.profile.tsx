import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Upload, User } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar-image";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/coach/profile")({
  head: () => ({ meta: [{ title: "Профиль — Жаттықтырушы" }] }),
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
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    surname: user?.surname ?? "",
    nameLatin: user?.nameLatin ?? "",
    surnameLatin: user?.surnameLatin ?? "",
    phone: user?.phone ?? "",
    avatarUrl: user?.avatarUrl ?? "",
    preferredLocale: user?.preferredLocale ?? "kk",
  }));

  const saveProfile = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({
        name: form.name.trim(),
        surname: form.surname.trim(),
        nameLatin: form.nameLatin.trim() || null,
        surnameLatin: form.surnameLatin.trim() || null,
        phone: form.phone.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        preferredLocale: form.preferredLocale,
      }),
    onSuccess: async () => {
      setError("");
      await refreshMe();
      toast.success(t("profile.saved"));
    },
    onError: (e: any) => {
      const msg = e instanceof ApiError ? e.message : t("profile.save_error");
      setError(msg); toast.error(msg);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => api.uploads.image(file),
    onSuccess: ({ url }) => { setForm((current) => ({ ...current, avatarUrl: url })); toast.success(t("profile.photo_uploaded")); },
    onError: (e: any) => {
      const msg = e instanceof ApiError ? e.message : t("profile.photo_error");
      setError(msg); toast.error(msg);
    },
  });

  if (!user) return null;

  return (
    <DashboardShell role={t("coach.role_label")} navItems={nav} accentTitle={t("profile.title")}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title={t("profile.personal_info")}>
          {error && <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }} className="grid gap-3 sm:grid-cols-2">
            <Field label={t("profile.first_name")} value={form.name} onChange={(name) => setForm({ ...form, name })} required />
            <Field label={t("profile.last_name")} value={form.surname} onChange={(surname) => setForm({ ...form, surname })} required />
            <Field label={t("profile.first_name_latin")} value={form.nameLatin} onChange={(nameLatin) => setForm({ ...form, nameLatin })} />
            <Field label={t("profile.last_name_latin")} value={form.surnameLatin} onChange={(surnameLatin) => setForm({ ...form, surnameLatin })} />
            <Field label={t("profile.phone")} value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">{t("profile.language")}</label>
              <select
                value={form.preferredLocale}
                onChange={(e) => setForm({ ...form, preferredLocale: e.target.value as "kk" | "ru" | "en" })}
                className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="kk">{t("profile.lang_kk")}</option>
                <option value="ru">{t("profile.lang_ru")}</option>
                <option value="en">{t("profile.lang_en")}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">{t("profile.photo")}</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={form.avatarUrl}
                  onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                  placeholder={t("profile.photo_placeholder")}
                  className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  {uploadAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t("profile.upload_photo")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAvatar.mutate(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <button
              disabled={saveProfile.isPending}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2.5 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
            >
              {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveProfile.isPending ? t("common.saving") : t("common.save")}
            </button>
          </form>
        </Panel>

        <Panel title={t("profile.preview")}>
          <div className="flex flex-col items-center text-center">
            {form.avatarUrl ? (
              <Avatar src={mediaUrl(form.avatarUrl)} name={`${form.name} ${form.surname}`} size={96} className="border border-gold/30" fetchpriority="high" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gold/15 text-xl font-bold text-gold">
                {form.name[0]}{form.surname[0]}
              </div>
            )}
            <div className="mt-4 font-display text-xl font-semibold">{form.name} {form.surname}</div>
            <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
            <div className="mt-3 rounded-full bg-gold/10 px-3 py-1 text-xs uppercase tracking-widest text-gold">{t("coach.role_label")}</div>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};
function Field({ label, value, onChange, ...rest }: FieldProps) {
  return (
    <div>
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
