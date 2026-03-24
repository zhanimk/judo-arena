import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { demoMatches } from '@/lib/demo-data';
import { Trophy } from 'lucide-react';

interface BracketMatchProps {
  athlete1: string;
  athlete2: string;
  score1: string;
  score2: string;
  winner?: string;
  status: string;
}

const BracketMatch: React.FC<BracketMatchProps> = ({ athlete1, athlete2, score1, score2, winner, status }) => (
  <div className={`w-56 rounded-lg border overflow-hidden ${status === 'active' ? 'border-success/50 gold-glow' : 'border-border'}`}>
    <div className={`px-3 py-2 flex items-center justify-between text-sm ${winner === athlete1 ? 'bg-primary/10 text-primary font-medium' : 'bg-navy-light text-foreground'}`}>
      <span className="truncate">{athlete1 || kz.bracket.bye}</span>
      <span className="text-xs font-mono ml-2">{score1}</span>
    </div>
    <div className="h-px bg-border" />
    <div className={`px-3 py-2 flex items-center justify-between text-sm ${winner === athlete2 ? 'bg-primary/10 text-primary font-medium' : 'bg-navy-light text-foreground'}`}>
      <span className="truncate">{athlete2 || kz.bracket.bye}</span>
      <span className="text-xs font-mono ml-2">{score2}</span>
    </div>
    {status === 'active' && (
      <div className="bg-success/10 px-3 py-1 text-center">
        <span className="text-[10px] text-success font-medium uppercase tracking-wider">{kz.status.live}</span>
      </div>
    )}
  </div>
);

const AdminBrackets: React.FC = () => {
  const rounds = [
    { title: `${kz.bracket.round} 1`, matches: demoMatches.filter(m => m.round === 1) },
    { title: kz.bracket.semifinal, matches: demoMatches.filter(m => m.round === 2) },
    { title: kz.bracket.final, matches: demoMatches.filter(m => m.round === 3) },
  ];

  return (
    <AppLayout title={kz.bracket.title}>
      <div className="space-y-6 animate-slide-in">
        <SectionTitle>{kz.bracket.title} — {kz.tournament.categories}: -73 кг</SectionTitle>
        <div className="card-premium p-6 overflow-x-auto">
          <div className="flex items-start gap-8 min-w-[800px]">
            {rounds.map((round, ri) => (
              <div key={ri} className="flex flex-col items-center">
                <h4 className="text-xs font-medium text-primary uppercase tracking-wider mb-4">{round.title}</h4>
                <div className="flex flex-col gap-6" style={{ paddingTop: `${ri * 40}px` }}>
                  {round.matches.map((m) => (
                    <div key={m.id} className="relative">
                      <BracketMatch athlete1={m.athlete1} athlete2={m.athlete2} score1={m.score1} score2={m.score2} winner={m.winner} status={m.status} />
                      {ri < rounds.length - 1 && <div className="absolute top-1/2 -right-8 w-8 h-px bg-border" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col items-center" style={{ paddingTop: '80px' }}>
              <h4 className="text-xs font-medium text-primary uppercase tracking-wider mb-4">{kz.bracket.winner}</h4>
              <div className="w-56 rounded-lg border border-primary/50 bg-primary/5 p-4 text-center gold-glow">
                <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Анықталуда...</p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>{kz.bracket.bronze}</SectionTitle>
          <div className="card-premium p-4 inline-block">
            <BracketMatch athlete1="Анықталуда" athlete2="Анықталуда" score1="" score2="" status="scheduled" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminBrackets;
