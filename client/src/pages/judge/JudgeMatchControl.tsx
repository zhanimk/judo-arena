import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { demoMatches } from '@/lib/demo-data';

const JudgeMatchControl: React.FC = () => {
  const match = demoMatches.find(m => m.status === 'active')!;
  const boutDuration = 300; // 5 min
  const [time, setTime] = useState(boutDuration);
  const [running, setRunning] = useState(false);
  const [scores, setScores] = useState({ w1: 0, w2: 0, s1: 0, s2: 0, u1: 0, u2: 0, p1: 0, p2: 0 });
  const [osaekomi, setOsaekomi] = useState(false);
  const [osaekomiTime, setOsaekomiTime] = useState(0);
  const [goldenScore, setGoldenScore] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running && time > 0) {
      intervalRef.current = setInterval(() => setTime(t => t - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (time === 0 && running) setRunning(false);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, time]);

  useEffect(() => {
    let id: NodeJS.Timeout;
    if (osaekomi && running) {
      id = setInterval(() => setOsaekomiTime(t => t + 1), 1000);
    }
    return () => clearInterval(id);
  }, [osaekomi, running]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const addScore = (athlete: 1 | 2, type: 'ippon' | 'wazaari' | 'uko' | 'shido') => {
    setScores(prev => {
      const key = type === 'ippon' ? `w${athlete}` : type === 'wazaari' ? `w${athlete}` : type === 'uko' ? `u${athlete}` : `p${athlete}`;
      if (type === 'ippon') return { ...prev, [`s${athlete}`]: 10 };
      if (type === 'wazaari') return { ...prev, [`s${athlete}`]: prev[`s${athlete}` as keyof typeof prev] + 1 };
      if (type === 'uko') return { ...prev, [`u${athlete}`]: prev[`u${athlete}` as keyof typeof prev] + 1 };
      return { ...prev, [`p${athlete}`]: prev[`p${athlete}` as keyof typeof prev] + 1 };
    });
  };

  return (
    <AppLayout title={kz.judge.matchControl}>
      <div className="space-y-4 animate-slide-in max-w-5xl mx-auto">
        {/* Match info */}
        <div className="text-center mb-2">
          <p className="text-xs text-muted-foreground">{match.category} · {kz.bracket.round} {match.round} · {kz.tournament.tatami} №{match.tatami}</p>
          {goldenScore && <p className="text-sm text-primary font-bold mt-1">{kz.judge.goldenScore}</p>}
        </div>

        {/* Timer */}
        <div className="text-center">
          <div className={`inline-block px-12 py-6 rounded-2xl border-2 ${running ? 'border-success gold-glow' : 'border-border'} bg-navy-deep`}>
            <p className="text-7xl font-mono font-bold text-foreground tracking-wider">{formatTime(time)}</p>
          </div>
          {osaekomi && (
            <div className="mt-2">
              <span className="text-lg font-mono text-warning font-bold">{kz.judge.osaekomi}: {osaekomiTime}с</span>
            </div>
          )}
        </div>

        {/* Timer controls */}
        <div className="flex justify-center gap-3">
          <Button variant={running ? 'destructive' : 'success'} size="lg" className="min-w-32 text-lg font-bold"
            onClick={() => setRunning(!running)}>
            {running ? kz.judge.matte : kz.judge.hajime}
          </Button>
          <Button variant="navy" size="lg" onClick={() => { setTime(boutDuration); setRunning(false); setScores({ w1: 0, w2: 0, s1: 0, s2: 0, u1: 0, u2: 0, p1: 0, p2: 0 }); setOsaekomi(false); setOsaekomiTime(0); }}>
            {kz.judge.reset}
          </Button>
          <Button variant="navy" size="lg" onClick={() => { setOsaekomi(!osaekomi); if (!osaekomi) setOsaekomiTime(0); }}>
            {osaekomi ? kz.judge.toketa : kz.judge.osaekomi}
          </Button>
          {time === 0 && <Button variant="gold" size="lg" onClick={() => { setGoldenScore(true); setTime(boutDuration); }}>{kz.judge.goldenScore}</Button>}
        </div>

        {/* Athletes & Controls */}
        <div className="grid grid-cols-2 gap-6">
          {/* Athlete 1 - White */}
          <div className="card-premium p-5 border-l-4 border-foreground">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{kz.judge.white}</p>
                <h3 className="text-lg font-display font-bold text-foreground">{match.athlete1}</h3>
              </div>
              <div className="text-3xl font-mono font-bold text-foreground">{scores.s1}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="gold" className="font-bold text-base py-6" onClick={() => addScore(1, 'ippon')}>{kz.judge.ippon}</Button>
              <Button variant="navy" className="font-bold text-base py-6" onClick={() => addScore(1, 'wazaari')}>{kz.judge.wazaari}</Button>
              <Button variant="secondary" className="font-bold" onClick={() => addScore(1, 'uko')}>{kz.judge.uko}</Button>
              <Button variant="destructive" className="font-bold" onClick={() => addScore(1, 'shido')}>
                {kz.judge.shido} ({scores.p1})
              </Button>
            </div>
          </div>

          {/* Athlete 2 - Blue */}
          <div className="card-premium p-5 border-l-4 border-info">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-info uppercase tracking-wider">{kz.judge.blue}</p>
                <h3 className="text-lg font-display font-bold text-foreground">{match.athlete2}</h3>
              </div>
              <div className="text-3xl font-mono font-bold text-foreground">{scores.s2}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="gold" className="font-bold text-base py-6" onClick={() => addScore(2, 'ippon')}>{kz.judge.ippon}</Button>
              <Button variant="navy" className="font-bold text-base py-6" onClick={() => addScore(2, 'wazaari')}>{kz.judge.wazaari}</Button>
              <Button variant="secondary" className="font-bold" onClick={() => addScore(2, 'uko')}>{kz.judge.uko}</Button>
              <Button variant="destructive" className="font-bold" onClick={() => addScore(2, 'shido')}>
                {kz.judge.shido} ({scores.p2})
              </Button>
            </div>
          </div>
        </div>

        {/* End match */}
        <div className="flex justify-center gap-4">
          <Button variant="destructive" size="lg" className="font-bold">{kz.judge.soremade}</Button>
          <Button variant="gold" size="lg" className="font-bold">{kz.judge.confirmResult}</Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeMatchControl;
