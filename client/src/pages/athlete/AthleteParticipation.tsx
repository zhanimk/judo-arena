import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyAthleteApplications, ApplicationStatus } from '@/api/applications';
import { getTournaments } from '@/api/tournaments';

function mapApplicationStatus(status: ApplicationStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'DRAFT':
      return 'draft';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    default:
      return 'pending';
  }
}

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

const AthleteParticipation: React.FC = () => {
  const applicationsQuery = useQuery({
    queryKey: ['athlete-my-applications'],
    queryFn: getMyAthleteApplications,
  });

  const tournamentsQuery = useQuery({
    queryKey: ['athlete-tournaments'],
    queryFn: getTournaments,
  });

  const upcoming = (tournamentsQuery.data || []).filter((t) => ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(t.status));

  return (
    <AppLayout title={kz.nav.participation}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.dashboard.myApplications}</SectionTitle>
        {applicationsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading applications...</div>}
        {applicationsQuery.isError && <div className="text-sm text-destructive">Failed to load applications.</div>}

        <div className="space-y-3">
          {(applicationsQuery.data || []).map((a) => (
            <div key={a._id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{a.tournamentId?.title || '—'}</h4>
                <p className="text-xs text-muted-foreground">
                  {a.clubId?.name || '—'} · {kz.application.coach}: {a.coachId?.fullName || '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {kz.application.submittedAt}: {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}
                </p>
              </div>
              <StatusBadge status={mapApplicationStatus(a.status)} />
            </div>
          ))}

          {!applicationsQuery.isLoading && !applicationsQuery.isError && (applicationsQuery.data || []).length === 0 && (
            <div className="card-premium p-6 text-center">
              <p className="text-muted-foreground">{kz.application.noApplications}</p>
            </div>
          )}
        </div>

        <SectionTitle>{kz.dashboard.upcomingEvents}</SectionTitle>
        {tournamentsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading tournaments...</div>}
        {tournamentsQuery.isError && <div className="text-sm text-destructive">Failed to load tournaments.</div>}

        <div className="space-y-3">
          {upcoming.map((t) => (
            <div key={t._id} className="card-premium p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">{t.title}</h4>
                  <p className="text-xs text-muted-foreground">{new Date(t.startDate).toLocaleDateString()} · {t.location}</p>
                </div>
                <StatusBadge status={mapTournamentStatus(t.status)} />
              </div>
            </div>
          ))}

          {!tournamentsQuery.isLoading && !tournamentsQuery.isError && upcoming.length === 0 && (
            <div className="card-premium p-6 text-center">
              <p className="text-muted-foreground">{kz.tournament.noTournaments}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteParticipation;
