import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel } from "@/components/dashboard/DashboardShell";
import { Building2, CheckCircle2, Clock, Loader2, Save, Search, Upload, X, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type InputHTMLAttributes } from "react";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar-image";
import { toast } from "sonner";
import { athleteNav as nav } from "@/components/dashboard/athlete-nav";

export const Route = createFileRoute("/athlete/profile")({
  head: () => ({ meta: [{ title: "Профиль — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ATHLETE"]}>
      <Profile />
    </ProtectedRoute>
  ),
});

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
      toast.success("Профиль сақталды");
    },
    onError: (e: any) => {
      const msg = e instanceof ApiError ? e.message : "Профиль сақталмады";
      setError(msg);
      toast.error(msg);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => api.uploads.image(file),
    onSuccess: ({ url }) => setForm((current) => ({ ...current, avatarUrl: url })),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Сурет жүктелмеді"),
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
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Аватар</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={form.avatarUrl}
                    onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                    placeholder="/uploads/... немесе https://..."
                    className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                    {uploadAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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

        <div className="space-y-4">
          <Panel title="Клуб">
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
              <ClubJoinSection userId={user.id} />
            )}
          </Panel>

          <Panel title="Баптаулар">
            <div className="space-y-3">
              {user.avatarUrl && (
                <Avatar src={mediaUrl(user.avatarUrl)} name={`${user.name} ${user.surname}`} size={80} className="border border-gold/30" />
              )}
              <Field label="Тіл" value={localeLabel(user.preferredLocale)} />
              <Field label="Тіркелген" value={new Date(user.createdAt).toLocaleDateString("kk-KZ")} />
              <Field label="Аккаунт күйі" value={user.isActive ? "Белсенді" : "Тоқтатылған"} />
            </div>
          </Panel>
        </div>
      </div>
    </DashboardShell>
  );
}

function ClubJoinSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clubError, setClubError] = useState("");

  const requestsQuery = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: () => api.joinRequests.myList(),
  });

  const clubsQuery = useQuery({
    queryKey: ["clubs-search", search],
    queryFn: () => api.clubs.list({ search }),
    enabled: search.length >= 2,
  });

  const sendRequest = useMutation({
    mutationFn: (clubId: string) => api.clubs.joinRequest(clubId),
    onSuccess: () => { setClubError(""); qc.invalidateQueries({ queryKey: ["my-join-requests"] }); },
    onError: (e: any) => setClubError(e instanceof ApiError ? e.message : "Қате орын алды"),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.joinRequests.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-join-requests"] }),
  });

  const pending = (requestsQuery.data ?? []).filter((r: any) => r.status === "PENDING");

  return (
    <div className="space-y-4">
      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Жіберілген өтінімдер</p>
          {pending.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold shrink-0" />
                <div>
                  <p className="text-sm font-medium">{localizeName(r.club?.name)}</p>
                  <p className="text-xs text-muted-foreground">{r.club?.city} · күтілуде</p>
                </div>
              </div>
              <button
                onClick={() => cancelRequest.mutate(r.id)}
                disabled={cancelRequest.isPending}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Club search */}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Клуб іздеу</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Клуб атын енгізіңіз..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        {clubError && <p className="mt-1.5 text-xs text-destructive">{clubError}</p>}
      </div>

      {search.length >= 2 && (
        <div className="space-y-1.5">
          {clubsQuery.isLoading && <p className="text-xs text-muted-foreground">Іздеу...</p>}
          {(clubsQuery.data?.items ?? []).length === 0 && !clubsQuery.isLoading && search.length >= 2 && (
            <p className="text-xs text-muted-foreground">Клуб табылмады</p>
          )}
          {(clubsQuery.data?.items ?? []).map((club: any) => {
            const alreadySent = (requestsQuery.data ?? []).some((r: any) => r.clubId === club.id && r.status === "PENDING");
            return (
              <div key={club.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-input/40 p-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{localizeName(club.name)}</p>
                    <p className="text-xs text-muted-foreground">{club.city}</p>
                  </div>
                </div>
                {alreadySent ? (
                  <span className="text-xs text-gold">Жіберілді</span>
                ) : (
                  <button
                    onClick={() => sendRequest.mutate(club.id)}
                    disabled={sendRequest.isPending}
                    className="text-xs bg-gradient-gold text-gold-foreground px-3 py-1.5 rounded-md shadow-gold disabled:opacity-50"
                  >
                    Өтінім беру
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

function localizeName(name: any): string {
  if (!name) return "—";
  if (typeof name === "string") return name;
  return name.kk || name.ru || name.en || "—";
}

function localeLabel(l: string): string {
  return l === "kk" ? "Қазақша" : l === "ru" ? "Русский" : "English";
}
