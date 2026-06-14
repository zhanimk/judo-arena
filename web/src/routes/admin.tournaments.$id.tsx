import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { DashboardShell, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { AlertTriangle, ArrowLeft, FileText, GitBranch, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
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
import { useTranslation } from "react-i18next";
export { AGE_GROUPS } from "@/components/tournament/age-groups";

export const Route = createFileRoute("/admin/tournaments/$id")({
  head: () => ({ meta: [{ title: "Жарыс басқару — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const tab =
      typeof search.tab === "string" && isTournamentTab(search.tab) ? search.tab : undefined;
    return { tab };
  },
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminTournamentDetail />
    </ProtectedRoute>
  ),
});

type Tab =
  | "overview"
  | "categories"
  | "applications"
  | "weighIn"
  | "scoreboard"
  | "protocol"
  | "notify"
  | "audit";
const tournamentTabs: Tab[] = [
  "overview",
  "categories",
  "applications",
  "weighIn",
  "scoreboard",
  "protocol",
  "notify",
  "audit",
];
function isTournamentTab(value: string): value is Tab {
  return tournamentTabs.includes(value as Tab);
}

function AdminTournamentDetail() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/admin/tournaments/$id" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(search.tab ?? "overview");
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const tQuery = useQuery({
    queryKey: ["admin-tournament", id],
    queryFn: () => api.tournaments.get(id),
  });

  const transitions: Record<string, { next: string; label: string; color?: string }[]> = {
    DRAFT: [
      { next: "REGISTRATION_OPEN", label: t("admin.tournament_open_registration") },
      { next: "CANCELLED", label: t("tournament.cancel"), color: "destructive" },
    ],
    REGISTRATION_OPEN: [
      { next: "REGISTRATION_CLOSED", label: t("admin.tournament_close_registration") },
      { next: "CANCELLED", label: t("tournament.cancel"), color: "destructive" },
    ],
    REGISTRATION_CLOSED: [
      { next: "IN_PROGRESS", label: t("admin.tournament_start") },
      { next: "REGISTRATION_OPEN", label: t("admin.tournament_reopen_registration") },
      { next: "CANCELLED", label: t("tournament.cancel"), color: "destructive" },
    ],
    IN_PROGRESS: [{ next: "CANCELLED", label: t("tournament.cancel"), color: "destructive" }],
    CANCELLED: [{ next: "DRAFT", label: t("admin.tournament_back_to_draft") }],
  };

  const change = useMutation({
    mutationFn: (status: string) => api.tournaments.setStatus(id, status),
    onMutate: () => setError(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tournament", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
  });

  const finalize = useMutation({
    mutationFn: () => api.admin.finalize(id),
    onMutate: () => setError(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tournament", id] }),
    onError: (e: unknown) => setError(e instanceof ApiError ? e.message : t("error.generic")),
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
      <DashboardShell role={t("admin.role_label")} navItems={nav} accentTitle={t("common.loading")}>
        <LoadingState />
      </DashboardShell>
    );
  }

  const tournament = tQuery.data;
  if (!tournament) {
    return (
      <DashboardShell
        role={t("admin.role_label")}
        navItems={nav}
        accentTitle={t("tournament.not_found")}
      >
        <EmptyState title={t("tournament.not_found")} />
      </DashboardShell>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("tournament.info_tab") },
    {
      id: "categories",
      label: `${t("tournament.categories_tab")} (${tournament.categories?.length ?? 0})`,
    },
    { id: "applications", label: t("dashboard.applications") },
    { id: "weighIn", label: t("weigh_in.title") },
    { id: "scoreboard", label: t("tournament.scoreboard") },
    { id: "protocol", label: t("tournament.protocol_tab") },
    { id: "notify", label: t("dashboard.notifications") },
    { id: "audit", label: t("dashboard.audit") },
  ];

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={localizeName(tournament.name)}
    >
      <Link
        to="/admin/tournaments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> {t("tournaments_page.all_tournaments")}
      </Link>

      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-3">
          {error}
        </div>
      )}

      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {tournament.city} · {tournament.location} ·{" "}
              {new Date(tournament.startDate).toLocaleDateString("kk-KZ")} —{" "}
              {new Date(tournament.endDate).toLocaleDateString("kk-KZ")}
            </div>
            <StatusBadge status={tournament.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(transitions[tournament.status] ?? []).map((tr) => (
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
          {tournament.status === "IN_PROGRESS" && (
            <button
              onClick={() => finalize.mutate()}
              disabled={finalize.isPending}
              className="text-sm px-4 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 disabled:opacity-50"
            >
              🏁 {t("admin.tournament_finalize")}
            </button>
          )}
          <button
            onClick={() =>
              downloadWithAuth(
                `/api/pdf/tournament-brackets?tournamentId=${tournament.id}`,
                `brackets-${tournament.id}.pdf`,
              )
            }
            className="text-sm px-4 py-1.5 rounded glass border border-border hover:border-gold/40 inline-flex items-center gap-1"
          >
            <FileText className="h-4 w-4" /> {t("admin.brackets_pdf")}
          </button>
          {tournament.status === "COMPLETED" && (
            <a
              href={api.admin.protocolPdfUrl(tournament.id)}
              target="_blank"
              rel="noopener"
              className="text-sm px-4 py-1.5 rounded glass border border-gold/30 hover:border-gold/60 inline-flex items-center gap-1"
            >
              <FileText className="h-4 w-4" /> {t("admin.protocol_pdf")}
            </a>
          )}
          <Link
            to="/tournaments/$id"
            params={{ id: tournament.id }}
            className="text-sm px-4 py-1.5 rounded glass border border-border hover:border-gold/40"
          >
            {t("tournament.public_page")} →
          </Link>
          <button
            onClick={() => selectTab("overview")}
            className="text-sm px-4 py-1.5 rounded glass border border-border hover:border-gold/40 inline-flex items-center gap-1"
          >
            <MapPin className="h-4 w-4" /> Карта / Регламент
          </button>
        </div>
      </div>

      {(tournament.status === "DRAFT" || (tournament.categories?.length ?? 0) === 0) && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold text-gold">
                <AlertTriangle className="h-4 w-4" />
                {t("admin.tournament_apply_setup_title")}
              </div>
              <div className="mt-1 text-muted-foreground">
                {t("admin.tournament_apply_setup_desc")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectTab("categories")}
                className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-background/50 px-3 py-2 text-xs font-medium text-gold hover:bg-gold/15"
              >
                <GitBranch className="h-3.5 w-3.5" />
                {t("admin.add_categories")}
              </button>
              {tournament.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={() => change.mutate("REGISTRATION_OPEN")}
                  disabled={change.isPending}
                  className="rounded-md bg-gradient-gold px-3 py-2 text-xs font-medium text-gold-foreground shadow-gold disabled:opacity-50"
                >
                  {t("admin.tournament_open_registration")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex overflow-x-auto gap-1 mb-6 border-b border-border/40 scrollbar-none pb-px">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => selectTab(tb.id)}
            className={`shrink-0 px-3 py-2 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === tb.id
                ? "border-gold text-gold font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <TournamentOverviewTab tournament={tournament} />}
      {tab === "categories" && <TournamentCategoriesTab tournament={tournament} />}
      {tab === "applications" && <TournamentApplicationsTab tournamentId={tournament.id} />}
      {tab === "weighIn" && <TournamentWeighInTab tournamentId={tournament.id} />}
      {tab === "scoreboard" && <TournamentScoreboardPanel fixedTournamentId={tournament.id} />}
      {tab === "protocol" && <TournamentProtocolTab tournament={tournament} />}
      {tab === "notify" && <TournamentNotifyTab tournament={tournament} />}
      {tab === "audit" && <TournamentAuditTab tournamentId={tournament.id} />}
    </DashboardShell>
  );
}
