import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { DashboardShell, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { ArrowLeft, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useEffect, useState } from "react";
import { TournamentScoreboardPanel } from "@/routes/admin.matches";
import { TournamentOverviewTab } from "@/components/tournament/TournamentOverviewTab";
import { TournamentCategoriesTab } from "@/components/tournament/TournamentCategoriesTab";
import { TournamentApplicationsTab } from "@/components/tournament/TournamentApplicationsTab";
import { TournamentWeighInTab } from "@/components/tournament/TournamentWeighInTab";
import { TournamentProtocolTab } from "@/components/tournament/TournamentProtocolTab";
import { TournamentNotifyTab } from "@/components/tournament/TournamentNotifyTab";
import { TournamentAuditTab } from "@/components/tournament/TournamentAuditTab";
import { StatusBadge, localizeName } from "@/components/tournament/shared";
export { AGE_GROUPS } from "@/components/tournament/age-groups";

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

type Tab = "overview" | "categories" | "applications" | "weighIn" | "scoreboard" | "protocol" | "notify" | "audit";
const tournamentTabs: Tab[] = ["overview", "categories", "applications", "weighIn", "scoreboard", "protocol", "notify", "audit"];
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
    { id: "weighIn", label: "Взвешивание" },
    { id: "scoreboard", label: "Табло" },
    { id: "protocol", label: "Хаттама / Сетка" },
    { id: "notify", label: "Хабарландыру" },
    { id: "audit", label: "Аудит" },
  ];

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle={localizeName(t.name)}>
      <Link to="/admin/tournaments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4">
        <ArrowLeft className="h-4 w-4" /> Барлық жарыстар
      </Link>

      {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">{error}</div>}

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
          <a href={api.admin.allBracketsPdfUrl(t.id)} target="_blank" rel="noopener"
            className="text-sm px-4 py-1.5 rounded glass border border-border hover:border-gold/40 inline-flex items-center gap-1">
            <FileText className="h-4 w-4" /> Сеткалар PDF
          </a>
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

      {tab === "overview" && <TournamentOverviewTab tournament={t} />}
      {tab === "categories" && <TournamentCategoriesTab tournament={t} />}
      {tab === "applications" && <TournamentApplicationsTab tournamentId={t.id} />}
      {tab === "weighIn" && <TournamentWeighInTab tournamentId={t.id} />}
      {tab === "scoreboard" && <TournamentScoreboardPanel fixedTournamentId={t.id} />}
      {tab === "protocol" && <TournamentProtocolTab tournament={t} />}
      {tab === "notify" && <TournamentNotifyTab tournament={t} />}
      {tab === "audit" && <TournamentAuditTab tournamentId={t.id} />}
    </DashboardShell>
  );
}
