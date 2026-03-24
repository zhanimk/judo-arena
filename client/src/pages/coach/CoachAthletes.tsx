import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, DataTable } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoAthletes } from '@/lib/demo-data';

const CoachAthletes: React.FC = () => {
  const athletes = demoAthletes.filter(a => a.club === 'Алматы Барыс');
  return (
    <AppLayout title={kz.nav.athletes}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.dashboard.myAthletes}</SectionTitle>
        <DataTable headers={[kz.table.name, kz.table.category, kz.table.weight, kz.table.age, kz.table.rank, kz.table.wins, kz.table.losses]}>
          {athletes.map(a => (
            <tr key={a.id} className="hover:bg-navy-light/50">
              <td className="px-4 py-3 text-sm font-medium text-foreground">{a.name}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{a.category}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{a.weight} кг</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{a.age}</td>
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

export default CoachAthletes;
