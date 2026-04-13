import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getTournaments } from '@/api/tournaments';

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

const CoachTournaments: React.FC = () => {
  const tournamentsQuery = useQuery({
    queryKey: ['coach-tournaments'],
    queryFn: getTournaments,
  });

  return (
    <AppLayout title={kz.nav.tournaments}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.nav.tournaments}</SectionTitle>

        {tournamentsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading tournaments...</div>}
        {tournamentsQuery.isError && <div className="text-sm text-destructive">Failed to load tournaments.</div>}

        <div className="space-y-3">
          {(tournamentsQuery.data || []).map((t) => (
            <div key={t._id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{t.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.startDate).toLocaleDateString()} · {t.location} · {(t.categories || []).map((c) => c.label).join(', ')}
                </p>
              </div>
              <StatusBadge status={mapTournamentStatus(t.status)} />
            </div>
          ))}
        </div>

        {!tournamentsQuery.isLoading && !tournamentsQuery.isError && (tournamentsQuery.data || []).length === 0 && (
          <div className="card-premium p-12 text-center">
            <p className="text-muted-foreground">{kz.tournament.noTournaments}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CoachTournaments;
