import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import { Activity, Bell, LayoutDashboard, Loader2, Save, Trophy, User, X, Swords } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/athlete/profile")({
  head: () => ({ meta: [{ title: "Профиль — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <Profile />
    </ProtectedRoute>
  ),
});

const nav = [
  { to: "/athlete", label: "Шолу", icon: LayoutDashboard },
  { to: "/athlete/profile", label: "Профиль", icon: User },
  { to: "/athlete/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/athlete/matches", label: "Жекпе-жектер", icon: Swords },
  { to: "/athlete/results", label: "Нәтижелер", icon: Activity },
  { to: "/athlete/notifications", label: "Хабарландырулар", icon: Bell },
];

function Profile() {
  const { user, refreshMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    surname: user?.surname ?? "",
    nameLatin: user?.nameLatin ?? "",
    surnameLatin: user?.surnameLatin ?? "",
    dateOfBirth: toDateInput(user?.dateOfBirth),
    gender: user?.gender ?? "MALE",
    weightKg: user?.weightKg ? String(user.weightKg) : "",
    beltRank: user?.beltRank ?? "",
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
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Профиль сақталмады"),
  });

  if (!user) return null;

  const fullName = `${user.name} ${user.surname}`;

  return (
    <DashboardShell role="Спортшы" navItems={nav} accentTitle="Менің профилім">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel
          title="Жеке мәлімет"
          action={
            editing ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" /> Болдырмау
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md bg-gradient-gold px-3 py-1.5 text-sm font-medium text-gold-foreground shadow-gold"
              >
                Өзгерту
              </button>
            )
          }
        >
          {error && <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {editing ? (
            <form
              onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Input label="Аты" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Input label="Тегі" value={form.surname} onChange={(v) => setForm({ ...form, surname: v })} required />
              <Input label="Аты латиница" value={form.nameLatin} onChange={(v) => setForm({ ...form, nameLatin: v })} />
              <Input label="Тегі латиница" value={form.surnameLatin} onChange={(v) => setForm({ ...form, surnameLatin: v })} />
              <Input label="Туған күн" type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Жыныс</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as "MALE" | "FEMALE" })}
                  className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  <option value="MALE">Ер</option>
                  <option value="FEMALE">Әйел</option>
                </select>
              </div>
              <Input label="Салмақ, кг" type="number" step="0.1" min="1" max="300" value={form.weightKg} onChange={(v) => setForm({ ...form, weightKg: v })} />
              <Input label="Белбеу" value={form.beltRank} onChange={(v) => setForm({ ...form, beltRank: v })} placeholder="мысалы 3 kyu" />
              <Input label="Телефон" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Input label="Аватар URL" type="url" value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} placeholder="https://..." />
              <button
                type="submit"
                disabled={saveProfile.isPending}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2.5 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
              >
                {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Сақтау
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <Field label="Аты-жөні" value={fullName} />
              <Field label="Латиница" value={`${user.nameLatin ?? "—"} ${user.surnameLatin ?? ""}`} />
              <Field label="Email" value={user.email} />
              <Field label="Туған күн" value={user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("kk-KZ") : "—"} />
              <Field label="Жыныс" value={user.gender === "MALE" ? "Ер" : user.gender === "FEMALE" ? "Әйел" : "—"} />
              <Field label="Салмақ" value={user.weightKg ? `${user.weightKg} кг` : "—"} />
              <Field label="Белбеу" value={user.beltRank ?? "—"} />
              <Field label="Телефон" value={user.phone ?? "—"} />
            </div>
          )}
        </Panel>

        <Panel title="Клуб және баптаулар">
          <div className="space-y-3">
            {user.avatarUrl && (
              <img src={user.avatarUrl} alt="" className="h-24 w-24 rounded-full border border-gold/30 object-cover" />
            )}
            <Field label="Клуб" value={user.club ? localizeName(user.club.name) : "Клубта жоқ"} />
            <Field label="Қала" value={user.club?.city ?? "—"} />
            <Field label="Тіл" value={localeLabel(user.preferredLocale)} />
            <Field label="Тіркелген" value={new Date(user.createdAt).toLocaleDateString("kk-KZ")} />
            <Field label="Аккаунт күйі" value={user.isActive ? "Белсенді" : "Тоқтатылған"} />

            <div className="mt-6 border-t border-border/30 pt-6">
              <p className="text-xs text-muted-foreground">
                Email және парольді ауыстыру бөлек қауіпсіздік экраны ретінде қосылады. Спорттық деректерді осы жерден жаңарта аласыз.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

function Input({ label, value, onChange, ...rest }: any) {
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

function localizeName(name: any): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function localeLabel(l: string): string {
  return l === "kk" ? "Қазақша" : l === "ru" ? "Русский" : "English";
}
