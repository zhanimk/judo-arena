import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyDashboard } from '@/api/dashboard';
import { Timer, Swords, CheckCircle, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function mapMatchStatus(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'active';
    case 'COMPLETED':
      return 'completed';
    case 'READY':
    case 'PENDING':
    default:
      return 'scheduled';
  }
}

const JudgeDashboard: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: getMyDashboard,
  });

  if (dashboardQuery.isLoading) {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.judge}`}>
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data || dashboardQuery.data.role !== 'JUDGE') {
    return (
      <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.judge}`}>
        <div className="text-sm text-destructive">Failed to load judge dashboard.</div>
      </AppLayout>
    );
  }

  const stats = dashboardQuery.data.stats || {};
  const queue = dashboardQuery.data.queue || [];

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.judge}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.dashboard.activeMatches} value={stats.activeMatches || 0} icon={<Swords size={20} />} />
          <StatCard title={kz.status.completed} value={stats.completedMatches || 0} icon={<CheckCircle size={20} />} />
          <StatCard title={kz.status.scheduled} value={stats.scheduledMatches || 0} icon={<ClipboardList size={20} />} />
          <StatCard title={kz.dashboard.todayMatches} value={stats.todayMatches || 0} icon={<Timer size={20} />} />
        </div>

        <div className="flex gap-4">
          <Link to="/judge/match"><Button variant="gold" size="lg" className="gap-2"><Timer size={18} /> {kz.judge.matchControl}</Button></Link>
          <Link to="/judge/scoreboard"><Button variant="navy" size="lg" className="gap-2"><Swords size={18} /> {kz.nav.scoreboard}</Button></Link>
        </div>

        <SectionTitle>{kz.judge.queue}</SectionTitle>
        <div className="space-y-2">
          {queue.map((m) => (
            <div key={m._id} className="card-premium p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{kz.tournament.tatami} №{m.tatamiNumber || '-'}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.slotA?.displayNameSnapshot || '—'} vs {m.slotB?.displayNameSnapshot || '—'}</p>
                  <p className="text-xs text-muted-foreground">{m.categoryKey} · {kz.bracket.round} {m.roundNumber}</p>
                </div>
              </div>
              <StatusBadge status={mapMatchStatus(m.status)} />
            </div>
          ))}
          {queue.length === 0 && <div className="text-xs text-muted-foreground">Queue is empty.</div>}
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeDashboard;
