/**
 * pending-result-cleanup.service.ts
 *
 * Автоматически отменяет "завшие" pendingResult в матчах.
 *
 * Проблема: судья нажал "Завершить → Красный победил" → появился pendingResult,
 * но никто не нажал "Подтвердить" (судья вышел, потерял связь и т.д.).
 * Матч висит в IN_PROGRESS с pendingResult навсегда.
 *
 * Решение: каждый час проверяем матчи с pendingResult старше 72 часов
 * и автоматически их отменяем (возвращаем в обычное IN_PROGRESS).
 *
 * Запускается через startPendingResultCleanup() в server.ts.
 */

import { prisma } from "../lib/prisma.js";
import { MatchStatus } from "@prisma/client";
import { normalizeScore, scoreToJson } from "./match-types.js";
import { Prisma } from "@prisma/client";

const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000;  // 72 часа
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;       // каждый час

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/** Запускает периодический cleanup pending results. */
export function startPendingResultCleanup(log: (msg: string) => void): void {
  // Первый запуск через 5 минут после старта (не сразу — даём серверу подняться)
  const firstRunTimer = setTimeout(() => {
    cleanupStalePendingResults(log).catch((err) =>
      log(`[pending-cleanup] Error: ${err.message}`),
    );
  }, 5 * 60 * 1000);
  firstRunTimer.unref(); // не блокируем завершение процесса

  cleanupInterval = setInterval(() => {
    cleanupStalePendingResults(log).catch((err) =>
      log(`[pending-cleanup] Error: ${err.message}`),
    );
  }, CLEANUP_INTERVAL_MS);

  cleanupInterval.unref();
  log("[pending-cleanup] Scheduler started (interval: 1h, threshold: 72h)");
}

export function stopPendingResultCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/** Единичный запуск очистки. Возвращает количество очищенных матчей. */
export async function cleanupStalePendingResults(
  log?: (msg: string) => void,
): Promise<number> {
  const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  // Находим IN_PROGRESS матчи — у них scoreSnapshot содержит pendingResult
  // Критерий "старый": pendingResult.proposedAt < threshold
  // Запрашиваем только матчи с scoreSnapshot (не null) и статусом IN_PROGRESS
  const candidates = await prisma.match.findMany({
    where: {
      status: MatchStatus.IN_PROGRESS,
      scoreSnapshot: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      scoreSnapshot: true,
    },
  });

  let cleaned = 0;

  for (const match of candidates) {
    const score = normalizeScore(match.scoreSnapshot);
    if (!score.pendingResult) continue;

    // Проверяем возраст pending result
    const proposedAt = score.pendingResult.proposedAt
      ? new Date(score.pendingResult.proposedAt)
      : null;

    if (!proposedAt || proposedAt > threshold) continue;

    // Отменяем зависший pending result
    score.pendingResult = null;

    try {
      await prisma.$transaction([
        prisma.match.update({
          where: { id: match.id },
          data: { scoreSnapshot: scoreToJson(score) },
        }),
        prisma.matchEvent.create({
          data: {
            matchId: match.id,
            type: "MATE" as const,
            side: "SYSTEM" as const,
            scoreSnapshot: scoreToJson(score),
            meta: {
              autoCleanup: true,
              reason: "pending_result_expired_72h",
              cleanedAt: new Date().toISOString(),
            },
          },
        }),
      ]);

      cleaned++;
      log?.(`[pending-cleanup] Cleared stale pendingResult for match ${match.id}`);
    } catch (err) {
      log?.(`[pending-cleanup] Failed to clean match ${match.id}: ${(err as Error).message}`);
    }
  }

  if (cleaned > 0) {
    log?.(`[pending-cleanup] Cleaned ${cleaned} stale pending results`);
  }

  return cleaned;
}
