import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { getMyDashboard } from '@/api/dashboard';

function mapMatchStatus(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'live';
    case 'COMPLETED':
      return 'completed';
    case 'READY':
      return 'active';
    case 'PENDING':
    default:
      return 'scheduled';
  }
}

const JudgeQueue: React.FC = () => {
  const dashboardQuery = useQuery({
    queryKey: ['judge-dashboard-queue'],
    queryFn: getMyDashboard,
    refetchInterval: 5000,
  });

  const queue = dashboardQuery.data?.role === 'JUDGE' ? dashboardQuery.data.queue || [] : [];

  return (
    <AppLayout title={kz.nav.tatamiQueue}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.nav.tatamiQueue}</SectionTitle>

        {dashboardQuery.isLoading && <div className="text-sm text-muted-foreground">Loading queue...</div>}
        {dashboardQuery.isError && <div className="text-sm text-destructive">Failed to load queue.</div>}

        <div className="space-y-3">
          {queue.map((m, i) => (
            <div key={m._id} className={`card-premium p-4 flex items-center justify-between ${m.status === 'IN_PROGRESS' ? 'border-success/50' : ''}`}>
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-navy-surface flex items-center justify-center text-sm font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.slotA?.displayNameSnapshot || '—'} vs {m.slotB?.displayNameSnapshot || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {kz.tournament.tatami} №{m.tatamiNumber || '-'} · {m.categoryKey} · {kz.bracket.round} {m.roundNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={mapMatchStatus(m.status)} />
                {m.status === 'IN_PROGRESS' && (
                  <Link to="/judge/match">
                    <Button variant="gold" size="sm" className="gap-1">
                      <Play size={12} /> {kz.judge.matchControl}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}

          {!dashboardQuery.isLoading && !dashboardQuery.isError && queue.length === 0 && (
            <div className="card-premium p-12 text-center">
              <p className="text-muted-foreground">{kz.bracket.noMatches}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeQueue;
