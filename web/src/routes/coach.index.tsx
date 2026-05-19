import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, StatCard, Panel, LoadingState, EmptyState } from "@/components/dashboard/DashboardShell";
import { Building2, LayoutDashboard, Users, ClipboardList, Trophy, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { ProtectedRoute } from "@/lib/protected-route";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Жаттықтырушы — Judo-Arena" }] }),
  component: () => (
    <ProtectedRoute allowedRoles={["COACH"]}>
      <CoachOverview />
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

function CoachOverview() {
  const { user } = useAuth();
  const clubId = user?.clubId;

  const clubQuery = useQuery({
    queryKey: ["club", clubId],
    queryFn: () => (clubId ? api.clubs.get(clubId) : null),
    enabled: !!clubId,
  });
  const membersQuery = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => (clubId ? api.clubs.members(clubId) : []),
    enabled: !!clubId,
  });
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments-open"],
    queryFn: () => api.tournaments.list({ status: "REGISTRATION_OPEN" }),
  });

  const clubName = clubQuery.data ? localizeName(clubQuery.data.name) : "—";
  return (
    <DashboardShell role="Жаттықтырушы" navItems={nav} accentTitle={clubName ? `«${clubName}» клубы` : "Менің клубым"}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Спортшылар" value={membersQuery.isLoading ? "…" : String(membersQuery.data?.length ?? 0)} accent />
        <StatCard label="Ашық жарыстар" value={tournamentsQuery.isLoading ? "…" : String(tournamentsQuery.data?.items.length ?? 0)} hint="тіркеу ашық" />
        <StatCard label="Қала" value={clubQuery.data?.city ?? "—"} />
        <StatCard label="Топтар" value={String(clubQuery.data?.groups?.length ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Менің спортшыларым" action={
          <Link to="/coach/athletes" className="text-xs text-gold hover:underline">Барлығы →</Link>
        }>
          {membersQuery.isLoading ? <LoadingState /> :
            (membersQuery.data ?? []).length === 0 ? (
              <EmptyState title="Спортшылар жоқ" hint="Спортшылар бөлімінен қосуға болады" />
            ) : (
              <div className="space-y-2">
                {(membersQuery.data ?? []).slice(0, 5).map((a: any) => (
                  <div key={a.id} className="flex justify-between glass rounded-md p-3">
                    <div>
                      <div className="font-medium">{a.name} {a.surname}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.weightKg ? `${a.weightKg} кг` : ""} {a.beltRank ? `· ${a.beltRank}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Panel>

        <Panel title="Ашық жарыстар">
          {tournamentsQuery.isLoading ? <LoadingState /> :
            (tournamentsQuery.data?.items ?? []).length === 0 ? (
              <EmptyState title="Ашық жарыс жоқ" />
            ) : (
              <ul className="space-y-2 text-sm">
                {tournamentsQuery.data!.items.slice(0, 4).map((t: any) => (
                  <li key={t.id} className="glass rounded-md p-3">
                    <div className="font-medium">{localizeName(t.name)}</div>
                    <div className="text-xs text-muted-foreground">{t.city}</div>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
    </DashboardShell>
  );
}

function localizeName(n: any): string { if (!n) return ""; if (typeof n === "string") return n; return n.kk || n.ru || n.en || ""; }
