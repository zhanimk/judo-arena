import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  Archive, ExternalLink, FileText, GitBranch, Loader2,
  Monitor, Plus, Power, Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

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


function AdminTournaments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const transitions: Record<string, { next: string; label: string }[]> = {
    DRAFT: [{ next: "REGISTRATION_OPEN", label: t("admin.tournament_open_registration") }],
    REGISTRATION_OPEN: [{ next: "REGISTRATION_CLOSED", label: t("admin.tournament_close_registration") }],
    REGISTRATION_CLOSED: [
      { next: "IN_PROGRESS", label: t("admin.tournament_start") },
      { next: "REGISTRATION_OPEN", label: t("admin.tournament_reopen") },
    ],
    IN_PROGRESS: [],
  };

  const query = useQuery({ queryKey: ["admin-all-tournaments"], queryFn: () => api.tournaments.list({ includeArchived: true, limit: 100 }) });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.tournaments.setStatus(id, status),
    onMutate: ({ id }) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setBusy(null),
  });

  const finalize = useMutation({
    mutationFn: (id: string) => api.admin.finalize(id),
    onMutate: (id) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setBusy(null),
  });

  const archive = useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) => api.admin.archiveTournament(id, archive),
    onMutate: ({ id }) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setBusy(null),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.tournaments.delete(id),
    onMutate: (id) => { setBusy(id); setError(""); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }),
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
    onSettled: () => setBusy(null),
  });

  return (
    <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("admin.tournaments_title")}>
      <Panel
        title={t("common.total") + ` ${query.data?.items.length ?? 0}`}
        action={
          <button onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 text-sm bg-gradient-gold text-gold-foreground px-3 py-1.5 rounded-md shadow-gold">
            <Plus className="h-4 w-4" /> {showCreate ? t("common.close") : t("admin.tournament_new")}
          </button>
        }
      >
        {error && <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">{error}</div>}

        {showCreate && (
          <CreateTournamentForm onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["admin-all-tournaments"] }); }} />
        )}

        {query.isLoading ? <LoadingState /> :
          (query.data?.items ?? []).length === 0 ? (
            <EmptyState title={t("tournament.no_tournaments")} hint={t("admin.tournament_new")} />
          ) : (
            <div className="space-y-3 mt-4">
              {query.data!.items.map((tournament: any) => {
                const trans = transitions[tournament.status] ?? [];
                return (
                  <div key={tournament.id} className="glass rounded-xl p-4 md:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate({ to: "/admin/tournaments/$id", params: { id: tournament.id } })}
                            className="text-left text-lg font-semibold leading-tight hover:text-gold"
                          >
                            {localizeName(tournament.name)} →
                          </button>
                          <StatusBadge status={tournament.status} />
                          {tournament.isArchived && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t("common.archived")}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{tournament.city}</span>
                          <span>·</span>
                          <span>{new Date(tournament.startDate).toLocaleDateString("kk-KZ")}</span>
                          <span>·</span>
                          <span>{t("common.categories_count", { count: tournament._count?.categories ?? 0 })}</span>
                          <span>·</span>
                          <span>{t("common.applications_count", { count: tournament._count?.applications ?? 0 })}</span>
                          <span>·</span>
                          <span>{t("common.tatami_count", { count: tournament.tatamiCount ?? 0 })}</span>
                        </div>
                      </div>

                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: tournament.id }}
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-gradient-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow-gold"
                      >
                        {t("admin.tournament_manage")}
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: tournament.id }}
                        search={{ tab: "scoreboard" }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/15"
                      >
                        <Monitor className="h-4 w-4" /> {t("tournament.scoreboard")}
                      </Link>
                      <Link
                        to="/live-wall/$tournamentId"
                        params={{ tournamentId: tournament.id }}
                        target="_blank"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium hover:border-gold/50"
                      >
                        <ExternalLink className="h-4 w-4" /> {t("tournament.projector")}
                      </Link>
                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: tournament.id }}
                        search={{ tab: "protocol" }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium hover:border-gold/50"
                      >
                        <FileText className="h-4 w-4" /> {t("tournament.protocol")}
                      </Link>
                      <Link
                        to="/admin/tournaments/$id"
                        params={{ id: tournament.id }}
                        search={{ tab: "categories" }}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm font-medium hover:border-gold/50"
                      >
                        <GitBranch className="h-4 w-4" /> {t("tournament.categories")}
                      </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
                      {trans.map((tr) => (
                        <button key={tr.next}
                          onClick={() => change.mutate({ id: tournament.id, status: tr.next })}
                          disabled={busy === tournament.id}
                          className="inline-flex min-h-9 items-center rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold disabled:opacity-50">
                          {tr.label}
                        </button>
                      ))}
                      {tournament.status === "IN_PROGRESS" && (
                        <button onClick={() => {
                          if (window.confirm(t("admin.tournament_finalize_confirm"))) finalize.mutate(tournament.id);
                        }} disabled={busy === tournament.id}
                          className="inline-flex min-h-9 items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50">
                          {t("admin.tournament_finalize")}
                        </button>
                      )}
                      <Link to="/tournaments/$id" params={{ id: tournament.id }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:border-gold/40">
                        <ExternalLink className="h-3.5 w-3.5" /> {t("tournament.public_page")}
                      </Link>
                      <button
                        onClick={() => archive.mutate({ id: tournament.id, archive: !tournament.isArchived })}
                        disabled={busy === tournament.id}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:border-gold/40 disabled:opacity-50"
                      >
                        <Archive className="h-3.5 w-3.5" /> {tournament.isArchived ? t("admin.tournament_unarchive") : t("admin.tournament_archive")}
                      </button>
                      {tournament.status !== "CANCELLED" && tournament.status !== "COMPLETED" && (
                        <button
                          onClick={() => change.mutate({ id: tournament.id, status: "CANCELLED" })}
                          disabled={busy === tournament.id}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Power className="h-3.5 w-3.5" /> {t("tournament.cancel")}
                        </button>
                      )}
                      {(tournament.status === "DRAFT" || tournament.status === "CANCELLED") && (
                        <button
                          onClick={() => {
                            if (window.confirm(t("admin.tournament_delete_confirm"))) remove.mutate(tournament.id);
                          }}
                          disabled={busy === tournament.id}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
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
  const { t } = useTranslation();
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
    onError: (e: any) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className="mt-4 mb-4 glass rounded-lg p-4 grid gap-3 md:grid-cols-3">
      <Input label={`${t("tournament.name")} (KZ) *`} value={form.nameKk} onChange={(v) => setForm({...form, nameKk: v})} required />
      <Input label={`${t("tournament.name")} (RU)`} value={form.nameRu} onChange={(v) => setForm({...form, nameRu: v})} />
      <Input label="Name (EN)" value={form.nameEn} onChange={(v) => setForm({...form, nameEn: v})} />
      <Input label={`${t("common.city")} *`} value={form.city} onChange={(v) => setForm({...form, city: v})} required />
      <Input label={`${t("common.location")} *`} value={form.location} onChange={(v) => setForm({...form, location: v})} required />
      <Input label={t("common.tatami")} type="number" min={1} max={20} value={String(form.tatamiCount)} onChange={(v) => setForm({...form, tatamiCount: Number(v)})} />
      <Input label={`${t("tournament.start_date")} *`} type="date" value={form.startDate} onChange={(v) => setForm({...form, startDate: v})} required />
      <Input label={`${t("tournament.end_date")} *`} type="date" value={form.endDate} onChange={(v) => setForm({...form, endDate: v})} required />
      <Input label={t("common.deadline")} type="datetime-local" value={form.applicationDeadline} onChange={(v) => setForm({...form, applicationDeadline: v})} />
      <Input label={t("tournament.poster_url")} type="url" value={form.posterUrl} onChange={(v) => setForm({...form, posterUrl: v})} placeholder="https://..." />
      <Input label={t("tournament.map_url")} type="url" value={form.mapUrl} onChange={(v) => setForm({...form, mapUrl: v})} placeholder="Google/2GIS link" />
      <Input label={t("tournament.weigh_in_location")} value={form.weighInLocation} onChange={(v) => setForm({...form, weighInLocation: v})} />
      <Input label={t("tournament.weigh_in_start")} type="datetime-local" value={form.weighInStart} onChange={(v) => setForm({...form, weighInStart: v})} />
      <Input label={t("tournament.weigh_in_end")} type="datetime-local" value={form.weighInEnd} onChange={(v) => setForm({...form, weighInEnd: v})} />

      {error && <div className="md:col-span-3 text-sm text-destructive">{error}</div>}
      <button type="submit" disabled={mut.isPending}
        className="md:col-span-3 bg-gradient-gold text-gold-foreground py-2.5 rounded-md font-medium shadow-gold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("common.create")}
      </button>
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
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    REGISTRATION_OPEN: "bg-gold/15 text-gold border border-gold/30",
    REGISTRATION_CLOSED: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    IN_PROGRESS: "bg-destructive/20 text-destructive border border-destructive/40",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  };
  const color = colors[status] ?? "bg-muted";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${color} shrink-0`}>{t(`status.${status}`, status)}</span>;
}

function localizeName(n: any): string { if (!n) return "—"; if (typeof n === "string") return n; return n.kk || n.ru || n.en || "—"; }
