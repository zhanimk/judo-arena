import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getAdminDashboard, getMyNotifications } from '@/api/admin';
import { Trophy, Users, FileCheck, Swords, Activity, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

function mapTournamentStatus(status: string): string {
  switch (status) {
    case 'REGISTRATION_OPEN':
      return 'upcoming';
    case 'REGISTRATION_CLOSED':
    case 'BRACKETS_GENERATED':
    case 'IN_PROGRESS':
    case 'PAUSED':
      return 'active';
    case 'COMPLETED':
    case 'ARCHIVED':
      return 'completed';
    case 'DRAFT':
    default:
      return 'draft';
  }
}

const AdminDashboard: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
  });

  const notificationsQuery = useQuery({
    queryKey: ['my-notifications'],
    queryFn: getMyNotifications,
  });

  if (dashboardQuery.isLoading) {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.admin}`}>
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.admin}`}>
        <div className="text-sm text-destructive">Failed to load admin dashboard.</div>
      </AppLayout>
    );
  }

  const { stats, recentTournaments } = dashboardQuery.data;
  const notifications = notificationsQuery.data || [];

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.admin}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={kz.dashboard.totalTournaments} value={stats.tournamentsTotal} icon={<Trophy size={20} />} />
          <StatCard title={kz.dashboard.totalAthletes} value={stats.athletesTotal} icon={<Users size={20} />} />
          <StatCard title={kz.dashboard.pendingApplications} value={stats.pendingApplications} icon={<FileCheck size={20} />} />
          <StatCard title={kz.dashboard.activeMatches} value={stats.activeMatches} icon={<Swords size={20} />} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionTitle action={<Link to="/admin/tournaments"><Button variant="gold" size="sm" className="gap-1"><Plus size={14} /> {kz.tournament.create}</Button></Link>}>
              {kz.dashboard.activeTournaments}
            </SectionTitle>
            <DataTable headers={[kz.tournament.name, kz.tournament.date, kz.tournament.location, kz.tournament.status, kz.tournament.categories]}>
              {recentTournaments.map((t) => (
                <tr key={t._id} className="hover:bg-navy-light/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{t.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(t.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.location}</td>
                  <td className="px-4 py-3"><StatusBadge status={mapTournamentStatus(t.status)} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.categories?.length || 0}</td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="space-y-6">
            <div>
              <SectionTitle>{kz.dashboard.notifications}</SectionTitle>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n._id} className="card-premium p-3 flex items-start gap-3">
                    <Activity size={14} className={n.isRead ? 'text-muted-foreground mt-0.5' : 'text-info mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="text-xs text-muted-foreground">No notifications yet.</div>
                )}
              </div>
            </div>

            <div>
              <SectionTitle>{kz.dashboard.quickActions}</SectionTitle>
              <div className="space-y-2">
                <Link to="/admin/tournaments" className="block"><Button variant="navy" className="w-full justify-start gap-2"><Trophy size={16} /> {kz.tournament.create}</Button></Link>
                <Link to="/admin/applications" className="block"><Button variant="navy" className="w-full justify-start gap-2"><FileCheck size={16} /> {kz.application.review}</Button></Link>
                <Link to="/admin/brackets" className="block"><Button variant="navy" className="w-full justify-start gap-2"><Activity size={16} /> {kz.bracket.title}</Button></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
