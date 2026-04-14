import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getMyApplications, ApplicationStatus } from '@/api/applications';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

function mapStatus(status: ApplicationStatus): string {
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

const CoachApplications: React.FC = () => {
  const applicationsQuery = useQuery({
    queryKey: ['coach-applications'],
    queryFn: getMyApplications,
  });

  return (
    <AppLayout title={kz.nav.applications}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.dashboard.myApplications}</SectionTitle>
          <Button variant="gold" size="sm" className="gap-1" disabled>
            <Plus size={14} /> {kz.application.submit}
          </Button>
        </div>

        {applicationsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading applications...</div>}
        {applicationsQuery.isError && <div className="text-sm text-destructive">Failed to load applications.</div>}

        <div className="space-y-3">
          {(applicationsQuery.data || []).map((a) => (
            <div key={a._id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{a.tournamentId?.title || '—'}</h4>
                <p className="text-xs text-muted-foreground">
                  {a.clubId?.name || '—'} · {kz.application.athlete}: {a.athletes?.length || 0}
                </p>
              </div>
              <StatusBadge status={mapStatus(a.status)} />
            </div>
          ))}
        </div>

        {!applicationsQuery.isLoading && !applicationsQuery.isError && (applicationsQuery.data || []).length === 0 && (
          <div className="card-premium p-12 text-center">
            <p className="text-muted-foreground">{kz.application.noApplications}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CoachApplications;
