/**
 * Есептер — merged page: Статистика + Хаттамалар + Аудит
 * Replaces the three separate pages (admin/reports, admin/protocols, admin/audit)
 * in one tabbed interface accessible from a single nav item.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";
import { OlympicBracket } from "@/components/judo/OlympicBracket";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Есептер — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminReports />
    </ProtectedRoute>
  ),
});

type Tab = "stats" | "protocols" | "audit";

function AdminReports() {
  const [tab, setTab] = useState<Tab>("stats");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "stats",     label: "Статистика",  icon: <BarChart3     className="h-4 w-4" /> },
    { id: "protocols", label: "Хаттамалар",  icon: <Trophy        className="h-4 w-4" /> },
    { id: "audit",     label: "Аудит",       icon: <ShieldAlert   className="h-4 w-4" /> },
  ];

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Есептер">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border/60 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stats"     && <StatsTab />}
      {tab === "protocols" && <ProtocolsTab />}
      {tab === "audit"     && <AuditTab />}
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TAB 1: Statistics
───────────────────────────────────────────────────────────────────────────── */

function StatsTab() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api.admin.stats() });

  if (stats.isLoading) return <LoadingState />;

  const tournamentByStatus = (stats.data?.tournaments ?? []).reduce(
    (acc: any, t: any) => ({ ...acc, [t.status]: t._count.id }), {},
  );
  const usersByRole = (stats.data?.users ?? []).reduce(
    (acc: any, u: any) => ({ ...acc, [u.role]: u._count.id }), {},
  );
  const matchesByStatus = (stats.data?.matches ?? []).reduce(
    (acc: any, m: any) => ({ ...acc, [m.status]: m._count.id }), {},
  );

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Барлық клубтар"    value={String(stats.data?.clubsCount ?? 0)} accent />
        <StatCard label="Барлық турнирлер"  value={String((stats.data?.tournaments ?? []).reduce((s: number, t: any) => s + t._count.id, 0))} />
        <StatCard label="Барлық матчтар"    value={String((stats.data?.matches    ?? []).reduce((s: number, m: any) => s + m._count.id, 0))} />
        <StatCard label="Рейтинг жазбалары" value={String(stats.data?.ratingEntriesCount ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Турнирлер">
          <div className="space-y-2">
            {Object.entries({
              DRAFT: "Жоба", REGISTRATION_OPEN: "Тіркеу ашық", REGISTRATION_CLOSED: "Тіркеу жабық",
              IN_PROGRESS: "LIVE", COMPLETED: "Аяқталды", CANCELLED: "Тоқтатылды",
            }).map(([k, l]) => {
              const count = tournamentByStatus[k] ?? 0;
              const total = Object.values(tournamentByStatus).reduce((s: number, x: any) => s + x, 0);
              const pct   = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>

        <Panel title="Пайдаланушылар">
          <div className="space-y-2">
            {Object.entries({ ATHLETE: "Спортшы", COACH: "Жаттықтырушы", ADMIN: "Әкімші" }).map(([k, l]) => {
              const count = usersByRole[k] ?? 0;
              const total = Object.values(usersByRole).reduce((s: number, x: any) => s + x, 0);
              const pct   = total ? Math.round((count / total) * 100) : 0;
              return <Bar key={k} label={l} value={count} pct={pct} />;
            })}
          </div>
        </Panel>

        <Panel title="Матчтар">
          <div className="space-y-2">
            {Object.entries({ PENDING: "Күтуде", IN_PROGRESS: "LIVE", COMPLETED: "Аяқталды", CANCELLED: "Тоқтатылды" }).map(([k, l]) => {
              const count = matchesByStatus[k] ?? 0;
              const total = Object.values(matchesByStatus).reduce((s: number, x: any) => s + x, 0);
              const pct   = total ? Math.round((count / total) * 100) : 0;
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
  const [openTournament, setOpenTournament] = useState<string | null>(null);
  const [openBracket, setOpenBracket] = useState<{ tournamentId: string; categoryId: string } | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ["admin-protocols-tournaments"],
    queryFn: () => api.tournaments.list({ limit: 100 }),
  });

  const tournaments = (tournamentsQuery.data?.items ?? []).filter((t: any) =>
    VISIBLE_STATUSES.includes(t.status),
  );

  if (tournamentsQuery.isLoading) return <LoadingState />;

  if (tournaments.length === 0) {
    return (
      <EmptyState
        title="Хаттамалар жоқ"
        hint="Тіркеу жабылған, жүріп жатқан немесе аяқталған жарыстар осында шығады"
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Жарысқа сайкес категориялар, жеребе сеткалары және PDF хаттамалар — бір жерде.
      </p>
      {tournaments.map((t: any) => (
        <TournamentProtocolCard
          key={t.id}
          tournament={t}
          isOpen={openTournament === t.id}
          onToggle={() => setOpenTournament(openTournament === t.id ? null : t.id)}
          openBracket={openBracket}
          onToggleBracket={(catId) =>
            setOpenBracket(
              openBracket !== null && openBracket.tournamentId === t.id && openBracket.categoryId === catId
                ? null
                : { tournamentId: t.id, categoryId: catId },
            )
          }
        />
      ))}
    </div>
  );
}

function TournamentProtocolCard({
  tournament: t,
  isOpen,
  onToggle,
  openBracket,
  onToggleBracket,
}: {
  tournament: any;
  isOpen: boolean;
  onToggle: () => void;
  openBracket: { tournamentId: string; categoryId: string } | null;
  onToggleBracket: (catId: string) => void;
}) {
  const bracketsQuery = useQuery({
    queryKey: ["protocols-brackets", t.id],
    queryFn: () => api.brackets.forTournament(t.id),
    enabled: isOpen,
  });

  const brackets = bracketsQuery.data ?? [];
  const isCompleted = t.status === "COMPLETED";

  return (
    <div className="glass rounded-xl border border-border/60 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-gold/5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 h-2.5 w-2.5 rounded-full ${statusDot(t.status)}`} />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold truncate">{localizeName(t.name)}</div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gold/60" /> {t.city}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gold/60" />
                {new Date(t.startDate).toLocaleDateString("kk-KZ")}
                {" – "}
                {new Date(t.endDate).toLocaleDateString("kk-KZ")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3 w-3 text-gold/60" />
                {t._count?.categories ?? 0} санат
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <TournamentStatusBadge status={t.status} />
          {isCompleted && (
            <a
              href={api.admin.protocolPdfUrl(t.id)}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-gold px-3 py-1.5 text-xs font-medium text-gold-foreground shadow-gold"
            >
              <Download className="h-3.5 w-3.5" />
              Хаттама PDF
            </a>
          )}
          <Link
            to="/admin/tournaments/$id"
            params={{ id: t.id }}
            search={{ tab: "protocol" }}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold"
          >
            <ExternalLink className="h-3 w-3" />
            Басқару
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
              Бұл жарыс үшін сеткалар жасалмаған.{" "}
              <Link
                to="/admin/tournaments/$id"
                params={{ id: t.id }}
                search={{ tab: "protocol" }}
                className="text-gold hover:underline"
              >
                Жасау →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {brackets.map((b: any) => {
                const catLabel = `${b.category?.gender === "MALE" ? "Ер" : "Қыз"} ${b.category?.weightMin ?? ""}–${b.category?.weightMax ?? ""} кг · ${b.category?.ageMin ?? ""}–${b.category?.ageMax ?? ""} жас`;
                const isShowingBracket =
                  openBracket !== null &&
                  openBracket.tournamentId === t.id &&
                  openBracket.categoryId === b.categoryId;

                return (
                  <div key={b.id} className="rounded-lg border border-border/50 bg-card/40">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="font-medium text-sm">{catLabel}</div>
                        <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                          <span>{b.size} қатысушы</span>
                          <span>·</span>
                          <span>{b.format === "ROUND_ROBIN" ? "Round-Robin" : "Olympic / SE"}</span>
                          <span>·</span>
                          <span>{b.matches?.length ?? 0} матч</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => onToggleBracket(b.categoryId)}
                          className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {isShowingBracket ? "Жабу" : "Сетка"}
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
                          size={b.size}
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
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["admin-audit-full", entityFilter, actionFilter],
    queryFn: () =>
      api.admin.auditLogs({
        targetEntity: entityFilter || undefined,
        action:       actionFilter || undefined,
        limit:        200,
      }),
  });

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpanded(s);
  };

  const exportCSV = () => {
    const items = query.data?.items ?? [];
    const rows = [
      ["Уақыт", "Кім", "Рөл", "Әрекет", "Нысан", "ID"],
      ...items.map((a: any) => [
        new Date(a.createdAt).toLocaleString("kk-KZ"),
        `${a.actor?.name ?? "-"} ${a.actor?.surname ?? ""}`.trim(),
        a.actor?.role ?? "-",
        a.action,
        a.targetEntity,
        a.targetId,
      ]),
    ];
    const csv  = rows.map((r) => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Panel
        title={`${query.data?.total ?? 0} жазба`}
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">Барлық нысандар</option>
              <option value="Match">Матч</option>
              <option value="Tournament">Жарыс</option>
              <option value="Club">Клуб</option>
              <option value="User">Пайдаланушы</option>
              <option value="Application">Өтінім</option>
              <option value="Bracket">Тор</option>
              <option value="SystemConfig">Баптау</option>
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5"
            >
              <option value="">Барлық әрекеттер</option>
              <option value="match.override">Override</option>
              <option value="match.rollback">Rollback</option>
              <option value="tournament.finalize">Финал</option>
              <option value="club.block">Клуб блок</option>
              <option value="user.block">Юзер блок</option>
              <option value="notification.broadcast">Рассылка</option>
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
          <EmptyState title="Жазбалар жоқ" />
        ) : (
          <div className="space-y-1.5">
            {(query.data?.items ?? []).map((a: any) => {
              const open = expanded.has(a.id);
              return (
                <div key={a.id} className="glass rounded">
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="w-full p-2.5 flex items-center justify-between gap-2 hover:bg-gold/5 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {open ? (
                        <ChevronDown  className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {new Date(a.createdAt).toLocaleString("kk-KZ")}
                      </span>
                      <span className="text-xs text-gold truncate">{a.actor?.name ?? "—"}</span>
                      <span className="text-xs font-mono truncate">{a.action}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {a.targetEntity}#{a.targetId.slice(-6)}
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="px-2.5 pb-2.5 text-xs">
                      {a.before && (
                        <div className="mt-2">
                          <div className="text-[10px] text-destructive uppercase">Before</div>
                          <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(a.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {a.after && (
                        <div className="mt-2">
                          <div className="text-[10px] text-emerald-300 uppercase">After</div>
                          <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(a.after, null, 2)}
                          </pre>
                        </div>
                      )}
                      {a.metadata && (
                        <div className="mt-2">
                          <div className="text-[10px] text-gold uppercase">Metadata</div>
                          <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(a.metadata, null, 2)}
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
          Көрсетілген: {(query.data?.items ?? []).length} / {query.data?.total ?? 0} жазба
          {(query.data?.total ?? 0) > 200 && (
            <span className="ml-2 text-amber-400">⚠ Тек соңғы 200 жазба көрінеді</span>
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
      <div className={`mt-2 font-display text-3xl font-bold ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
    </div>
  );
}

function Bar({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>{value} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TournamentStatusBadge({ status }: { status: string }) {
  const m: Record<string, { c: string; l: string }> = {
    REGISTRATION_CLOSED: { c: "bg-amber-500/15 text-amber-300 border border-amber-500/30", l: "Тіркеу жабық" },
    IN_PROGRESS:         { c: "bg-destructive/20 text-destructive border border-destructive/40", l: "LIVE" },
    COMPLETED:           { c: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", l: "Аяқталды" },
  };
  const x = m[status] ?? { c: "bg-muted text-muted-foreground", l: status };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${x.c}`}>{x.l}</span>;
}

function statusDot(status: string): string {
  if (status === "IN_PROGRESS") return "bg-destructive animate-pulse";
  if (status === "COMPLETED")   return "bg-emerald-400";
  return "bg-amber-400";
}

function localizeName(n: any): string {
  if (!n) return "—";
  if (typeof n === "string") return n;
  return n.kk || n.ru || n.en || "—";
}
