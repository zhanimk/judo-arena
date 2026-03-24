import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoTournaments, demoMatches, demoApplications } from '@/lib/demo-data';
import { Users, Swords, FileCheck, Trophy, Clock, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const AdminTournamentDetails: React.FC = () => {
  const t = demoTournaments[0];
  const tMatches = demoMatches;
  const tApps = demoApplications.filter(a => a.tournamentName === t.name);
  const approvedApps = tApps.filter(a => a.status === 'approved').length;
  const pendingApps = tApps.filter(a => a.status === 'pending').length;

  return (
    <AppLayout title={`${kz.tournament.details} — ${t.name}`}>
      <div className="space-y-6 animate-slide-in">
        {/* Header */}
        <div className="card-premium p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-display font-bold text-foreground">{t.name}</h2>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar size={14} /> {t.date} — {t.endDate}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {t.location}</span>
                <span className="flex items-center gap-1"><Clock size={14} /> {t.boutDuration / 60} {kz.tournament.boutDurationMin}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="navy" size="sm">{kz.tournament.edit}</Button>
              <Link to="/admin/brackets"><Button variant="gold" size="sm">{kz.tournament.viewBracket}</Button></Link>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t.description}</p>
          <div className="flex gap-2 mt-3">
            {t.categories.map(c => (
              <span key={c} className="px-2 py-0.5 rounded bg-navy-surface text-xs text-muted-foreground border border-border">{c}</span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.tournament.participants} value={t.participants} icon={<Users size={20} />} />
          <StatCard title={kz.dashboard.activeMatches} value={tMatches.filter(m => m.status === 'active').length} icon={<Swords size={20} />} />
          <StatCard title={kz.status.approved} value={approvedApps} icon={<FileCheck size={20} />} />
          <StatCard title={kz.status.pending} value={pendingApps} icon={<Clock size={20} />} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Operations */}
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
                  {[1, 2, 3].map(n => {
                    const activeMatch = tMatches.find(m => m.tatami === n && m.status === 'active');
                    return (
                      <div key={n} className={`p-3 rounded-lg border ${activeMatch ? 'border-success/30 bg-success/5' : 'border-border bg-navy-surface'}`}>
                        <p className="text-xs text-muted-foreground">{kz.tournament.tatami} №{n}</p>
                        {activeMatch ? (
                          <p className="text-xs text-success font-medium mt-1">{activeMatch.athlete1} vs {activeMatch.athlete2}</p>
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

          {/* Schedule */}
          <div>
            <SectionTitle>{kz.tournament.schedule}</SectionTitle>
            <DataTable headers={[kz.bracket.round, kz.judge.athlete1, kz.judge.athlete2, kz.tournament.status, kz.tournament.tatami]}>
              {tMatches.slice(0, 6).map(m => (
                <tr key={m.id} className="hover:bg-navy-light/50">
                  <td className="px-4 py-2 text-sm text-muted-foreground">{m.round}</td>
                  <td className="px-4 py-2 text-sm text-foreground">{m.athlete1 || '—'}</td>
                  <td className="px-4 py-2 text-sm text-foreground">{m.athlete2 || '—'}</td>
                  <td className="px-4 py-2"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">№{m.tatami}</td>
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
