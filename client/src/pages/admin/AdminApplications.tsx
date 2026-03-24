import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import {
  approveApplication,
  getMyApplications,
  markApplicationUnderReview,
  rejectApplication,
  ApplicationEntity,
  ApplicationStatus,
} from '@/api/applications';
import { Check, X, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

function mapStatus(status: ApplicationStatus): 'pending' | 'approved' | 'rejected' | 'draft' {
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

const AdminApplications: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ['applications-my'],
    queryFn: getMyApplications,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['applications-my'] });

  const approveMutation = useMutation({
    mutationFn: approveApplication,
    onSuccess: refresh,
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectApplication(id, 'Rejected by admin'),
    onSuccess: refresh,
  });

  const reviewMutation = useMutation({
    mutationFn: markApplicationUnderReview,
    onSuccess: refresh,
  });

  const applications = applicationsQuery.data || [];

  const filtered = useMemo(
    () =>
      applications.filter((a) => {
        const status = mapStatus(a.status);
        if (filter !== 'all' && status !== filter) {
          return false;
        }

        if (search.trim()) {
          const source = `${a.tournamentId?.title || ''} ${a.clubId?.name || ''} ${a.coachId?.fullName || ''}`.toLowerCase();
          if (!source.includes(search.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    [applications, filter, search]
  );

  const pendingCount = applications.filter((a) => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)).length;

  const pendingStatus = (application: ApplicationEntity) =>
    application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW';

  return (
    <AppLayout title={kz.nav.applications}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.application.review}</SectionTitle>
          <span className="text-sm text-muted-foreground">
            {kz.status.pending}: <span className="text-warning font-semibold">{pendingCount}</span>
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="pl-9 pr-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary w-60"
              placeholder={kz.table.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">{kz.application.filterByStatus}: {kz.application.all}</option>
            <option value="pending">{kz.status.pending}</option>
            <option value="approved">{kz.status.approved}</option>
            <option value="rejected">{kz.status.rejected}</option>
          </select>
        </div>

        {applicationsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading applications...</div>}
        {applicationsQuery.isError && <div className="text-sm text-destructive">Failed to load applications.</div>}

        {!applicationsQuery.isLoading && !applicationsQuery.isError && (
          <DataTable headers={[
            kz.tournament.name,
            kz.application.club,
            kz.application.coach,
            kz.application.submittedAt,
            kz.tournament.status,
            kz.table.actions,
          ]}>
            {filtered.map((a) => (
              <React.Fragment key={a._id}>
                <tr className="hover:bg-navy-light/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{a.tournamentId?.title || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{a.clubId?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{a.coachId?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={mapStatus(a.status)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {pendingStatus(a) ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-info" onClick={() => reviewMutation.mutate(a._id)}><Eye size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => approveMutation.mutate(a._id)}><Check size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => rejectMutation.mutate(a._id)}><X size={14} /></Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(expandedId === a._id ? null : a._id)}><Eye size={14} /></Button>
                      )}
                    </div>
                  </td>
                </tr>

                {expandedId === a._id && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 bg-navy-light/30">
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground"><span className="text-foreground font-medium">Review comment:</span> {a.reviewComment || '—'}</p>
                        <p className="text-muted-foreground"><span className="text-foreground font-medium">Coach email:</span> {a.coachId?.email || '—'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </DataTable>
        )}

        {!applicationsQuery.isLoading && !applicationsQuery.isError && filtered.length === 0 && (
          <div className="card-premium p-12 text-center">
            <p className="text-muted-foreground">{kz.application.noApplications}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminApplications;
