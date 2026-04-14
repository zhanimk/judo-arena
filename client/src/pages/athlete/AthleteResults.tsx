import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyMatches, MatchEntity } from '@/api/matches';
import { useAuth } from '@/lib/auth-context';

function resolveDisplayName(match: MatchEntity, slot: 'A' | 'B') {
  const slotData = slot === 'A' ? match.slotA : match.slotB;
  return slotData?.athleteId?.fullName || slotData?.displayNameSnapshot || '—';
}

function mapStatus(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'live';
    case 'COMPLETED':
      return 'completed';
    case 'READY':
      return 'scheduled';
    case 'REPLAY_REQUIRED':
      return 'pending';
    case 'CANCELLED':
      return 'rejected';
    case 'PENDING':
    case 'UNDER_REVIEW':
    default:
      return 'pending';
  }
}

const AthleteResults: React.FC = () => {
  const { user } = useAuth();

  const matchesQuery = useQuery({
    queryKey: ['athlete-my-matches'],
    queryFn: () => getMyMatches({ limit: 100 }),
  });

  return (
    <AppLayout title={kz.nav.results}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.dashboard.myResults}</SectionTitle>

        {matchesQuery.isLoading && <div className="text-sm text-muted-foreground">Loading matches...</div>}
        {matchesQuery.isError && <div className="text-sm text-destructive">Failed to load match history.</div>}

        <div className="space-y-3">
          {(matchesQuery.data || []).map((m) => {
            const athleteA = resolveDisplayName(m, 'A');
            const athleteB = resolveDisplayName(m, 'B');
            const winnerName = m.winnerId?.fullName;
            const isWinnerA = winnerName && winnerName === athleteA;
            const isWinnerB = winnerName && winnerName === athleteB;

            return (
              <div key={m._id} className="card-premium p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {m.tournamentId?.title || 'Tournament'} · {kz.bracket.round} {m.roundNumber} · {m.categoryKey}
                  </span>
                  <StatusBadge status={mapStatus(m.status)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isWinnerA ? 'text-primary' : 'text-foreground'}`}>{athleteA}</span>
                  <span className="text-lg font-display font-bold text-muted-foreground">{m.scoreA ?? 0} : {m.scoreB ?? 0}</span>
                  <span className={`text-sm font-medium ${isWinnerB ? 'text-primary' : 'text-foreground'}`}>{athleteB}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>Penalties: {m.penaltiesA ?? 0} : {m.penaltiesB ?? 0}</span>
                  {m.endedAt ? <span>{new Date(m.endedAt).toLocaleString()}</span> : <span>—</span>}
                </div>
                {winnerName && (
                  <p className="text-xs text-success mt-2">
                    {kz.bracket.winner}: {winnerName}
                    {user?.fullName === winnerName ? ' ✅' : ''}
                  </p>
                )}
              </div>
            );
          })}

          {!matchesQuery.isLoading && !matchesQuery.isError && (matchesQuery.data || []).length === 0 && (
            <div className="card-premium p-12 text-center">
              <p className="text-muted-foreground">{kz.bracket.noMatches}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteResults;
