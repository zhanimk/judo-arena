import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoAthletes, demoApplications, demoTournaments, demoClubs } from '@/lib/demo-data';
import { Users, Trophy, FileCheck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CoachDashboard: React.FC = () => {
  const club = demoClubs[0];
  const clubAthletes = demoAthletes.filter(a => a.club === club.name);
  const clubApps = demoApplications.filter(a => a.coachName === club.coach);

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.coach}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="card-premium p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-navy-surface flex items-center justify-center text-success">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">{club.name}</h2>
            <p className="text-sm text-muted-foreground">{club.coach} · {club.city}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.dashboard.myAthletes} value={clubAthletes.length} icon={<Users size={20} />} />
          <StatCard title={kz.dashboard.myApplications} value={clubApps.length} icon={<FileCheck size={20} />} />
          <StatCard title={kz.dashboard.totalTournaments} value={demoTournaments.length} icon={<Trophy size={20} />} />
          <StatCard title={kz.dashboard.totalClubs} value="1" icon={<Building2 size={20} />} />
        </div>

        <SectionTitle>{kz.dashboard.myAthletes}</SectionTitle>
        <DataTable headers={[kz.table.name, kz.table.category, kz.table.weight, kz.table.rank, kz.table.wins, kz.table.losses]}>
          {clubAthletes.map(a => (
            <tr key={a.id} className="hover:bg-navy-light/50">
              <td className="px-4 py-3 text-sm font-medium text-foreground">{a.name}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{a.category}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{a.weight} кг</td>
              <td className="px-4 py-3 text-sm text-primary">{a.rank}</td>
              <td className="px-4 py-3 text-sm text-success">{a.wins}</td>
              <td className="px-4 py-3 text-sm text-destructive">{a.losses}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </AppLayout>
  );
};

export default CoachDashboard;
