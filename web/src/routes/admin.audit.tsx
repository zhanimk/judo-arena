import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { adminNav as nav } from "@/components/dashboard/admin-nav";
import { LayoutDashboard, Users, Trophy, ShieldAlert, Activity, Settings, ClipboardList, GitBranch, Download, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { useState } from "react";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Аудит — Әкімші" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminAudit />
    </ProtectedRoute>
  ),
});



function AdminAudit() {
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["admin-audit-full", entityFilter, actionFilter],
    queryFn: () => api.admin.auditLogs({
      targetEntity: entityFilter || undefined,
      action: actionFilter || undefined,
      limit: 200,
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
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell role="Әкімші" navItems={nav} accentTitle="Аудит журналы">
      <Panel
        title={`${query.data?.total ?? 0} жазба`}
        action={
          <div className="flex flex-wrap gap-2">
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">Барлық нысандар</option>
              <option value="Match">Матч</option>
              <option value="Tournament">Жарыс</option>
              <option value="Club">Клуб</option>
              <option value="User">Пайдаланушы</option>
              <option value="Application">Өтінім</option>
              <option value="Bracket">Тор</option>
              <option value="SystemConfig">Баптау</option>
            </select>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
              className="text-sm bg-input border border-border rounded px-2 py-1.5">
              <option value="">Барлық әрекеттер</option>
              <option value="match.override">Override</option>
              <option value="match.rollback">Rollback</option>
              <option value="tournament.finalize">Финал</option>
              <option value="club.block">Клуб блок</option>
              <option value="user.block">Юзер блок</option>
              <option value="notification.broadcast">Рассылка</option>
            </select>
            <button onClick={exportCSV}
              className="text-sm bg-gold/15 text-gold border border-gold/40 px-3 py-1.5 rounded inline-flex items-center gap-1">
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        }
      >
        {query.isLoading ? <LoadingState /> :
          (query.data?.items ?? []).length === 0 ? <EmptyState title="Жазбалар жоқ" /> : (
            <div className="space-y-1.5">
              {(query.data?.items ?? []).map((a: any) => {
                const open = expanded.has(a.id);
                return (
                  <div key={a.id} className="glass rounded">
                    <button onClick={() => toggleExpand(a.id)}
                      className="w-full p-2.5 flex items-center justify-between gap-2 hover:bg-gold/5 text-left">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {new Date(a.createdAt).toLocaleString("kk-KZ")}
                        </span>
                        <span className="text-xs text-gold truncate">{a.actor?.name ?? "—"}</span>
                        <span className="text-xs font-mono truncate">{a.action}</span>
                        <span className="text-xs text-muted-foreground truncate">{a.targetEntity}#{a.targetId.slice(-6)}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="px-2.5 pb-2.5 text-xs">
                        {a.before && (
                          <div className="mt-2">
                            <div className="text-[10px] text-destructive uppercase">Before</div>
                            <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">{JSON.stringify(a.before, null, 2)}</pre>
                          </div>
                        )}
                        {a.after && (
                          <div className="mt-2">
                            <div className="text-[10px] text-emerald-300 uppercase">After</div>
                            <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">{JSON.stringify(a.after, null, 2)}</pre>
                          </div>
                        )}
                        {a.metadata && (
                          <div className="mt-2">
                            <div className="text-[10px] text-gold uppercase">Metadata</div>
                            <pre className="mt-1 bg-background/50 rounded p-2 overflow-x-auto">{JSON.stringify(a.metadata, null, 2)}</pre>
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
    </DashboardShell>
  );
}
