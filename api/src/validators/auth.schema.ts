/**
 * Zod-схемы для аутентификационных эндпоинтов.
 * Используются и для серверной валидации, и (в будущем) для генерации типов фронта.
 */

import { z } from "zod";

const imageUrlSchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith("/uploads/") ||
      z.string().url().safeParse(value).success,
    "Невалидный URL изображения",
  );

const uploadUrlSchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith("private:documents/") ||
      value.startsWith("/uploads/") ||
      z.string().url().safeParse(value).success,
    "Невалидный URL файла",
  );

const strongPassword = z
  .string()
  .min(8, "Пароль должен быть не короче 8 символов")
  .max(128, "Пароль слишком длинный")
  .regex(/[A-Z]/, "Пароль должен содержать хотя бы одну заглавную букву")
  .regex(/[a-z]/, "Пароль должен содержать хотя бы одну строчную букву")
  .regex(/[0-9]/, "Пароль должен содержать хотя бы одну цифру");

const nameField = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\p{L}\s'-]+$/u, "Допускаются только буквы, пробел, дефис, апостроф");

const nameLatinField = z
  .string()
  .max(64)
  .regex(/^[A-Za-z\s'-]*$/, "Допускаются только латинские буквы, пробел, дефис, апостроф")
  .optional();

const dateOfBirthField = z.coerce
  .date()
  .refine((d) => {
    const ageMs = Date.now() - d.getTime();
    const years = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    return years >= 6 && years <= 120;
  }, "Возраст должен быть от 6 до 120 лет")
  .optional();

export const registerSchema = z
  .object({
    email: z.string().email("Невалидный email"),
    password: strongPassword,
    role: z.enum(["ATHLETE", "COACH"], {
      errorMap: () => ({
        message: "Можно зарегистрировать только спортсмена или тренера",
      }),
    }),
    name: nameField,
    surname: nameField,
    nameLatin: nameLatinField,
    surnameLatin: nameLatinField,
    dateOfBirth: dateOfBirthField,
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    weightKg: z.coerce.number().positive().max(300).optional(),
    beltRank: z.string().max(20).optional(),
    preferredLocale: z.enum(["ru", "kk", "en"]).default("kk"),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{6,14}$/, "Некорректный формат телефона")
      .optional(),
    // Опционально: спортсмен может сразу указать клуб (если знает id)
    clubId: z.string().uuid("Некорректный формат ID клуба").optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
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
    name: nameField.optional(),
    surname: nameField.optional(),
    nameLatin: nameLatinField.nullable().optional(),
    surnameLatin: nameLatinField.nullable().optional(),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{6,14}$/, "Некорректный формат телефона")
      .nullable()
      .optional(),
    avatarUrl: imageUrlSchema.nullable().optional(),
    preferredLocale: z.enum(["ru", "kk", "en"]).optional(),
  })
  .strict();

export type UpdateMeProfileInput = z.infer<typeof updateMeProfileSchema>;

export const upsertUserDocumentSchema = z
  .object({
    type: z.enum(["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "COACH_ID"]),
    url: uploadUrlSchema,
    originalName: z.string().max(255).nullable().optional(),
    mimeType: z.string().max(120).nullable().optional(),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024)
      .nullable()
      .optional(),
  })
  .strict();

export type UpsertUserDocumentInput = z.infer<typeof upsertUserDocumentSchema>;
