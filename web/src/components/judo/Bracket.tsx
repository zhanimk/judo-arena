import { Play, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

export type Match = {
  id: string;
  a: string;
  b: string;
  countryA?: string;
  countryB?: string;
  flagA?: string;
  flagB?: string;
  scoreA?: string;
  scoreB?: string;
  winner?: "A" | "B";
  status?: "done" | "live" | "next" | "scheduled";
};

export type Round = { title: string; matches: Match[] };

const CARD_W = 272;
const CARD_H = 108;
const ROUND_GAP = 108;
const HEADER_H = 54;
const BASE_GAP = 18;
const PAD = 24;

function roundGap(roundIndex: number) {
  return BASE_GAP + roundIndex * 24 + Math.max(0, roundIndex - 1) * 34;
}

function roundTop(roundIndex: number) {
  return HEADER_H + ((CARD_H + BASE_GAP) * (Math.pow(2, roundIndex) - 1)) / 2;
}

function getLayout(rounds: Round[]) {
  const positions = rounds.map((round, roundIndex) => {
    const gap = roundGap(roundIndex);
    const top = roundTop(roundIndex);
    return round.matches.map((_, matchIndex) => ({
      x: PAD + roundIndex * (CARD_W + ROUND_GAP),
      y: top + matchIndex * (CARD_H + gap),
    }));
  });

  const width = PAD * 2 + rounds.length * CARD_W + Math.max(0, rounds.length - 1) * ROUND_GAP;
  const height = Math.max(
    360,
    ...positions.flatMap((round) => round.map((p) => p.y + CARD_H + PAD)),
  );

  return { positions, width, height };
}

function MatchCard({ match }: { match: Match }) {
  const live = match.status === "live";
  const done = match.status === "done";
  const scheduled = match.status === "scheduled";
  const border = live
    ? "border-destructive/60 shadow-[0_0_30px_-10px_oklch(0.65_0.18_25/0.8)]"
    : done
      ? "border-gold/35"
      : "border-border/60";

  const row = (name: string, country?: string, flag?: string, score?: string, win?: boolean) => (
    <div
      className={`grid grid-cols-[2.7rem_1fr_auto] items-center gap-2 px-3 py-2.5 ${win ? "text-gold" : "text-foreground/85"}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {country ?? "KAZ"}
        </span>
        <span className="text-lg leading-none">{flag ?? "🇰🇿"}</span>
      </div>
      <div className={`min-w-0 text-sm leading-tight ${win ? "font-bold" : "font-medium"}`}>
        <span className="block truncate">{name}</span>
      </div>
      <div
        className={`min-w-8 text-right text-xs font-semibold tabular-nums ${win ? "text-gold" : "text-muted-foreground"}`}
      >
        {score ?? "—"}
      </div>
    </div>
  );

  return (
    <div
      className={`relative h-[108px] overflow-hidden rounded-2xl border bg-card/92 shadow-sm backdrop-blur ${border}`}
    >
      {live && (
        <span className="absolute -top-px left-4 z-10 rounded-b-md bg-red-700 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
          live
        </span>
      )}
      {(live || done) && (
        <span className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-gold">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
      )}
      <div className={scheduled ? "opacity-70" : ""}>
        {row(match.a, match.countryA, match.flagA, match.scoreA, match.winner === "A")}
        <div className="h-px bg-border/55" />
        {row(match.b, match.countryB, match.flagB, match.scoreB, match.winner === "B")}
      </div>
      {live && <div className="absolute inset-y-0 left-0 w-1 bg-destructive" />}
      {done && <div className="absolute inset-y-0 left-0 w-1 bg-gold" />}
    </div>
  );
}

export function Bracket({ rounds, champion }: { rounds: Round[]; champion?: string }) {
  const { t } = useTranslation();
  const { positions, width, height } = getLayout(rounds);
  const championX = PAD + rounds.length * (CARD_W + ROUND_GAP);
  const totalWidth = champion ? width + CARD_W + ROUND_GAP : width;

  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="relative min-w-max rounded-[1.5rem] bg-gradient-to-br from-sky-100/10 via-background to-emerald-100/10"
        style={{ width: totalWidth, height }}
      >
        <svg
          className="pointer-events-none absolute inset-0 z-0"
          width={totalWidth}
          height={height}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bracketLine" x1="0" x2="1">
              <stop offset="0%" stopColor="oklch(0.72 0.14 78 / 0.55)" />
              <stop offset="100%" stopColor="oklch(0.58 0.08 250 / 0.38)" />
            </linearGradient>
          </defs>
          {rounds.slice(0, -1).flatMap((round, roundIndex) =>
            round.matches.map((_, matchIndex) => {
              const from = positions[roundIndex]?.[matchIndex];
              const to = positions[roundIndex + 1]?.[Math.floor(matchIndex / 2)];
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
                  stroke="url(#bracketLine)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }),
          )}
          {champion && rounds.length > 0 && positions.at(-1)?.[0] && (
            <path
              d={`M ${positions.at(-1)![0].x + CARD_W} ${positions.at(-1)![0].y + CARD_H / 2} H ${championX}`}
              fill="none"
              stroke="url(#bracketLine)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>

        {rounds.map((round, roundIndex) => (
          <div
            key={`round-${roundIndex}-${round.title}`}
            className="absolute z-10"
            style={{ left: positions[roundIndex]?.[0]?.x ?? PAD, top: 0, width: CARD_W }}
          >
            <div className="mb-3 flex h-10 items-center justify-center">
              <span className="rounded-full border border-gold/30 bg-background/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-gold backdrop-blur">
                {round.title}
              </span>
            </div>
            {round.matches.map((match, matchIndex) => {
              const pos = positions[roundIndex][matchIndex];
              return (
                <div
                  key={match.id}
                  className="absolute"
                  style={{ left: 0, top: pos.y - HEADER_H, width: CARD_W }}
                >
                  <MatchCard match={match} />
                </div>
              );
            })}
          </div>
        ))}

        {champion && (
          <div
            className="absolute z-10 flex h-[108px] items-center"
            style={{ left: championX, top: positions.at(-1)?.[0]?.y ?? HEADER_H, width: CARD_W }}
          >
            <div className="w-full rounded-2xl border-2 border-gold/60 bg-card/95 p-4 text-center shadow-gold">
              <Trophy className="mx-auto mb-2 h-6 w-6 text-gold" />
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                {t("bracket.champion")}
              </div>
              <div className="mt-1 truncate font-display text-lg font-bold text-gradient-gold">
                {champion}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const sampleRounds: Round[] = [
  {
    title: "1/8 финал",
    matches: [
      {
        id: "m1",
        a: "Ә. Сәрсен",
        b: "Б. Темір",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        scoreA: "Ippon",
        scoreB: "—",
        winner: "A",
        status: "done",
      },
      {
        id: "m2",
        a: "Д. Нұрлан",
        b: "А. Қанат",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        scoreA: "Waza-ari",
        scoreB: "—",
        winner: "A",
        status: "done",
      },
      {
        id: "m3",
        a: "С. Бекзат",
        b: "М. Ержан",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        scoreA: "—",
        scoreB: "Ippon",
        winner: "B",
        status: "done",
      },
      {
        id: "m4",
        a: "Р. Дәурен",
        b: "Т. Олжас",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        scoreA: "Yuko",
        scoreB: "—",
        winner: "A",
        status: "done",
      },
    ],
  },
  {
    title: "Жартылай финал",
    matches: [
      {
        id: "s1",
        a: "Ә. Сәрсен",
        b: "Д. Нұрлан",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        scoreA: "2",
        scoreB: "1",
        status: "live",
      },
      {
        id: "s2",
        a: "М. Ержан",
        b: "Р. Дәурен",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        scoreA: "—",
        scoreB: "—",
        status: "next",
      },
    ],
  },
  {
    title: "Финал",
    matches: [
      {
        id: "f1",
        a: "Жеңімпаз S1",
        b: "Жеңімпаз S2",
        countryA: "KAZ",
        countryB: "KAZ",
        flagA: "🇰🇿",
        flagB: "🇰🇿",
        status: "scheduled",
      },
    ],
  },
];
