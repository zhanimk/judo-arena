/**
 * IJF-style tournament bracket visualization.
 *
 * For SE brackets with size ≥ 8: Pool A/B/C/D tabs + Finals section (IJF format).
 * For size ≤ 4 and Round Robin: flat / per-round view.
 */

import { memo, useState } from "react";
import { Play, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { mediaUrl } from "@/lib/api";

const COUNTRY_FLAGS: Record<string, string> = {
  KZ: "🇰🇿",
  RU: "🇷🇺",
  US: "🇺🇸",
  USA: "🇺🇸",
  JP: "🇯🇵",
  FR: "🇫🇷",
  DE: "🇩🇪",
  IT: "🇮🇹",
  BR: "🇧🇷",
  ES: "🇪🇸",
  UA: "🇺🇦",
};

interface BracketAthlete {
  id: string;
  name: string;
  surname: string;
  clubCity?: string;
  country?: string;
  avatarUrl?: string | null;
  club?: { country?: string | null } | null;
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

const CARD_W = 200;
const CARD_H = 68;
const ROUND_GAP = 56;
const HEADER_H = 44;
const BASE_GAP = 14;
const PAD = 14;

/* ─── Main export ─────────────────────────────────────────────────────────── */

function OlympicBracketInner({ matches, size, format }: Props) {
  if (matches.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Тор бос</div>;
  }

  if (format === "ROUND_ROBIN") return <RoundRobinView matches={matches} />;
  if (format === "MIXED") return <MixedView matches={matches} size={size} />;

  const totalRounds = Math.round(Math.log2(Math.max(size, 2)));
  const quartersRound = totalRounds - 2; // round where Pool Final (QF) is played

  if (quartersRound < 1) {
    return <FlatSEView matches={matches} size={size} />;
  }

  return (
    <PooledSEView
      matches={matches}
      size={size}
      totalRounds={totalRounds}
      quartersRound={quartersRound}
    />
  );
}

/** Memoised — re-renders only when matches/size/format props change. */
export const OlympicBracket = memo(OlympicBracketInner);

/* ─── Pool bracket view (size ≥ 8, IJF format) ───────────────────────────── */

const POOL_LABELS = ["A", "B", "C", "D"] as const;

/** Which pool (0=A…3=D) does a match in this round/position belong to? */
function matchPoolIndex(position: number, round: number, size: number): number {
  const matchesInRound = size / Math.pow(2, round);
  return Math.min(3, Math.floor((position * 4) / matchesInRound));
}

/** Label for a pool round column, given steps remaining to the Pool Final. */
function poolRoundLabel(stepsToQF: number): string {
  const MAP: Record<number, string> = {
    0: "Pool Final",
    1: "1/8",
    2: "1/16",
    3: "1/32",
    4: "1/64",
    5: "1/128",
  };
  return MAP[stepsToQF] ?? `R${stepsToQF}`;
}

function PooledSEView({
  matches,
  size,
  totalRounds,
  quartersRound,
}: {
  matches: BracketMatch[];
  size: number;
  totalRounds: number;
  quartersRound: number;
}) {
  const [activePool, setActivePool] = useState(0);

  const semisRound = totalRounds - 1;

  const poolMatchesAll = matches.filter(
    (m) => m.bracketSection === "main" && m.round <= quartersRound,
  );
  const finalsMatches = matches.filter(
    (m) => (m.bracketSection === "main" || m.bracketSection === "final") && m.round >= semisRound,
  );
  const repechage = matches
    .filter((m) => m.bracketSection === "repechage")
    .sort((a, b) => a.position - b.position);
  const bronze = matches
    .filter((m) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2")
    .sort((a, b) => a.bracketSection.localeCompare(b.bracketSection));

  // Build round arrays for the active pool
  const poolRounds: BracketMatch[][] = [];
  for (let r = 1; r <= quartersRound; r++) {
    const row = poolMatchesAll
      .filter((m) => m.round === r && matchPoolIndex(m.position, r, size) === activePool)
      .sort((a, b) => a.position - b.position);
    poolRounds.push(row);
  }

  const layout = getMainBracketLayout(poolRounds);

  return (
    <div className="space-y-8">
      {/* Pool tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mr-1">
          Pool
        </span>
        {POOL_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setActivePool(i)}
            className={[
              "px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all",
              activePool === i
                ? "bg-gold/90 text-gold-foreground border-gold shadow-md shadow-gold/30"
                : "border-border/50 text-muted-foreground hover:border-gold/40 hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pool bracket */}
      <div className="overflow-x-auto pb-4">
        <div
          className="relative min-w-max rounded-2xl bg-gradient-to-br from-gold/5 via-background to-sky-100/10"
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={layout.width}
            height={layout.height}
            aria-hidden
            focusable="false"
          >
            <defs>
              <linearGradient id="poolLine" x1="0" x2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.13 78 / 0.55)" />
                <stop offset="100%" stopColor="oklch(0.55 0.07 250 / 0.38)" />
              </linearGradient>
            </defs>
            {poolRounds.slice(0, -1).flatMap((roundMatches, ri) =>
              roundMatches.map((_, mi) => {
                const from = layout.positions[ri]?.[mi];
                const to = layout.positions[ri + 1]?.[Math.floor(mi / 2)];
                if (!from || !to) return null;
                const x1 = from.x + CARD_W;
                const y1 = from.y + CARD_H / 2;
                const x2 = to.x;
                const y2 = to.y + CARD_H / 2;
                const mid = x1 + ROUND_GAP / 2;
                return (
                  <path
                    key={`${ri}-${mi}`}
                    d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                    fill="none"
                    stroke="url(#poolLine)"
                    strokeWidth="2"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            )}
          </svg>

          {poolRounds.map((roundMatches, ri) => {
            const label = poolRoundLabel(quartersRound - (ri + 1));
            return (
              <div
                key={`pool-r${ri}`}
                className="absolute z-10"
                style={{
                  left: layout.positions[ri]?.[0]?.x ?? PAD,
                  top: 0,
                  width: CARD_W,
                }}
              >
                <div className="mb-2 flex h-8 items-center justify-center">
                  <span className="rounded-full border border-gold/30 bg-background/90 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold shadow-sm backdrop-blur">
                    {label}
                  </span>
                </div>
                {roundMatches.map((match, mi) => {
                  const pos = layout.positions[ri]?.[mi];
                  if (!pos) return null;
                  const isEmpty = !match.redAthleteId && !match.blueAthleteId;
                  const isBye = match.scoreSnapshot?.bye === true;
                  return (
                    <div
                      key={match.id}
                      className="absolute"
                      style={{
                        left: 0,
                        top: pos.y - HEADER_H,
                        width: CARD_W,
                        height: CARD_H,
                      }}
                    >
                      <MatchCard
                        match={match}
                        dim={isEmpty}
                        bye={isBye}
                        final={ri === poolRounds.length - 1}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Finals + Repechage + Bronze */}
      <FinalsSection
        matches={finalsMatches}
        repechage={repechage}
        bronze={bronze}
        totalRounds={totalRounds}
        semisRound={semisRound}
      />
    </div>
  );
}

/* ─── Finals section ─────────────────────────────────────────────────────── */

function FinalsSection({
  matches,
  repechage,
  bronze,
  totalRounds,
  semisRound,
}: {
  matches: BracketMatch[];
  repechage: BracketMatch[];
  bronze: BracketMatch[];
  totalRounds: number;
  semisRound: number;
}) {
  const { t } = useTranslation();
  const semis = matches
    .filter((m) => m.round === semisRound && m.bracketSection === "main")
    .sort((a, b) => a.position - b.position);

  const finalMatch =
    matches.find((m) => m.bracketSection === "final") ??
    matches.find((m) => m.round === totalRounds);

  const champion =
    finalMatch?.status === "COMPLETED" && finalMatch.winnerId
      ? finalMatch.redAthlete?.id === finalMatch.winnerId
        ? finalMatch.redAthlete
        : finalMatch.blueAthlete
      : null;

  const hasContent = semis.length > 0 || !!finalMatch || repechage.length > 0 || bronze.length > 0;

  if (!hasContent) return null;

  return (
    <div className="border-t border-border/40 pt-6 space-y-6">
      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gold/20" />
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          {t("bracket.finals_title")}
        </span>
        <div className="h-px flex-1 bg-gold/20" />
      </div>

      {/* Semi-finals */}
      {semis.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            {t("bracket.semifinal")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {semis.map((m, i) => (
              <div key={m.id}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Semi {i + 1}
                </div>
                <MatchCard match={m} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final + Champion */}
      {finalMatch && (
        <div className="max-w-xs mx-auto">
          <div className="text-[10px] uppercase tracking-widest text-gold mb-1.5 text-center font-semibold">
            {t("bracket.final")}
          </div>
          <MatchCard match={finalMatch} final />
          {champion && (
            <div className="mt-3 rounded-lg border-2 border-gold/70 bg-gradient-gold p-3 text-center shadow-gold">
              <Trophy className="mx-auto mb-1 h-5 w-5 text-gold-foreground" />
              <div className="font-display text-sm font-bold text-gold-foreground">
                {champion.name} {champion.surname}
              </div>
              {champion.clubCity && (
                <div className="text-[10px] text-gold-foreground/80">{champion.clubCity}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Repechage + Bronze */}
      {(repechage.length > 0 || bronze.length > 0) && (
        <div className="border-t border-border/30 pt-5 space-y-5">
          {repechage.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
                {t("bracket.repechage")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {repechage.map((m) => (
                  <div key={m.id}>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                      {t("bracket.repechage_n", { n: m.position + 1 })}
                    </div>
                    <MatchCard match={m} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {bronze.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-amber-600 mb-3">
                {t("bracket.bronze_matches")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {bronze.map((m, i) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-amber-600/20 bg-amber-600/5 p-3"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-amber-600 mb-1.5 font-semibold">
                      Қола {bronze.length > 1 ? i + 1 : ""}
                    </div>
                    <MatchCard match={m} bronze />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Flat SE view (size ≤ 4) ────────────────────────────────────────────── */

function FlatSEView({ matches, size }: { matches: BracketMatch[]; size: number }) {
  const { t } = useTranslation();
  const totalRounds = Math.round(Math.log2(Math.max(size, 2)));

  const mainRounds: BracketMatch[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const inRound = matches
      .filter(
        (m) =>
          (m.bracketSection === "main" || (r === totalRounds && m.bracketSection === "final")) &&
          m.round === r,
      )
      .sort((a, b) => a.position - b.position);
    if (inRound.length > 0) mainRounds.push(inRound);
  }

  const repechage = matches
    .filter((m) => m.bracketSection === "repechage")
    .sort((a, b) => a.position - b.position);
  const bronze = matches
    .filter((m) => m.bracketSection === "bronze1" || m.bracketSection === "bronze2")
    .sort((a, b) => a.bracketSection.localeCompare(b.bracketSection));

  const finalMatch = matches.find((m) => m.bracketSection === "final" && m.status === "COMPLETED");
  const champion = finalMatch?.winnerId
    ? finalMatch.redAthlete?.id === finalMatch.winnerId
      ? finalMatch.redAthlete
      : finalMatch.blueAthlete
    : null;

  const labels = ["1/32", "1/16", "1/8", "1/4", t("bracket.semifinal"), t("bracket.final")].slice(
    -mainRounds.length,
  );
  const layout = getMainBracketLayout(mainRounds);
  const championX = PAD + mainRounds.length * (CARD_W + ROUND_GAP);
  const totalWidth = champion ? layout.width + CARD_W + ROUND_GAP : layout.width;

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto pb-4">
        <div
          className="relative min-w-max rounded-2xl bg-gradient-to-br from-gold/5 via-background to-sky-100/10"
          style={{ width: totalWidth, height: layout.height }}
        >
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={totalWidth}
            height={layout.height}
            aria-hidden
          >
            <defs>
              <linearGradient id="flatLine" x1="0" x2="1">
                <stop offset="0%" stopColor="oklch(0.72 0.13 78 / 0.58)" />
                <stop offset="100%" stopColor="oklch(0.55 0.07 250 / 0.42)" />
              </linearGradient>
            </defs>
            {mainRounds.slice(0, -1).flatMap((roundMatches, ri) =>
              roundMatches.map((_, mi) => {
                const from = layout.positions[ri]?.[mi];
                const to = layout.positions[ri + 1]?.[Math.floor(mi / 2)];
                if (!from || !to) return null;
                const x1 = from.x + CARD_W;
                const y1 = from.y + CARD_H / 2;
                const x2 = to.x;
                const y2 = to.y + CARD_H / 2;
                const mid = x1 + ROUND_GAP / 2;
                return (
                  <path
                    key={`${ri}-${mi}`}
                    d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                    fill="none"
                    stroke="url(#flatLine)"
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
                stroke="url(#flatLine)"
                strokeWidth="2"
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {mainRounds.map((roundMatches, ri) => (
            <div
              key={labels[ri] ?? ri}
              className="absolute z-10"
              style={{
                left: layout.positions[ri]?.[0]?.x ?? PAD,
                top: 0,
                width: CARD_W,
              }}
            >
              <div className="mb-2 flex h-8 items-center justify-center">
                <span className="rounded-full border border-gold/30 bg-background/90 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold shadow-sm backdrop-blur">
                  {labels[ri] ?? `Раунд ${ri + 1}`}
                </span>
              </div>
              {roundMatches.map((match, mi) => {
                const pos = layout.positions[ri]![mi]!;
                return (
                  <div
                    key={match.id}
                    className="absolute"
                    style={{
                      left: 0,
                      top: pos.y - HEADER_H,
                      width: CARD_W,
                      height: CARD_H,
                    }}
                  >
                    <MatchCard match={match} final={ri === mainRounds.length - 1} />
                  </div>
                );
              })}
            </div>
          ))}

          {champion && (
            <div
              className="absolute z-10 flex items-center"
              style={{
                left: championX,
                top: layout.positions.at(-1)?.[0]?.y ?? HEADER_H,
                width: CARD_W,
                height: CARD_H,
              }}
            >
              <div className="w-full rounded-lg border-2 border-gold/70 bg-gradient-gold p-3 text-center shadow-gold">
                <Trophy className="mx-auto mb-1 h-5 w-5 text-gold-foreground" />
                <div className="font-display text-sm font-bold text-gold-foreground">
                  {champion.name} {champion.surname}
                </div>
                {champion.clubCity && (
                  <div className="text-[10px] text-gold-foreground/80">{champion.clubCity}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {(repechage.length > 0 || bronze.length > 0) && (
        <div className="border-t border-border/40 pt-6">
          {repechage.length > 0 && (
            <div className="mb-5">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
                {t("bracket.repechage")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {repechage.map((m) => (
                  <div key={m.id}>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                      {t("bracket.repechage_n", { n: m.position + 1 })}
                    </div>
                    <MatchCard match={m} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {bronze.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-amber-600 mb-3">
                {t("bracket.bronze_matches")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {bronze.map((m, i) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-amber-600/20 bg-amber-600/5 p-3"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-amber-600 mb-1.5 font-semibold">
                      Қола {bronze.length > 1 ? i + 1 : ""}
                    </div>
                    <MatchCard match={m} bronze />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Layout helper ──────────────────────────────────────────────────────── */

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
    ...positions.flatMap((round) => round.map((pos) => pos.y + CARD_H + PAD)),
  );

  return { positions, width, height };
}

/* ─── Match card ─────────────────────────────────────────────────────────── */

function MatchCard({
  match,
  final,
  bronze,
  dim,
  bye,
}: {
  match: BracketMatch;
  final?: boolean;
  bronze?: boolean;
  dim?: boolean;
  bye?: boolean;
}) {
  if (dim) {
    return (
      <div className="relative h-full rounded-lg overflow-hidden border border-border/15 bg-background/20 opacity-25 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground/40 italic">—</span>
      </div>
    );
  }

  const red = match.redAthlete;
  const blue = match.blueAthlete;
  const live = match.status === "IN_PROGRESS";
  const done = match.status === "COMPLETED";
  const score = match.scoreSnapshot ?? {};

  return (
    <div
      className={`relative h-full rounded-lg overflow-hidden shadow-sm border transition-all
        ${
          live
            ? "border-destructive shadow-[0_0_18px_-4px_rgba(220,50,50,0.5)]"
            : final
              ? "border-gold/50"
              : bronze
                ? "border-amber-600/50"
                : done
                  ? "border-gold/20"
                  : "border-border/50"
        }
        bg-white/96 dark:bg-card
      `}
    >
      {live && (
        <div className="absolute right-1.5 top-1 z-10 animate-pulse rounded bg-destructive px-1 py-px text-[8px] font-bold uppercase tracking-widest text-white">
          LIVE
        </div>
      )}
      {bye && done && (
        <div className="absolute right-1.5 bottom-1 z-10 rounded bg-muted/80 px-1 py-px text-[8px] uppercase tracking-widest text-muted-foreground">
          BYE
        </div>
      )}
      <AthleteRow
        athlete={red}
        score={formatScore(score.red)}
        isWinner={done && match.winnerId === red?.id}
        isLoser={done && !!match.winnerId && match.winnerId !== red?.id}
        side="red"
      />
      <div className="h-px bg-border/30" />
      <AthleteRow
        athlete={blue}
        score={formatScore(score.blue)}
        isWinner={done && match.winnerId === blue?.id}
        isLoser={done && !!match.winnerId && match.winnerId !== blue?.id}
        side="blue"
      />
    </div>
  );
}

/* ─── Athlete row ────────────────────────────────────────────────────────── */

function AthleteRow({
  athlete,
  score,
  isWinner,
  isLoser,
  side,
}: {
  athlete?: BracketAthlete | null;
  score?: string;
  isWinner: boolean;
  isLoser: boolean;
  side: "red" | "blue";
}) {
  const flag = athlete ? athleteFlag(athlete) : "";
  const avatar = athlete?.avatarUrl ? mediaUrl(athlete.avatarUrl) : "";

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors
        ${isWinner ? "bg-gold/12 font-semibold" : isLoser ? "opacity-45" : ""}
      `}
    >
      <div
        className={`w-0.5 h-5 rounded-full shrink-0 ${
          side === "red" ? "bg-rose-400" : "bg-sky-400"
        }`}
      />
      {athlete && (
        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
              {athlete.name?.[0] ?? "?"}
              {athlete.surname?.[0] ?? ""}
            </span>
          )}
          {flag && (
            <span className="absolute -bottom-0.5 -right-0.5 text-[8px] leading-none">{flag}</span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 truncate">
        {athlete ? (
          <>
            <span>{athlete.name} </span>
            <span className="font-bold uppercase tracking-tight">{athlete.surname}</span>
          </>
        ) : (
          <span className="italic text-muted-foreground/60">TBD</span>
        )}
      </div>
      <div className="shrink-0 ml-1">
        {score ? (
          <span
            className={`tabular-nums font-semibold ${
              isWinner ? "text-gold" : "text-muted-foreground/70"
            }`}
          >
            {score}
          </span>
        ) : athlete && !isLoser ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/15">
            <Play className="h-2.5 w-2.5 fill-gold text-gold" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function athleteFlag(athlete: BracketAthlete): string {
  const code = (athlete.country ?? athlete.club?.country ?? "KZ").toUpperCase();
  return COUNTRY_FLAGS[code] ?? COUNTRY_FLAGS.KZ;
}

/* ─── MIXED view: Group stage tabs + Playoff SE ──────────────────────────── */

function MixedView({ matches, size }: { matches: BracketMatch[]; size: number }) {
  const { t } = useTranslation();
  // Separate group matches from playoff matches
  const groupSections = Array.from(
    new Set(matches.map((m) => m.bracketSection).filter((s) => s?.startsWith("group_"))),
  ).sort() as string[];

  const playoffMatches = matches.filter((m) => m.bracketSection === "playoff");

  const [activeTab, setActiveTab] = useState<string>(groupSections[0] ?? "playoff");

  const groupLabel = (s: string) => `${t("bracket.group")} ${s.replace("group_", "")}`; // "group_A" → "Group A"

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
        {groupSections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveTab(section)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === section
                ? "bg-background border border-b-background border-border -mb-px text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {groupLabel(section)}
          </button>
        ))}
        <button
          onClick={() => setActiveTab("playoff")}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
            activeTab === "playoff"
              ? "bg-background border border-b-background border-border -mb-px text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🏆 Плей-офф
        </button>
      </div>

      {/* Group tab content */}
      {activeTab !== "playoff" && (
        <MixedGroupTab
          matches={matches.filter((m) => m.bracketSection === activeTab)}
          groupLabel={activeTab.replace("group_", "")}
        />
      )}

      {/* Playoff tab */}
      {activeTab === "playoff" && (
        <div>
          {playoffMatches.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Плей-офф барлық топ матчтары аяқталғаннан кейін басталады
            </p>
          ) : (
            <FlatSEView matches={playoffMatches} size={size} />
          )}
        </div>
      )}
    </div>
  );
}

function MixedGroupTab({ matches, groupLabel }: { matches: BracketMatch[]; groupLabel: string }) {
  const { t } = useTranslation();
  // Collect unique athletes in this group
  const athleteMap = new Map<string, BracketAthlete>();
  for (const m of matches) {
    if (m.redAthleteId && m.redAthlete) athleteMap.set(m.redAthleteId, m.redAthlete);
    if (m.blueAthleteId && m.blueAthlete) athleteMap.set(m.blueAthleteId, m.blueAthlete);
  }

  // Compute standings
  const standingsMap = new Map<string, { wins: number; losses: number; played: number }>();
  for (const id of athleteMap.keys()) standingsMap.set(id, { wins: 0, losses: 0, played: 0 });

  for (const m of matches) {
    if (m.status !== "COMPLETED" || !m.winnerId) continue;
    const loserId = m.winnerId === m.redAthleteId ? m.blueAthleteId : m.redAthleteId;
    const w = standingsMap.get(m.winnerId);
    const l = loserId ? standingsMap.get(loserId) : undefined;
    if (w) {
      w.wins++;
      w.played++;
    }
    if (l) {
      l.losses++;
      l.played++;
    }
  }

  const standings = Array.from(standingsMap.entries())
    .map(([id, s]) => ({ id, athlete: athleteMap.get(id)!, ...s }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  const completedCount = matches.filter((m) => m.status === "COMPLETED").length;
  const totalCount = matches.length;

  return (
    <div className="space-y-4">
      {/* Standings table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between">
          <span>{t("bracket.group_table", { label: groupLabel })}</span>
          <span>
            {completedCount}/{totalCount} {t("tatami.match_word")}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 font-medium">#</th>
              <th className="text-left px-4 py-2 font-medium">{t("tournament.athletes")}</th>
              <th className="text-center px-3 py-2 font-medium" title={t("bracket.standing_wins")}>
                W
              </th>
              <th
                className="text-center px-3 py-2 font-medium"
                title={t("bracket.standing_losses")}
              >
                L
              </th>
              <th
                className="text-center px-3 py-2 font-medium"
                title={t("bracket.standing_played")}
              >
                P
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => (
              <tr
                key={s.id}
                className={`border-b border-border last:border-0 ${idx < 2 ? "bg-green-500/5" : ""}`}
              >
                <td className="px-4 py-2 text-muted-foreground">
                  {idx < 2 ? <span className="text-green-500 font-bold">{idx + 1}</span> : idx + 1}
                </td>
                <td className="px-4 py-2 font-medium">
                  {s.athlete ? `${s.athlete.name} ${s.athlete.surname}` : "—"}
                  {idx < 2 && (
                    <span className="ml-2 text-xs text-green-500 font-normal">
                      {t("bracket.advances_to_playoff")}
                    </span>
                  )}
                </td>
                <td className="text-center px-3 py-2 text-green-500 font-semibold">{s.wins}</td>
                <td className="text-center px-3 py-2 text-red-500">{s.losses}</td>
                <td className="text-center px-3 py-2">{s.played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Match list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          {t("bracket.stat_matches")}
        </p>
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

/* ─── Round Robin view ───────────────────────────────────────────────────── */

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
            {ms
              .sort((a, b) => a.position - b.position)
              .map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Score formatter ────────────────────────────────────────────────────── */

function formatScore(s: any): string | undefined {
  if (!s) return undefined;
  if (s.ippon > 0) return "Ippon";
  if (s.wazaari >= 2) return "WA×2";
  if (s.wazaari > 0 && s.yuko > 0) return `WA+Y${s.yuko}`;
  if (s.wazaari > 0) return "Waza-ari";
  if (s.yuko > 0) return `Yuko ${s.yuko}`;
  if (s.shido > 0) return `Shido ${s.shido}`;
  return undefined;
}
