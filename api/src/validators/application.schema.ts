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

export const weighInStatusSchema = z.enum([
  "PENDING",
  "PASSED",
  "FAILED_WEIGHT",
  "FAILED_DOCUMENTS",
  "ABSENT",
  "WITHDRAWN",
]);

export const updateWeighInSchema = z
  .object({
    status: weighInStatusSchema,
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();
export type UpdateWeighInInput = z.infer<typeof updateWeighInSchema>;
