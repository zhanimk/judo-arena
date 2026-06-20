import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, EmptyState, LoadingState } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";
import { ChevronDown, ChevronRight } from "lucide-react";

export function TournamentAuditTab({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["tournament-audit", tournamentId],
    queryFn: () => api.admin.auditLogs({ targetEntity: "Tournament", targetId: tournamentId, limit: 50 }),
  });

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setExpanded(s);
  };

  return (
    <Panel title={t("dashboard.audit")}>
      {query.isLoading ? <LoadingState /> :
        (query.data?.items ?? []).length === 0 ? <EmptyState title={t("audit.empty")} /> : (
          <div className="space-y-2">
            {(query.data?.items ?? []).map((a: any) => {
              const open = expanded.has(a.id);
              return (
                <div key={a.id} className="glass rounded border border-border/40 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="w-full p-3 flex items-center justify-between gap-3 hover:bg-gold/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
                        {new Date(a.createdAt).toLocaleString("kk-KZ")}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                        <span className="text-sm font-medium text-gold truncate">
                          {a.actor?.name ?? "—"} {a.actor?.surname ?? ""}
                        </span>
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground whitespace-nowrap">
                          {a.action}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground sm:hidden tabular-nums shrink-0">
                      {new Date(a.createdAt).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                  {open && (
                    <div className="p-3 pt-0 text-xs border-t border-border/40 bg-background/20">
                      {Boolean(a.before) && (
                        <div className="mt-2">
                          <div className="text-[10px] text-destructive uppercase tracking-widest font-bold">Before</div>
                          <pre className="mt-1 bg-background/50 rounded-md p-2 overflow-x-auto border border-border/40">
                            {JSON.stringify(a.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {Boolean(a.after) && (
                        <div className="mt-2">
                          <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">After</div>
                          <pre className="mt-1 bg-background/50 rounded-md p-2 overflow-x-auto border border-border/40">
                            {JSON.stringify(a.after, null, 2)}
                          </pre>
                        </div>
                      )}
                      {Boolean(a.metadata) && (
                        <div className="mt-2">
                          <div className="text-[10px] text-gold uppercase tracking-widest font-bold">Metadata</div>
                          <pre className="mt-1 bg-background/50 rounded-md p-2 overflow-x-auto border border-border/40">
                            {JSON.stringify(a.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      {!a.before && !a.after && !a.metadata && (
                        <div className="mt-2 text-muted-foreground italic">No detailed payload recorded.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </Panel>
  );
}
