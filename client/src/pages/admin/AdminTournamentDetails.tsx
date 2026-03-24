import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getTournamentById } from '@/api/tournaments';
import { getMatchesByTournament } from '@/api/matches';
import { getApplicationsByTournament } from '@/api/applications';
import { Users, Swords, FileCheck, Trophy, Clock, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useParams } from 'react-router-dom';

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

function mapMatchStatus(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'active';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'scheduled';
  }
}

const AdminTournamentDetails: React.FC = () => {
  const { id = '' } = useParams();

  const tournamentQuery = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id),
    enabled: Boolean(id),
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', 'tournament', id],
    queryFn: () => getMatchesByTournament(id),
    enabled: Boolean(id),
  });

  const applicationsQuery = useQuery({
    queryKey: ['applications', 'tournament', id],
    queryFn: () => getApplicationsByTournament(id),
    enabled: Boolean(id),
  });

  if (tournamentQuery.isLoading) {
    return <AppLayout title={kz.tournament.details}><div className="text-sm text-muted-foreground">Loading...</div></AppLayout>;
  }

  if (tournamentQuery.isError || !tournamentQuery.data) {
    return <AppLayout title={kz.tournament.details}><div className="text-sm text-destructive">Failed to load tournament.</div></AppLayout>;
  }

  const t = tournamentQuery.data;
  const tMatches = matchesQuery.data || [];
  const tApps = applicationsQuery.data || [];

  const approvedApps = tApps.filter((a) => a.status === 'APPROVED').length;
  const pendingApps = tApps.filter((a) => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)).length;

  return (
    <AppLayout title={`${kz.tournament.details} — ${t.title}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="card-premium p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-display font-bold text-foreground">{t.title}</h2>
                <StatusBadge status={mapTournamentStatus(t.status)} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(t.startDate).toLocaleDateString()} — {new Date(t.endDate).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {t.location}</span>
                <span className="flex items-center gap-1"><Clock size={14} /> Tatami: {t.tatamiCount}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="navy" size="sm">{kz.tournament.edit}</Button>
              <Link to="/admin/brackets"><Button variant="gold" size="sm">{kz.tournament.viewBracket}</Button></Link>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{(t as { description?: string }).description || '—'}</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {(t.categories || []).map((c) => (
              <span key={c.id} className="px-2 py-0.5 rounded bg-navy-surface text-xs text-muted-foreground border border-border">{c.label}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.tournament.participants} value={tApps.length} icon={<Users size={20} />} />
          <StatCard title={kz.dashboard.activeMatches} value={tMatches.filter((m) => m.status === 'IN_PROGRESS').length} icon={<Swords size={20} />} />
          <StatCard title={kz.status.approved} value={approvedApps} icon={<FileCheck size={20} />} />
          <StatCard title={kz.status.pending} value={pendingApps} icon={<Clock size={20} />} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <SectionTitle>{kz.tournament.operations}</SectionTitle>
            <div className="card-premium p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Link to="/admin/applications"><Button variant="navy" className="w-full text-sm gap-2"><FileCheck size={16} /> {kz.tournament.manageApplications}</Button></Link>
                <Link to="/admin/brackets"><Button variant="navy" className="w-full text-sm gap-2"><Trophy size={16} /> {kz.tournament.viewBracket}</Button></Link>
              </div>
              <div>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{kz.tournament.tatami}</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((n) => {
                    const activeMatch = tMatches.find((m) => m.tatamiNumber === n && m.status === 'IN_PROGRESS');
                    return (
                      <div key={n} className={`p-3 rounded-lg border ${activeMatch ? 'border-success/30 bg-success/5' : 'border-border bg-navy-surface'}`}>
                        <p className="text-xs text-muted-foreground">{kz.tournament.tatami} №{n}</p>
                        {activeMatch ? (
                          <p className="text-xs text-success font-medium mt-1">{activeMatch.slotA?.displayNameSnapshot || '—'} vs {activeMatch.slotB?.displayNameSnapshot || '—'}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">{kz.judge.noActiveMatch}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionTitle>{kz.tournament.schedule}</SectionTitle>
            <DataTable headers={[kz.bracket.round, kz.judge.athlete1, kz.judge.athlete2, kz.tournament.status, kz.tournament.tatami]}>
              {tMatches.slice(0, 6).map((m) => (
                <tr key={m._id} className="hover:bg-navy-light/50">
                  <td className="px-4 py-2 text-sm text-muted-foreground">{m.roundNumber}</td>
                  <td className="px-4 py-2 text-sm text-foreground">{m.slotA?.displayNameSnapshot || '—'}</td>
                  <td className="px-4 py-2 text-sm text-foreground">{m.slotB?.displayNameSnapshot || '—'}</td>
                  <td className="px-4 py-2"><StatusBadge status={mapMatchStatus(m.status)} /></td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">№{m.tatamiNumber || '-'}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminTournamentDetails;
