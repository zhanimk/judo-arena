/**
 * Olympic-style визуализация турнирной сетки (как на JudoTV).
 * Горизонтальная сетка с белыми карточками + SVG-линии соединения.
 *
 * Поддерживает:
 *  - Single Elimination + Repechage (size 4/8/16/32/64)
 *  - Round-Robin (отрисовывает по турам)
 *  - Live статусы (LIVE / DONE / TBD)
 */

import { Play, Trophy } from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  KZ: "🇰🇿", RU: "🇷🇺", US: "🇺🇸", USA: "🇺🇸", JP: "🇯🇵", FR: "🇫🇷",
  DE: "🇩🇪", IT: "🇮🇹", BR: "🇧🇷", ES: "🇪🇸", UA: "🇺🇦",
};

interface BracketAthlete {
  id: string;
  name: string;
  surname: string;
  clubCity?: string;
  country?: string;
}

interface BracketMatch {
  id: string;
  round: number;
  position: number;
  bracketSection: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
  redAthlete?: BracketAthlete | null;
  blueAthlete?: BracketAthlete | null;
  winnerId?: string | null;
  scoreSnapshot?: any;
}

interface Props {
  matches: BracketMatch[];
  size: number;
  format: "SE_IJF" | "ROUND_ROBIN" | "MIXED";
}

export function OlympicBracket({ matches, size, format }: Props) {
  if (matches.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Тор бос</div>;
  }

  if (format === "ROUND_ROBIN") {
    return <RoundRobinView matches={matches} />;
  }

  return <SingleEliminationView matches={matches} size={size} />;
}

function SingleEliminationView({ matches, size }: { matches: BracketMatch[]; size: number }) {
  const totalRounds = Math.log2(size);

  // Группируем основные раунды
  const mainRounds: BracketMatch[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const inRound = matches
      .filter((m) => (m.bracketSection === "main" || (r === totalRounds && m.bracketSection === "final")) && m.round === r)
      .sort((a, b) => a.position - b.position);
    if (inRound.length > 0) mainRounds.push(inRound);
  }

  // Repechage
  const repechage = matches.filter((m) => m.bracketSection === "repechage").sort((a, b) => a.position - b.position);
  const bronze = matches.filter((m) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2")
    .sort((a, b) => a.bracketSection.localeCompare(b.bracketSection));

  // Финальный победитель для финиш-карточки
  const finalMatch = matches.find((m) => m.bracketSection === "final" && m.status === "COMPLETED");
  const champion = finalMatch?.winnerId
    ? (finalMatch.redAthlete?.id === finalMatch.winnerId ? finalMatch.redAthlete : finalMatch.blueAthlete)
    : null;

  const roundLabels = [
    "1/32", "1/16", "1/8", "1/4", "Жартылай финал", "Финал"
  ].slice(-mainRounds.length);

  return (
    <div className="space-y-8">
      {/* Основная сетка */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max items-stretch">
          {mainRounds.map((roundMatches, idx) => (
            <RoundColumn
              key={idx}
              label={roundLabels[idx] ?? `Раунд ${idx + 1}`}
              matches={roundMatches}
              isFirst={idx === 0}
              isLast={idx === mainRounds.length - 1}
            />
          ))}

          {/* Чемпион */}
          {champion && (
            <div className="flex flex-col justify-center min-w-[240px] pl-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 text-center mb-3">Чемпион</div>
              <div className="relative bg-gradient-gold rounded-xl p-5 text-center shadow-gold border-2 border-gold">
                <Trophy className="h-8 w-8 text-gold-foreground mx-auto mb-2" />
                <div className="font-display text-xl font-bold text-gold-foreground">
                  {champion.name} {champion.surname}
                </div>
                {champion.clubCity && (
                  <div className="text-xs text-gold-foreground/80 mt-1">{champion.clubCity}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Repechage + Bronze */}
      {(repechage.length > 0 || bronze.length > 0) && (
        <div className="border-t border-border/40 pt-6">
          <div className="text-xs uppercase tracking-[0.3em] text-gold mb-4">Жұбату & Қола</div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {repechage.map((m) => (
              <div key={m.id}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Жұбату {m.position + 1}
                </div>
                <MatchCard match={m} />
              </div>
            ))}
            {bronze.map((m) => (
              <div key={m.id}>
                <div className="text-[10px] uppercase tracking-widest text-amber-600 mb-2 inline-flex items-center gap-1">
                  🥉 Қола үшін
                </div>
                <MatchCard match={m} bronze />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundColumn({ label, matches, isFirst, isLast }: {
  label: string; matches: BracketMatch[]; isFirst: boolean; isLast: boolean;
}) {
  const matchHeight = 96; // высота карточки матча
  const gap = isFirst ? 16 : matchHeight * Math.pow(2, 0) * 1.5; // увеличивается экспоненциально

  return (
    <div className="flex flex-col min-w-[240px]" style={{ justifyContent: matches.length === 1 ? "center" : "space-around" }}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80 text-center mb-3">
        {label}
      </div>
      <div className="flex flex-col gap-4 flex-1 justify-around">
        {matches.map((m) => <MatchCard key={m.id} match={m} final={isLast} />)}
      </div>
    </div>
  );
}

function MatchCard({ match, final, bronze }: { match: BracketMatch; final?: boolean; bronze?: boolean }) {
  const red = match.redAthlete;
  const blue = match.blueAthlete;
  const liveBorder = match.status === "IN_PROGRESS";
  const score = match.scoreSnapshot ?? {};

  return (
    <div className={`relative bg-white/95 dark:bg-card rounded-lg overflow-hidden shadow-md border-2 transition-all
      ${liveBorder ? "border-destructive shadow-[0_0_24px_-6px_rgba(220,50,50,0.55)]" :
        final ? "border-gold/60" :
        bronze ? "border-amber-600/60" :
        match.status === "COMPLETED" ? "border-gold/30" : "border-border/60"}
    `}>
      {match.status === "IN_PROGRESS" && (
        <div className="absolute -top-2 left-3 z-10 text-[9px] px-1.5 py-0.5 rounded bg-destructive text-white uppercase tracking-widest animate-pulse">
          Live
        </div>
      )}
      <AthleteRow
        athlete={red}
        score={formatScore(score.red)}
        isWinner={match.winnerId === red?.id}
        side="red"
      />
      <div className="h-px bg-border/40" />
      <AthleteRow
        athlete={blue}
        score={formatScore(score.blue)}
        isWinner={match.winnerId === blue?.id}
        side="blue"
      />
    </div>
  );
}

function AthleteRow({ athlete, score, isWinner, side }: {
  athlete?: BracketAthlete | null; score?: string; isWinner: boolean; side: "red" | "blue";
}) {
  const flag = athlete?.country ? COUNTRY_FLAGS[athlete.country] ?? athlete.country : "";
  const winnerCls = isWinner ? "bg-gold/15 text-gold-foreground dark:text-gold font-bold" : "text-foreground/90";

  return (
    <div className={`flex items-center px-3 py-2.5 gap-2 ${winnerCls}`}>
      {/* Side indicator */}
      <div className={`w-1 h-8 rounded-sm ${side === "red" ? "bg-rose-500/40" : "bg-sky-500/40"}`} />

      {/* Country flag/code */}
      <div className="flex flex-col items-center min-w-[28px]">
        {flag && (
          flag.length <= 3
            ? <span className="text-[9px] uppercase font-mono font-bold tracking-tight">{flag}</span>
            : <span className="text-lg leading-none">{flag}</span>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {athlete ? (
          <div className="text-sm truncate">
            <span className="font-medium">{athlete.name}</span>{" "}
            <span className="font-bold uppercase">{athlete.surname}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">— TBD —</div>
        )}
      </div>

      {/* Score / Play */}
      <div className="ml-2 shrink-0">
        {score ? (
          <span className={`text-xs tabular-nums font-semibold ${isWinner ? "text-gold" : "text-muted-foreground"}`}>
            {score}
          </span>
        ) : athlete && (
          <button className="w-6 h-6 rounded-full bg-gold/20 hover:bg-gold/40 flex items-center justify-center transition-colors">
            <Play className="h-3 w-3 text-gold fill-current" />
          </button>
        )}
      </div>
    </div>
  );
}

function RoundRobinView({ matches }: { matches: BracketMatch[] }) {
  const byRound = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  const rounds = Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-6">
      {rounds.map(([round, ms]) => (
        <div key={round}>
          <div className="text-xs uppercase tracking-[0.3em] text-gold mb-3">{round}-тур</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ms.sort((a, b) => a.position - b.position).map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatScore(s: any): string | undefined {
  if (!s) return undefined;
  if (s.ippon > 0) return "Ippon";
  if (s.wazaari >= 2) return "Waza-ari 2";
  if (s.wazaari > 0) return "Waza-ari";
  if (s.yuko > 0) return "Yuko";
  if (s.shido > 0) return `Shido ${s.shido}`;
  return undefined;
}
