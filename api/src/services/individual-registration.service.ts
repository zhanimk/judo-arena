import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import {
  ApplicationError,
  validateAthleteFitsCategory,
  assertApplicationDeadlineOpen,
} from "./application-shared.js";
import { isAdult } from "./category-age.js";
import { logAudit } from "./audit.service.js";

export interface ManualParticipant {
  name: string;
  surname: string;
  dateOfBirth: Date;
  gender: "MALE" | "FEMALE";
  weightKg: number;
  email?: string;
}

/** Independent entries retain the same review, payment and weigh-in lifecycle as club entries. */
export async function registerIndividual(
  actorId: string,
  tournamentId: string,
  categoryId: string,
  manual?: { athleteId?: string; participant?: ManualParticipant },
) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  const admin = manual !== undefined;
  if (
    !actor ||
    !actor.isActive ||
    actor.deletedAt ||
    actor.role !== (admin ? "ADMIN" : "ATHLETE")
  ) {
    throw new ApplicationError("FORBIDDEN", "Недостаточно прав", 403);
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!tournament || !category || category.tournamentId !== tournamentId) {
    throw new ApplicationError(
      "CATEGORY_NOT_FOUND",
      "Категория турнира не найдена",
      404,
    );
  }
  if (admin) {
    if (
      !["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(
        tournament.status,
      )
    ) {
      throw new ApplicationError(
        "REGISTRATION_CLOSED",
        "Нельзя добавлять участников после начала турнира",
        409,
      );
    }
  } else {
    if (
      tournament.status !== "REGISTRATION_OPEN" ||
      !tournament.selfRegistrationEnabled ||
      tournament.audience === "CHILD"
    ) {
      throw new ApplicationError(
        "SELF_REGISTRATION_DISABLED",
        "Самостоятельные заявки на этот турнир закрыты",
        409,
      );
    }
    assertApplicationDeadlineOpen(
      tournament.applicationDeadline ?? tournament.startDate,
    );
    if (!isAdult(actor.dateOfBirth))
      throw new ApplicationError(
        "ADULT_REQUIRED",
        "Самостоятельная подача доступна с 18 полных лет. Детей заявляет тренер или администратор",
        403,
      );
  }
  const existingAthlete =
    admin && manual.athleteId
      ? await prisma.user.findUnique({ where: { id: manual.athleteId } })
      : admin
        ? null
        : actor;
  if (admin && !existingAthlete && !manual.participant)
    throw new ApplicationError(
      "ATHLETE_NOT_FOUND",
      "Выберите спортсмена или заполните нового участника",
      404,
    );
  if (
    existingAthlete &&
    (existingAthlete.role !== "ATHLETE" ||
      !existingAthlete.isActive ||
      existingAthlete.deletedAt)
  ) {
    throw new ApplicationError("INVALID_ATHLETE", "Спортсмен недоступен", 409);
  }
  // A random discarded password does not give the administrator access to an existing account.
  const newData =
    !existingAthlete && manual?.participant
      ? {
          ...manual.participant,
          email:
            manual.participant.email?.toLowerCase().trim() ??
            `${randomUUID()}@manual.invalid`,
          passwordHash: await bcrypt.hash(randomUUID(), env.BCRYPT_ROUNDS),
          role: "ATHLETE" as const,
        }
      : null;
  const athlete =
    existingAthlete ??
    (newData ? { ...actor, ...newData, clubId: null } : actor);
  await validateAthleteFitsCategory(athlete, category);
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Recheck draw existence inside the registration transaction.
        if (await tx.bracket.findFirst({ where: { categoryId } }))
          throw new ApplicationError(
            "BRACKET_EXISTS",
            "Сетка категории уже создана",
            409,
          );
        const participant =
          existingAthlete ?? (await tx.user.create({ data: newData! }));
        const duplicate = await tx.applicationEntry.findFirst({
          where: { athleteId: participant.id, categoryId },
        });
        if (duplicate)
          throw new ApplicationError(
            "DUPLICATE_ENTRY",
            "Спортсмен уже заявлен в эту категорию",
            409,
          );
        let application = await tx.application.findUnique({
          where: {
            tournamentId_applicantId: {
              tournamentId,
              applicantId: participant.id,
            },
          },
        });
        if (
          application &&
          application.status !== "DRAFT" &&
          !(admin && application.status === "SUBMITTED")
        )
          throw new ApplicationError(
            "APPLICATION_LOCKED",
            "Заявка уже отправлена. Изменения выполняет администратор после отзыва",
            409,
          );
        if (!application)
          application = await tx.application.create({
            data: {
              tournamentId,
              applicantId: participant.id,
              source: admin ? "ADMIN" : "SELF",
            },
          });
        await tx.applicationEntry.create({
          data: {
            applicationId: application.id,
            athleteId: participant.id,
            categoryId,
          },
        });
        const count = await tx.applicationEntry.count({
          where: { applicationId: application.id },
        });
        const amount = tournament.entryFeeKzt * count;
        const alreadyPaid =
          application.paymentStatus === "PAID" &&
          application.paymentAmountKzt >= amount;
        // Never silently mark manual participants as paid or weighed in.
        return tx.application.update({
          where: { id: application.id },
          data: {
            paymentAmountKzt: amount,
            paymentStatus: amount
              ? alreadyPaid
                ? "PAID"
                : "PENDING"
              : "NOT_REQUIRED",
            ...(admin || !amount
              ? { status: "SUBMITTED", submittedAt: new Date() }
              : {}),
          },
          include: {
            entries: {
              include: {
                athlete: { select: { id: true, name: true, surname: true } },
                category: true,
              },
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await logAudit({
      actorUserId: actorId,
      action: admin ? "application.manual_create" : "application.self_create",
      targetEntity: "Application",
      targetId: result.id,
      after: { tournamentId, categoryId, source: result.source },
    });
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    ) {
      throw new ApplicationError(
        "REGISTRATION_CONFLICT",
        "Участник уже зарегистрирован или заявка изменилась. Обновите страницу",
        409,
      );
    }
    throw error;
  }
}
