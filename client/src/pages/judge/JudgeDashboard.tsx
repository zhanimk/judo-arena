import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoMatches } from '@/lib/demo-data';
import { Timer, Swords, CheckCircle, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const JudgeDashboard: React.FC = () => {
  const active = demoMatches.filter(m => m.status === 'active').length;
  const completed = demoMatches.filter(m => m.status === 'completed').length;
  const scheduled = demoMatches.filter(m => m.status === 'scheduled').length;

  return (
    <AppLayout title={`${kz.nav.dashboard} — ${kz.roles.judge}`}>
      <div className="space-y-6 animate-slide-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title={kz.dashboard.activeMatches} value={active} icon={<Swords size={20} />} />
          <StatCard title={kz.status.completed} value={completed} icon={<CheckCircle size={20} />} />
          <StatCard title={kz.status.scheduled} value={scheduled} icon={<ClipboardList size={20} />} />
          <StatCard title={kz.dashboard.todayMatches} value={active + scheduled} icon={<Timer size={20} />} />
        </div>

        <div className="flex gap-4">
          <Link to="/judge/match"><Button variant="gold" size="lg" className="gap-2"><Timer size={18} /> {kz.judge.matchControl}</Button></Link>
          <Link to="/judge/scoreboard"><Button variant="navy" size="lg" className="gap-2"><Swords size={18} /> {kz.nav.scoreboard}</Button></Link>
        </div>

        <SectionTitle>{kz.judge.queue}</SectionTitle>
        <div className="space-y-2">
          {demoMatches.filter(m => m.status !== 'completed').map(m => (
            <div key={m.id} className="card-premium p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{kz.tournament.tatami} №{m.tatami}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.athlete1 || '—'} vs {m.athlete2 || '—'}</p>
                  <p className="text-xs text-muted-foreground">{m.category} · {kz.bracket.round} {m.round}</p>
                </div>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeDashboard;
