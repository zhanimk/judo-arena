import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoTournaments, demoApplications, demoMatches, demoNotifications, demoClubs } from '@/lib/demo-data';
import { Trophy, Users, FileCheck, Swords, Building2, Activity, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const pendingApps = demoApplications.filter(a => a.status === 'pending').length;
  const activeMatches = demoMatches.filter(m => m.status === 'active').length;

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.admin}`}>
      <div className="space-y-6 animate-slide-in">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={kz.dashboard.totalTournaments} value={demoTournaments.length} icon={<Trophy size={20} />} trend="+2 осы айда" />
          <StatCard title={kz.dashboard.totalAthletes} value="186" icon={<Users size={20} />} trend="+24 осы аптада" />
          <StatCard title={kz.dashboard.pendingApplications} value={pendingApps} icon={<FileCheck size={20} />} />
          <StatCard title={kz.dashboard.activeMatches} value={activeMatches} icon={<Swords size={20} />} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Tournaments */}
          <div className="lg:col-span-2">
            <SectionTitle action={<Link to="/admin/tournaments"><Button variant="gold" size="sm" className="gap-1"><Plus size={14} /> {kz.tournament.create}</Button></Link>}>
              {kz.dashboard.activeTournaments}
            </SectionTitle>
            <DataTable headers={[kz.tournament.name, kz.tournament.date, kz.tournament.location, kz.tournament.status, kz.tournament.participants]}>
              {demoTournaments.map(t => (
                <tr key={t.id} className="hover:bg-navy-light/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.date}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.location}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.participants}/{t.maxParticipants}</td>
                </tr>
              ))}
            </DataTable>
          </div>

          {/* Notifications & Quick Actions */}
          <div className="space-y-6">
            <div>
              <SectionTitle>{kz.dashboard.notifications}</SectionTitle>
              <div className="space-y-2">
                {demoNotifications.map(n => (
                  <div key={n.id} className="card-premium p-3 flex items-start gap-3">
                    <Activity size={14} className={n.type === 'warning' ? 'text-warning mt-0.5' : n.type === 'success' ? 'text-success mt-0.5' : 'text-info mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{n.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle>{kz.dashboard.quickActions}</SectionTitle>
              <div className="space-y-2">
                <Link to="/admin/tournaments" className="block"><Button variant="navy" className="w-full justify-start gap-2"><Trophy size={16} /> {kz.tournament.create}</Button></Link>
                <Link to="/admin/applications" className="block"><Button variant="navy" className="w-full justify-start gap-2"><FileCheck size={16} /> {kz.application.review}</Button></Link>
                <Link to="/admin/brackets" className="block"><Button variant="navy" className="w-full justify-start gap-2"><Activity size={16} /> {kz.bracket.title}</Button></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
