import {
  ApplicationStatus,
  PaymentStatus,
  UserRole,
  WeighInStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "./audit.service.js";
import { emitToUser } from "../sockets/io.js";
import type { UpdateWeighInInput } from "../validators/application.schema.js";

export class WeighInError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "WeighInError";
  }
}

export async function getTournamentWeighIn(
  actorUserId: string,
  tournamentId: string,
) {
  await assertCanOperateWeighIn(actorUserId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      weighInLocation: true,
      weighInStart: true,
      weighInEnd: true,
      applications: {
        where: { status: ApplicationStatus.APPROVED },
        orderBy: { createdAt: "asc" },
        include: {
          club: {
            select: {
              id: true,
              name: true,
              shortName: true,
              city: true,
              logoUrl: true,
            },
          },
          entries: {
            orderBy: [
              { athlete: { surname: "asc" } },
              { athlete: { name: "asc" } },
            ],
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
                  avatarUrl: true,
                  preferredLocale: true,
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
                },
              },
              weighedBy: {
                select: { id: true, name: true, surname: true, role: true },
              },
            },
          },
        },
      },
    },
  });
  if (!tournament)
    throw new WeighInError("TOURNAMENT_NOT_FOUND", "Турнир табылмады", 404);
  return tournament;
}

const statusTitles: Record<string, { kk: string; ru: string; en: string }> = {
  PASSED: { kk: "Таразылаудан өтті ✓", ru: "Допущен ✓", en: "Admitted ✓" },
  FAILED_WEIGHT: {
    kk: "Таразылаудан өтпеді (салмақ)",
    ru: "Не допущен (вес)",
    en: "Not admitted (weight)",
  },
  FAILED_DOCUMENTS: {
    kk: "Таразылаудан өтпеді (құжат)",
    ru: "Не допущен (документы)",
    en: "Not admitted (docs)",
  },
  ABSENT: { kk: "Келмеді", ru: "Отсутствует", en: "Absent" },
  WITHDRAWN: {
    kk: "Өтінімнен шығарылды",
    ru: "Снят с соревнований",
    en: "Withdrawn",
  },
};

export async function updateEntryWeighIn(
  actorUserId: string,
  entryId: string,
  input: UpdateWeighInInput,
) {
  await assertCanOperateWeighIn(actorUserId);

  const entry = await prisma.applicationEntry.findUnique({
    where: { id: entryId },
    include: {
      application: {
        select: {
          id: true,
          tournamentId: true,
          status: true,
          paymentStatus: true,
          paymentAmountKzt: true,
          tournament: { select: { name: true } },
        },
      },
      athlete: {
        select: { id: true, name: true, surname: true, preferredLocale: true },
      },
      category: true,
    },
  });
  if (!entry)
    throw new WeighInError(
      "ENTRY_NOT_FOUND",
      "Спортшы өтінімде табылмады",
      404,
    );
  if (entry.application.status !== ApplicationStatus.APPROVED) {
    throw new WeighInError(
      "APPLICATION_NOT_APPROVED",
      "Таразылау тек бекітілген өтінімдер үшін",
      409,
    );
  }
  const paymentCleared =
    entry.application.paymentAmountKzt <= 0 ||
    entry.application.paymentStatus === PaymentStatus.NOT_REQUIRED ||
    entry.application.paymentStatus === PaymentStatus.PAID;
  if (input.status === WeighInStatus.PASSED && !paymentCleared) {
    throw new WeighInError(
      "PAYMENT_REQUIRED",
      "Алдымен клубтың төлемін растаңыз, содан кейін таразылаудан өткізуге болады",
      409,
    );
  }

  const prevStatus = entry.weighInStatus;
  const shouldNotify =
    input.status !== WeighInStatus.PENDING && input.status !== prevStatus;

  // Собираем данные уведомления заранее (до транзакции — не зависит от БД)
  let notifyPayload: {
    athleteId: string;
    title: string;
    body: string;
    locale: "kk" | "ru" | "en";
  } | null = null;
  if (shouldNotify) {
    const locale = (entry.athlete?.preferredLocale ?? "kk") as
      | "kk"
      | "ru"
      | "en";
    const titles = statusTitles[input.status] ?? statusTitles.PASSED;
    const tournamentName =
      typeof entry.application.tournament?.name === "string"
        ? entry.application.tournament.name
        : (entry.application.tournament?.name as Record<string, string>)?.[
            locale
          ] ||
          (entry.application.tournament?.name as Record<string, string>)?.[
            "kk"
          ] ||
          "Жарыс";
    const title = titles[locale];
    const bodyParts = [`${tournamentName}: ${title}`];
    if (input.notes?.trim()) bodyParts.push(input.notes.trim());
    notifyPayload = {
      athleteId: entry.athlete.id,
      title,
      body: bodyParts.join(" — "),
      locale,
    };
  }

  // Обновление записи + уведомление в одной транзакции — атомарность гарантирована
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.applicationEntry.update({
      where: { id: entryId },
      data: {
        weighInStatus: input.status,
        actualWeightKg: null,
        weighInNotes: input.notes?.trim() || null,
        weighedAt: input.status === WeighInStatus.PENDING ? null : new Date(),
        weighedById:
          input.status === WeighInStatus.PENDING ? null : actorUserId,
      },
      include: {
        athlete: true,
        category: true,
        weighedBy: {
          select: { id: true, name: true, surname: true, role: true },
        },
      },
    });

    if (notifyPayload) {
      await tx.notification.create({
        data: {
          userId: notifyPayload.athleteId,
          type: "weighIn.result",
          titleKey: notifyPayload.title,
          bodyKey: notifyPayload.body,
          locale: notifyPayload.locale,
          payload: {
            entryId,
            status: input.status,
            tournamentId: entry.application.tournamentId,
          },
        },
      });
    }

    return result;
  });

  await logAudit({
    actorUserId,
    action: "weighIn.update",
    targetEntity: "ApplicationEntry",
    targetId: entryId,
    before: { weighInStatus: prevStatus },
    after: {
      weighInStatus: updated.weighInStatus,
      notes: updated.weighInNotes,
    },
    metadata: {
      applicationId: entry.application.id,
      tournamentId: entry.application.tournamentId,
    },
  });

  // Socket emit после успешной транзакции — fire and forget
  if (notifyPayload) {
    emitToUser(notifyPayload.athleteId, "notification:new", {
      type: "weighIn.result",
      titleKey: notifyPayload.title,
      bodyKey: notifyPayload.body,
    });
  }

  return updated;
}

async function assertCanOperateWeighIn(actorUserId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor)
    throw new WeighInError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);
  if (actor.role === UserRole.ADMIN) return actor;
  throw new WeighInError(
    "FORBIDDEN",
    "Таразылау модулін тек админ жүргізеді",
    403,
  );
}
