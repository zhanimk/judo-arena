/**
 * Shared helpers for the application service modules.
 * Imported by application.service.ts, application-entry.service.ts,
 * and application-payment.service.ts to avoid circular dependencies.
 */

import { prisma } from "../lib/prisma.js";
import { ClubRole, UserRole, type User, type Category, Prisma } from "@prisma/client";

export class ApplicationError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function validateAthleteFitsCategory(athlete: User, category: Category): void {
  if (athlete.gender !== category.gender) {
    throw new ApplicationError(
      "GENDER_MISMATCH",
      `Категория для ${category.gender}, спортсмен ${athlete.gender}`,
      409,
    );
  }

  if (!athlete.dateOfBirth) {
    throw new ApplicationError(
      "MISSING_DOB",
      "У спортсмена не указана дата рождения — нельзя определить возраст",
      400,
    );
  }
  const age = Math.floor(
    (Date.now() - athlete.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000),
  );
  if (age < category.ageMin || age > category.ageMax) {
    throw new ApplicationError(
      "AGE_MISMATCH",
      `Спортсмену ${age} лет, категория ${category.ageMin}-${category.ageMax}`,
      409,
    );
  }

  if (athlete.weightKg === null || athlete.weightKg === undefined) {
    throw new ApplicationError(
      "MISSING_WEIGHT",
      "У спортсмена не указан вес",
      400,
    );
  }
  if (
    athlete.weightKg <= category.weightMin ||
    athlete.weightKg > category.weightMax
  ) {
    throw new ApplicationError(
      "WEIGHT_MISMATCH",
      `Вес ${athlete.weightKg} кг не в диапазоне (${category.weightMin}, ${category.weightMax}]`,
      409,
    );
  }
}

export async function assertCanManageApplication(
  actorUserId: string,
  clubId: string,
): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor)
    throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role === UserRole.ADMIN) return;
  if (
    actor.role === UserRole.COACH &&
    actor.clubId === clubId &&
    actor.clubRole === ClubRole.OWNER
  )
    return;
  throw new ApplicationError(
    "FORBIDDEN",
    "Управлять официальной заявкой может только главный тренер клуба или админ",
    403,
  );
}

export function assertApplicationDeadlineOpen(deadline: Date): void {
  if (new Date() > deadline) {
    throw new ApplicationError(
      "DEADLINE_PASSED",
      "Срок подачи заявок истёк",
      409,
    );
  }
}

export function localizeName(value: Prisma.JsonValue | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && !Array.isArray(value) && value !== null) {
    const obj = value as Record<string, Prisma.JsonValue>;
    return (obj["kk"] as string) || (obj["ru"] as string) || (obj["en"] as string) || "";
  }
  return "";
}
