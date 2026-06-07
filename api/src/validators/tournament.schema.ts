/**
 * Zod-схемы для турниров и категорий.
 */

import { z } from "zod";

const i18nName = z
  .object({
    ru: z.string().min(1).max(200).optional(),
    kk: z.string().min(1).max(200).optional(),
    en: z.string().min(1).max(200).optional(),
  })
  .refine((v) => v.ru || v.kk || v.en, {
    message: "Заполните название хотя бы на одном языке",
  });

const i18nDescription = z
  .object({
    ru: z.string().max(5000).optional(),
    kk: z.string().max(5000).optional(),
    en: z.string().max(5000).optional(),
  })
  .optional();

// ============================================================
// ТУРНИРЫ
// ============================================================

export const createTournamentSchema = z
  .object({
    name: i18nName,
    description: i18nDescription,
    location: z.string().min(1).max(255),
    city: z.string().min(1).max(100),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    applicationDeadline: z.coerce.date().optional(),
    mapUrl: z.string().url().optional(),
    weighInLocation: z.string().min(1).max(255).optional(),
    weighInStart: z.coerce.date().optional(),
    weighInEnd: z.coerce.date().optional(),
    tatamiCount: z.coerce.number().int().min(1).max(20).default(1),
    primaryLocale: z.enum(["ru", "kk", "en"]).default("kk"),
    posterUrl: z.string().url().optional(),
    entryFeeKzt: z.coerce.number().int().min(0).max(10_000_000).default(0),
    kaspiPaymentUrl: z.string().url().optional(),
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, {
    message: "endDate должна быть ≥ startDate",
    path: ["endDate"],
  })
  .refine(
    (v) => !v.applicationDeadline || v.applicationDeadline <= v.startDate,
    {
      message: "applicationDeadline должен быть не позже startDate",
      path: ["applicationDeadline"],
    },
  )
  .refine(
    (v) => !v.weighInStart || !v.weighInEnd || v.weighInEnd >= v.weighInStart,
    {
      message: "weighInEnd должен быть ≥ weighInStart",
      path: ["weighInEnd"],
    },
  );

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = z
  .object({
    name: i18nName.optional(),
    description: i18nDescription,
    location: z.string().min(1).max(255).optional(),
    city: z.string().min(1).max(100).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    applicationDeadline: z.coerce.date().nullable().optional(),
    mapUrl: z.string().url().nullable().optional(),
    weighInLocation: z.string().min(1).max(255).nullable().optional(),
    weighInStart: z.coerce.date().nullable().optional(),
    weighInEnd: z.coerce.date().nullable().optional(),
    tatamiCount: z.coerce.number().int().min(1).max(20).optional(),
    primaryLocale: z.enum(["ru", "kk", "en"]).optional(),
    posterUrl: z.string().url().nullable().optional(),
    entryFeeKzt: z.coerce.number().int().min(0).max(10_000_000).optional(),
    kaspiPaymentUrl: z.string().url().nullable().optional(),
    // Empty entries preserve the tatami index when only some mats have a stream.
    youtubeUrls: z
      .array(z.union([z.string().url(), z.literal("")]))
      .nullable()
      .optional(),
  })
  .strict();

export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;

export const listTournamentsQuerySchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  city: z.string().optional(),
  search: z.string().optional(),
  upcoming: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  /** Admin-only: include archived tournaments. Public API always hides archived. */
  includeArchived: z.coerce.boolean().optional().default(false),
});
export type ListTournamentsQuery = z.infer<typeof listTournamentsQuerySchema>;

export const changeStatusSchema = z
  .object({
    status: z.enum([
      "DRAFT",
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ]),
  })
  .strict();
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// ============================================================
// КАТЕГОРИИ
// ============================================================

export const createCategorySchema = z
  .object({
    name: i18nName.optional(),
    gender: z.enum(["MALE", "FEMALE"]),
    ageMin: z.coerce.number().int().min(4).max(99),
    ageMax: z.coerce.number().int().min(4).max(99),
    weightMin: z.coerce.number().positive().max(300),
    weightMax: z.coerce.number().positive().max(300),
    matchDurationSec: z.coerce.number().int().min(60).max(900).default(240),
    goldenScoreSec: z.coerce.number().int().min(0).max(900).default(0),
    format: z.enum(["SE_IJF", "ROUND_ROBIN", "MIXED"]).default("SE_IJF"),
    allowYuko: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.ageMin <= v.ageMax, {
    message: "ageMin должен быть ≤ ageMax",
    path: ["ageMin"],
  })
  .refine((v) => v.weightMin < v.weightMax, {
    message: "weightMin должен быть < weightMax",
    path: ["weightMin"],
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: i18nName.optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    ageMin: z.coerce.number().int().min(4).max(99).optional(),
    ageMax: z.coerce.number().int().min(4).max(99).optional(),
    weightMin: z.coerce.number().positive().max(300).optional(),
    weightMax: z.coerce.number().positive().max(300).optional(),
    matchDurationSec: z.coerce.number().int().min(60).max(900).optional(),
    goldenScoreSec: z.coerce.number().int().min(0).max(900).optional(),
    format: z.enum(["SE_IJF", "ROUND_ROBIN", "MIXED"]).optional(),
    allowYuko: z.boolean().optional(),
  })
  .strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
