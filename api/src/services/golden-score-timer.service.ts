/** Server alert for an optional local Golden Score limit; the judge decides the result. */

import { prisma } from "../lib/prisma.js";
import { MatchStatus } from "@prisma/client";
import { emitMatchEvent } from "../sockets/io.js";
import { normalizeScore } from "./match-types.js";

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
    await triggerGoldenScoreTimeout(matchId, startedAt);
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

async function triggerGoldenScoreTimeout(
  matchId: string,
  startedAt: string,
): Promise<void> {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        version: true,
        goldenScoreStartedAt: true,
        status: true,
        scoreSnapshot: true,
        redAthleteId: true,
        blueAthleteId: true,
      },
    });

    if (!match || match.status !== MatchStatus.IN_PROGRESS) return;
    if (!match.redAthleteId || !match.blueAthleteId) return;
    if (
      match.goldenScoreStartedAt &&
      match.goldenScoreStartedAt.toISOString() !== startedAt
    )
      return;

    const score = normalizeScore(match.scoreSnapshot);
    if (!score.isGoldenScore) return;

    if (score.pendingResult || !score.clock.running) return;
    // A time limit is never a disqualification or a win on fewer shido.
    // Stop and leave the decision to the judge for the configured local rules.
    const { pauseMatch } = await import("./match-lifecycle.service.js");
    const { match: updated } = await pauseMatch(
      matchId,
      undefined,
      match.version,
    );

    try {
      emitMatchEvent(updated, "match:scoreUpdate", {
        matchId,
        reason: "golden_score_timeout",
        requiresJudgeDecision: true,
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
