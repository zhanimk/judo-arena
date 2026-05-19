import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { Building2, LayoutDashboard, Users, ClipboardList, Trophy, Bell, Check, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/notifications")({
  head: () => ({ meta: [{ title: "Хабарландырулар — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachNotifications />
    </ProtectedRoute>
  ),
});

const nav = [
  { to: "/coach", label: "Шолу", icon: LayoutDashboard },
  { to: "/coach/club", label: "Клуб", icon: Building2 },
  { to: "/coach/athletes", label: "Спортшылар", icon: Users },
  { to: "/coach/applications", label: "Өтінімдер", icon: ClipboardList },
  { to: "/coach/tournaments", label: "Жарыстар", icon: Trophy },
  { to: "/coach/notifications", label: "Хабарландырулар", icon: Bell },
];

function CoachNotifications() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["my-notifications"], queryFn: () => api.notifications.list() });

  const markAll = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const unread = (query.data ?? []).filter((n: any) => !n.read).length;

  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle={`Хабарландырулар${unread > 0 ? ` (${unread})` : ""}`}>
      <Panel
        title={`Барлығы ${query.data?.length ?? 0}`}
        action={unread > 0 && (
          <button onClick={() => markAll.mutate()} disabled={markAll.isPending}
            className="text-sm text-gold hover:underline inline-flex items-center gap-1">
            {markAll.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Бәрін оқылды деп белгілеу
          </button>
        )}
      >
        {query.isLoading ? <LoadingState /> :
          (query.data ?? []).length === 0 ? (
            <EmptyState title="Әзірге хабарландыру жоқ" />
          ) : (
            <ul className="space-y-2">
              {(query.data ?? []).map((n: any) => (
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
                      className="text-xs text-gold hover:bg-gold/10 px-2 py-1 rounded inline-flex items-center gap-1">
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
