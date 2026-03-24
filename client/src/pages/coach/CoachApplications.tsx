import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoApplications } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const CoachApplications: React.FC = () => {
  const apps = demoApplications.filter(a => a.coachName === 'Марат Жанұзақов');
  return (
    <AppLayout title={kz.nav.applications}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between">
          <SectionTitle>{kz.dashboard.myApplications}</SectionTitle>
          <Button variant="gold" size="sm" className="gap-1"><Plus size={14} /> {kz.application.submit}</Button>
        </div>
        <div className="space-y-3">
          {apps.map(a => (
            <div key={a.id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{a.athleteName}</h4>
                <p className="text-xs text-muted-foreground">{a.tournamentName} · {a.category} · {a.weight}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default CoachApplications;
