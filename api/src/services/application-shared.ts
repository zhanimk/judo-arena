/**
 * Shared helpers for the application service modules.
 * Imported by application.service.ts, application-entry.service.ts,
 * and application-payment.service.ts to avoid circular dependencies.
 */

import { fitsBirthYears, birthYearBounds, isAdult } from "./category-age.js";
import { prisma } from "../lib/prisma.js";
import {
  ClubRole,
  UserRole,
  type User,
  type Category,
  Prisma,
} from "@prisma/client";

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

export async function validateAthleteFitsCategory(
  athlete: User,
  category: Category,
): Promise<void> {
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
  const tournament = await prisma.tournament.findUnique({
    where: { id: category.tournamentId },
    select: { startDate: true },
  });
  if (!tournament)
    throw new ApplicationError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (!fitsBirthYears(athlete.dateOfBirth, category, tournament.startDate)) {
    const bounds = birthYearBounds(category, tournament.startDate);
    throw new ApplicationError(
      "AGE_MISMATCH",
      `Допустимые годы рождения: ${bounds.birthYearMin}–${bounds.birthYearMax}`,
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
  clubId: string | null,
  applicantId?: string | null,
): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor)
    throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role === UserRole.ADMIN) return;
  if (
    actor.role === UserRole.ATHLETE &&
    applicantId === actor.id &&
    isAdult(actor.dateOfBirth)
  )
    return;
  if (
    clubId &&
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

export function localizeName(
  value: Prisma.JsonValue | null | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && !Array.isArray(value) && value !== null) {
    const obj = value as Record<string, Prisma.JsonValue>;
    return (
      (obj["kk"] as string) ||
      (obj["ru"] as string) ||
      (obj["en"] as string) ||
      ""
    );
  }
  return "";
}

/** Recheck administrator settings when an existing draft is changed or submitted. */
export async function assertRegistrationMethodOpen(
  actorId: string,
  app: { tournamentId: string; clubId: string | null; source: string },
): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  if (actor?.role === "ADMIN") return;
  const t = await prisma.tournament.findUnique({
    where: { id: app.tournamentId },
  });
  if (!t || t.status !== "REGISTRATION_OPEN")
    throw new ApplicationError(
      "REGISTRATION_CLOSED",
      "Регистрация закрыта",
      409,
    );
  if (
    app.clubId
      ? !t.clubRegistrationEnabled
      : app.source !== "SELF" ||
        !t.selfRegistrationEnabled ||
        t.audience === "CHILD"
  ) {
    throw new ApplicationError(
      "REGISTRATION_METHOD_DISABLED",
      "Этот способ подачи отключён администратором",
      409,
    );
  }
}
