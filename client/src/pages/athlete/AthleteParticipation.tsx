import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoApplications, demoTournaments } from '@/lib/demo-data';

const AthleteParticipation: React.FC = () => {
  const myApps = demoApplications.filter(a => a.athleteName === 'Әлібек Серіков');

  return (
    <AppLayout title={kz.nav.participation}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.dashboard.myApplications}</SectionTitle>
        <div className="space-y-3">
          {myApps.map(a => (
            <div key={a.id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{a.tournamentName}</h4>
                <p className="text-xs text-muted-foreground">{a.category} · {a.weight} · {kz.application.coach}: {a.coachName}</p>
                <p className="text-xs text-muted-foreground mt-1">{kz.application.submittedAt}: {a.submittedAt}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>

        <SectionTitle>{kz.dashboard.upcomingEvents}</SectionTitle>
        <div className="space-y-3">
          {demoTournaments.filter(t => t.status === 'upcoming').map(t => (
            <div key={t.id} className="card-premium p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">{t.date} · {t.location}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteParticipation;
