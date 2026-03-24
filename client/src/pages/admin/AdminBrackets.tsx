import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { SectionTitle } from '@/components/ui-premium';
import { kz } from '@/lib/kz';
import { getTournaments } from '@/api/tournaments';
import { getMatchesByTournament } from '@/api/matches';
import { Trophy } from 'lucide-react';

interface BracketMatchProps {
  athlete1: string;
  athlete2: string;
  status: string;
}

const BracketMatch: React.FC<BracketMatchProps> = ({ athlete1, athlete2, status }) => (
  <div className={`w-56 rounded-lg border overflow-hidden ${status === 'IN_PROGRESS' ? 'border-success/50 gold-glow' : 'border-border'}`}>
    <div className="px-3 py-2 flex items-center justify-between text-sm bg-navy-light text-foreground">
      <span className="truncate">{athlete1 || kz.bracket.bye}</span>
    </div>
    <div className="h-px bg-border" />
    <div className="px-3 py-2 flex items-center justify-between text-sm bg-navy-light text-foreground">
      <span className="truncate">{athlete2 || kz.bracket.bye}</span>
    </div>
    {status === 'IN_PROGRESS' && (
      <div className="bg-success/10 px-3 py-1 text-center">
        <span className="text-[10px] text-success font-medium uppercase tracking-wider">{kz.status.live}</span>
      </div>
    )}
  </div>
);

const AdminBrackets: React.FC = () => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');

  const tournamentsQuery = useQuery({
    queryKey: ['tournaments'],
    queryFn: getTournaments,
  });

  const activeTournamentId = selectedTournamentId || tournamentsQuery.data?.[0]?._id || '';

  const matchesQuery = useQuery({
    queryKey: ['matches', 'tournament', activeTournamentId],
    queryFn: () => getMatchesByTournament(activeTournamentId),
    enabled: Boolean(activeTournamentId),
  });

  const rounds = useMemo(() => {
    const matches = matchesQuery.data || [];
    const grouped = new Map<number, typeof matches>();

    matches.forEach((match) => {
      if (!grouped.has(match.roundNumber)) {
        grouped.set(match.roundNumber, []);
      }
      grouped.get(match.roundNumber)?.push(match);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([roundNumber, roundMatches]) => ({
        title: `${kz.bracket.round} ${roundNumber}`,
        matches: roundMatches,
      }));
  }, [matchesQuery.data]);

  return (
    <AppLayout title={kz.bracket.title}>
      <div className="space-y-6 animate-slide-in">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>{kz.bracket.title}</SectionTitle>
          <select
            value={activeTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            className="px-3 py-2 rounded-md bg-navy-surface border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {(tournamentsQuery.data || []).map((t) => (
              <option key={t._id} value={t._id}>{t.title}</option>
            ))}
          </select>
        </div>

        {matchesQuery.isLoading && <div className="text-sm text-muted-foreground">Loading bracket...</div>}
        {matchesQuery.isError && <div className="text-sm text-destructive">Failed to load bracket matches.</div>}

        {!matchesQuery.isLoading && !matchesQuery.isError && (
          <div className="card-premium p-6 overflow-x-auto">
            <div className="flex items-start gap-8 min-w-[800px]">
              {rounds.map((round, ri) => (
                <div key={round.title} className="flex flex-col items-center">
                  <h4 className="text-xs font-medium text-primary uppercase tracking-wider mb-4">{round.title}</h4>
                  <div className="flex flex-col gap-6" style={{ paddingTop: `${ri * 40}px` }}>
                    {round.matches.map((m) => (
                      <div key={m._id} className="relative">
                        <BracketMatch
                          athlete1={m.slotA?.displayNameSnapshot || ''}
                          athlete2={m.slotB?.displayNameSnapshot || ''}
                          status={m.status}
                        />
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
                  <p className="text-sm font-medium text-primary">{kz.status.pending}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminBrackets;
