/**
 * Zod-схемы для матчей и судейских действий.
 */

import { z } from "zod";

// Создание судейской сессии (одноразовая ссылка)
export const createJudgeSessionSchema = z
  .object({
    judgeName: z.string().min(1).max(100).optional(),
    ttlHours: z.coerce.number().int().min(1).max(72).default(12),
  })
  .strict();
export type CreateJudgeSessionInput = z.infer<typeof createJudgeSessionSchema>;

// Назначение матча на татами + порядок в очереди
export const assignTatamiSchema = z
  .object({
    tatamiNumber: z.number().int().min(1).max(20).nullable(),
    queuePosition: z.number().int().min(0).optional(),
  })
  .strict();
export type AssignTatamiInput = z.infer<typeof assignTatamiSchema>;

export const reorderTatamiQueueSchema = z
  .object({
    direction: z.enum(["up", "down"]),
  })
  .strict();
export type ReorderTatamiQueueInput = z.infer<typeof reorderTatamiQueueSchema>;

// Действие судьи на матче
export const scoreEventSchema = z
  .object({
    type: z.enum([
      "IPPON",
      "WAZA_ARI",
      "YUKO",
      "SHIDO",
      "HANSOKU_MAKE",
    ]),
    side: z.enum(["RED", "BLUE"]),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();
export type ScoreEventInput = z.infer<typeof scoreEventSchema>;

// Контрол матча (старт, пауза, golden score, ручное завершение)
export const matchControlSchema = z
  .object({
    action: z.enum(["HAJIME", "MATE", "GOLDEN_SCORE", "SORE_MADE"]),
  })
  .strict();
export type MatchControlInput = z.infer<typeof matchControlSchema>;

// Start osaekomi (удержание)
export const startOsaekomiSchema = z
  .object({
    side: z.enum(["RED", "BLUE"]),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();
export type StartOsaekomiInput = z.infer<typeof startOsaekomiSchema>;

// End osaekomi (TOKETA или авто-стоп по времени)
export const endOsaekomiSchema = z
  .object({
    reason: z.enum(["TOKETA", "TIME_LIMIT"]).default("TOKETA"),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();
export type EndOsaekomiInput = z.infer<typeof endOsaekomiSchema>;

// Ручное завершение матча с указанием победителя (если ничья и нужно решить)
export const finishMatchSchema = z
  .object({
    winnerSide: z.enum(["RED", "BLUE"]),
    reason: z.string().max(200).optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();
export type FinishMatchInput = z.infer<typeof finishMatchSchema>;

// Список матчей с фильтрами
export const listMatchesQuerySchema = z.object({
  tournamentId: z.string().optional(),
  bracketId: z.string().optional(),
  athleteId: z.string().optional(),
  tatamiNumber: z.coerce.number().int().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
