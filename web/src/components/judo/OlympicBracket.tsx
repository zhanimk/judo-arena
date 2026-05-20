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

const CARD_W = 260;
const CARD_H = 98;
const ROUND_GAP = 96;
const HEADER_H = 54;
const BASE_GAP = 26;
const PAD = 20;

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
  const layout = getMainBracketLayout(mainRounds);
  const championX = PAD + mainRounds.length * (CARD_W + ROUND_GAP);
  const totalWidth = champion ? layout.width + CARD_W + ROUND_GAP : layout.width;
  const lineColor = "url(#olympicBracketLine)";

  return (
    <div className="space-y-8">
      {/* Основная сетка */}
      <div className="overflow-x-auto pb-4">
        <div
          className="relative min-w-max rounded-2xl bg-gradient-to-br from-gold/5 via-background to-sky-100/10"
          style={{ width: totalWidth, height: layout.height }}
        >
          <svg className="pointer-events-none absolute inset-0 z-0" width={totalWidth} height={layout.height} aria-hidden="true">
            <defs>
              <linearGradient id="olympicBracketLine" x1="0" x2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.13 78 / 0.58)" />
                <stop offset="100%" stopColor="oklch(0.55 0.07 250 / 0.42)" />
              </linearGradient>
            </defs>
            {mainRounds.slice(0, -1).flatMap((roundMatches, roundIndex) =>
              roundMatches.map((_, matchIndex) => {
                const from = layout.positions[roundIndex]?.[matchIndex];
                const to = layout.positions[roundIndex + 1]?.[Math.floor(matchIndex / 2)];
                if (!from || !to) return null;

                const x1 = from.x + CARD_W;
                const y1 = from.y + CARD_H / 2;
                const x2 = to.x;
                const y2 = to.y + CARD_H / 2;
                const mid = x1 + ROUND_GAP / 2;

                return (
                  <path
                    key={`${roundIndex}-${matchIndex}`}
                    d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="2"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            )}
            {champion && layout.positions.at(-1)?.[0] && (
              <path
                d={`M ${layout.positions.at(-1)![0].x + CARD_W} ${layout.positions.at(-1)![0].y + CARD_H / 2} H ${championX}`}
                fill="none"
                stroke={lineColor}
                strokeWidth="2"
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {mainRounds.map((roundMatches, roundIndex) => (
            <div
              key={roundLabels[roundIndex] ?? roundIndex}
              className="absolute z-10"
              style={{ left: layout.positions[roundIndex]?.[0]?.x ?? PAD, top: 0, width: CARD_W }}
            >
              <div className="mb-3 flex h-10 items-center justify-center">
                <span className="rounded-full border border-gold/30 bg-background/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-gold shadow-sm backdrop-blur">
                  {roundLabels[roundIndex] ?? `Раунд ${roundIndex + 1}`}
                </span>
              </div>
              {roundMatches.map((match, matchIndex) => {
                const position = layout.positions[roundIndex]![matchIndex]!;
                return (
                  <div
                    key={match.id}
                    className="absolute"
                    style={{ left: 0, top: position.y - HEADER_H, width: CARD_W, height: CARD_H }}
                  >
                    <MatchCard match={match} final={roundIndex === mainRounds.length - 1} />
                  </div>
                );
              })}
            </div>
          ))}

          {champion && (
            <div
              className="absolute z-10 flex items-center"
              style={{ left: championX, top: layout.positions.at(-1)?.[0]?.y ?? HEADER_H, width: CARD_W, height: CARD_H }}
            >
              <div className="w-full rounded-lg border-2 border-gold/70 bg-gradient-gold p-4 text-center shadow-gold">
                <Trophy className="mx-auto mb-1.5 h-6 w-6 text-gold-foreground" />
                <div className="font-display text-lg font-bold text-gold-foreground">
                  {champion.name} {champion.surname}
                </div>
                {champion.clubCity && (
                  <div className="mt-1 text-xs text-gold-foreground/80">{champion.clubCity}</div>
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

function getMainBracketLayout(rounds: BracketMatch[][]) {
  const positions = rounds.map((roundMatches, roundIndex) => {
    const top = HEADER_H + ((CARD_H + BASE_GAP) * (Math.pow(2, roundIndex) - 1)) / 2;
    const gap = (CARD_H + BASE_GAP) * Math.pow(2, roundIndex) - CARD_H;

    return roundMatches.map((_, matchIndex) => ({
      x: PAD + roundIndex * (CARD_W + ROUND_GAP),
      y: top + matchIndex * (CARD_H + gap),
    }));
  });

  const width = PAD * 2 + rounds.length * CARD_W + Math.max(0, rounds.length - 1) * ROUND_GAP;
  const height = Math.max(
    360,
    ...positions.flatMap((round) => round.map((position) => position.y + CARD_H + PAD)),
  );

  return { positions, width, height };
}

function MatchCard({ match, final, bronze }: { match: BracketMatch; final?: boolean; bronze?: boolean }) {
  const red = match.redAthlete;
  const blue = match.blueAthlete;
  const liveBorder = match.status === "IN_PROGRESS";
  const score = match.scoreSnapshot ?? {};

  return (
    <div className={`relative h-full bg-white/95 dark:bg-card rounded-lg overflow-hidden shadow-md border-2 transition-all
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
