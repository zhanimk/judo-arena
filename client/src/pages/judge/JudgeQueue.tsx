import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyDashboard } from '@/api/dashboard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';

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

const JudgeQueue: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: getMyDashboard,
  });

  if (dashboardQuery.isLoading) {
    return (
      <AppLayout title={kz.nav.tatamiQueue}>
        <div className="text-sm text-muted-foreground">Loading queue...</div>
      </AppLayout>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data || dashboardQuery.data.role !== 'JUDGE') {
    return (
      <AppLayout title={kz.nav.tatamiQueue}>
        <div className="text-sm text-destructive">Failed to load tatami queue.</div>
      </AppLayout>
    );
  }

  const queued = (dashboardQuery.data.queue || []).filter((m) => m.status !== 'COMPLETED');

  return (
    <AppLayout title={kz.nav.tatamiQueue}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.nav.tatamiQueue}</SectionTitle>
        <div className="space-y-3">
          {queued.map((m, i) => (
            <div key={m._id} className={`card-premium p-4 flex items-center justify-between ${m.status === 'IN_PROGRESS' ? 'border-success/50' : ''}`}>
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-navy-surface flex items-center justify-center text-sm font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.slotA?.displayNameSnapshot || '—'} vs {m.slotB?.displayNameSnapshot || '—'}</p>
                  <p className="text-xs text-muted-foreground">{kz.tournament.tatami} №{m.tatamiNumber || '-'} · {m.categoryKey} · {kz.bracket.round} {m.roundNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={mapMatchStatus(m.status)} />
                {m.status === 'IN_PROGRESS' && (
                  <Link to="/judge/match"><Button variant="gold" size="sm" className="gap-1"><Play size={12} /> {kz.judge.matchControl}</Button></Link>
                )}
              </div>
            </div>
          ))}
          {queued.length === 0 && (
            <div className="text-xs text-muted-foreground">Queue is empty.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeQueue;
