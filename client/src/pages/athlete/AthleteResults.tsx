import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoMatches } from '@/lib/demo-data';

const AthleteResults: React.FC = () => {
  const myMatches = demoMatches.filter(m => m.athlete1 === 'Әлібек Серіков' || m.athlete2 === 'Әлібек Серіков');

  return (
    <AppLayout title={kz.nav.results}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.dashboard.myResults}</SectionTitle>
        <div className="space-y-3">
          {myMatches.map(m => (
            <div key={m.id} className="card-premium p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{kz.bracket.round} {m.round} · {m.category}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${m.winner === m.athlete1 ? 'text-primary' : 'text-foreground'}`}>{m.athlete1}</span>
                <span className="text-lg font-display font-bold text-muted-foreground">{m.score1} : {m.score2}</span>
                <span className={`text-sm font-medium ${m.winner === m.athlete2 ? 'text-primary' : 'text-foreground'}`}>{m.athlete2}</span>
              </div>
              {m.winner && (
                <p className="text-xs text-success mt-2">{kz.bracket.winner}: {m.winner}</p>
              )}
            </div>
          ))}
          {myMatches.length === 0 && (
            <div className="card-premium p-12 text-center">
              <p className="text-muted-foreground">{kz.bracket.noMatches}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteResults;
