import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ClipboardList,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell, EmptyState, LoadingState, Panel } from "@/components/dashboard/DashboardShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/club")({
  head: () => ({ meta: [{ title: "Клуб — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachClub />
    </ProtectedRoute>
  ),
});

const nav = [
  { to: "/coach", label: "Шолу", icon: LayoutDashboard },
  { to: "/coach/club", label: "Клуб", icon: Building2 },
  { to: "/coach/athletes", label: "Спортшылар", icon: Users },
  { to: "/coach/applications", label: "Өтінімдер", icon: ClipboardList },
  { to: "/coach/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/coach/notifications", label: "Хабарландырулар", icon: Bell },
];

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

function CoachClub() {
  const { user, refreshMe } = useAuth();
  const clubId = user?.clubId;
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
      ]);
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Клуб сақталмады"),
  });

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle="Менің клубым">
      {!clubId && (
        <div className="mb-6 rounded-md border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
          Клуб әлі байланыстырылмаған. Төмендегі форманы толтырсаңыз, клуб құрылып, сізге бекітіледі.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Panel title={clubId ? "Клуб карточкасы" : "Клуб құру"}>
          {clubQuery.isLoading ? (
            <LoadingState />
          ) : (
            <ClubEditor
              initial={formInitial}
              isSaving={saveClub.isPending}
              error={error}
              onSubmit={(form) => saveClub.mutate(form)}
            />
          )}
        </Panel>

        <Panel title="Көрініс">
          <ClubPreview club={clubQuery.data} fallback={formInitial} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title={`Жас топтары ${groupsQuery.data?.length ?? 0}`}>
          {!clubId ? (
            <EmptyState title="Алдымен клуб құрыңыз" hint="Топтарды клуб сақталғаннан кейін қосуға болады" />
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
    </DashboardShell>
  );
}

function ClubEditor({
  initial,
  isSaving,
  error,
  onSubmit,
}: {
  initial: ClubForm;
  isSaving: boolean;
  error: string;
  onSubmit: (form: ClubForm) => void;
}) {
  const [form, setForm] = useState(initial);
  const [locale, setLocale] = useState<Locale>("kk");

  useEffect(() => setForm(initial), [initial]);

  const updateLocale = (key: "name" | "description", value: string) => {
    setForm((current) => ({ ...current, [key]: { ...current[key], [locale]: value } }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(["kk", "ru", "en"] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => setLocale(lng)}
            className={`rounded-md border px-3 py-1.5 text-xs uppercase transition-colors ${
              locale === lng ? "border-gold/50 bg-gold/15 text-gold" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {lng}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={`Атауы (${locale.toUpperCase()})`}
          value={form.name[locale]}
          onChange={(value) => updateLocale("name", value)}
          required={locale === "kk"}
        />
        <Field label="Қысқа атауы" value={form.shortName} onChange={(shortName) => setForm({ ...form, shortName })} placeholder="JCL Almaty" />
        <Field label="Қала" value={form.city} onChange={(city) => setForm({ ...form, city })} required />
        <Field label="Ел коды" value={form.country} onChange={(country) => setForm({ ...form, country: country.toUpperCase().slice(0, 2) })} required maxLength={2} />
        <Field
          label="Логотип URL"
          value={form.logoUrl}
          onChange={(logoUrl) => setForm({ ...form, logoUrl })}
          placeholder="https://..."
          type="url"
          className="md:col-span-2"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Сипаттама ({locale.toUpperCase()})</label>
        <textarea
          value={form.description[locale]}
          onChange={(e) => updateLocale("description", e.target.value)}
          rows={5}
          className="mt-1.5 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
          placeholder="Клуб туралы қысқаша ақпарат"
        />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      <button
        disabled={isSaving}
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2.5 font-medium text-gold-foreground shadow-gold disabled:opacity-50 sm:w-auto"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Сақтау
      </button>
    </form>
  );
}

function GroupsManager({ clubId, groups, onChanged }: { clubId: string; groups: any[]; onChanged: () => void }) {
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
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Топ қосылмады"),
  });

  const updateGroup = useMutation({
    mutationFn: (group: any) => api.clubs.updateGroup(group.id, toGroupPayload(group)),
    onSuccess: () => {
      setEditingId(null);
      setError("");
      onChanged();
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Топ сақталмады"),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.clubs.deleteGroup(id),
    onSuccess: onChanged,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Топ өшірілмеді"),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); createGroup.mutate(); }}
        className="grid gap-3 rounded-md border border-border/60 bg-background/30 p-3 md:grid-cols-[minmax(180px,1fr)_110px_110px_auto]"
      >
        <Field label="Топ атауы" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
        <Field label="Жасынан" type="number" value={draft.ageMin} onChange={(ageMin) => setDraft({ ...draft, ageMin })} required />
        <Field label="Жасына дейін" type="number" value={draft.ageMax} onChange={(ageMax) => setDraft({ ...draft, ageMax })} required />
        <button
          disabled={createGroup.isPending}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gold/15 px-4 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {createGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Қосу
        </button>
      </form>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {groups.length === 0 ? (
        <EmptyState title="Жас топтары жоқ" hint="Мысалы: U10, U12, Junior" />
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

function GroupCard({ group, isEditing, isBusy, onEdit, onCancel, onSave, onDelete }: any) {
  const [form, setForm] = useState({ ...group, ageMin: String(group.ageMin), ageMax: String(group.ageMax) });

  if (isEditing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="rounded-md border border-gold/30 bg-gold/5 p-4">
        <div className="space-y-3">
          <Field label="Топ" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min" type="number" value={form.ageMin} onChange={(ageMin) => setForm({ ...form, ageMin })} required />
            <Field label="Max" type="number" value={form.ageMax} onChange={(ageMax) => setForm({ ...form, ageMax })} required />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button disabled={isBusy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-gold px-3 py-2 text-sm text-gold-foreground shadow-gold disabled:opacity-50">
            <Save className="h-4 w-4" /> Сақтау
          </button>
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Болдырмау
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
          <div className="mt-1 text-xs text-muted-foreground">{group.ageMin}-{group.ageMax} жас</div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground" aria-label="Өзгерту">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} disabled={isBusy} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50" aria-label="Өшіру">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ClubPreview({ club, fallback }: { club: any; fallback: ClubForm }) {
  const logo = club?.logoUrl || fallback.logoUrl;
  const name = localizeName(club?.name) || fallback.name.kk || fallback.name.ru || fallback.name.en || "Judo Club";
  const description = localizeName(club?.description) || fallback.description.kk || fallback.description.ru || fallback.description.en || "Клуб сипаттамасы сақталғаннан кейін осында көрінеді.";

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background/30">
      <div className="flex aspect-[16/9] items-center justify-center bg-muted/30">
        {logo ? (
          <img src={logo} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <div className="p-4">
        <div className="font-display text-xl font-semibold">{name}</div>
        <div className="mt-1 text-sm text-muted-foreground">{club?.city || fallback.city || "Қала"} · {club?.country || fallback.country}</div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, className = "", ...rest }: any) {
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

function toClubForm(club: any): ClubForm {
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

function normalizeI18n(value: any): Record<Locale, string> {
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

function toGroupPayload(group: any) {
  return {
    name: group.name.trim(),
    ageMin: Number(group.ageMin),
    ageMax: Number(group.ageMax),
  };
}

function localizeName(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "";
}
