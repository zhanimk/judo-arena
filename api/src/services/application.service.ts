/**
 * Сервис заявок клубов на турниры.
 *
 * Lifecycle заявки:
 *   DRAFT → SUBMITTED → APPROVED / REJECTED
 *        ↘ WITHDRAWN
 *
 * Бизнес-правила:
 *  • Тренер создаёт заявку для своего клуба (только если турнир в REGISTRATION_OPEN).
 *  • Спортсмен в заявке должен быть из того же клуба.
 *  • Спортсмен/категория проверяются на совпадение пола, возраста, веса.
 *  • Один спортсмен в одной категории на турнире.
 *  • Submitted-заявку нельзя редактировать (только отозвать через WITHDRAWN).
 */

import { prisma } from "../lib/prisma.js";
import {
  ApplicationStatus,
  TournamentStatus,
  UserRole,
  type User,
  type Category,
} from "@prisma/client";

export class ApplicationError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "ApplicationError";
  }
}

// ============================================================
// CREATE / LIST / GET
// ============================================================

export async function createOrGetDraftApplication(
  coachUserId: string,
  tournamentId: string,
  notes?: string,
) {
  const coach = await prisma.user.findUnique({ where: { id: coachUserId } });
  if (!coach || coach.role !== UserRole.COACH) {
    throw new ApplicationError("FORBIDDEN", "Создавать заявки может только тренер", 403);
  }
  if (!coach.clubId) {
    throw new ApplicationError("NO_CLUB", "Тренер не привязан к клубу", 409);
  }

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new ApplicationError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    throw new ApplicationError(
      "REGISTRATION_CLOSED",
      "Регистрация на турнир закрыта",
      409,
    );
  }

  // Если у клуба уже есть заявка — возвращаем её (вместо создания дубля)
  const existing = await prisma.application.findUnique({
    where: { tournamentId_clubId: { tournamentId, clubId: coach.clubId } },
    include: { entries: { include: { athlete: true, category: true } } },
  });
  if (existing) return existing;

  assertApplicationDeadlineOpen(tournament.applicationDeadline ?? tournament.startDate);

  return prisma.application.create({
    data: {
      tournamentId,
      clubId: coach.clubId,
      status: ApplicationStatus.DRAFT,
      notes,
    },
    include: { entries: { include: { athlete: true, category: true } } },
  });
}

export async function listApplicationsForTournament(actorUserId: string, tournamentId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);

  const where: any = { tournamentId };
  // Тренер видит только заявки своего клуба, админ — все
  if (actor.role === UserRole.COACH) {
    if (!actor.clubId) return [];
    where.clubId = actor.clubId;
  } else if (actor.role !== UserRole.ADMIN) {
    throw new ApplicationError("FORBIDDEN", "Просмотр заявок недоступен", 403);
  }

  return prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      club: { select: { id: true, name: true, shortName: true, city: true } },
      entries: {
        select: {
          id: true,
          athleteId: true,
          categoryId: true,
          athlete: { select: { id: true, name: true, surname: true, gender: true, dateOfBirth: true, weightKg: true } },
          category: { select: { id: true, name: true, gender: true, ageMin: true, ageMax: true, weightMin: true, weightMax: true, format: true } },
        },
      },
      _count: { select: { entries: true } },
    },
  });
}

export async function getApplication(actorUserId: string, applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      club: true,
      tournament: {
        select: {
          id: true,
          name: true,
          status: true,
      startDate: true,
      endDate: true,
      applicationDeadline: true,
      location: true,
          city: true,
          posterUrl: true,
        },
      },
      entries: {
        include: {
          athlete: {
            select: {
              id: true, name: true, surname: true, gender: true,
              dateOfBirth: true, weightKg: true, beltRank: true,
            },
          },
          category: true,
        },
      },
    },
  });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  await assertCanViewApplication(actorUserId, app.clubId);
  return app;
}

// ============================================================
// ENTRIES (спортсмен в заявке)
// ============================================================

export async function addEntry(
  actorUserId: string,
  applicationId: string,
  athleteId: string,
  categoryId: string,
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { tournament: { select: { startDate: true, applicationDeadline: true } } },
  });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError("LOCKED", "Изменять можно только заявку в статусе DRAFT", 409);
  }
  assertApplicationDeadlineOpen(app.tournament.applicationDeadline ?? app.tournament.startDate);
  await assertCanManageApplication(actorUserId, app.clubId);

  const [athlete, category] = await Promise.all([
    prisma.user.findUnique({ where: { id: athleteId } }),
    prisma.category.findUnique({ where: { id: categoryId } }),
  ]);

  if (!athlete || athlete.role !== UserRole.ATHLETE) {
    throw new ApplicationError("ATHLETE_NOT_FOUND", "Спортсмен не найден", 404);
  }
  if (athlete.clubId !== app.clubId) {
    throw new ApplicationError("WRONG_CLUB", "Спортсмен не из вашего клуба", 409);
  }
  if (!category || category.tournamentId !== app.tournamentId) {
    throw new ApplicationError("CATEGORY_MISMATCH", "Категория не из этого турнира", 409);
  }

  // Проверка соответствия пол/возраст/вес
  validateAthleteFitsCategory(athlete, category);

  // Проверка что спортсмен ещё не в этой категории на этом турнире (ни в этой, ни в чужой заявке)
  const duplicate = await prisma.applicationEntry.findFirst({
    where: {
      athleteId,
      categoryId,
      application: { tournamentId: app.tournamentId },
    },
  });
  if (duplicate) {
    throw new ApplicationError(
      "DUPLICATE_ENTRY",
      "Этот спортсмен уже заявлен в эту категорию",
      409,
    );
  }

  return prisma.applicationEntry.create({
    data: { applicationId, athleteId, categoryId },
    include: { athlete: true, category: true },
  });
}

export async function removeEntry(actorUserId: string, applicationId: string, entryId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError("LOCKED", "Изменять можно только DRAFT", 409);
  }
  await assertCanManageApplication(actorUserId, app.clubId);

  const entry = await prisma.applicationEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.applicationId !== applicationId) {
    throw new ApplicationError("ENTRY_NOT_FOUND", "Запись не найдена", 404);
  }
  await prisma.applicationEntry.delete({ where: { id: entryId } });
}

// ============================================================
// LIFECYCLE
// ============================================================

export async function submit(actorUserId: string, applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      _count: { select: { entries: true } },
      tournament: { select: { startDate: true, applicationDeadline: true } },
    },
  });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError("INVALID_STATUS", "Отправить можно только DRAFT", 409);
  }
  if (app._count.entries === 0) {
    throw new ApplicationError("EMPTY_APPLICATION", "Нельзя отправить пустую заявку", 409);
  }
  assertApplicationDeadlineOpen(app.tournament.applicationDeadline ?? app.tournament.startDate);
  await assertCanManageApplication(actorUserId, app.clubId);

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
  });
}

export async function approve(actorUserId: string, applicationId: string, reviewerNotes?: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError("FORBIDDEN", "Только админ может одобрять заявки", 403);
  }
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { tournament: { select: { id: true, name: true } } },
  });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.SUBMITTED) {
    throw new ApplicationError("INVALID_STATUS", "Одобрять можно только SUBMITTED", 409);
  }
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.APPROVED,
      reviewedAt: new Date(),
      reviewerNotes,
    },
  });
  await notifyCoachesOfApplicationReview(app, ApplicationStatus.APPROVED, reviewerNotes);
  return updated;
}

export async function reject(actorUserId: string, applicationId: string, reviewerNotes?: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError("FORBIDDEN", "Только админ может отклонять заявки", 403);
  }
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { tournament: { select: { id: true, name: true } } },
  });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.SUBMITTED) {
    throw new ApplicationError("INVALID_STATUS", "Отклонять можно только SUBMITTED", 409);
  }
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.REJECTED,
      reviewedAt: new Date(),
      reviewerNotes,
    },
  });
  await notifyCoachesOfApplicationReview(app, ApplicationStatus.REJECTED, reviewerNotes);
  return updated;
}

export async function withdraw(actorUserId: string, applicationId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.DRAFT && app.status !== ApplicationStatus.SUBMITTED) {
    throw new ApplicationError(
      "INVALID_STATUS",
      "Отозвать можно только DRAFT или SUBMITTED",
      409,
    );
  }
  await assertCanManageApplication(actorUserId, app.clubId);
  return prisma.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.WITHDRAWN },
  });
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function validateAthleteFitsCategory(athlete: User, category: Category): void {
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
  const age = Math.floor((Date.now() - athlete.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000));
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
  if (athlete.weightKg <= category.weightMin || athlete.weightKg > category.weightMax) {
    throw new ApplicationError(
      "WEIGHT_MISMATCH",
      `Вес ${athlete.weightKg} кг не в диапазоне (${category.weightMin}, ${category.weightMax}]`,
      409,
    );
  }
}

async function assertCanManageApplication(actorUserId: string, clubId: string): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role === UserRole.ADMIN) return;
  if (actor.role === UserRole.COACH && actor.clubId === clubId) return;
  throw new ApplicationError(
    "FORBIDDEN",
    "Управлять заявкой может только тренер клуба или админ",
    403,
  );
}

async function assertCanViewApplication(actorUserId: string, clubId: string): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role === UserRole.ADMIN) return;
  if (actor.role === UserRole.COACH && actor.clubId === clubId) return;
  throw new ApplicationError(
    "FORBIDDEN",
    "Просмотр заявки доступен только тренеру клуба или админу",
    403,
  );
}

async function notifyCoachesOfApplicationReview(
  app: { id: string; clubId: string; tournamentId: string; tournament?: { name: any } | null },
  status: ApplicationStatus,
  reviewerNotes?: string,
) {
  const coaches = await prisma.user.findMany({
    where: { clubId: app.clubId, role: UserRole.COACH, isActive: true },
    select: { id: true },
  });
  if (coaches.length === 0) return;

  const tournamentName = localizeName(app.tournament?.name) || "турнир";
  const isApproved = status === ApplicationStatus.APPROVED;
  const title = isApproved ? "Өтінім бекітілді" : "Өтінім қайтарылды";
  const body = isApproved
    ? `${tournamentName}: клуб өтінімі бекітілді.${reviewerNotes ? ` Ескерту: ${reviewerNotes}` : ""}`
    : `${tournamentName}: өтінімде түзету керек.${reviewerNotes ? ` Себебі: ${reviewerNotes}` : ""}`;

  await prisma.notification.createMany({
    data: coaches.map((coach) => ({
      userId: coach.id,
      type: isApproved ? "application_approved" : "application_rejected",
      titleKey: title,
      bodyKey: body,
      payload: {
        applicationId: app.id,
        tournamentId: app.tournamentId,
        status,
        reviewerNotes: reviewerNotes ?? null,
      },
      locale: "kk",
    })),
  });
}

function localizeName(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.kk || value.ru || value.en || "";
}

function assertApplicationDeadlineOpen(deadline: Date) {
  if (new Date() > deadline) {
    throw new ApplicationError(
      "APPLICATION_DEADLINE_PASSED",
      "Дедлайн подачи заявки уже прошёл",
      409,
    );
  }
}
