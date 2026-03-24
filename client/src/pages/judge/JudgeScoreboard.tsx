import React, { useState, useEffect } from 'react';
import { kz } from '@/lib/kz';
import { demoMatches } from '@/lib/demo-data';
import { Trophy } from 'lucide-react';

const JudgeScoreboard: React.FC = () => {
  const match = demoMatches.find(m => m.status === 'active')!;
  const [time, setTime] = useState(247);

  useEffect(() => {
    const id = setInterval(() => setTime(t => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-navy-deep flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
            <Trophy size={16} className="text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">Judo-Arena</span>
        </div>
        <div className="text-sm text-muted-foreground">{match.category} · {kz.bracket.round} {match.round}</div>
        <div className="text-sm text-muted-foreground">{kz.tournament.tatami} №{match.tatami}</div>
      </div>

      {/* Main scoreboard */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl">
          {/* Timer */}
          <div className="text-center mb-12">
            <p className="text-9xl font-mono font-bold text-foreground tracking-wider gold-glow inline-block px-16 py-8 rounded-3xl border-2 border-primary/30">
              {formatTime(time)}
            </p>
          </div>

          {/* Athletes */}
          <div className="grid grid-cols-2 gap-8">
            {/* White */}
            <div className="text-center">
              <div className="bg-foreground/10 rounded-2xl p-8 border-2 border-foreground/20">
                <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">{kz.judge.white}</p>
                <h2 className="text-3xl font-display font-bold text-foreground mb-6">{match.athlete1}</h2>
                <div className="text-8xl font-mono font-bold text-foreground">0</div>
                <div className="flex justify-center gap-6 mt-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.wazaari}</p>
                    <p className="text-xl font-bold text-foreground">0</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.uko}</p>
                    <p className="text-xl font-bold text-foreground">0</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.shido}</p>
                    <p className="text-xl font-bold text-warning">0</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Blue */}
            <div className="text-center">
              <div className="bg-info/10 rounded-2xl p-8 border-2 border-info/30">
                <p className="text-sm uppercase tracking-widest text-info mb-2">{kz.judge.blue}</p>
                <h2 className="text-3xl font-display font-bold text-foreground mb-6">{match.athlete2}</h2>
                <div className="text-8xl font-mono font-bold text-foreground">0</div>
                <div className="flex justify-center gap-6 mt-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.wazaari}</p>
                    <p className="text-xl font-bold text-foreground">0</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.uko}</p>
                    <p className="text-xl font-bold text-foreground">0</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.shido}</p>
                    <p className="text-xl font-bold text-warning">0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JudgeScoreboard;
