/**
 * match-types.ts — чистые типы и pure-функции для матчей.
 *
 * Не импортирует prisma/redis/внешние сервисы —
 * можно использовать в тестах без side-effects.
 */

import { MatchEventType } from "@prisma/client";

// ============================================================
// ОШИБКА ДОМЕННОГО СЛОЯ
// ============================================================

export class MatchError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "MatchError";
  }
}

// ============================================================
// ТИП ДЛЯ scoreSnapshot
// ============================================================

export interface ScoreSnapshot {
  red: {
    ippon: number;
    wazaari: number;
    yuko: number;
    shido: number;
    hansoku: boolean;
  };
  blue: {
    ippon: number;
    wazaari: number;
    yuko: number;
    shido: number;
    hansoku: boolean;
  };
  isGoldenScore: boolean;
  /** Текущее удержание (osaekomi). null если никто не удерживает. */
  osaekomi: { side: "RED" | "BLUE"; startedAt: string } | null;
  /** Match clock state. elapsedSec — накопленное время до runningStartedAt. */
  clock: {
    running: boolean;
    elapsedSec: number;
    runningStartedAt: string | null;
  };
  /** Результат ожидающий подтверждения. */
  pendingResult: {
    winnerSide: "RED" | "BLUE";
    winnerId: string;
    reason: string;
    triggeredBy: string;
    createdAt: string;
  } | null;
}

// ============================================================
// ПОРОГИ OSAEKOMI (IJF rules)
// ============================================================

export const OSAEKOMI_YUKO_SEC = 5; // 5+ сек  → Yuko (если разрешено категорией)
export const OSAEKOMI_WAZAARI_SEC = 10; // 10+ сек → Waza-ari
export const OSAEKOMI_IPPON_SEC = 20; // 20+ сек → Ippon (мгновенная победа)

// ============================================================
// СОБЫТИЯ ДОПУСТИМЫЕ К ОТМЕНЕ (undo)
// ============================================================

export const UNDOABLE_TYPES = [
  MatchEventType.IPPON,
  MatchEventType.WAZA_ARI,
  MatchEventType.YUKO,
  MatchEventType.SHIDO,
  MatchEventType.HANSOKU_MAKE,
  MatchEventType.GOLDEN_SCORE,
] as const;

// ============================================================
// PURE HELPERS — не имеют side effects, легко тестируются
// ============================================================

export function emptyScore(): ScoreSnapshot {
  return {
    red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false },
    isGoldenScore: false,
    osaekomi: null,
    clock: { running: false, elapsedSec: 0, runningStartedAt: null },
    pendingResult: null,
  };
}

export function normalizeScore(value: unknown): ScoreSnapshot {
  const base = emptyScore();
  if (!value || typeof value !== "object") return base;
  const score = value as Partial<ScoreSnapshot>;
  return {
    red: { ...base.red, ...(score.red ?? {}) },
    blue: { ...base.blue, ...(score.blue ?? {}) },
    isGoldenScore: Boolean(score.isGoldenScore),
    osaekomi: score.osaekomi ?? null,
    pendingResult: score.pendingResult ?? null,
    clock: {
      running: Boolean(score.clock?.running),
      elapsedSec: Math.max(0, Number(score.clock?.elapsedSec ?? 0)),
      runningStartedAt: score.clock?.runningStartedAt ?? null,
    },
  };
}

export function currentClockElapsedSec(
  score: ScoreSnapshot,
  now = new Date(),
): number {
  if (!score.clock.running || !score.clock.runningStartedAt)
    return score.clock.elapsedSec;
  const startedMs = new Date(score.clock.runningStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return score.clock.elapsedSec;
  return Math.max(
    0,
    score.clock.elapsedSec + Math.floor((now.getTime() - startedMs) / 1000),
  );
}

export function stopClock(
  score: ScoreSnapshot,
  now = new Date(),
): ScoreSnapshot {
  score.clock.elapsedSec = currentClockElapsedSec(score, now);
  score.clock.running = false;
  score.clock.runningStartedAt = null;
  return score;
}

export function markPendingResult(
  score: ScoreSnapshot,
  winnerSide: "RED" | "BLUE",
  winnerId: string,
  reason: string,
  triggeredBy: string,
): ScoreSnapshot {
  stopClock(score);
  score.osaekomi = null;
  score.pendingResult = {
    winnerSide,
    winnerId,
    reason,
    triggeredBy,
    createdAt: new Date().toISOString(),
  };
  return score;
}

/**
 * По длительности удержания (сек) определить какой балл начисляется (IJF rules).
 * Экспортируется для использования в osaekomi-timer.service.ts и тестах.
 */
export function osaekomiScore(
  durationSec: number,
  allowYuko: boolean,
): { type: "IPPON" } | { type: "WAZA_ARI" } | { type: "YUKO" } | null {
  if (durationSec >= OSAEKOMI_IPPON_SEC) return { type: "IPPON" };
  if (durationSec >= OSAEKOMI_WAZAARI_SEC) return { type: "WAZA_ARI" };
  if (allowYuko && durationSec >= OSAEKOMI_YUKO_SEC) return { type: "YUKO" };
  return null;
}
