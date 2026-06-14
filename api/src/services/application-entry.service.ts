/**
 * application-entry.service.ts — управление участниками в заявке.
 *
 * Содержит: addEntry, removeEntry, adminForceRemoveEntry, adminForceMoveEntry
 */

import { prisma } from "../lib/prisma.js";
import { ApplicationStatus, UserRole } from "@prisma/client";
import {
  ApplicationError,
  assertCanManageApplication,
  assertApplicationDeadlineOpen,
  validateAthleteFitsCategory,
} from "./application-shared.js";

export async function addEntry(
  actorUserId: string,
  applicationId: string,
  athleteId: string,
  categoryId: string,
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      tournament: { select: { startDate: true, applicationDeadline: true } },
    },
  });
  if (!app)
    throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError("LOCKED", "Изменять можно только заявку в статусе DRAFT", 409);
  }
  assertApplicationDeadlineOpen(
    app.tournament.applicationDeadline ?? app.tournament.startDate,
  );
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

  validateAthleteFitsCategory(athlete, category);

  const duplicate = await prisma.applicationEntry.findFirst({
    where: {
      athleteId,
      categoryId,
      application: { tournamentId: app.tournamentId },
    },
  });
  if (duplicate) {
    throw new ApplicationError("DUPLICATE_ENTRY", "Этот спортсмен уже заявлен в эту категорию", 409);
  }

  return prisma.applicationEntry.create({
    data: { applicationId, athleteId, categoryId },
    include: { athlete: true, category: true },
  });
}

export async function removeEntry(
  actorUserId: string,
  applicationId: string,
  entryId: string,
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);

  const entry = await prisma.applicationEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.applicationId !== applicationId)
    throw new ApplicationError("ENTRY_NOT_FOUND", "Запись не найдена", 404);

  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);

  const isAthleteSelf = actor.role === UserRole.ATHLETE && entry.athleteId === actorUserId;

  if (isAthleteSelf) {
    if (
      app.status === ApplicationStatus.APPROVED ||
      app.status === ApplicationStatus.WITHDRAWN
    ) {
      throw new ApplicationError("LOCKED", "Убрать запись можно только до одобрения заявки", 409);
    }
  } else {
    if (app.status !== ApplicationStatus.DRAFT) {
      throw new ApplicationError("LOCKED", "Изменять можно только DRAFT", 409);
    }
    await assertCanManageApplication(actorUserId, app.clubId);
  }

  await prisma.applicationEntry.delete({ where: { id: entryId } });
}

export async function adminForceRemoveEntry(
  applicationId: string,
  entryId: string,
): Promise<void> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);

  const entry = await prisma.applicationEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.applicationId !== applicationId) {
    throw new ApplicationError("ENTRY_NOT_FOUND", "Запись не найдена", 404);
  }
  await prisma.applicationEntry.delete({ where: { id: entryId } });
}

export async function adminForceMoveEntry(
  applicationId: string,
  entryId: string,
  newCategoryId: string,
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);

  const entry = await prisma.applicationEntry.findUnique({
    where: { id: entryId },
    include: { athlete: true },
  });
  if (!entry || entry.applicationId !== applicationId) {
    throw new ApplicationError("ENTRY_NOT_FOUND", "Запись не найдена", 404);
  }

  const category = await prisma.category.findUnique({ where: { id: newCategoryId } });
  if (!category || category.tournamentId !== app.tournamentId) {
    throw new ApplicationError("CATEGORY_MISMATCH", "Категория не из этого турнира", 409);
  }

  const duplicate = await prisma.applicationEntry.findFirst({
    where: {
      athleteId: entry.athleteId,
      categoryId: newCategoryId,
      application: { tournamentId: app.tournamentId },
      NOT: { id: entryId },
    },
  });
  if (duplicate) {
    throw new ApplicationError("DUPLICATE_ENTRY", "Спортсмен уже записан в эту категорию", 409);
  }

  return prisma.$transaction(async (tx) => {
    await tx.applicationEntry.delete({ where: { id: entryId } });
    return tx.applicationEntry.create({
      data: { applicationId, athleteId: entry.athleteId, categoryId: newCategoryId },
      include: { athlete: true, category: true },
    });
  });
}
