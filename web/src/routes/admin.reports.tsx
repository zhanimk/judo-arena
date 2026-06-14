/**
 * Есептер — merged page: Статистика + Хаттамалар + Аудит
 */

import { RouteErrorUI } from "@/components/ui/ErrorBoundary";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DashboardShell,
  Panel,
  LoadingState,
  EmptyState,
} from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  ShieldAlert,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tournament, Bracket, AuditLog, FederationAnalytics } from "@/lib/api-types";
import { ProtectedRoute } from "@/lib/protected-route";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OlympicBracket } from "@/components/judo/OlympicBracket";
import {
  BarChart as RBarChart,
  Bar as RBar,
  LineChart as RLineChart,
  Line as RLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie as RPie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Есептер — Әкімші" }] }),
  errorComponent: RouteErrorUI,
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminReports />
    </ProtectedRoute>
  ),
});

type Tab = "stats" | "protocols" | "audit" | "analytics";

function AdminReports() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("stats");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "stats", label: t("reports.tab_stats"), icon: <BarChart3 className="h-4 w-4" /> },
    { id: "analytics", label: t("dashboard.analytics"), icon: <TrendingUp className="h-4 w-4" /> },
    { id: "protocols", label: t("reports.tab_protocols"), icon: <Trophy className="h-4 w-4" /> },
    { id: "audit", label: t("reports.tab_audit"), icon: <ShieldAlert className="h-4 w-4" /> },
  ];

  return (
    <DashboardShell
      role={t("admin.role_label")}
      navItems={nav}
      accentTitle={t("admin.reports_title")}
    >
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border/60 pb-0">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === tb.id
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "protocols" && <ProtocolsTab />}
      {tab === "audit" && <AuditTab />}
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAB 1: Statistics
───────────────────────────────────────────────────────────────────────────── */

function StatsTab() {
  const { t } = useTranslation();
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.admin.stats() });

  if (stats.isLoading) return <LoadingState />;

  const tournamentByStatus = (stats.data?.tournaments ?? []).reduce(
    (acc: Record<string, number>, item: { status: string; _count: { id: number } }) => ({ ...acc, [item.status]: item._count.id }),
    {},
  );
  const usersByRole = (stats.data?.users ?? []).reduce(
    (acc: Record<string, number>, item: { role: string; _count: { id: number } }) => ({ ...acc, [item.role]: item._count.id }),
    {},
  );
  const matchesByStatus = (stats.data?.matches ?? []).reduce(
    (acc: Record<string, number>, item: { status: string; _count: { id: number } }) => ({ ...acc, [item.status]: item._count.id }),
    {},
  );

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label={t("reports.stat_clubs")}
          value={String(stats.data?.clubsCount ?? 0)}
          accent
        />
        <StatCard
          label={t("reports.stat_tournaments")}
          value={String(
            (stats.data?.tournaments ?? []).reduce((s: number, item: { _count: { id: number } }) => s + item._count.id, 0),
          )}
        />
        <StatCard
          label={t("reports.stat_matches")}
          value={String(
            (stats.data?.matches ?? []).reduce((s: number, item: { _count: { id: number } }) => s + item._count.id, 0),
          )}
        />
        <StatCard
          label={t("reports.stat_rating_entries")}
          value={String(stats.data?.ratingEntriesCount ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("reports.tournaments_panel")}>
          <div className="space-y-2">
            {(
              [
                ["DRAFT", t("status.DRAFT")],
                ["REGISTRATION_OPEN", t("status.REGISTRATION_OPEN")],
                ["REGISTRATION_CLOSED", t("status.REGISTRATION_CLOSED")],
                ["IN_PROGRESS", "LIVE"],
                ["COMPLETED", t("status.COMPLETED")],
                ["CANCELLED", t("status.CANCELLED")],
              ] as [string, string][]
            ).map(([k, l]) => {
              const count = tournamentByStatus[k] ?? 0;
              const total = Object.values(tournamentByStatus).reduce(
                (s: number, x: number) => s + x,
                0,
              );
              const pct = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>

        <Panel title={t("reports.users_panel")}>
          <div className="space-y-2">
            {(
              [
                ["ATHLETE", t("admin.users_athletes")],
                ["COACH", t("admin.users_coaches")],
                ["ADMIN", t("admin.role_label")],
              ] as [string, string][]
            ).map(([k, l]) => {
              const count = usersByRole[k] ?? 0;
              const total = Object.values(usersByRole).reduce((s: number, x: number) => s + x, 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>

        <Panel title={t("reports.matches_panel")}>
          <div className="space-y-2">
            {(
              [
                ["PENDING", t("status.PENDING")],
                ["IN_PROGRESS", "LIVE"],
                ["COMPLETED", t("status.COMPLETED")],
                ["CANCELLED", t("status.CANCELLED")],
              ] as [string, string][]
            ).map(([k, l]) => {
              const count = matchesByStatus[k] ?? 0;
              const total = Object.values(matchesByStatus).reduce((s: number, x: number) => s + x, 0);
              const pct = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAB 2: Protocols / Brackets
───────────────────────────────────────────────────────────────────────────── */

const VISIBLE_STATUSES = ["IN_PROGRESS", "COMPLETED", "REGISTRATION_CLOSED"];

function ProtocolsTab() {
  const { t } = useTranslation();
  const [openTournament, setOpenTournament] = useState<string | null>(null);
  const [openBracket, setOpenBracket] = useState<{
    tournamentId: string;
    categoryId: string;
  } | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ["admin-protocols-tournaments"],
    queryFn: () => api.tournaments.list({ limit: 100 }),
  });

  const tournaments = (tournamentsQuery.data?.items ?? []).filter((item: Tournament) =>
    VISIBLE_STATUSES.includes(item.status),
  );

  if (tournamentsQuery.isLoading) return <LoadingState />;

  if (tournaments.length === 0) {
    return <EmptyState title={t("reports.no_protocols")} hint={t("reports.no_protocols_hint")} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("reports.protocols_desc")}</p>
      {tournaments.map((tourney: Tournament) => (
        <TournamentProtocolCard
          key={tourney.id}
          tournament={tourney}
          isOpen={openTournament === tourney.id}
          onToggle={() => setOpenTournament(openTournament === tourney.id ? null : tourney.id)}
          openBracket={openBracket}
          onToggleBracket={(catId) =>
            setOpenBracket(
              openBracket !== null &&
                openBracket.tournamentId === tourney.id &&
                openBracket.categoryId === catId
                ? null
                : { tournamentId: tourney.id, categoryId: catId },
            )
          }
        />
      ))}
    </div>
  );
}

function TournamentProtocolCard({
  tournament: tourney,
  isOpen,
  onToggle,
  openBracket,
  onToggleBracket,
}: {
  tournament: Tournament;
  isOpen: boolean;
  onToggle: () => void;
  openBracket: { tournamentId: string; categoryId: string } | null;
  onToggleBracket: (catId: string) => void;
}) {
  const { t } = useTranslation();

  const bracketsQuery = useQuery({
    queryKey: ["protocols-brackets", tourney.id],
    queryFn: () => api.brackets.forTournament(tourney.id),
    enabled: isOpen,
  });

  const brackets = bracketsQuery.data ?? [];
  const isCompleted = tourney.status === "COMPLETED";

  return (
    <div className="glass rounded-xl border border-border/60 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gold/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 h-2.5 w-2.5 rounded-full ${statusDot(tourney.status)}`} />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold truncate">
              {localizeName(tourney.name)}
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gold/60" /> {tourney.city}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gold/60" />
                {new Date(tourney.startDate).toLocaleDateString("kk-KZ")}
                {" – "}
                {new Date(tourney.endDate).toLocaleDateString("kk-KZ")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3 w-3 text-gold/60" />
                {tourney._count?.categories ?? 0} {t("reports.categories_count")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <TournamentStatusBadge status={tourney.status} />
          {isCompleted && (
            <a
              href={api.admin.protocolPdfUrl(tourney.id)}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold"
            >
              <Download className="h-3.5 w-3.5" />
              {t("admin.protocol_pdf")}
            </a>
          )}
          {isCompleted && (
            <a
              href={api.admin.excelExportUrl(tourney.id)}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </a>
          )}
          <Link
            to="/admin/tournaments/$id"
            params={{ id: tourney.id }}
            search={{ tab: "protocol" }}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold"
          >
            <ExternalLink className="h-3 w-3" />
            {t("admin.tournament_manage")}
          </Link>
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border/40 bg-background/20 p-5">
          {bracketsQuery.isLoading ? (
            <LoadingState />
          ) : brackets.length === 0 ? (
            <div className="rounded-md border border-border/40 p-4 text-sm text-muted-foreground">
              {t("reports.no_brackets")}{" "}
              <Link
                to="/admin/tournaments/$id"
                params={{ id: tourney.id }}
                search={{ tab: "protocol" }}
                className="text-gold hover:underline"
              >
                {t("reports.create_brackets")} →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {brackets.map((b: Bracket) => {
                const genderLabel =
                  b.category?.gender === "MALE" ? t("common.male") : t("common.female");
                const catLabel = `${genderLabel} ${b.category?.weightMin ?? ""}–${b.category?.weightMax ?? ""} ${t("common.kg")} · ${b.category?.ageMin ?? ""}–${b.category?.ageMax ?? ""} ${t("common.years_short")}`;
                const isShowingBracket =
                  openBracket !== null &&
                  openBracket.tournamentId === tourney.id &&
                  openBracket.categoryId === b.categoryId;

                return (
                  <div key={b.id} className="rounded-lg border border-border/50 bg-card/40">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="font-medium text-sm">{catLabel}</div>
                        <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                          <span>
                            {b.size} {t("common.participant").toLowerCase()}
                          </span>
                          <span>·</span>
                          <span>{b.format === "ROUND_ROBIN" ? "Round-Robin" : "Olympic / SE"}</span>
                          <span>·</span>
                          <span>
                            {b.matches?.length ?? 0} {t("reports.matches_count")}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => onToggleBracket(b.categoryId)}
                          className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {isShowingBracket ? t("common.close") : t("reports.bracket_btn")}
                        </button>
                        <a
                          href={api.admin.bracketPdfUrl(b.id)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      </div>
                    </div>

                    {isShowingBracket && (
                      <div className="border-t border-border/40 p-4">
                        <OlympicBracket
                          matches={b.matches ?? []}
                          size={b.size ?? 0}
                          format={b.format}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAB 3: Audit Log
───────────────────────────────────────────────────────────────────────────── */

function AuditTab() {
  const { t } = useTranslation();
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["admin-audit-full", entityFilter, actionFilter],
    queryFn: () =>
      api.admin.auditLogs({
        targetEntity: entityFilter || undefined,
        action: actionFilter || undefined,
        limit: 200,
      }),
  });

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setExpanded(s);
  };

  const exportCSV = () => {
    const items = query.data?.items ?? [];
    const rows = [
      [
        t("audit.col_time"),
        t("audit.col_who"),
        t("common.role"),
        t("audit.col_action"),
        t("audit.col_entity"),
        "ID",
      ],
      ...items.map((a: AuditLog) => [
        new Date(a.createdAt).toLocaleString("kk-KZ"),
        `${a.actor?.name ?? "-"} ${a.actor?.surname ?? ""}`.trim(),
        a.actor?.role ?? "-",
        a.action,
        a.targetEntity,
        a.targetId,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Panel
        title={`${query.data?.total ?? 0} ${t("audit.records")}`}
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("audit.all_entities")}</option>
              <option value="Match">{t("audit.entity_match")}</option>
              <option value="Tournament">{t("audit.entity_tournament")}</option>
              <option value="Club">{t("audit.entity_club")}</option>
              <option value="User">{t("audit.entity_user")}</option>
              <option value="Application">{t("audit.entity_application")}</option>
              <option value="Bracket">{t("audit.entity_bracket")}</option>
              <option value="SystemConfig">{t("audit.entity_config")}</option>
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">{t("audit.all_actions")}</option>
              <option value="match.override">Override</option>
              <option value="match.rollback">Rollback</option>
              <option value="tournament.finalize">{t("admin.tournament_finalize")}</option>
              <option value="club.block">{t("audit.action_club_block")}</option>
              <option value="user.block">{t("audit.action_user_block")}</option>
              <option value="notification.broadcast">{t("audit.action_broadcast")}</option>
            </select>
            <button
              onClick={exportCSV}
              className="text-sm bg-gold/15 text-gold border border-gold/40 px-3 py-1.5 rounded inline-flex items-center gap-1"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        }
      >
        {query.isLoading ? (
          <LoadingState />
        ) : (query.data?.items ?? []).length === 0 ? (
          <EmptyState title={t("audit.empty")} />
        ) : (
          <div className="space-y-1.5">
            {(query.data?.items ?? []).map((auditItem: AuditLog) => {
              const open = expanded.has(auditItem.id);
              return (
                <div key={auditItem.id} className="glass rounded">
                  <button
                    onClick={() => toggleExpand(auditItem.id)}
                    className="w-full p-2.5 flex items-center justify-between gap-2 hover:bg-gold/5 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {open ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {new Date(auditItem.createdAt).toLocaleString("kk-KZ")}
                      </span>
                      <span className="text-xs text-gold truncate">
                        {auditItem.actor?.name ?? "—"}
                      </span>
                      <span className="text-xs font-mono truncate">{auditItem.action}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {auditItem.targetEntity}#{auditItem.targetId.slice(-6)}
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="px-2.5 pb-2.5 text-xs">
                      {Boolean(auditItem.before) && (
                        <div className="mt-2">
                          <div className="text-[10px] text-destructive uppercase">Before</div>
                          <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(auditItem.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {Boolean(auditItem.after) && (
                        <div className="mt-2">
                          <div className="text-[10px] text-emerald-300 uppercase">After</div>
                          <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(auditItem.after, null, 2)}
                          </pre>
                        </div>
                      )}
                      {Boolean(auditItem.metadata) && (
                        <div className="mt-2">
                          <div className="text-[10px] text-gold uppercase">Metadata</div>
                          <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(auditItem.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {(query.data?.total ?? 0) > 0 && (
        <div className="mt-3 text-xs text-muted-foreground text-right">
          {t("audit.showing")}: {(query.data?.items ?? []).length} / {query.data?.total ?? 0}{" "}
          {t("audit.records")}
          {(query.data?.total ?? 0) > 200 && (
            <span className="ml-2 text-amber-400">⚠ {t("audit.max_warning")}</span>
          )}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────────────────────────── */

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-xl p-5 ${accent ? "border-gold/40" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent ? "text-gradient-gold" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Bar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const m: Record<string, { c: string; l: string }> = {
    REGISTRATION_CLOSED: {
      c: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      l: t("status.REGISTRATION_CLOSED"),
    },
    IN_PROGRESS: {
      c: "bg-destructive/20 text-destructive border border-destructive/40",
      l: "LIVE",
    },
    COMPLETED: {
      c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
      l: t("status.COMPLETED"),
    },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${x.c}`}>{x.l}</span>;
}

function statusDot(status: string): string {
  if (status === "IN_PROGRESS") return "bg-destructive animate-pulse";
  if (status === "COMPLETED") return "bg-emerald-400";
  return "bg-amber-400";
}

function localizeName(n: import("@/lib/api-types").LocalizedName | string | null | undefined): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}

// ── Analytics Tab (вынесена из admin.analytics.tsx) ───────────────────────────

const GENDER_COLORS: Record<string, string> = { MALE: "#3b82f6", FEMALE: "#ec4899", UNKNOWN: "#9ca3af" };
const CHART_COLORS = ["#c9a84c","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#84cc16"];
function monthLabel(year: number, month: number) { return `${String(month).padStart(2,"0")}.${String(year).slice(2)}`; }

function AnalyticsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<FederationAnalytics>({
    queryKey: ["federation-analytics"],
    queryFn: () => api.admin.analytics(),
    staleTime: 5 * 60 * 1000,
  });

  const athletesByMonth = useMemo(() => (data?.athletes.byMonth ?? []).map((r) => ({ label: monthLabel(r.year, r.month), count: r.count })), [data]);
  const matchesByMonth  = useMemo(() => (data?.matches.byMonth ?? []).map((r) => ({ label: monthLabel(r.year, r.month), count: r.count })), [data]);
  const totalAthletes   = useMemo(() => data?.athletes.byGender.reduce((s, g) => s + g.count, 0) ?? 0, [data]);
  const genderPie       = useMemo(() => (data?.athletes.byGender ?? []).map((g) => ({
    name: g.gender === "MALE" ? t("common.male") : g.gender === "FEMALE" ? t("tatami.female_short") : "—",
    value: g.count,
    color: GENDER_COLORS[g.gender] ?? "#9ca3af",
  })), [data, t]);
  const weightClasses   = useMemo(() => (data?.categories.popularWeightClasses ?? []).slice(0, 10).map((w) => ({
    label: `${w.gender === "MALE" ? "♂" : "♀"} ${w.weightMax >= 200 ? "+" : "-"}${w.weightMax}kg`,
    count: w.count,
  })), [data]);

  if (isLoading || !data) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t("analytics.total_athletes"), value: totalAthletes, color: "#3b82f6" },
          { label: t("analytics.tournaments_this_year"), value: data.tournaments.completedThisYear.length, color: "#c9a84c" },
          { label: t("analytics.matches_total"), value: data.matches.byMonth.reduce((s,m)=>s+m.count,0), color: "#10b981" },
          { label: t("analytics.clubs_active"), value: data.athletes.topClubs.length, color: "#8b5cf6" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Registration trend */}
      <Panel title={t("analytics.athlete_registrations")} action={<span className="text-xs text-muted-foreground">{t("analytics.last_24_months")}</span>}>
        <ResponsiveContainer width="100%" height={200}>
          <RLineChart data={athletesByMonth} margin={{ top:4, right:16, left:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize:11 }} />
            <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
            <RTooltip />
            <RLine type="monotone" dataKey="count" stroke="#c9a84c" strokeWidth={2} dot={false} name={t("analytics.athletes")} />
          </RLineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gender pie */}
        <Panel title={t("analytics.gender_breakdown")}>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <RPieChart>
                <RPie data={genderPie} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {genderPie.map((e,i) => <Cell key={i} fill={e.color} />)}
                </RPie>
                <RTooltip formatter={(v:number)=>[v,""]} />
              </RPieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {genderPie.map((g,i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: g.color }} />{g.name}</div>
                  <span className="font-semibold">{g.value.toLocaleString()}</span>
                </div>
              ))}
              {data.athletes.avgAgeByGender.map((a,i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {a.gender === "MALE" ? t("common.male") : t("tatami.female_short")} — {t("analytics.avg_age")}: <strong>{a.avgAge} {t("common.years")}</strong>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Matches per month */}
        <Panel title={t("analytics.matches_per_month")}>
          <ResponsiveContainer width="100%" height={160}>
            <RBarChart data={matchesByMonth} margin={{ top:4, right:8, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize:10 }} />
              <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
              <RTooltip />
              <RBar dataKey="count" fill="#3b82f6" radius={[3,3,0,0]} name={t("analytics.matches")} />
            </RBarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Athletes by city */}
        <Panel title={t("analytics.athletes_by_city")}>
          <ResponsiveContainer width="100%" height={180}>
            <RBarChart data={data.athletes.byCity} layout="vertical" margin={{ top:4, right:16, left:50, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="city" tick={{ fontSize:10 }} width={50} />
              <RTooltip />
              <RBar dataKey="count" fill="#10b981" radius={[0,3,3,0]} name={t("analytics.athletes")} />
            </RBarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Popular weight classes */}
        <Panel title={t("analytics.popular_weight_classes")}>
          <ResponsiveContainer width="100%" height={180}>
            <RBarChart data={weightClasses} layout="vertical" margin={{ top:4, right:16, left:80, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize:10 }} width={80} />
              <RTooltip />
              <RBar dataKey="count" radius={[0,3,3,0]} name={t("analytics.entries")}>
                {weightClasses.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </RBar>
            </RBarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Top clubs */}
      <Panel title={t("analytics.top_clubs")}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground text-xs uppercase">
            <th className="pb-2 text-left w-8">#</th>
            <th className="pb-2 text-left">{t("analytics.club")}</th>
            <th className="pb-2 text-left">{t("common.city")}</th>
            <th className="pb-2 text-right">{t("analytics.athletes")}</th>
          </tr></thead>
          <tbody>
            {data.athletes.topClubs.map((c,i) => (
              <tr key={c.clubId} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-1.5 text-muted-foreground">{i+1}</td>
                <td className="py-1.5 font-medium">{localizeName(c.name)}</td>
                <td className="py-1.5 text-muted-foreground">{c.city}</td>
                <td className="py-1.5 text-right font-semibold">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Top athletes */}
      <Panel title={t("analytics.top_athletes_year")} action={<span className="text-xs text-muted-foreground">{new Date().getFullYear()}</span>}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground text-xs uppercase">
            <th className="pb-2 text-left w-8">#</th>
            <th className="pb-2 text-left">{t("analytics.athlete")}</th>
            <th className="pb-2 text-left">{t("common.city")}</th>
            <th className="pb-2 text-right">{t("analytics.points")}</th>
          </tr></thead>
          <tbody>
            {data.ratings.topAthletesThisYear.map((a,i) => (
              <tr key={a.athleteId} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-1.5 font-bold">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
                <td className="py-1.5 font-medium">{a.surname} {a.name}</td>
                <td className="py-1.5 text-muted-foreground">{a.clubCity ?? "—"}</td>
                <td className="py-1.5 text-right font-semibold text-amber-400">{a.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
