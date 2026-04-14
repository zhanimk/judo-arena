import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { kz } from '@/lib/kz';
import { Trophy } from 'lucide-react';
import { getMyDashboard } from '@/api/dashboard';
import { getMatchById } from '@/api/matches';

const BOUT_DURATION_SECONDS = 300;

const JudgeScoreboard: React.FC = () => {
  const [time, setTime] = useState(BOUT_DURATION_SECONDS);

  const dashboardQuery = useQuery({
    queryKey: ['judge-dashboard-scoreboard'],
    queryFn: getMyDashboard,
    refetchInterval: 5000,
  });

  const activeMatchId = useMemo(() => {
    const queue = dashboardQuery.data?.queue || [];
    return queue.find((m) => m.status === 'IN_PROGRESS')?._id || queue[0]?._id || '';
  }, [dashboardQuery.data]);

  const matchQuery = useQuery({
    queryKey: ['judge-scoreboard-match', activeMatchId],
    queryFn: () => getMatchById(activeMatchId),
    enabled: Boolean(activeMatchId),
    refetchInterval: 3000,
  });

  const match = matchQuery.data;

  useEffect(() => {
    if (!match?.startedAt || match.status !== 'IN_PROGRESS') {
      setTime(BOUT_DURATION_SECONDS);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(match.startedAt as string).getTime()) / 1000);
      setTime(Math.max(BOUT_DURATION_SECONDS - elapsed, 0));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match?.startedAt, match?.status]);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (dashboardQuery.isLoading || matchQuery.isLoading) {
    return <div className="min-h-screen bg-navy-deep p-8 text-sm text-muted-foreground">Loading scoreboard...</div>;
  }

  if (!match || matchQuery.isError) {
    return <div className="min-h-screen bg-navy-deep p-8 text-sm text-muted-foreground">{kz.judge.noActiveMatch}</div>;
  }

  const athleteA = match.slotA?.athleteId?.fullName || match.slotA?.displayNameSnapshot || '—';
  const athleteB = match.slotB?.athleteId?.fullName || match.slotB?.displayNameSnapshot || '—';

  return (
    <div className="min-h-screen bg-navy-deep flex flex-col">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
            <Trophy size={16} className="text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">Judo-Arena</span>
        </div>
        <div className="text-sm text-muted-foreground">{match.categoryKey} · {kz.bracket.round} {match.roundNumber}</div>
        <div className="text-sm text-muted-foreground">{kz.tournament.tatami} №{match.tatamiNumber || '-'}</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-9xl font-mono font-bold text-foreground tracking-wider gold-glow inline-block px-16 py-8 rounded-3xl border-2 border-primary/30">
              {formatTime(time)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="bg-foreground/10 rounded-2xl p-8 border-2 border-foreground/20">
                <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">{kz.judge.white}</p>
                <h2 className="text-3xl font-display font-bold text-foreground mb-6">{athleteA}</h2>
                <div className="text-8xl font-mono font-bold text-foreground">{match.scoreA || 0}</div>
                <div className="flex justify-center gap-6 mt-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.wazaari}</p>
                    <p className="text-xl font-bold text-foreground">{match.scoreA || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.shido}</p>
                    <p className="text-xl font-bold text-warning">{match.penaltiesA || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="bg-info/10 rounded-2xl p-8 border-2 border-info/30">
                <p className="text-sm uppercase tracking-widest text-info mb-2">{kz.judge.blue}</p>
                <h2 className="text-3xl font-display font-bold text-foreground mb-6">{athleteB}</h2>
                <div className="text-8xl font-mono font-bold text-foreground">{match.scoreB || 0}</div>
                <div className="flex justify-center gap-6 mt-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.wazaari}</p>
                    <p className="text-xl font-bold text-foreground">{match.scoreB || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{kz.judge.shido}</p>
                    <p className="text-xl font-bold text-warning">{match.penaltiesB || 0}</p>
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
