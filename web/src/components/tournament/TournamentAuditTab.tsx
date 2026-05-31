import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel, EmptyState, LoadingState } from "@/components/dashboard/DashboardShell";
import { api } from "@/lib/api";

export function TournamentAuditTab({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["tournament-audit", tournamentId],
    queryFn: () => api.admin.auditLogs({ targetEntity: "Tournament", targetId: tournamentId, limit: 50 }),
  });
  return (
    <Panel title={t("dashboard.audit")}>
      {query.isLoading ? <LoadingState /> :
        (query.data?.items ?? []).length === 0 ? <EmptyState title={t("audit.empty")} /> : (
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
