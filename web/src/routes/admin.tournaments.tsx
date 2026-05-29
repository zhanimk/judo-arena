import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Activity, Archive, ClipboardList, ExternalLink, FileText, GitBranch, Loader2,
  Monitor, Plus, Power, Settings, ShieldAlert, Trash2, Trophy, Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, type InputHTMLAttributes } from "react";

export const Route = createFileRoute("/admin/tournaments")({
  head: () => ({ meta: [{ title: "Жарыстар — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminTournamentsRoute />
    </ProtectedRoute>
  ),
});


function AdminTournamentsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const normalizedPath = pathname.replace(/\/+$/, "");

  if (normalizedPath !== "/admin/tournaments") {
    return <Outlet />;
  }

  return <AdminTournaments />;
}


const transitions: Record<string, { next: string; label: string }[]> = {
  DRAFT: [{ next: "REGISTRATION_OPEN", label: "Тіркеуді ашу" }],
  REGISTRATION_OPEN: [{ next: "REGISTRATION_CLOSED", label: "Тіркеуді жабу" }],
  REGISTRATION_CLOSED: [{ next: "IN_PROGRESS", label: "Бастау" }, { next: "REGISTRATION_OPEN", label: "Қайта ашу" }],
  IN_PROGRESS: [],
};

function AdminTournaments() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery({ queryKey: ["admin-all-tournaments"], queryFn: () => api.tournaments.list({ includeArchived: true, limit: 100 }) });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.tournaments.setStatus(id, status),
    onMutate: ({ id }) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
    onSettled: () => setBusy(null),
  });

  const finalize = useMutation({
    mutationFn: (id: string) => api.admin.finalize(id),
    onMutate: (id) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
    onSettled: () => setBusy(null),
  });

  const archive = useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) => api.admin.archiveTournament(id, archive),
    onMutate: ({ id }) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Архив өзгермеді"),
    onSettled: () => setBusy(null),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.tournaments.delete(id),
    onMutate: (id) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Турнир өшірілмеді"),
    onSettled: () => setBusy(null),
  });

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Жарыстарды басқару">
      <Panel
        title={`Барлығы ${query.data?.items.length ?? 0}`}
        action={
          <button onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 text-sm bg-gradient-gold text-gold-foreground px-3 py-1.5 rounded-md shadow-gold">
            <Plus className="h-4 w-4" /> {showCreate ? "Жабу" : "Жаңа жарыс"}
          </button>
        }
      >
        {error && <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">{error}</div>}

        {showCreate && (
          <CreateTournamentForm onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }); }} />
        )}

        {query.isLoading ? <LoadingState /> :
          (query.data?.items ?? []).length === 0 ? (
            <EmptyState title="Жарыстар жоқ" hint="Жаңа жарыс құрыңыз" />
          ) : (
            <div className="space-y-3 mt-4">
              {query.data!.items.map((t: any) => {
                const trans = transitions[t.status] ?? [];
                return (
                  <div key={t.id} className="glass rounded-xl p-4 md:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate({ to: "/admin/tournaments/$id", params: { id: t.id } })}
                            className="text-left text-lg font-semibold leading-tight hover:text-gold"
                          >
                            {localizeName(t.name)} →
                          </button>
                          <StatusBadge status={t.status} />
                          {t.isArchived && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Архив</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{t.city}</span>
                          <span>·</span>
                          <span>{new Date(t.startDate).toLocaleDateString("kk-KZ")}</span>
                          <span>·</span>
                          <span>{t._count?.categories ?? 0} санат</span>
                          <span>·</span>
                          <span>{t._count?.applications ?? 0} өтінім</span>
                          <span>·</span>
                          <span>{t.tatamiCount ?? 0} татами</span>
                        </div>
                      </div>

                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: t.id }}
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-gold"
                      >
                        Басқару
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: t.id }}
                        search={{ tab: "scoreboard" }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/15"
                      >
                        <Monitor className="h-4 w-4" /> Табло
                      </Link>
                      <Link
                        to="/live-wall/$tournamentId"
                        params={{ tournamentId: t.id }}
                        target="_blank"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium hover:border-gold/50"
                      >
                        <ExternalLink className="h-4 w-4" /> Проектор
                      </Link>
                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: t.id }}
                        search={{ tab: "protocol" }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium hover:border-gold/50"
                      >
                        <FileText className="h-4 w-4" /> Хаттама
                      </Link>
                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: t.id }}
                        search={{ tab: "categories" }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium hover:border-gold/50"
                      >
                        <GitBranch className="h-4 w-4" /> Санаттар / веса
                      </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
                      {trans.map((tr) => (
                        <button key={tr.next}
                          onClick={() => change.mutate({ id: t.id, status: tr.next })}
                          disabled={busy === t.id}
                          className="inline-flex min-h-9 items-center rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold disabled:opacity-50">
                          {tr.label}
                        </button>
                      ))}
                      {t.status === "IN_PROGRESS" && (
                        <button onClick={() => finalize.mutate(t.id)} disabled={busy === t.id}
                          className="inline-flex min-h-9 items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50">
                          Аяқтау + рейтинг
                        </button>
                      )}
                      <Link to="/tournaments/$id" params={{ id: t.id }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:border-gold/40">
                        <ExternalLink className="h-3.5 w-3.5" /> Жария бет
                      </Link>
                      <button
                        onClick={() => archive.mutate({ id: t.id, archive: !t.isArchived })}
                        disabled={busy === t.id}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:border-gold/40 disabled:opacity-50"
                      >
                        <Archive className="h-3.5 w-3.5" /> {t.isArchived ? "Архивтен шығару" : "Архив"}
                      </button>
                      {t.status !== "CANCELLED" && t.status !== "COMPLETED" && (
                        <button
                          onClick={() => change.mutate({ id: t.id, status: "CANCELLED" })}
                          disabled={busy === t.id}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Power className="h-3.5 w-3.5" /> Тоқтату
                        </button>
                      )}
                      {(t.status === "DRAFT" || t.status === "CANCELLED") && (
                        <button
                          onClick={() => {
                            if (window.confirm("Турнирді толық өшіру керек пе? Бұл әрекет қайтарылмайды.")) remove.mutate(t.id);
                          }}
                          disabled={busy === t.id}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Жою
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </Panel>
    </DashboardShell>
  );
}

function CreateTournamentForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    nameKk: "", nameRu: "", nameEn: "",
    location: "", city: "Алматы", startDate: "", endDate: "", applicationDeadline: "", tatamiCount: 2,
    posterUrl: "", mapUrl: "", weighInLocation: "", weighInStart: "", weighInEnd: "",
  });
  const [error, setError] = useState("");
  const mut = useMutation({
    mutationFn: () => api.tournaments.create({
      name: { kk: form.nameKk, ru: form.nameRu || undefined, en: form.nameEn || undefined },
      location: form.location, city: form.city,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      applicationDeadline: form.applicationDeadline ? new Date(form.applicationDeadline).toISOString() : undefined,
      mapUrl: form.mapUrl || undefined,
      weighInLocation: form.weighInLocation || undefined,
      weighInStart: form.weighInStart ? new Date(form.weighInStart).toISOString() : undefined,
      weighInEnd: form.weighInEnd ? new Date(form.weighInEnd).toISOString() : undefined,
      tatamiCount: Number(form.tatamiCount),
      posterUrl: form.posterUrl || undefined,
    }),
    onSuccess: onDone,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className="mt-4 mb-4 glass rounded-lg p-4 grid gap-3 md:grid-cols-3">
      <Input label="Атауы (KZ) *" value={form.nameKk} onChange={(v) => setForm({...form, nameKk: v})} required />
      <Input label="Атауы (RU)" value={form.nameRu} onChange={(v) => setForm({...form, nameRu: v})} />
      <Input label="Name (EN)" value={form.nameEn} onChange={(v) => setForm({...form, nameEn: v})} />
      <Input label="Қала *" value={form.city} onChange={(v) => setForm({...form, city: v})} required />
      <Input label="Орын *" value={form.location} onChange={(v) => setForm({...form, location: v})} required placeholder="мысалы Дворец Спорта" />
      <Input label="Татами саны" type="number" min={1} max={20} value={String(form.tatamiCount)} onChange={(v) => setForm({...form, tatamiCount: Number(v)})} />
      <Input label="Бастау күні *" type="date" value={form.startDate} onChange={(v) => setForm({...form, startDate: v})} required />
      <Input label="Аяқтау күні *" type="date" value={form.endDate} onChange={(v) => setForm({...form, endDate: v})} required />
      <Input label="Өтінім дедлайны" type="datetime-local" value={form.applicationDeadline} onChange={(v) => setForm({...form, applicationDeadline: v})} />
      <Input label="Положение / фото URL" type="url" value={form.posterUrl} onChange={(v) => setForm({...form, posterUrl: v})} placeholder="https://..." />
      <Input label="Карта URL" type="url" value={form.mapUrl} onChange={(v) => setForm({...form, mapUrl: v})} placeholder="Google/2GIS link" />
      <Input label="Взвешивание орны" value={form.weighInLocation} onChange={(v) => setForm({...form, weighInLocation: v})} placeholder="мысалы зал №2" />
      <Input label="Взвешивание басталуы" type="datetime-local" value={form.weighInStart} onChange={(v) => setForm({...form, weighInStart: v})} />
      <Input label="Взвешивание аяқталуы" type="datetime-local" value={form.weighInEnd} onChange={(v) => setForm({...form, weighInEnd: v})} />

      {error && <div className="md:col-span-3 text-sm text-destructive">{error}</div>}
      <button type="submit" disabled={mut.isPending}
        className="md:col-span-3 bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Жасау
      </button>
    </form>
  );
}

function TournamentCategoriesPanel({ tournamentId, canEdit, canGenerateBracket, onGenerate }: {
  tournamentId: string;
  canEdit: boolean;
  canGenerateBracket: boolean;
  onGenerate: (catId: string) => void;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const catQuery = useQuery({
    queryKey: ["tournament-categories", tournamentId],
    queryFn: () => api.tournaments.categories(tournamentId),
  });
  const bracketsQuery = useQuery({
    queryKey: ["tournament-brackets", tournamentId],
    queryFn: () => api.brackets.forTournament(tournamentId),
  });
  const deleteCategory = useMutation({
    mutationFn: (categoryId: string) => api.tournaments.deleteCategory(categoryId),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["tournament-categories", tournamentId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Санат өшірілмеді"),
  });

  return (
    <div className="mt-4 pt-4 border-t border-border/30">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-sm">Санаттар</h4>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)} className="text-xs text-gold hover:underline">
            {showForm ? "Жабу" : "+ Жаңа санат"}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <AddCategoryForm tournamentId={tournamentId} onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["tournament-categories", tournamentId] }); }} />
      )}
      {error && <div className="mb-3 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}

      {catQuery.isLoading ? <LoadingState /> :
        (catQuery.data ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground">Санаттар жоқ</div>
        ) : (
          <div className="space-y-2">
            {catQuery.data!.map((c: any) => {
              const bracket = bracketsQuery.data?.find((b: any) => b.categoryId === c.id);
              return (
                <div key={c.id} className="glass rounded p-3 flex justify-between items-center text-sm">
                  <div>
                    <div className="font-medium">
                      {c.gender === "MALE" ? "🧑 Ер" : "👩 Әйел"} {c.weightMin}-{c.weightMax} кг
                      <span className="text-xs text-muted-foreground ml-2">({c.ageMin}-{c.ageMax} жас)</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.format === "ROUND_ROBIN" ? "Round-Robin" : "SE+Repechage"}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {bracket ? (
                      <a href={api.admin.bracketPdfUrl(bracket.id)} target="_blank" rel="noopener"
                        className="text-xs glass border border-gold/30 px-2.5 py-1 rounded hover:border-gold/60">
                        📄 Тор PDF
                      </a>
                    ) : canGenerateBracket ? (
                      <button onClick={() => onGenerate(c.id)}
                        className="text-xs bg-gold/15 text-gold border border-gold/40 px-2.5 py-1 rounded">
                        ⚙️ Жеребе тастау
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Тор жоқ</span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => deleteCategory.mutate(c.id)}
                        disabled={deleteCategory.isPending}
                        className="text-xs border border-destructive/30 text-destructive px-2.5 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Өшіру
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

function AddCategoryForm({ tournamentId, onDone }: { tournamentId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    gender: "MALE" as "MALE" | "FEMALE",
    ageMin: 18, ageMax: 35,
    weightMin: 60, weightMax: 66,
    matchDurationSec: 240,
    format: "SE_IJF" as "SE_IJF" | "ROUND_ROBIN",
  });
  const [error, setError] = useState("");
  const mut = useMutation({
    mutationFn: () => api.tournaments.addCategory(tournamentId, {
      gender: form.gender,
      ageMin: Number(form.ageMin), ageMax: Number(form.ageMax),
      weightMin: Number(form.weightMin), weightMax: Number(form.weightMax),
      matchDurationSec: Number(form.matchDurationSec),
      format: form.format,
    }),
    onSuccess: onDone,
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className="mb-4 glass rounded-lg p-3 grid gap-3 md:grid-cols-4">
      <div>
        <label className="text-xs uppercase text-muted-foreground">Жыныс</label>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {(["MALE", "FEMALE"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setForm({...form, gender: g})}
              className={`py-1.5 rounded text-xs border ${form.gender === g ? "bg-gold/15 text-gold border-gold/40" : "glass border-border"}`}>
              {g === "MALE" ? "Ер" : "Әйел"}
            </button>
          ))}
        </div>
      </div>
      <Input label="Жасы мин" type="number" value={String(form.ageMin)} onChange={(v) => setForm({...form, ageMin: Number(v)})} />
      <Input label="Жасы макс" type="number" value={String(form.ageMax)} onChange={(v) => setForm({...form, ageMax: Number(v)})} />
      <div>
        <label className="text-xs uppercase text-muted-foreground">Формат</label>
        <select value={form.format} onChange={(e) => setForm({...form, format: e.target.value as any})}
          className="mt-1 w-full bg-input border border-border rounded px-2 py-1.5 text-xs">
          <option value="SE_IJF">SE + Repechage</option>
          <option value="ROUND_ROBIN">Round-Robin</option>
        </select>
      </div>
      <Input label="Салмақ мин (кг)" type="number" step="0.1" value={String(form.weightMin)} onChange={(v) => setForm({...form, weightMin: Number(v)})} />
      <Input label="Салмақ макс (кг)" type="number" step="0.1" value={String(form.weightMax)} onChange={(v) => setForm({...form, weightMax: Number(v)})} />
      <Input label="Матч ұзақтығы (сек)" type="number" value={String(form.matchDurationSec)} onChange={(v) => setForm({...form, matchDurationSec: Number(v)})} />

      {error && <div className="md:col-span-4 text-xs text-destructive">{error}</div>}
      <div className="md:col-span-4 flex justify-end">
        <button type="submit" disabled={mut.isPending}
          className="text-xs bg-gradient-gold text-gold-foreground px-4 py-1.5 rounded shadow-gold disabled:opacity-50">
          {mut.isPending ? "..." : "Қосу"}
        </button>
      </div>
    </form>
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
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest}
        className="mt-1 w-full bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-gold focus:outline-none" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    DRAFT: { c: "bg-muted text-muted-foreground", l: "Жоба" },
    REGISTRATION_OPEN: { c: "bg-gold/15 text-gold border border-gold/30", l: "Тіркеу ашық" },
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS: { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED: { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const x = m[status] ?? { c: "bg-muted", l: status };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${x.c} shrink-0`}>{x.l}</span>;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
