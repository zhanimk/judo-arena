import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoAthletes, demoTournaments, demoApplications } from '@/lib/demo-data';
import { Trophy, Medal, Swords, TrendingUp } from 'lucide-react';

const AthleteDashboard: React.FC = () => {
  const me = demoAthletes[0];
  const myApps = demoApplications.filter(a => a.athleteName === me.name);

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.athlete}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="card-premium p-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center text-xl font-bold text-primary-foreground">
            {me.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">{me.name}</h2>
            <p className="text-sm text-muted-foreground">{me.club} · {me.category} · {me.weight} кг · {me.rank}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.table.wins} value={me.wins} icon={<Trophy size={20} />} />
          <StatCard title={kz.table.losses} value={me.losses} icon={<Swords size={20} />} />
          <StatCard title={kz.dashboard.myApplications} value={myApps.length} icon={<Medal size={20} />} />
          <StatCard title={kz.dashboard.performance} value={`${Math.round(me.wins / (me.wins + me.losses) * 100)}%`} icon={<TrendingUp size={20} />} />
        </div>

        <SectionTitle>{kz.dashboard.myTournaments}</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          {demoTournaments.slice(0, 3).map(t => (
            <div key={t.id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-foreground">{t.name}</h4>
                <p className="text-xs text-muted-foreground">{t.date} · {t.location}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>

        <SectionTitle>{kz.dashboard.myApplications}</SectionTitle>
        <div className="space-y-2">
          {myApps.map(a => (
            <div key={a.id} className="card-premium p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{a.tournamentName}</p>
                <p className="text-xs text-muted-foreground">{a.category} · {a.weight}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default AthleteDashboard;
