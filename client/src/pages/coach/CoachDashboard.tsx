import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyDashboard } from '@/api/dashboard';
import { Users, Trophy, FileCheck, Building2 } from 'lucide-react';

const CoachDashboard: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: getMyDashboard,
  });

  if (dashboardQuery.isLoading) {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.coach}`}>
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data || dashboardQuery.data.role !== 'COACH') {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.coach}`}>
        <div className="text-sm text-destructive">Failed to load coach dashboard.</div>
      </AppLayout>
    );
  }

  const club = (dashboardQuery.data.summary?.club as { name?: string; city?: string } | null) || null;
  const stats = dashboardQuery.data.stats || {};

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.coach}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="card-premium p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-navy-surface flex items-center justify-center text-success">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">{club?.name || 'My Club'}</h2>
            <p className="text-sm text-muted-foreground">{club?.city || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.dashboard.myAthletes} value={stats.clubAthletes || 0} icon={<Users size={20} />} />
          <StatCard title={kz.dashboard.myApplications} value={stats.myApplications || 0} icon={<FileCheck size={20} />} />
          <StatCard title={kz.dashboard.totalTournaments} value={stats.tournamentsTotal || 0} icon={<Trophy size={20} />} />
          <StatCard title={kz.dashboard.totalClubs} value={stats.clubsTotal || 0} icon={<Building2 size={20} />} />
        </div>
      </div>
    </AppLayout>
  );
};

export default CoachDashboard;
