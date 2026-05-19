/**
 * Zod-схемы для клубов, групп и прокси-регистрации спортсменов.
 */

import { z } from "zod";

/** Мультиязычная строка: хотя бы один язык обязателен */
const i18nString = z
  .object({
    ru: z.string().min(1).max(200).optional(),
    kk: z.string().min(1).max(200).optional(),
    en: z.string().min(1).max(200).optional(),
  })
  .refine((v) => v.ru || v.kk || v.en, {
    message: "Заполните название хотя бы на одном языке",
  });

const i18nStringOptional = z
  .object({
    ru: z.string().max(2000).optional(),
    kk: z.string().max(2000).optional(),
    en: z.string().max(2000).optional(),
  })
  .optional();

// ============================================================
// КЛУБ
// ============================================================

export const createClubSchema = z
  .object({
    name: i18nString,
    shortName: z.string().min(2).max(50).optional(),
    city: z.string().min(1).max(100),
    country: z.string().length(2).default("KZ"),
    logoUrl: z.string().url().optional(),
    description: i18nStringOptional,
  })
  .strict();

export type CreateClubInput = z.infer<typeof createClubSchema>;

export const updateClubSchema = createClubSchema.partial();
export type UpdateClubInput = z.infer<typeof updateClubSchema>;

export const listClubsQuerySchema = z.object({
  city: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>;

// ============================================================
// ГРУППА КЛУБА
// ============================================================

export const createClubGroupSchema = z
  .object({
    name: z.string().min(1).max(100),
    ageMin: z.coerce.number().int().min(4).max(99),
    ageMax: z.coerce.number().int().min(4).max(99),
  })
  .strict()
  .refine((v) => v.ageMin <= v.ageMax, {
    message: "ageMin должен быть ≤ ageMax",
    path: ["ageMin"],
  });

export type CreateClubGroupInput = z.infer<typeof createClubGroupSchema>;

export const updateClubGroupSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    ageMin: z.coerce.number().int().min(4).max(99).optional(),
    ageMax: z.coerce.number().int().min(4).max(99).optional(),
  })
  .strict();

export type UpdateClubGroupInput = z.infer<typeof updateClubGroupSchema>;

// ============================================================
// СПОРТСМЕН (прокси-регистрация тренером)
// ============================================================

export const createAthleteByCoachSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),  // Тренер задаёт начальный пароль
    name: z.string().min(1).max(64),
    surname: z.string().min(1).max(64),
    nameLatin: z.string().max(64).optional(),
    surnameLatin: z.string().max(64).optional(),
    dateOfBirth: z.coerce.date(),         // Обязательно для категорий по возрасту
    gender: z.enum(["MALE", "FEMALE"]),   // Обязательно для категорий
    weightKg: z.coerce.number().positive().max(300),
    beltRank: z.string().max(20).optional(),
    preferredLocale: z.enum(["ru", "kk", "en"]).default("kk"),
    phone: z.string().max(20).optional(),
  })
  .strict();

export type CreateAthleteByCoachInput = z.infer<typeof createAthleteByCoachSchema>;

export const updateAthleteSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    surname: z.string().min(1).max(64).optional(),
    nameLatin: z.string().max(64).optional(),
    surnameLatin: z.string().max(64).optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    weightKg: z.coerce.number().positive().max(300).optional(),
    beltRank: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    isActive: z.boolean().optional(),
    clubId: z.string().nullable().optional(),  // null = отвязать от клуба
  })
  .strict();

export type UpdateAthleteInput = z.infer<typeof updateAthleteSchema>;
