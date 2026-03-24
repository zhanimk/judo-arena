import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { getMyDashboard } from '@/api/dashboard';
import {
  finishMatch,
  getMatchById,
  startMatch,
  updateMatchPenalties,
  updateMatchScore,
} from '@/api/matches';

const JudgeMatchControl: React.FC = () => {
  const queryClient = useQueryClient();
  const boutDuration = 300;
  const [time, setTime] = useState(boutDuration);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: getMyDashboard,
  });

  const activeMatchId = dashboardQuery.data?.role === 'JUDGE' ? dashboardQuery.data.queue?.[0]?._id || '' : '';

  const matchQuery = useQuery({
    queryKey: ['judge-match', activeMatchId],
    queryFn: () => getMatchById(activeMatchId),
    enabled: Boolean(activeMatchId),
    refetchInterval: 4000,
  });

  const startMutation = useMutation({
    mutationFn: startMatch,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['judge-match', activeMatchId] });
      setRunning(true);
    },
  });

  const finishMutation = useMutation({
    mutationFn: ({ matchId, winnerSlot }: { matchId: string; winnerSlot: 'A' | 'B' }) =>
      finishMatch(matchId, {
        winnerSlot,
        scoreA: matchQuery.data?.scoreA || 0,
        scoreB: matchQuery.data?.scoreB || 0,
        penaltiesA: matchQuery.data?.penaltiesA || 0,
        penaltiesB: matchQuery.data?.penaltiesB || 0,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['judge-match', activeMatchId] });
      await queryClient.invalidateQueries({ queryKey: ['my-dashboard'] });
      setRunning(false);
      setTime(boutDuration);
    },
  });

  useEffect(() => {
    if (running && time > 0) {
      intervalRef.current = setInterval(() => setTime((t) => t - 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [running, time]);

  const match = matchQuery.data;

  const scoreA = match?.scoreA || 0;
  const scoreB = match?.scoreB || 0;
  const penaltiesA = match?.penaltiesA || 0;
  const penaltiesB = match?.penaltiesB || 0;

  const athleteA = match?.slotA?.athleteId?.fullName || match?.slotA?.displayNameSnapshot || '—';
  const athleteB = match?.slotB?.athleteId?.fullName || match?.slotB?.displayNameSnapshot || '—';

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const addWazaari = (athlete: 'A' | 'B') => {
    if (!match?._id) return;

    updateMatchScore(match._id, {
      scoreA: athlete === 'A' ? scoreA + 1 : scoreA,
      scoreB: athlete === 'B' ? scoreB + 1 : scoreB,
    }).then(() => queryClient.invalidateQueries({ queryKey: ['judge-match', activeMatchId] }));
  };

  const addShido = (athlete: 'A' | 'B') => {
    if (!match?._id) return;

    updateMatchPenalties(match._id, {
      penaltiesA: athlete === 'A' ? penaltiesA + 1 : penaltiesA,
      penaltiesB: athlete === 'B' ? penaltiesB + 1 : penaltiesB,
    }).then(() => queryClient.invalidateQueries({ queryKey: ['judge-match', activeMatchId] }));
  };

  if (dashboardQuery.isLoading || matchQuery.isLoading) {
    return <AppLayout title={kz.judge.matchControl}><div className="text-sm text-muted-foreground">Loading match control...</div></AppLayout>;
  }

  if (!match || matchQuery.isError) {
    return <AppLayout title={kz.judge.matchControl}><div className="text-sm text-muted-foreground">{kz.judge.noActiveMatch}</div></AppLayout>;
  }

  return (
    <AppLayout title={kz.judge.matchControl}>
      <div className="space-y-4 animate-slide-in max-w-5xl mx-auto">
        <div className="text-center mb-2">
          <p className="text-xs text-muted-foreground">{match.categoryKey} · {kz.bracket.round} {match.roundNumber} · {kz.tournament.tatami} №{match.tatamiNumber || '-'}</p>
        </div>

        <div className="text-center">
          <div className={`inline-block px-12 py-6 rounded-2xl border-2 ${running ? 'border-success gold-glow' : 'border-border'} bg-navy-deep`}>
            <p className="text-7xl font-mono font-bold text-foreground tracking-wider">{formatTime(time)}</p>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            variant={running ? 'destructive' : 'success'}
            size="lg"
            className="min-w-32 text-lg font-bold"
            onClick={() => {
              if (!running && match._id) {
                startMutation.mutate(match._id);
              } else {
                setRunning(false);
              }
            }}
          >
            {running ? kz.judge.matte : kz.judge.hajime}
          </Button>

          <Button
            variant="navy"
            size="lg"
            onClick={() => {
              setTime(boutDuration);
              setRunning(false);
            }}
          >
            {kz.judge.reset}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card-premium p-5 border-l-4 border-foreground">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{kz.judge.white}</p>
                <h3 className="text-lg font-display font-bold text-foreground">{athleteA}</h3>
              </div>
              <div className="text-3xl font-mono font-bold text-foreground">{scoreA}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="navy" className="font-bold text-base py-6" onClick={() => addWazaari('A')}>{kz.judge.wazaari}</Button>
              <Button variant="destructive" className="font-bold" onClick={() => addShido('A')}>{kz.judge.shido} ({penaltiesA})</Button>
            </div>
          </div>

          <div className="card-premium p-5 border-l-4 border-info">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-info uppercase tracking-wider">{kz.judge.blue}</p>
                <h3 className="text-lg font-display font-bold text-foreground">{athleteB}</h3>
              </div>
              <div className="text-3xl font-mono font-bold text-foreground">{scoreB}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="navy" className="font-bold text-base py-6" onClick={() => addWazaari('B')}>{kz.judge.wazaari}</Button>
              <Button variant="destructive" className="font-bold" onClick={() => addShido('B')}>{kz.judge.shido} ({penaltiesB})</Button>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button variant="destructive" size="lg" className="font-bold" onClick={() => finishMutation.mutate({ matchId: match._id, winnerSlot: 'A' })}>A Wins</Button>
          <Button variant="gold" size="lg" className="font-bold" onClick={() => finishMutation.mutate({ matchId: match._id, winnerSlot: 'B' })}>{kz.judge.confirmResult}</Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default JudgeMatchControl;
