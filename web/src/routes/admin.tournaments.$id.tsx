/**
 * Детальное управление одним турниром.
 * Табы: Обзор · Категории · Заявки · Табло · Хаттама · Уведомление · Аудит.
 */

import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings,
  ClipboardList, GitBranch, ArrowLeft, Loader2, Send, FileText,
  Plus, Pencil, Trash2, Save, X, AlertTriangle, MapPin, Clock,
  Wand2, Monitor, ExternalLink,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useEffect, useState } from "react";
import { LiveBracket } from "@/components/judo/LiveBracket";
import { TournamentScoreboardPanel } from "@/routes/admin.matches";

export const Route = createFileRoute("/admin/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс басқару — Әкімші" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab = typeof search.tab === "string" && isTournamentTab(search.tab) ? search.tab : undefined;
    return { tab };
  },
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminTournamentDetail />
    </ProtectedRoute>
  ),
});



type Tab = "overview" | "categories" | "applications" | "scoreboard" | "protocol" | "notify" | "audit";
const tournamentTabs: Tab[] = ["overview", "categories", "applications", "scoreboard", "protocol", "notify", "audit"];
function isTournamentTab(value: string): value is Tab {
  return tournamentTabs.includes(value as Tab);
}

const transitions: Record<string, { next: string; label: string; color?: string }[]> = {
  DRAFT: [
    { next: "REGISTRATION_OPEN", label: "Тіркеуді ашу" },
    { next: "CANCELLED", label: "Тоқтату", color: "destructive" },
  ],
  REGISTRATION_OPEN: [
    { next: "REGISTRATION_CLOSED", label: "Тіркеуді жабу" },
    { next: "CANCELLED", label: "Тоқтату", color: "destructive" },
  ],
  REGISTRATION_CLOSED: [
    { next: "IN_PROGRESS", label: "Бастау" },
    { next: "REGISTRATION_OPEN", label: "Қайта ашу" },
    { next: "CANCELLED", label: "Тоқтату", color: "destructive" },
  ],
  IN_PROGRESS: [
    { next: "CANCELLED", label: "Тоқтату", color: "destructive" },
  ],
  CANCELLED: [
    { next: "DRAFT", label: "Жобаға қайтару" },
  ],
};

function AdminTournamentDetail() {
  const { id } = useParams({ from: "/admin/tournaments/$id" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(search.tab ?? "overview");
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const tQuery = useQuery({ queryKey: ["admin-tournament", id], queryFn: () => api.tournaments.get(id) });

  const change = useMutation({
    mutationFn: (status: string) => api.tournaments.setStatus(id, status),
    onMutate: () => setError(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tournament", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  const finalize = useMutation({
    mutationFn: () => api.admin.finalize(id),
    onMutate: () => setError(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tournament", id] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  useEffect(() => {
    if (search.tab && search.tab !== tab) {
      setTab(search.tab);
    }
  }, [search.tab, tab]);

  const selectTab = (nextTab: Tab) => {
    setTab(nextTab);
    navigate({
      to: "/admin/tournaments/$id",
      params: { id },
      search: { tab: nextTab },
      replace: true,
    });
  };

  if (tQuery.isLoading) {
    return (
      <DashboardShell role="Әкімші" navItems={nav} accentTitle="Жүктелуде...">
        <LoadingState />
      </DashboardShell>
    );
  }

  const t = tQuery.data;
  if (!t) {
    return (
      <DashboardShell role="Әкімші" navItems={nav} accentTitle="Жарыс табылмады">
        <EmptyState title="Жарыс жоқ" />
      </DashboardShell>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Шолу" },
    { id: "categories", label: `Санаттар (${t.categories?.length ?? 0})` },
    { id: "applications", label: "Өтінімдер" },
    { id: "scoreboard", label: "Табло" },
    { id: "protocol", label: "Хаттама" },
    { id: "notify", label: "Хабарландыру" },
    { id: "audit", label: "Аудит" },
  ];

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle={localizeName(t.name)}>
      <Link to="/admin/tournaments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowLeft className="h-4 w-4" /> Барлық жарыстар
      </Link>

      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

      {/* Шапка с lifecycle */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {t.city} · {t.location} · {new Date(t.startDate).toLocaleDateString("kk-KZ")} — {new Date(t.endDate).toLocaleDateString("kk-KZ")}
            </div>
            <StatusBadge status={t.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(transitions[t.status] ?? []).map((tr) => (
            <button
              key={tr.next}
              onClick={() => change.mutate(tr.next)}
              disabled={change.isPending}
              className={`text-sm px-4 py-1.5 rounded shadow disabled:opacity-50 ${
                tr.color === "destructive"
                  ? "bg-destructive/15 text-destructive border border-destructive/40"
                  : "bg-gradient-gold text-gold-foreground shadow-gold"
              }`}
            >
              {tr.label}
            </button>
          ))}
          {t.status === "IN_PROGRESS" && (
            <button
              onClick={() => finalize.mutate()}
              disabled={finalize.isPending}
              className="text-sm px-4 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 disabled:opacity-50"
            >
              🏁 Аяқтау + рейтинг
            </button>
          )}
          {t.status === "COMPLETED" && (
            <a href={api.admin.protocolPdfUrl(t.id)} target="_blank" rel="noopener"
              className="text-sm px-4 py-1.5 rounded glass border border-gold/30 hover:border-gold/60 inline-flex items-center gap-1">
              <FileText className="h-4 w-4" /> Хаттама PDF
            </a>
          )}
          <Link to="/tournaments/$id" params={{ id: t.id }}
            className="text-sm px-4 py-1.5 rounded glass border border-border hover:border-gold/40">
            Жария бет →
          </Link>
        </div>
      </div>

      {/* Табы */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-border/40">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => selectTab(tb.id)}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === tb.id
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Контент */}
      {tab === "overview" && <OverviewTab tournament={t} />}
      {tab === "categories" && <CategoriesTab tournament={t} />}
      {tab === "applications" && <ApplicationsTab tournamentId={t.id} />}
      {tab === "scoreboard" && <TournamentScoreboardPanel fixedTournamentId={t.id} />}
      {tab === "protocol" && <ProtocolTab tournament={t} />}
      {tab === "notify" && <NotifyTab tournament={t} />}
      {tab === "audit" && <AuditTab tournamentId={t.id} />}
    </DashboardShell>
  );
}

function OverviewTab({ tournament: t }: { tournament: any }) {
  const qc = useQueryClient();
  const [posterUrl, setPosterUrl] = useState(t.posterUrl ?? "");
  const [mapUrl, setMapUrl] = useState(t.mapUrl ?? "");
  const [weighInLocation, setWeighInLocation] = useState(t.weighInLocation ?? "");
  const [weighInStart, setWeighInStart] = useState(toDateTimeLocal(t.weighInStart ?? ""));
  const [weighInEnd, setWeighInEnd] = useState(toDateTimeLocal(t.weighInEnd ?? ""));
  const [applicationDeadline, setApplicationDeadline] = useState(toDateTimeLocal(t.applicationDeadline ?? t.startDate));
  const [error, setError] = useState("");
  const savePoster = useMutation({
    mutationFn: () => api.tournaments.update(t.id, {
      posterUrl: posterUrl || null,
      mapUrl: mapUrl || null,
      weighInLocation: weighInLocation || null,
      weighInStart: weighInStart ? new Date(weighInStart).toISOString() : null,
      weighInEnd: weighInEnd ? new Date(weighInEnd).toISOString() : null,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline).toISOString() : null,
    }),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", t.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Положение сақталмады"),
  });

  return (
    <Panel title="Жалпы ақпарат">
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <Field label="Атауы" value={localizeName(t.name)} />
        <Field label="Орын" value={`${t.location}, ${t.city}`} />
        <Field label="Басталу" value={new Date(t.startDate).toLocaleString("kk-KZ")} />
        <Field label="Аяқталу" value={new Date(t.endDate).toLocaleString("kk-KZ")} />
        <Field label="Өтінім дедлайны" value={t.applicationDeadline ? new Date(t.applicationDeadline).toLocaleString("kk-KZ") : new Date(t.startDate).toLocaleString("kk-KZ")} />
        <Field label="Взвешивание" value={formatWeighIn(t)} />
        <Field label="Татами" value={String(t.tatamiCount)} />
        <Field label="Санаттар" value={String(t.categories?.length ?? 0)} />
        <Field label="Өтінімдер" value={String(t._count?.applications ?? 0)} />
        <Field label="Тіл" value={t.primaryLocale} />
      </div>
      <div className="mt-4 grid gap-4 border-t border-border/30 pt-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Положение, карта және взвешивание</div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="URL"
              type="url"
              value={posterUrl}
              onChange={setPosterUrl}
              placeholder="https://..."
            />
            <Input
              label="Өтінім дедлайны"
              type="datetime-local"
              value={applicationDeadline}
              onChange={setApplicationDeadline}
            />
            <Input
              label="Карта URL"
              type="url"
              value={mapUrl}
              onChange={setMapUrl}
              placeholder="Google Maps / 2GIS"
            />
            <Input
              label="Взвешивание орны"
              value={weighInLocation}
              onChange={setWeighInLocation}
              placeholder="Спортзал, кабинет, вход..."
            />
            <Input
              label="Взвешивание басталуы"
              type="datetime-local"
              value={weighInStart}
              onChange={setWeighInStart}
            />
            <Input
              label="Взвешивание аяқталуы"
              type="datetime-local"
              value={weighInEnd}
              onChange={setWeighInEnd}
            />
          </div>
          <button
            type="button"
            onClick={() => savePoster.mutate()}
            disabled={savePoster.isPending}
            className="self-end rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50"
          >
            Сақтау
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
        {t.posterUrl && (
          <a
            href={t.posterUrl}
            target="_blank"
            rel="noopener"
            className="mt-3 inline-flex rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
          >
            Ашу
          </a>
        )}
        {t.mapUrl && (
          <a
            href={t.mapUrl}
            target="_blank"
            rel="noopener"
            className="ml-2 mt-3 inline-flex rounded-md border border-border bg-card/50 px-3 py-2 text-sm hover:border-gold/40"
          >
            Карта сілтемесі
          </a>
        )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <iframe
            title="Tournament map"
            src={mapEmbedUrl(t)}
            className="h-64 w-full border-0"
            loading="lazy"
          />
          <div className="space-y-2 p-3 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div>
                <div className="font-medium">{t.location}</div>
                <div className="text-xs text-muted-foreground">{t.city}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div>
                <div className="font-medium">Взвешивание</div>
                <div className="text-xs text-muted-foreground">{formatWeighIn(t)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {t.description && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Сипаттама</div>
          <p className="text-sm leading-relaxed">{localizeName(t.description)}</p>
        </div>
      )}
    </Panel>
  );
}

function CategoriesTab({ tournament: t }: { tournament: any }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState("");
  const canEdit = t.status === "DRAFT";

  const create = useMutation({
    mutationFn: (data: any) => api.tournaments.addCategory(t.id, data),
    onSuccess: () => {
      setShowForm(false);
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", t.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Санат қосылмады"),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.tournaments.updateCategory(id, data),
    onSuccess: () => {
      setEditing(null);
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", t.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Санат сақталмады"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.tournaments.deleteCategory(id),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-tournament", t.id] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Санат өшірілмеді"),
  });

  return (
    <Panel
      title={`Барлығы ${t.categories?.length ?? 0} санат`}
      action={canEdit && (
        <button
          onClick={() => { setShowForm((v) => !v); setEditing(null); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-sm text-gold-foreground shadow-gold"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Жабу" : "Санат қосу"}
        </button>
      )}
    >
      {!canEdit && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Санаттарды тек DRAFT мәртебесінде өзгертуге болады. Тіркеу ашылғаннан кейін санаттар турнир құрылымының негізі болып бекітіледі.
        </div>
      )}
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {showForm && (
        <CategoryForm
          busy={create.isPending}
          onSubmit={(data) => create.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {(t.categories ?? []).length === 0 ? (
        <EmptyState title="Санаттар жоқ" hint="DRAFT мәртебесінде санаттар қосуға болады" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {t.categories.map((c: any) => (
            <div key={c.id} className="rounded-md border border-border/60 bg-background/30 p-4 text-sm">
              {editing?.id === c.id ? (
                <CategoryForm
                  initial={c}
                  busy={update.isPending}
                  onSubmit={(data) => update.mutate({ id: c.id, data })}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{categoryTitle(c)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.gender === "MALE" ? "Ер" : "Қыз"} · {c.ageMin}-{c.ageMax} жас · ({c.weightMin}, {c.weightMax}] кг
                      </div>
                    </div>
                    <FormatBadge format={c.format} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="rounded border border-border/50 p-2">
                      Матч<br /><span className="text-foreground">{c.matchDurationSec}с</span>
                    </div>
                    <div className="rounded border border-border/50 p-2">
                      Golden<br /><span className="text-foreground">{c.goldenScoreSec || "шексіз"}</span>
                    </div>
                    <div className="rounded border border-border/50 p-2">
                      Yuko<br /><span className="text-foreground">{c.allowYuko ? "иә" : "жоқ"}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => { setEditing(c); setShowForm(false); }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Өзгерту
                      </button>
                      <button
                        onClick={() => remove.mutate(c.id)}
                        disabled={remove.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Өшіру
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function CategoryForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: any;
  busy: boolean;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nameKk: initial?.name?.kk ?? "",
    nameRu: initial?.name?.ru ?? "",
    nameEn: initial?.name?.en ?? "",
    gender: initial?.gender ?? "MALE",
    ageMin: String(initial?.ageMin ?? 6),
    ageMax: String(initial?.ageMax ?? 8),
    weightMin: String(initial?.weightMin ?? 20),
    weightMax: String(initial?.weightMax ?? 24),
    matchDurationSec: String(initial?.matchDurationSec ?? 180),
    goldenScoreSec: String(initial?.goldenScoreSec ?? 0),
    format: initial?.format ?? "SE_IJF",
    allowYuko: Boolean(initial?.allowYuko),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = compactI18n({ kk: form.nameKk, ru: form.nameRu, en: form.nameEn });
    onSubmit({
      ...(Object.keys(name).length > 0 ? { name } : {}),
      gender: form.gender,
      ageMin: Number(form.ageMin),
      ageMax: Number(form.ageMax),
      weightMin: Number(form.weightMin),
      weightMax: Number(form.weightMax),
      matchDurationSec: Number(form.matchDurationSec),
      goldenScoreSec: Number(form.goldenScoreSec),
      format: form.format,
      allowYuko: form.allowYuko,
    });
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-md border border-gold/20 bg-gold/5 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Атауы KK" value={form.nameKk} onChange={(nameKk) => setForm({ ...form, nameKk })} placeholder="U12 -24 кг" />
        <Input label="Атауы RU" value={form.nameRu} onChange={(nameRu) => setForm({ ...form, nameRu })} />
        <Input label="Атауы EN" value={form.nameEn} onChange={(nameEn) => setForm({ ...form, nameEn })} />
        <Select label="Жыныс" value={form.gender} onChange={(gender) => setForm({ ...form, gender })} options={[
          ["MALE", "Ер"],
          ["FEMALE", "Қыз"],
        ]} />
        <Input label="Жас min" type="number" value={form.ageMin} onChange={(ageMin) => setForm({ ...form, ageMin })} required />
        <Input label="Жас max" type="number" value={form.ageMax} onChange={(ageMax) => setForm({ ...form, ageMax })} required />
        <Input label="Салмақ min" type="number" step="0.1" value={form.weightMin} onChange={(weightMin) => setForm({ ...form, weightMin })} required />
        <Input label="Салмақ max" type="number" step="0.1" value={form.weightMax} onChange={(weightMax) => setForm({ ...form, weightMax })} required />
        <Select label="Формат" value={form.format} onChange={(format) => setForm({ ...form, format })} options={[
          ["SE_IJF", "Olympic / IJF"],
          ["ROUND_ROBIN", "Round-robin"],
          ["MIXED", "Mixed"],
        ]} />
        <Input label="Матч, секунд" type="number" value={form.matchDurationSec} onChange={(matchDurationSec) => setForm({ ...form, matchDurationSec })} required />
        <Input label="Golden score" type="number" value={form.goldenScoreSec} onChange={(goldenScoreSec) => setForm({ ...form, goldenScoreSec })} />
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allowYuko}
            onChange={(e) => setForm({ ...form, allowYuko: e.target.checked })}
            className="mb-2 h-4 w-4"
          />
          <span className="mb-1.5 text-muted-foreground">Yuko рұқсат</span>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сақтау
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          Болдырмау
        </button>
      </div>
    </form>
  );
}

function ApplicationsTab({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<{ id: string; action: "approve" | "reject"; notes: string } | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["tournament-apps", tournamentId],
    queryFn: () => api.tournaments.applications(tournamentId),
  });
  const detailQuery = useQuery({
    queryKey: ["admin-application-detail", selectedId],
    queryFn: () => api.applications.get(selectedId!),
    enabled: !!selectedId,
  });

  const approve = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.applications.approve(id, notes),
    onSuccess: () => {
      setReview(null);
      setError("");
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
      qc.invalidateQueries({ queryKey: ["admin-application-detail", selectedId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Өтінім бекітілмеді"),
  });
  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.applications.reject(id, notes),
    onSuccess: () => {
      setReview(null);
      setError("");
      qc.invalidateQueries({ queryKey: ["tournament-apps", tournamentId] });
      qc.invalidateQueries({ queryKey: ["admin-application-detail", selectedId] });
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Өтінім қайтарылмады"),
  });

  return (
    <Panel title="Клубтардан өтінімдер">
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {query.isLoading ? <LoadingState /> :
        (query.data ?? []).length === 0 ? (
          <EmptyState title="Өтінімдер жоқ" />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
            <div className="space-y-2">
              {query.data!.map((a: any) => (
                <div key={a.id} className={`rounded-md border p-3 text-sm ${selectedId === a.id ? "border-gold/40 bg-gold/5" : "border-border/60 bg-background/30"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setSelectedId(a.id)} className="min-w-0 text-left">
                      <div className="truncate font-medium">{localizeName(a.club?.name)}</div>
                      <div className="text-xs text-muted-foreground">{a._count?.entries ?? 0} спортшы</div>
                    </button>
                    <div className="flex shrink-0 gap-2 items-center">
                      <StatusBadge status={a.status} />
                      {a.status === "SUBMITTED" && (
                        <>
                          <button onClick={() => setReview({ id: a.id, action: "approve", notes: "" })}
                            className="text-xs px-2 py-1 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25">✓</button>
                          <button onClick={() => setReview({ id: a.id, action: "reject", notes: "" })}
                            className="text-xs px-2 py-1 rounded bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">✕</button>
                        </>
                      )}
                    </div>
                  </div>
                  {a.reviewerNotes && (
                    <div className="mt-2 border-l-2 border-gold/40 pl-3 text-xs text-muted-foreground">{a.reviewerNotes}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border/60 bg-background/30 p-4">
              {!selectedId ? (
                <EmptyState title="Өтінімді таңдаңыз" hint="Клубтың категориялар бойынша спортшыларын көру үшін ашыңыз" />
              ) : detailQuery.isLoading ? (
                <LoadingState />
              ) : !detailQuery.data ? (
                <EmptyState title="Өтінім табылмады" />
              ) : (
                <ApplicationReviewDetail app={detailQuery.data} />
              )}
            </div>

            {review && (
              <div className="xl:col-span-2 rounded-md border border-gold/30 bg-gold/5 p-4">
                <div className="mb-3 flex items-center gap-2 font-medium">
                  {review.action === "approve" ? "Өтінімді бекіту" : "Өтінімді қайтару"}
                </div>
                <textarea
                  value={review.notes}
                  onChange={(e) => setReview({ ...review, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  placeholder={review.action === "approve" ? "Ескерту (міндетті емес)" : "Қайтару себебі: мысалы салмақ/құжат/категория дұрыс емес"}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => review.action === "approve"
                      ? approve.mutate({ id: review.id, notes: review.notes || undefined })
                      : reject.mutate({ id: review.id, notes: review.notes || undefined })}
                    disabled={approve.isPending || reject.isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm text-gold-foreground shadow-gold disabled:opacity-50"
                  >
                    {(approve.isPending || reject.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                    Растау
                  </button>
                  <button onClick={() => setReview(null)} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                    Болдырмау
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </Panel>
  );
}

function ApplicationReviewDetail({ app }: { app: any }) {
  const grouped = new Map<string, any[]>();
  for (const entry of app.entries ?? []) {
    const key = entry.categoryId;
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{localizeName(app.club?.name)}</div>
          <div className="text-xs text-muted-foreground">{app.entries?.length ?? 0} спортшы · {app.submittedAt ? new Date(app.submittedAt).toLocaleString("kk-KZ") : "жіберілмеген"}</div>
        </div>
        <StatusBadge status={app.status} />
      </div>
      {(app.entries ?? []).length === 0 ? (
        <EmptyState title="Спортшылар жоқ" />
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([categoryId, entries]) => {
            const category = entries[0]?.category;
            return (
              <div key={categoryId} className="rounded-md border border-border/50 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{categoryTitle(category)}</div>
                  <FormatBadge format={category?.format} />
                </div>
                <div className="space-y-2">
                  {entries.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded border border-border/40 px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{entry.athlete?.name} {entry.athlete?.surname}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.athlete?.gender === "MALE" ? "Ер" : "Қыз"} · {entry.athlete?.weightKg ?? "—"} кг · {entry.athlete?.beltRank ?? "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BracketsTab({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const tQuery = useQuery({ queryKey: ["admin-tournament", tournamentId], queryFn: () => api.tournaments.get(tournamentId) });
  const bracketsQuery = useQuery({
    queryKey: ["tournament-brackets-admin", tournamentId],
    queryFn: () => api.brackets.forTournament(tournamentId),
  });

  const generate = useMutation({
    mutationFn: (categoryId: string) => api.brackets.generate(tournamentId, categoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-brackets-admin", tournamentId] }),
  });
  const remove = useMutation({
    mutationFn: (bracketId: string) => api.brackets.delete(bracketId),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["tournament-brackets-admin", tournamentId] });
    },
  });

  return (
    <Panel title="Турнирлік торлар">
      <div className="space-y-2 mb-4">
        {(tQuery.data?.categories ?? []).map((c: any) => {
          const bracket = bracketsQuery.data?.find((b: any) => b.categoryId === c.id);
          return (
            <div key={c.id} className="glass rounded p-3 flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">
                  {c.gender === "MALE" ? "Ер" : "Әйел"} {c.weightMin}-{c.weightMax} кг
                </div>
                <div className="text-xs text-muted-foreground">{c.format}</div>
              </div>
              <div className="flex gap-2 items-center">
                {bracket ? (
                  <>
                    <button onClick={() => setSelected(selected === c.id ? null : c.id)}
                      className="text-xs glass border border-gold/30 px-2.5 py-1 rounded hover:border-gold/60">
                      {selected === c.id ? "Жабу" : "Қарау"}
                    </button>
                    <a href={api.admin.bracketPdfUrl(bracket.id)} target="_blank" rel="noopener"
                      className="text-xs glass border border-gold/30 px-2.5 py-1 rounded hover:border-gold/60">
                      📄 PDF
                    </a>
                    <button onClick={() => remove.mutate(bracket.id)}
                      disabled={remove.isPending}
                      className="text-xs border border-destructive/30 text-destructive px-2.5 py-1 rounded hover:bg-destructive/10 disabled:opacity-50">
                      Өшіру
                    </button>
                  </>
                ) : (
                  <button onClick={() => generate.mutate(c.id)}
                    disabled={generate.isPending}
                    className="text-xs bg-gold/15 text-gold border border-gold/40 px-2.5 py-1 rounded disabled:opacity-50">
                    ⚙️ Жеребе тастау
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="glass rounded-xl p-4 border border-gold/20 mt-6">
          <LiveBracket tournamentId={tournamentId} categoryId={selected} />
        </div>
      )}
    </Panel>
  );
}

function MatchesTab({ tournamentId }: { tournamentId: string }) {
  const query = useQuery({
    queryKey: ["tournament-matches", tournamentId],
    queryFn: () => api.matches.list({ tournamentId, limit: 500 }),
  });
  return (
    <Panel
      title={`Барлығы ${query.data?.length ?? 0} матч`}
      action={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/matches"
            search={{ tournamentId }}
            className="rounded-md bg-gradient-gold px-3 py-2 text-sm font-medium text-gold-foreground shadow-gold"
          >
            Табло басқару →
          </Link>
          <Link
            to="/live-wall/$tournamentId"
            params={{ tournamentId }}
            target="_blank"
            className="rounded-md border border-border px-3 py-2 text-sm hover:border-gold/40"
          >
            Проектор →
          </Link>
        </div>
      }
    >
      {query.isLoading ? <LoadingState /> :
        (query.data ?? []).length === 0 ? <EmptyState title="Матчтар әлі жоқ" /> : (
          <div className="space-y-1 max-h-[500px] overflow-y-auto text-sm">
            {(query.data ?? []).map((m: any) => (
              <div key={m.id} className="glass rounded p-2 flex justify-between items-center">
                <div className="text-xs">
                  <span className="text-muted-foreground">R{m.round}.{m.position}</span>{" "}
                  {m.redAthlete?.surname ?? "TBD"} vs {m.blueAthlete?.surname ?? "TBD"}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  m.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-300" :
                  m.status === "IN_PROGRESS" ? "bg-destructive/20 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>{m.status}</span>
              </div>
            ))}
          </div>
        )}
    </Panel>
  );
}

function NotifyTab({ tournament }: { tournament: any }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tournamentId = tournament.id;

  const fillWeighInTemplate = () => {
    setTitle("Взвешивание туралы хабарландыру");
    setBody(
      [
        `${localizeName(tournament.name)} жарысына взвешивание:`,
        `Орын: ${tournament.weighInLocation || tournament.location}, ${tournament.city}`,
        `Уақыты: ${formatWeighIn(tournament)}`,
        tournament.mapUrl ? `Карта: ${tournament.mapUrl}` : null,
      ].filter(Boolean).join("\n"),
    );
  };

  const mut = useMutation({
    mutationFn: () =>
      api.notifications.broadcast({
        kind: "tournament",
        tournamentId,
        title,
        body,
        type: "tournament_update",
      }),
    onSuccess: (r) => {
      setResult(`✓ Жіберілді ${r.count} адамға`);
      setTitle(""); setBody(""); setError("");
    },
    onError: (e: any) => setError(e instanceof ApiError ? e.message : "Қате"),
  });

  return (
    <Panel title="Қатысушыларға хабарландыру жіберу">
      <p className="text-xs text-muted-foreground mb-4">
        Бекітілген өтінімдегі барлық тренерлер мен спортшылар хабарландыру алады.
      </p>
      <button
        type="button"
        onClick={fillWeighInTemplate}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/15"
      >
        <Clock className="h-4 w-4" /> Взвешивание шаблонын қою
      </button>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Тақырып</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            placeholder="Мысалы: Жарыс уақыты өзгерді" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Мәтін</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
            className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm focus:border-gold focus:outline-none"
            placeholder="Толық хабарлама..." />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {result && <div className="text-sm text-emerald-300">{result}</div>}
        <button type="submit" disabled={mut.isPending}
          className="bg-gradient-gold text-gold-foreground px-4 py-2 rounded font-medium shadow-gold inline-flex items-center gap-2 disabled:opacity-50">
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Жіберу
        </button>
      </form>
    </Panel>
  );
}

function ProtocolTab({ tournament }: { tournament: any }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [prepareResult, setPrepareResult] = useState<any | null>(null);
  const [prepareError, setPrepareError] = useState("");
  const bracketsQuery = useQuery({
    queryKey: ["protocol-brackets", tournament.id],
    queryFn: () => api.brackets.forTournament(tournament.id),
  });
  const matchesQuery = useQuery({
    queryKey: ["protocol-matches", tournament.id],
    queryFn: () => api.matches.list({ tournamentId: tournament.id }),
  });
  const applicationsQuery = useQuery({
    queryKey: ["protocol-applications", tournament.id],
    queryFn: () => api.tournaments.applications(tournament.id),
  });
  const prepare = useMutation({
    mutationFn: () => api.brackets.prepareTournament(tournament.id),
    onSuccess: (result) => {
      setPrepareResult(result);
      setPrepareError("");
      qc.invalidateQueries({ queryKey: ["protocol-brackets", tournament.id] });
      qc.invalidateQueries({ queryKey: ["protocol-matches", tournament.id] });
      qc.invalidateQueries({ queryKey: ["admin-tournament", tournament.id] });
    },
    onError: (e: any) => {
      setPrepareError(e instanceof ApiError ? e.message : "Жеребе дайындалмады");
      setPrepareResult(null);
    },
  });
  const generate = useMutation({
    mutationFn: (categoryId: string) => api.brackets.generate(tournament.id, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protocol-brackets", tournament.id] });
      qc.invalidateQueries({ queryKey: ["protocol-matches", tournament.id] });
    },
  });
  const remove = useMutation({
    mutationFn: (bracketId: string) => api.brackets.delete(bracketId),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["protocol-brackets", tournament.id] });
      qc.invalidateQueries({ queryKey: ["protocol-matches", tournament.id] });
    },
  });
  const completed = (matchesQuery.data ?? []).filter((m: any) => m.status === "COMPLETED").length;
  const total = matchesQuery.data?.length ?? 0;
  const entryCountByCategory = buildCategoryEntryCounts(applicationsQuery.data ?? []);
  const categoryStatuses = (tournament.categories ?? []).map((category: any) => {
    const bracket = bracketsQuery.data?.find((b: any) => b.categoryId === category.id);
    return {
      category,
      bracket,
      participants: entryCountByCategory.get(category.id) ?? 0,
    };
  });
  const readyCategories = categoryStatuses.filter((item: any) => item.bracket).length;
  const progress = (tournament.categories?.length ?? 0) > 0
    ? Math.round((readyCategories / (tournament.categories?.length ?? 1)) * 100)
    : 0;
  const tatamiPlan = buildJudoTvTatamiPlan(matchesQuery.data ?? [], tournament.tatamiCount);
  const playableTotal = (matchesQuery.data ?? []).filter((m: any) => m.redAthlete && m.blueAthlete).length;
  const unassignedPlayable = (matchesQuery.data ?? []).filter((m: any) => m.redAthlete && m.blueAthlete && !m.tatamiNumber && m.status !== "COMPLETED").length;

  return (
    <div className="space-y-6">
      <Panel title="Жеребе және хаттама дайындау">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => prepare.mutate()}
                disabled={prepare.isPending || tournament.status === "DRAFT" || tournament.status === "REGISTRATION_OPEN"}
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-gradient-gold px-5 py-3 text-sm font-semibold text-gold-foreground shadow-gold disabled:opacity-50"
              >
                {prepare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Барлығын дайындау
              </button>
              <Link
                to="/admin/tournaments/$id"
                params={{ id: tournament.id }}
                search={{ tab: "scoreboard" }}
                className="inline-flex min-h-12 items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold hover:bg-gold/15"
              >
                <Monitor className="h-4 w-4" /> Табло
              </Link>
              <Link
                to="/live-wall/$tournamentId"
                params={{ tournamentId: tournament.id }}
                target="_blank"
                className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-card/50 px-4 py-3 text-sm hover:border-gold/40"
              >
                <ExternalLink className="h-4 w-4" /> Проектор
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Бір батырма: бекітілген өтінімдерден сетка жасайды, матчтарды татамиге таратады, хаттама және табло дайын болады.
              Алдымен өтінімдерді қабылдап, тіркеуді жабыңыз.
            </p>
            {prepareError && <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{prepareError}</div>}
            {prepareResult && (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                Дайын: {prepareResult.totals?.bracketsCreated ?? 0} жаңа сетка, {prepareResult.totals?.bracketsExisting ?? 0} дайын болған, {prepareResult.totals?.playableMatches ?? 0} матч татамиге бөлінді.
              </div>
            )}
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Дайындық</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {readyCategories}/{tournament.categories?.length ?? 0} категорияда сетка бар
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Санат</div>
            <div className="mt-2 font-display text-3xl font-bold">{tournament.categories?.length ?? 0}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Сетка</div>
            <div className="mt-2 font-display text-3xl font-bold">{bracketsQuery.data?.length ?? 0}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Матч</div>
            <div className="mt-2 font-display text-3xl font-bold">{completed}/{total}</div>
            <div className="mt-1 text-xs text-muted-foreground">{playableTotal} дайын жұп</div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Татами</div>
            <div className="mt-2 font-display text-3xl font-bold">{tournament.tatamiCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">{unassignedPlayable} бөлінбеген</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={api.admin.protocolPdfUrl(tournament.id)}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-gold-foreground shadow-gold"
          >
            <FileText className="h-4 w-4" /> Хаттама PDF
          </a>
          <Link
            to="/tournaments/$id"
            params={{ id: tournament.id }}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Жария бет
          </Link>
        </div>
      </Panel>

      <Panel title="JudoTV татами жоспары">
        {matchesQuery.isLoading ? (
          <LoadingState />
        ) : playableTotal === 0 ? (
          <EmptyState title="Татами жоспары әлі жоқ" hint="Алдымен өтінімдерді бекітіп, сеткаларды дайындаңыз" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {tatamiPlan.map((tatami) => (
              <div key={tatami.number} className="rounded-md border border-border/60 bg-background/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-semibold">Татами {tatami.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {tatami.live.length} live · {tatami.queue.length} кезекте · {tatami.done.length} аяқталды
                    </div>
                  </div>
                  <Link
                    to="/admin/tournaments/$id"
                    params={{ id: tournament.id }}
                    search={{ tab: "scoreboard" }}
                    className="rounded-md border border-gold/30 px-2.5 py-1 text-xs text-gold hover:bg-gold/10"
                  >
                    Басқару
                  </Link>
                </div>

                <div className="space-y-2">
                  {[...tatami.live, ...tatami.queue.slice(0, 6)].map((match: any, index: number) => (
                    <div key={match.id} className={`rounded-md border p-2 text-sm ${
                      match.status === "IN_PROGRESS"
                        ? "border-destructive/40 bg-destructive/10"
                        : "border-border/50 bg-card/50"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {matchAthleteName(match.redAthlete)} vs {matchAthleteName(match.blueAthlete)}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            #{index + 1} · {categoryTitle(match.bracket?.category)} · {matchSectionLabel(match.bracketSection)} R{match.round}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                          match.status === "IN_PROGRESS"
                            ? "bg-destructive/20 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {adminMatchStatusLabel(match.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {tatami.queue.length > 6 && (
                    <div className="rounded-md border border-border/50 bg-muted/20 p-2 text-center text-xs text-muted-foreground">
                      +{tatami.queue.length - 6} келесі матч
                    </div>
                  )}
                  {tatami.live.length === 0 && tatami.queue.length === 0 && (
                    <EmptyState title="Кезек бос" hint="Матчтар осы татамиге бөлінбеген" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Категориялар / веса">
        <CategoryPills
          items={categoryStatuses}
          selected={selected}
          onSelect={(categoryId) => setSelected(selected === categoryId ? null : categoryId)}
        />
        <div className="mt-5 space-y-2">
          {categoryStatuses.map(({ category: c, bracket, participants }: any) => {
            return (
              <div key={c.id} className="rounded-md border border-border/60 bg-background/30 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{categoryTitle(c)}</div>
                    <div className="text-xs text-muted-foreground">
                      {participants} қатысушы · {bracket ? `${bracket._count?.matches ?? 0} матч · ${bracket.size} орын` : "жеребе әлі жасалмаған"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {bracket ? (
                      <>
                        <button
                          onClick={() => setSelected(selected === c.id ? null : c.id)}
                          className="rounded-md border border-gold/30 px-2.5 py-1 text-xs text-gold hover:border-gold/60"
                        >
                          {selected === c.id ? "Жабу" : "Live сетка"}
                        </button>
                        <a
                          href={api.admin.bracketPdfUrl(bracket.id)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-2.5 py-1 text-xs text-gold hover:border-gold/60"
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </a>
                        <button
                          onClick={() => remove.mutate(bracket.id)}
                          disabled={remove.isPending}
                          className="rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Өшіру
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => generate.mutate(c.id)}
                        disabled={generate.isPending}
                        className="rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1 text-xs text-gold disabled:opacity-50"
                      >
                        Жеребе тастау
                      </button>
                    )}
                  </div>
                </div>
                {selected === c.id && bracket && (
                  <div className="mt-4 rounded-lg border border-gold/20 bg-background/40 p-4">
                    <LiveBracket tournamentId={tournament.id} categoryId={c.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(tournament.categories ?? []).length === 0 && (
          <EmptyState title="Санаттар жоқ" hint="Алдымен Санаттар вкладкасында категорияларды қосыңыз" />
        )}
      </Panel>
    </div>
  );
}

function CategoryPills({ items, selected, onSelect }: {
  items: Array<{ category: any; bracket?: any; participants: number }>;
  selected: string | null;
  onSelect: (categoryId: string) => void;
}) {
  const male = items.filter((item) => item.category.gender === "MALE");
  const female = items.filter((item) => item.category.gender === "FEMALE");
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      {[
        { label: "Ерлер", symbol: "♂", items: male },
        { label: "Қыздар", symbol: "♀", items: female },
      ].map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-2 py-1.5">
          <div className="w-16 text-sm font-semibold text-gold">{group.symbol} {group.label}</div>
          {group.items.length === 0 ? (
            <span className="text-xs text-muted-foreground">санат жоқ</span>
          ) : group.items.map((item) => {
            const active = selected === item.category.id;
            const ready = Boolean(item.bracket);
            return (
              <button
                key={item.category.id}
                type="button"
                onClick={() => onSelect(item.category.id)}
                className={`min-h-10 rounded-full px-4 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-gold text-gold-foreground shadow-gold"
                    : ready
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-card/70 border border-border hover:border-gold/40"
                }`}
              >
                {weightLabel(item.category)} · {item.participants}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function buildJudoTvTatamiPlan(matches: any[], tatamiCount: number) {
  const count = Math.max(1, Number(tatamiCount || 1));
  const assigned = matches
    .filter((match) => match.tatamiNumber && match.redAthlete && match.blueAthlete)
    .sort(judoTvMatchSort);

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const tatamiMatches = assigned.filter((match) => Number(match.tatamiNumber) === number);
    return {
      number,
      live: tatamiMatches.filter((match) => match.status === "IN_PROGRESS"),
      queue: tatamiMatches.filter((match) => match.status === "PENDING"),
      done: tatamiMatches.filter((match) => match.status === "COMPLETED"),
    };
  });
}

function judoTvMatchSort(a: any, b: any) {
  return (
    matchStatusOrder(a.status) - matchStatusOrder(b.status) ||
    (a.queuePosition ?? 999999) - (b.queuePosition ?? 999999) ||
    categoryOrder(a) - categoryOrder(b) ||
    matchSectionOrder(a.bracketSection) - matchSectionOrder(b.bracketSection) ||
    (a.round ?? 0) - (b.round ?? 0) ||
    (a.position ?? 0) - (b.position ?? 0)
  );
}

function categoryOrder(match: any): number {
  const category = match.bracket?.category;
  if (!category) return 999999;
  const gender = category.gender === "MALE" ? 0 : 100000;
  return gender + (Number(category.ageMin) || 0) * 1000 + (Number(category.weightMax) || 0);
}

function matchStatusOrder(status: string): number {
  const order: Record<string, number> = {
    IN_PROGRESS: 0,
    PENDING: 1,
    COMPLETED: 2,
    CANCELLED: 3,
  };
  return order[status] ?? 9;
}

function matchSectionOrder(section?: string | null): number {
  const order: Record<string, number> = {
    main: 1,
    repechage: 2,
    bronze1: 3,
    bronze2: 3,
    final: 4,
  };
  return section ? order[section] ?? 9 : 9;
}

function matchSectionLabel(section?: string | null): string {
  const labels: Record<string, string> = {
    main: "Негізгі",
    repechage: "Жұбату",
    bronze1: "Қола",
    bronze2: "Қола",
    final: "Финал",
  };
  return section ? labels[section] ?? section : "Сетка";
}

function adminMatchStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Күтуде",
    IN_PROGRESS: "LIVE",
    COMPLETED: "Бітті",
    CANCELLED: "Болмады",
  };
  return labels[status] ?? status;
}

function matchAthleteName(athlete: any): string {
  if (!athlete) return "TBD";
  return [athlete.name, athlete.surname].filter(Boolean).join(" ") || "TBD";
}

function buildCategoryEntryCounts(applications: any[]) {
  const counts = new Map<string, number>();
  for (const app of applications) {
    if (app.status !== "APPROVED") continue;
    for (const entry of app.entries ?? []) {
      counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
    }
  }
  return counts;
}

function AuditTab({ tournamentId }: { tournamentId: string }) {
  const query = useQuery({
    queryKey: ["tournament-audit", tournamentId],
    queryFn: () => api.admin.auditLogs({ targetEntity: "Tournament", targetId: tournamentId, limit: 50 }),
  });
  return (
    <Panel title="Аудит">
      {query.isLoading ? <LoadingState /> :
        (query.data?.items ?? []).length === 0 ? <EmptyState title="Жазбалар жоқ" /> : (
          <ul className="space-y-2 text-sm">
            {(query.data?.items ?? []).map((a: any) => (
              <li key={a.id} className="glass rounded p-2 flex justify-between">
                <span>
                  <span className="text-gold">{a.actor?.name ?? "—"}</span>{" "}
                  <span className="text-muted-foreground text-xs">{a.action}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString("kk-KZ")}
                </span>
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, className = "", ...rest }: any) {
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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-gold focus:outline-none"
      >
        {options.map(([v, labelText]) => <option key={v} value={v}>{labelText}</option>)}
      </select>
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
    CANCELLED: { c: "bg-muted text-muted-foreground", l: "Тоқтатылды" },
    SUBMITTED: { c: "bg-gold/15 text-gold border border-gold/30", l: "Қарауда" },
    APPROVED: { c: "bg-emerald-500/15 text-emerald-300", l: "Бекітілді" },
    REJECTED: { c: "bg-destructive/15 text-destructive", l: "Қайтарылды" },
  };
  const x = m[status] ?? { c: "bg-muted", l: status };
  return <span className={`text-xs px-3 py-1 rounded-full ${x.c}`}>{x.l}</span>;
}

function FormatBadge({ format }: { format: string }) {
  const m: Record<string, string> = {
    SE_IJF: "Olympic / IJF",
    ROUND_ROBIN: "Round-robin",
    MIXED: "Mixed",
  };
  return <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">{m[format] ?? format}</span>;
}

function categoryTitle(c: any): string {
  if (!c) return "Санат";
  const custom = localizeName(c.name);
  if (custom) return custom;
  return `${c.gender === "MALE" ? "Ер" : "Қыз"} ${c.ageMin}-${c.ageMax} жас ${c.weightMin}-${c.weightMax} кг`;
}

function weightLabel(c: any): string {
  const max = Number(c.weightMax);
  if (Number.isFinite(max) && max >= 100) return `+${Math.round(Number(c.weightMin))} кг`;
  return `-${Math.round(max)} кг`;
}

function compactI18n(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, item.trim()])
      .filter(([, item]) => item),
  );
}

function toDateTimeLocal(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mapEmbedUrl(t: any): string {
  const query = `${t.location}, ${t.city}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function formatWeighIn(t: any): string {
  const place = t.weighInLocation || "орын көрсетілмеген";
  const start = t.weighInStart ? new Date(t.weighInStart).toLocaleString("kk-KZ") : "";
  const end = t.weighInEnd ? new Date(t.weighInEnd).toLocaleString("kk-KZ") : "";
  const time = start && end ? `${start} — ${end}` : start || "уақыт көрсетілмеген";
  return `${place} · ${time}`;
}

function localizeName(n: any): string { if (!n) return ""; if (typeof n === "string") return n; return n.kk || n.ru || n.en || ""; }
