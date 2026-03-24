import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoTournaments } from '@/lib/demo-data';

const CoachTournaments: React.FC = () => (
  <AppLayout title={kz.nav.tournaments}>
    <div className="space-y-6 animate-slide-in">
      <SectionTitle>{kz.nav.tournaments}</SectionTitle>
      <div className="space-y-3">
        {demoTournaments.map(t => (
          <div key={t.id} className="card-premium p-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-foreground">{t.name}</h4>
              <p className="text-xs text-muted-foreground">{t.date} · {t.location} · {t.categories.join(', ')}</p>
            </div>
            <StatusBadge status={t.status} />
          </div>
        ))}
      </div>
    </div>
  </AppLayout>
);

export default CoachTournaments;
