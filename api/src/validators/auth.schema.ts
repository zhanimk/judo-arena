/**
 * Zod-схемы для аутентификационных эндпоинтов.
 * Используются и для серверной валидации, и (в будущем) для генерации типов фронта.
 */

import { z } from "zod";

const imageUrlSchema = z.string().refine(
  (value) => value.startsWith("/uploads/") || z.string().url().safeParse(value).success,
  "Невалидный URL изображения",
);

export const registerSchema = z
  .object({
    email: z.string().email("Невалидный email"),
    password: z
      .string()
      .min(8, "Пароль должен быть не короче 8 символов")
      .max(128, "Пароль слишком длинный"),
    role: z.enum(["ATHLETE", "COACH"], {
      errorMap: () => ({ message: "Можно зарегистрировать только спортсмена или тренера" }),
    }),
    name: z.string().min(1).max(64),
    surname: z.string().min(1).max(64),
    nameLatin: z.string().max(64).optional(),
    surnameLatin: z.string().max(64).optional(),
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    weightKg: z.coerce.number().positive().max(300).optional(),
    beltRank: z.string().max(20).optional(),
    preferredLocale: z.enum(["ru", "kk", "en"]).default("kk"),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Некорректный формат телефона").optional(),
    // Опционально: спортсмен может сразу указать клуб (если знает id)
    clubId: z.string().optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const updateLocaleSchema = z
  .object({
    locale: z.enum(["ru", "kk", "en"]),
  })
  .strict();

export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;

export const updateMeProfileSchema = z
  .object({
    name: z.string().min(1).max(64).optional(),
    surname: z.string().min(1).max(64).optional(),
    nameLatin: z.string().max(64).nullable().optional(),
    surnameLatin: z.string().max(64).nullable().optional(),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Некорректный формат телефона").nullable().optional(),
    avatarUrl: imageUrlSchema.nullable().optional(),
    preferredLocale: z.enum(["ru", "kk", "en"]).optional(),
  })
  .strict();

export type UpdateMeProfileInput = z.infer<typeof updateMeProfileSchema>;
