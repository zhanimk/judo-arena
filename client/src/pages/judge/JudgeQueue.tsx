import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle, StatusBadge } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoMatches } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';

const JudgeQueue: React.FC = () => {
  const queued = demoMatches.filter(m => m.status !== 'completed');
  return (
    <AppLayout title={kz.nav.tatamiQueue}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.nav.tatamiQueue}</SectionTitle>
        <div className="space-y-3">
          {queued.map((m, i) => (
            <div key={m.id} className={`card-premium p-4 flex items-center justify-between ${m.status === 'active' ? 'border-success/50' : ''}`}>
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-navy-surface flex items-center justify-center text-sm font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.athlete1 || '—'} vs {m.athlete2 || '—'}</p>
                  <p className="text-xs text-muted-foreground">{kz.tournament.tatami} №{m.tatami} · {m.category} · {kz.bracket.round} {m.round}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={m.status} />
                {m.status === 'active' && (
                  <Link to="/judge/match"><Button variant="gold" size="sm" className="gap-1"><Play size={12} /> {kz.judge.matchControl}</Button></Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeQueue;
