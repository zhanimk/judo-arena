/**
 * Zod-схемы для заявок клубов на турниры.
 */

import { z } from "zod";

export const createApplicationSchema = z
  .object({
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const addEntrySchema = z
  .object({
    athleteId: z.string().min(1),
    categoryId: z.string().min(1),
  })
  .strict();
export type AddEntryInput = z.infer<typeof addEntrySchema>;

export const reviewApplicationSchema = z
  .object({
    reviewerNotes: z.string().max(2000).optional(),
  })
  .strict();
export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;
