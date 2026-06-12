/**
 * Серверный таймер golden score.
 *
 * Когда матч переходит в golden score и у категории задан goldenScoreSec > 0,
 * запускается этот таймер. По истечению времени:
 *   • Если один спортсмен ведёт по очкам — засчитывается победа ему.
 *   • Если ничья — матч остаётся на судье (логируем предупреждение).
 *
 * При рестарте сервера — restoreGoldenScoreTimers() восстанавливает активные таймеры.
 */

import { prisma } from "../lib/prisma.js";
import { MatchStatus } from "@prisma/client";
import { emitMatchEvent } from "../sockets/io.js";
import { normalizeScore, type ScoreSnapshot } from "./match-types.js";

// matchId → { handle, goldenScoreSec, startedAt }
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Запланировать авто-завершение golden score через оставшееся время.
 * @param startedAt ISO-строка момента входа в golden score
 */
export function scheduleGoldenScoreTimer(
  matchId: string,
  goldenScoreSec: number,
  startedAt: string,
): void {
  if (goldenScoreSec <= 0) return; // 0 = без лимита
  cancelGoldenScoreTimer(matchId);

  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const remaining = Math.max(0, goldenScoreSec - elapsed);

  const handle = setTimeout(async () => {
    activeTimers.delete(matchId);
    await triggerGoldenScoreTimeout(matchId);
  }, remaining * 1000);

  activeTimers.set(matchId, handle);
}

export function cancelGoldenScoreTimer(matchId: string): void {
  const h = activeTimers.get(matchId);
  if (h !== undefined) {
    clearTimeout(h);
    activeTimers.delete(matchId);
  }
}

/** При старте сервера — восстановить таймеры для матчей в golden score. */
export async function restoreGoldenScoreTimers(): Promise<void> {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.IN_PROGRESS, isGoldenScore: true },
    select: {
      id: true,
      scoreSnapshot: true,
      startedAt: true,
      goldenScoreStartedAt: true,
      bracket: { select: { category: { select: { goldenScoreSec: true } } } },
    },
  });

  let restored = 0;
  for (const m of matches) {
    const goldenScoreSec = m.bracket.category.goldenScoreSec;
    if (!goldenScoreSec || goldenScoreSec <= 0) continue;

    const startedAt =
      m.goldenScoreStartedAt?.toISOString() ??
      m.startedAt?.toISOString() ??
      new Date().toISOString();
    scheduleGoldenScoreTimer(m.id, goldenScoreSec, startedAt);
    restored++;
  }

  if (restored > 0) {
    process.stdout.write(
      `[golden-score-timer] Restored ${restored} active timer(s) after restart\n`,
    );
  }
}

// ---- внутренний триггер авто-завершения ----

function determineLeader(
  score: ScoreSnapshot,
  redAthleteId: string,
  blueAthleteId: string,
): string | null {
  const r = score.red;
  const b = score.blue;

  // Ippon / hansoku
  if (r.ippon > b.ippon) return redAthleteId;
  if (b.ippon > r.ippon) return blueAthleteId;

  // Waza-ari
  if (r.wazaari > b.wazaari) return redAthleteId;
  if (b.wazaari > r.wazaari) return blueAthleteId;

  // Yuko (если включён)
  if (r.yuko > b.yuko) return redAthleteId;
  if (b.yuko > r.yuko) return blueAthleteId;

  // Shido (меньше — лучше)
  if (r.shido < b.shido) return redAthleteId;
  if (b.shido < r.shido) return blueAthleteId;

  return null; // ничья
}

async function triggerGoldenScoreTimeout(matchId: string): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        scoreSnapshot: true,
        redAthleteId: true,
        blueAthleteId: true,
      },
    });

    if (!match || match.status !== MatchStatus.IN_PROGRESS) return;
    if (!match.redAthleteId || !match.blueAthleteId) return;

    const score = normalizeScore(match.scoreSnapshot);
    if (!score.isGoldenScore) return;

    const winnerId = determineLeader(
      score,
      match.redAthleteId,
      match.blueAthleteId,
    );

    if (!winnerId) {
      process.stderr.write(
        `[golden-score-timer] Match ${matchId}: golden score timeout but scores are tied — judge must decide\n`,
      );
      return;
    }

    const forfeitSide = winnerId === match.redAthleteId ? "BLUE" : "RED";

    // Lazy import to avoid circular dependency
    const { forfeitMatch } = await import("./match-lifecycle.service.js");
    const updated = await forfeitMatch(matchId, forfeitSide, "DISQUALIFIED");

    try {
      emitMatchEvent(updated, "match:finished", {
        matchId,
        reason: "golden_score_timeout",
        winnerId,
      });
    } catch {
      // IO may not be ready — non-critical
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[golden-score-timer] Timeout handler failed for match ${matchId}: ${message}\n`,
    );
  }
}
