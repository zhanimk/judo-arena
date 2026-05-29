import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { Check, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";
import { toast } from "sonner";
import { coachNav as nav } from "@/components/dashboard/coach-nav";
import { useState } from "react";

export const Route = createFileRoute("/coach/notifications")({
  head: () => ({ meta: [{ title: "Хабарландырулар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachNotifications />
    </ProtectedRoute>
  ),
});

const FILTER_LABELS: Record<string, string> = {
  all: "Барлығы",
  unread: "Оқылмаған",
  application_approved: "Бекітілген",
  match_scheduled: "Матч",
  tournament_update: "Жарыс",
  announcement: "Хабарлама",
};

function CoachNotifications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const query = useQuery({
    queryKey: ["my-notifications", filter],
    queryFn: () => {
      if (filter === "unread") return api.notifications.list({ unreadOnly: true });
      if (filter === "all") return api.notifications.list();
      return api.notifications.list({ type: filter });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
      toast.success("Барлығы оқылды деп белгіленді ✓");
    },
    onError: (e: any) => toast.error(e instanceof ApiError ? e.message : "Қате"),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
    },
    onError: (e: any) => toast.error(e instanceof ApiError ? e.message : "Қате"),
  });

  const items = query.data ?? [];
  const unread = items.filter((n: any) => !n.read).length;

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle={`Хабарландырулар${unread > 0 ? ` (${unread})` : ""}`}>
      <Panel
        title={`${items.length} хабарландыру`}
        action={unread > 0 && (
          <button onClick={() => markAll.mutate()} disabled={markAll.isPending}
            className="text-sm text-gold hover:underline inline-flex items-center gap-1">
            {markAll.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Бәрін оқылды деп белгілеу
          </button>
        )}
      >
        {/* Фильтр */}
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                filter === key
                  ? "bg-gold/15 text-gold border-gold/40"
                  : "glass border-border text-muted-foreground hover:text-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {query.isLoading ? <LoadingState /> :
          items.length === 0 ? (
            <EmptyState title="Әзірге хабарландыру жоқ" />
          ) : (
            <ul className="space-y-2">
              {items.map((n: any) => (
                <li key={n.id}
                  className={`glass rounded-md p-4 flex justify-between items-start gap-3 ${n.read ? "opacity-60" : "border-gold/30"}`}>
                  <div>
                    <div className="font-medium text-sm">{n.titleKey}</div>
                    <div className="text-xs text-muted-foreground mt-1">{n.bodyKey}</div>
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {new Date(n.createdAt).toLocaleString("kk-KZ")}
                    </div>
                  </div>
                  {!n.read && (
                    <button onClick={() => markOne.mutate(n.id)}
                      className="text-xs text-gold hover:bg-gold/10 px-2 py-1 rounded inline-flex items-center gap-1 shrink-0">
                      <Check className="h-3 w-3" /> Оқылды
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
      </Panel>
    </DashboardShell>
  );
}
