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
  Prisma,
  ApplicationStatus,
  ClubRole,
  PaymentStatus,
  TournamentStatus,
  UserRole,
  type User,
  type Category,
} from "@prisma/client";
import {
  sendEmail,
  applicationApprovedHtml,
  applicationRejectedHtml,
} from "./email.service.js";
import { logAudit } from "./audit.service.js";
import { emitToUser } from "../sockets/io.js";
import { ApplicationError } from "./application-shared.js";

// ApplicationError — канонический класс в application-shared.ts
export { ApplicationError } from "./application-shared.js";

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
    throw new ApplicationError(
      "FORBIDDEN",
      "Создавать заявки может только тренер",
      403,
    );
  }
  if (!coach.clubId) {
    throw new ApplicationError("NO_CLUB", "Тренер не привязан к клубу", 409);
  }
  if (coach.clubRole !== ClubRole.OWNER) {
    throw new ApplicationError(
      "CLUB_OWNER_REQUIRED",
      "Официальную заявку клуба может подать только главный тренер",
      403,
    );
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament)
    throw new ApplicationError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
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
    include: {
      tournament: { select: { entryFeeKzt: true, kaspiPaymentUrl: true } },
      entries: { include: { athlete: true, category: true } },
    },
  });
  if (existing) return existing;

  assertApplicationDeadlineOpen(
    tournament.applicationDeadline ?? tournament.startDate,
  );

  return prisma.application.create({
    data: {
      tournamentId,
      clubId: coach.clubId,
      status: ApplicationStatus.DRAFT,
      notes,
    },
    include: {
      tournament: { select: { entryFeeKzt: true, kaspiPaymentUrl: true } },
      entries: { include: { athlete: true, category: true } },
    },
  });
}

export async function listApplicationsForTournament(
  actorUserId: string,
  tournamentId: string,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor)
    throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);

  const where: Prisma.ApplicationWhereInput = { tournamentId };
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
          weighInStatus: true,
          actualWeightKg: true,
          weighInNotes: true,
          weighedAt: true,
          athlete: {
            select: {
              id: true,
              name: true,
              surname: true,
              gender: true,
              dateOfBirth: true,
              weightKg: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              gender: true,
              ageMin: true,
              ageMax: true,
              weightMin: true,
              weightMax: true,
              format: true,
            },
          },
        },
        orderBy: [
          { category: { ageMin: "asc" } },
          { category: { weightMin: "asc" } },
          { athlete: { surname: "asc" } },
        ],
      },
      _count: { select: { entries: true } },
    },
  });
}

/** ADMIN-only: все заявки по всем турнирам за один запрос. */
export async function listAllApplicationsAdmin(
  status?: string,
  tournamentId?: string,
) {
  const where: Prisma.ApplicationWhereInput = {};
  if (status) where.status = status as ApplicationStatus;
  if (tournamentId) where.tournamentId = tournamentId;

  return prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tournament: {
        select: { id: true, name: true, startDate: true, entryFeeKzt: true },
      },
      club: { select: { id: true, name: true, shortName: true, city: true } },
      _count: { select: { entries: true } },
    },
  });
}

export async function getApplication(
  actorUserId: string,
  applicationId: string,
) {
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
          entryFeeKzt: true,
          kaspiPaymentUrl: true,
        },
      },
      entries: {
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              surname: true,
              gender: true,
              dateOfBirth: true,
              weightKg: true,
              beltRank: true,
            },
          },
          category: true,
          weighedBy: {
            select: { id: true, name: true, surname: true, role: true },
          },
        },
        orderBy: [
          { category: { ageMin: "asc" } },
          { category: { weightMin: "asc" } },
          { athlete: { surname: "asc" } },
        ],
      },
    },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  await assertCanViewApplication(actorUserId, app.clubId);
  return app;
}

export async function listCoachApplications(coachUserId: string) {
  const coach = await prisma.user.findUnique({ where: { id: coachUserId } });
  if (!coach || coach.role !== UserRole.COACH) {
    throw new ApplicationError("FORBIDDEN", "Доступно только тренеру", 403);
  }
  if (!coach.clubId) return [];

  return prisma.application.findMany({
    where: { clubId: coach.clubId },
    orderBy: { createdAt: "desc" },
    include: {
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
          entryFeeKzt: true,
        },
      },
      _count: { select: { entries: true } },
    },
  });
}

export async function listAthleteApplicationEntries(actorUserId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, role: true },
  });
  if (!actor)
    throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role !== UserRole.ATHLETE) {
    throw new ApplicationError(
      "FORBIDDEN",
      "Просмотр доступен только спортсмену",
      403,
    );
  }

  return prisma.applicationEntry.findMany({
    where: { athleteId: actor.id },
    orderBy: { id: "desc" },
    include: {
      category: true,
      weighedBy: {
        select: { id: true, name: true, surname: true, role: true },
      },
      application: {
        select: {
          id: true,
          status: true,
          notes: true,
          reviewerNotes: true,
          submittedAt: true,
          reviewedAt: true,
          club: {
            select: { id: true, name: true, shortName: true, city: true },
          },
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
              tatamiCount: true,
            },
          },
        },
      },
    },
  });
}

// ============================================================
// ENTRIES
// ============================================================

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
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError(
      "LOCKED",
      "Изменять можно только заявку в статусе DRAFT",
      409,
    );
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
    throw new ApplicationError(
      "WRONG_CLUB",
      "Спортсмен не из вашего клуба",
      409,
    );
  }
  if (!category || category.tournamentId !== app.tournamentId) {
    throw new ApplicationError(
      "CATEGORY_MISMATCH",
      "Категория не из этого турнира",
      409,
    );
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

export async function removeEntry(
  actorUserId: string,
  applicationId: string,
  entryId: string,
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );

  const entry = await prisma.applicationEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry || entry.applicationId !== applicationId)
    throw new ApplicationError("ENTRY_NOT_FOUND", "Запись не найдена", 404);

  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor)
    throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);

  const isAthleteSelf =
    actor.role === UserRole.ATHLETE && entry.athleteId === actorUserId;

  if (isAthleteSelf) {
    // Спортсмен может убрать только свою запись, пока заявка не одобрена
    if (
      app.status === ApplicationStatus.APPROVED ||
      app.status === ApplicationStatus.WITHDRAWN
    ) {
      throw new ApplicationError(
        "LOCKED",
        "Убрать запись можно только до одобрения заявки",
        409,
      );
    }
  } else {
    // Тренер/Админ — только в статусе DRAFT
    if (app.status !== ApplicationStatus.DRAFT) {
      throw new ApplicationError("LOCKED", "Изменять можно только DRAFT", 409);
    }
    await assertCanManageApplication(actorUserId, app.clubId);
  }

  await prisma.applicationEntry.delete({ where: { id: entryId } });
}

// ============================================================
// ADMIN-FORCE ENTRY MANAGEMENT (bypass DRAFT/deadline checks)
// Used for weigh-in adjustments after application is APPROVED
// ============================================================

export async function adminForceRemoveEntry(
  applicationId: string,
  entryId: string,
): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );

  const entry = await prisma.applicationEntry.findUnique({
    where: { id: entryId },
  });
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
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );

  const entry = await prisma.applicationEntry.findUnique({
    where: { id: entryId },
    include: { athlete: true },
  });
  if (!entry || entry.applicationId !== applicationId) {
    throw new ApplicationError("ENTRY_NOT_FOUND", "Запись не найдена", 404);
  }

  const category = await prisma.category.findUnique({
    where: { id: newCategoryId },
  });
  if (!category || category.tournamentId !== app.tournamentId) {
    throw new ApplicationError(
      "CATEGORY_MISMATCH",
      "Категория не из этого турнира",
      409,
    );
  }

  // Check duplicate in target category
  const duplicate = await prisma.applicationEntry.findFirst({
    where: {
      athleteId: entry.athleteId,
      categoryId: newCategoryId,
      application: { tournamentId: app.tournamentId },
      NOT: { id: entryId },
    },
  });
  if (duplicate) {
    throw new ApplicationError(
      "DUPLICATE_ENTRY",
      "Спортсмен уже записан в эту категорию",
      409,
    );
  }

  // Atomic move: delete old, create new
  return prisma.$transaction(async (tx) => {
    await tx.applicationEntry.delete({ where: { id: entryId } });
    return tx.applicationEntry.create({
      data: {
        applicationId,
        athleteId: entry.athleteId,
        categoryId: newCategoryId,
      },
      include: { athlete: true, category: true },
    });
  });
}

// ============================================================
// LIFECYCLE (submit / approve / reject / withdraw)
// ============================================================

export async function submit(actorUserId: string, applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      _count: { select: { entries: true } },
      tournament: {
        select: {
          name: true,
          startDate: true,
          applicationDeadline: true,
          entryFeeKzt: true,
          kaspiPaymentUrl: true,
        },
      },
    },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError(
      "INVALID_STATUS",
      "Отправить можно только DRAFT",
      409,
    );
  }
  if (app._count.entries === 0) {
    throw new ApplicationError(
      "EMPTY_APPLICATION",
      "Нельзя отправить пустую заявку",
      409,
    );
  }
  assertApplicationDeadlineOpen(
    app.tournament.applicationDeadline ?? app.tournament.startDate,
  );
  await assertCanManageApplication(actorUserId, app.clubId);

  const paymentAmountKzt =
    Math.max(0, app.tournament.entryFeeKzt) * app._count.entries;
  if (
    paymentAmountKzt > 0 &&
    (app.paymentStatus !== PaymentStatus.PAID ||
      app.paymentAmountKzt < paymentAmountKzt)
  ) {
    throw new ApplicationError(
      "PAYMENT_REQUIRED",
      "Сначала оплатите стартовый взнос в Kaspi, после подтверждения оплаты можно отправить заявку",
      409,
    );
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.SUBMITTED,
      submittedAt: new Date(),
      paymentStatus:
        paymentAmountKzt > 0 ? PaymentStatus.PAID : PaymentStatus.NOT_REQUIRED,
      paymentAmountKzt,
      paymentProvider:
        paymentAmountKzt > 0 ? (app.paymentProvider ?? "KASPI") : null,
      paymentReference: paymentAmountKzt > 0 ? app.paymentReference : null,
      paymentUrl: paymentAmountKzt > 0 ? app.paymentUrl : null,
      paidAt: paymentAmountKzt > 0 ? app.paidAt : null,
    },
  });
  await logAudit({
    actorUserId,
    action: "application.submit",
    targetEntity: "Application",
    targetId: applicationId,
    after: {
      status: "SUBMITTED",
      paymentStatus:
        paymentAmountKzt > 0 ? updated.paymentStatus : "NOT_REQUIRED",
      paymentAmountKzt,
    },
  });
  return updated;
}

export async function initiateKaspiPayment(
  actorUserId: string,
  applicationId: string,
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      _count: { select: { entries: true } },
      tournament: {
        select: {
          name: true,
          startDate: true,
          applicationDeadline: true,
          entryFeeKzt: true,
          kaspiPaymentUrl: true,
        },
      },
    },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (app.status !== ApplicationStatus.DRAFT) {
    throw new ApplicationError(
      "INVALID_STATUS",
      "Оплатить можно только черновик заявки",
      409,
    );
  }
  if (app._count.entries === 0) {
    throw new ApplicationError(
      "EMPTY_APPLICATION",
      "Сначала добавьте спортсменов в заявку",
      409,
    );
  }
  assertApplicationDeadlineOpen(
    app.tournament.applicationDeadline ?? app.tournament.startDate,
  );
  await assertCanManageApplication(actorUserId, app.clubId);

  const paymentAmountKzt =
    Math.max(0, app.tournament.entryFeeKzt) * app._count.entries;
  if (paymentAmountKzt <= 0) {
    return prisma.application.update({
      where: { id: applicationId },
      data: {
        paymentStatus: PaymentStatus.NOT_REQUIRED,
        paymentAmountKzt: 0,
        paymentProvider: null,
        paymentReference: null,
        paymentUrl: null,
        paidAt: null,
      },
    });
  }
  if (!app.tournament.kaspiPaymentUrl) {
    throw new ApplicationError(
      "KASPI_URL_REQUIRED",
      "Админ не указал Kaspi ссылку для этого турнира",
      409,
    );
  }

  const paymentReference =
    app.paymentReference ?? buildPaymentReference(app.id);
  const paymentUrl = buildKaspiPaymentUrl(app.tournament.kaspiPaymentUrl, {
    amountKzt: paymentAmountKzt,
    reference: paymentReference,
    comment: `Judo-Arena ${localizeName(app.tournament.name)} ${app._count.entries} athletes`,
  });
  const hasEnoughConfirmedPayment =
    app.paymentStatus === PaymentStatus.PAID &&
    app.paymentAmountKzt >= paymentAmountKzt;

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      paymentStatus: hasEnoughConfirmedPayment
        ? PaymentStatus.PAID
        : PaymentStatus.PENDING,
      paymentAmountKzt,
      paymentProvider: "KASPI",
      paymentReference,
      paymentUrl,
      paidAt: hasEnoughConfirmedPayment ? app.paidAt : null,
    },
  });
  await logAudit({
    actorUserId,
    action: "application.paymentKaspiStart",
    targetEntity: "Application",
    targetId: applicationId,
    after: {
      paymentStatus: updated.paymentStatus,
      paymentAmountKzt,
      paymentReference,
    },
  });
  return updated;
}

export async function approve(
  actorUserId: string,
  applicationId: string,
  reviewerNotes?: string,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError(
      "FORBIDDEN",
      "Только админ может одобрять заявки",
      403,
    );
  }
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      tournament: { select: { id: true, name: true, entryFeeKzt: true } },
    },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (app.status !== ApplicationStatus.SUBMITTED) {
    throw new ApplicationError(
      "INVALID_STATUS",
      "Одобрять можно только SUBMITTED",
      409,
    );
  }
  if (
    app.tournament.entryFeeKzt > 0 &&
    app.paymentStatus !== PaymentStatus.PAID
  ) {
    throw new ApplicationError(
      "PAYMENT_REQUIRED",
      "Нельзя одобрить заявку до оплаты стартового взноса",
      409,
    );
  }
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.APPROVED,
      reviewedAt: new Date(),
      reviewerNotes,
    },
  });
  await notifyCoachesOfApplicationReview(
    app,
    ApplicationStatus.APPROVED,
    reviewerNotes,
  );
  await logAudit({
    actorUserId,
    action: "application.approve",
    targetEntity: "Application",
    targetId: applicationId,
    after: { status: "APPROVED", reviewerNotes: reviewerNotes ?? null },
  });
  return updated;
}

export async function reject(
  actorUserId: string,
  applicationId: string,
  reviewerNotes?: string,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError(
      "FORBIDDEN",
      "Только админ может отклонять заявки",
      403,
    );
  }
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { tournament: { select: { id: true, name: true } } },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (app.status !== ApplicationStatus.SUBMITTED) {
    throw new ApplicationError(
      "INVALID_STATUS",
      "Отклонять можно только SUBMITTED",
      409,
    );
  }
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatus.REJECTED,
      reviewedAt: new Date(),
      reviewerNotes,
    },
  });
  await notifyCoachesOfApplicationReview(
    app,
    ApplicationStatus.REJECTED,
    reviewerNotes,
  );
  await logAudit({
    actorUserId,
    action: "application.reject",
    targetEntity: "Application",
    targetId: applicationId,
    after: { status: "REJECTED", reviewerNotes: reviewerNotes ?? null },
  });
  return updated;
}

/**
 * AD1: Одобрить все SUBMITTED заявки в турнире за одну операцию.
 * Возвращает количество одобренных.
 */
export async function bulkApprove(
  actorUserId: string,
  tournamentId: string,
  reviewerNotes?: string,
): Promise<{ approved: number }> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError(
      "FORBIDDEN",
      "Только админ может одобрять заявки",
      403,
    );
  }

  const submitted = await prisma.application.findMany({
    where: {
      tournamentId,
      status: ApplicationStatus.SUBMITTED,
      OR: [
        { paymentStatus: PaymentStatus.PAID },
        { paymentStatus: PaymentStatus.NOT_REQUIRED },
        { paymentAmountKzt: 0 },
      ],
    },
    include: { tournament: { select: { id: true, name: true } } },
  });

  if (submitted.length === 0) return { approved: 0 };

  // Обновляем только те же заявки что нашли выше — с тем же фильтром оплаты.
  // Без этого между findMany и updateMany могла проскочить неоплаченная заявка.
  const approvedIds = submitted.map((a) => a.id);
  await prisma.application.updateMany({
    where: { id: { in: approvedIds } },
    data: {
      status: ApplicationStatus.APPROVED,
      reviewedAt: new Date(),
      reviewerNotes: reviewerNotes ?? null,
    },
  });

  await Promise.all(
    submitted.map((app) =>
      logAudit({
        actorUserId,
        action: "application.bulkApprove",
        targetEntity: "Application",
        targetId: app.id,
        before: { status: "SUBMITTED" },
        after: { status: "APPROVED", reviewerNotes: reviewerNotes ?? null },
        metadata: { tournamentId },
      }),
    ),
  );

  // Уведомления для каждого клуба
  await Promise.all(
    submitted.map((app) =>
      notifyCoachesOfApplicationReview(
        app,
        ApplicationStatus.APPROVED,
        reviewerNotes,
      ),
    ),
  );

  return { approved: submitted.length };
}

export async function markPaymentPaid(
  actorUserId: string,
  applicationId: string,
  providerReference?: string,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError(
      "FORBIDDEN",
      "Только админ может подтверждать оплату",
      403,
    );
  }
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (app.paymentAmountKzt <= 0) {
    throw new ApplicationError(
      "PAYMENT_NOT_REQUIRED",
      "Для этой заявки оплата не требуется",
      409,
    );
  }
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentProvider: "KASPI",
      paymentReference: providerReference ?? app.paymentReference,
      paidAt: new Date(),
    },
  });
  await logAudit({
    actorUserId,
    action: "application.paymentPaid",
    targetEntity: "Application",
    targetId: applicationId,
    after: {
      paymentStatus: "PAID",
      paymentAmountKzt: updated.paymentAmountKzt,
      paymentReference: updated.paymentReference,
    },
  });
  return updated;
}

export async function confirmKaspiPayment(reference: string) {
  const app = await prisma.application.findFirst({
    where: { paymentReference: reference },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка по платежу не найдена",
      404,
    );
  if (app.paymentAmountKzt <= 0) {
    throw new ApplicationError(
      "PAYMENT_NOT_REQUIRED",
      "Для этой заявки оплата не требуется",
      409,
    );
  }
  return prisma.application.update({
    where: { id: app.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentProvider: "KASPI",
      paidAt: new Date(),
    },
  });
}

export async function withdraw(actorUserId: string, applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app)
    throw new ApplicationError(
      "APPLICATION_NOT_FOUND",
      "Заявка не найдена",
      404,
    );
  if (
    app.status !== ApplicationStatus.DRAFT &&
    app.status !== ApplicationStatus.SUBMITTED
  ) {
    throw new ApplicationError(
      "INVALID_STATUS",
      "Отозвать можно только DRAFT или SUBMITTED",
      409,
    );
  }
  await assertCanManageApplication(actorUserId, app.clubId);
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: ApplicationStatus.WITHDRAWN },
  });
  await logAudit({
    actorUserId,
    action: "application.withdraw",
    targetEntity: "Application",
    targetId: applicationId,
    after: { status: "WITHDRAWN" },
  });
  return updated;
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

function buildPaymentReference(applicationId: string): string {
  return `JA-${applicationId.slice(-10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

function buildKaspiPaymentUrl(
  template: string | null,
  input: { amountKzt: number; reference: string; comment: string },
): string | null {
  if (!template) return null;
  const replacements: Record<string, string> = {
    amount: String(input.amountKzt),
    amountKzt: String(input.amountKzt),
    reference: input.reference,
    orderId: input.reference,
    comment: input.comment,
  };
  return template.replace(
    /\{(amount|amountKzt|reference|orderId|comment)\}/g,
    (_, key: string) => encodeURIComponent(replacements[key] ?? ""),
  );
}

async function assertCanManageApplication(
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

async function assertCanViewApplication(
  actorUserId: string,
  clubId: string,
): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor)
    throw new ApplicationError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role === UserRole.ADMIN) return;
  if (actor.role === UserRole.COACH && actor.clubId === clubId) return;
  throw new ApplicationError(
    "FORBIDDEN",
    "Просмотр заявки доступен только тренеру клуба или админу",
    403,
  );
}

const notificationText = {
  approved: {
    kk: {
      title: "Өтінім бекітілді",
      body: (t: string, notes?: string) =>
        `${t}: клуб өтінімі бекітілді.${notes ? ` Ескерту: ${notes}` : ""}`,
    },
    ru: {
      title: "Заявка одобрена",
      body: (t: string, notes?: string) =>
        `${t}: заявка клуба одобрена.${notes ? ` Примечание: ${notes}` : ""}`,
    },
    en: {
      title: "Application Approved",
      body: (t: string, notes?: string) =>
        `${t}: club application approved.${notes ? ` Note: ${notes}` : ""}`,
    },
  },
  rejected: {
    kk: {
      title: "Өтінім қайтарылды",
      body: (t: string, notes?: string) =>
        `${t}: өтінімде түзету керек.${notes ? ` Себебі: ${notes}` : ""}`,
    },
    ru: {
      title: "Заявка возвращена",
      body: (t: string, notes?: string) =>
        `${t}: требуется исправление заявки.${notes ? ` Причина: ${notes}` : ""}`,
    },
    en: {
      title: "Application Rejected",
      body: (t: string, notes?: string) =>
        `${t}: application requires correction.${notes ? ` Reason: ${notes}` : ""}`,
    },
  },
};

async function notifyCoachesOfApplicationReview(
  app: {
    id: string;
    clubId: string;
    tournamentId: string;
    tournament?: { name: Prisma.JsonValue } | null;
  },
  status: ApplicationStatus,
  reviewerNotes?: string,
) {
  const coaches = await prisma.user.findMany({
    where: { clubId: app.clubId, role: UserRole.COACH, isActive: true },
    select: { id: true, email: true, preferredLocale: true },
  });
  if (coaches.length === 0) return;

  const tournamentName = localizeName(app.tournament?.name) || "турнир";
  const isApproved = status === ApplicationStatus.APPROVED;
  const templateGroup = isApproved
    ? notificationText.approved
    : notificationText.rejected;

  // In-app уведомления — каждый тренер получает на своём языке
  await prisma.notification.createMany({
    data: coaches.map((coach) => {
      const locale = (coach.preferredLocale ?? "kk") as "kk" | "ru" | "en";
      const tmpl = templateGroup[locale] ?? templateGroup.kk;
      return {
        userId: coach.id,
        type: isApproved ? "application_approved" : "application_rejected",
        titleKey: tmpl.title,
        bodyKey: tmpl.body(tournamentName, reviewerNotes),
        payload: {
          applicationId: app.id,
          tournamentId: app.tournamentId,
          status,
          reviewerNotes: reviewerNotes ?? null,
        },
        locale,
      };
    }),
  });

  // N2: Socket.IO push в личную комнату тренера
  for (const coach of coaches) {
    const locale = (coach.preferredLocale ?? "kk") as "kk" | "ru" | "en";
    const tmpl = templateGroup[locale] ?? templateGroup.kk;
    emitToUser(coach.id, "notification:new", {
      type: isApproved ? "application_approved" : "application_rejected",
      title: tmpl.title,
      body: tmpl.body(tournamentName, reviewerNotes),
    });
  }

  // AP1 / N1: Email-уведомления тренерам
  const emailHtml = isApproved
    ? applicationApprovedHtml(tournamentName, reviewerNotes)
    : applicationRejectedHtml(tournamentName, reviewerNotes);
  const emailSubject = isApproved
    ? `✅ Өтінім бекітілді — ${tournamentName}`
    : `❌ Өтінімде түзету керек — ${tournamentName}`;

  await Promise.all(
    coaches.map((coach) =>
      sendEmail({ to: coach.email, subject: emailSubject, html: emailHtml }),
    ),
  );
}

function localizeName(value: Prisma.JsonValue | null | undefined): string {
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

function assertApplicationDeadlineOpen(deadline: Date) {
  if (new Date() > deadline) {
    throw new ApplicationError(
      "APPLICATION_DEADLINE_PASSED",
      "Дедлайн подачи заявки уже прошёл",
      409,
    );
  }
}
