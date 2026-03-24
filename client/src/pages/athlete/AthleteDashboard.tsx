import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyDashboard } from '@/api/dashboard';
import { Trophy, Swords, Medal, TrendingUp } from 'lucide-react';

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

const AthleteDashboard: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: getMyDashboard,
  });

  if (dashboardQuery.isLoading) {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.athlete}`}>
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data || dashboardQuery.data.role !== 'ATHLETE') {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.athlete}`}>
        <div className="text-sm text-destructive">Failed to load athlete dashboard.</div>
      </AppLayout>
    );
  }

  const athlete = (dashboardQuery.data.summary?.athlete as {
    fullName?: string;
    rank?: string;
    weight?: number;
    clubId?: { name?: string };
  }) || { fullName: 'Athlete' };

  const wins = dashboardQuery.data.stats?.wins || 0;
  const losses = dashboardQuery.data.stats?.losses || 0;
  const performance = dashboardQuery.data.stats?.performance || 0;

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.athlete}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="card-premium p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center text-xl font-bold text-primary-foreground">
            {(athlete.fullName || 'A').charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">{athlete.fullName}</h2>
            <p className="text-sm text-muted-foreground">{athlete.clubId?.name || 'No club'} · {athlete.weight || '—'} кг · {athlete.rank || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.table.wins} value={wins} icon={<Trophy size={20} />} />
          <StatCard title={kz.table.losses} value={losses} icon={<Swords size={20} />} />
          <StatCard title={kz.dashboard.myApplications} value={0} icon={<Medal size={20} />} />
          <StatCard title={kz.dashboard.performance} value={`${performance}%`} icon={<TrendingUp size={20} />} />
        </div>

        <SectionTitle>{kz.dashboard.myTournaments}</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          {(dashboardQuery.data.recentTournaments || []).map((t) => (
            <div key={t._id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{t.title}</h4>
                <p className="text-xs text-muted-foreground">{new Date(t.startDate).toLocaleDateString()} · {t.location}</p>
              </div>
              <StatusBadge status={mapTournamentStatus(t.status)} />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteDashboard;
