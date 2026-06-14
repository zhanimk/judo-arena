/**
 * application-payment.service.ts — платёжный флоу заявки.
 *
 * Содержит: initiateKaspiPayment, markPaymentPaid, confirmKaspiPayment
 */

import { prisma } from "../lib/prisma.js";
import { PaymentStatus, UserRole } from "@prisma/client";
import { logAudit } from "./audit.service.js";
import {
  ApplicationError,
  assertCanManageApplication,
  assertApplicationDeadlineOpen,
  localizeName,
} from "./application-shared.js";

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
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.status !== "DRAFT") {
    throw new ApplicationError("INVALID_STATUS", "Оплатить можно только черновик заявки", 409);
  }
  if (app._count.entries === 0) {
    throw new ApplicationError("EMPTY_APPLICATION", "Сначала добавьте спортсменов в заявку", 409);
  }
  assertApplicationDeadlineOpen(
    app.tournament.applicationDeadline ?? app.tournament.startDate,
  );
  await assertCanManageApplication(actorUserId, app.clubId);

  const paymentAmountKzt = Math.max(0, app.tournament.entryFeeKzt) * app._count.entries;
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
    throw new ApplicationError("KASPI_URL_REQUIRED", "Админ не указал Kaspi ссылку для этого турнира", 409);
  }

  const paymentReference = app.paymentReference ?? buildPaymentReference(app.id);
  const paymentUrl = buildKaspiPaymentUrl(app.tournament.kaspiPaymentUrl, {
    amountKzt: paymentAmountKzt,
    reference: paymentReference,
    comment: `Judo-Arena ${localizeName(app.tournament.name)} ${app._count.entries} athletes`,
  });
  const hasEnoughConfirmedPayment =
    app.paymentStatus === PaymentStatus.PAID && app.paymentAmountKzt >= paymentAmountKzt;

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      paymentStatus: hasEnoughConfirmedPayment ? PaymentStatus.PAID : PaymentStatus.PENDING,
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
    after: { paymentStatus: updated.paymentStatus, paymentAmountKzt, paymentReference },
  });
  return updated;
}

export async function markPaymentPaid(
  actorUserId: string,
  applicationId: string,
  providerReference?: string,
) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ApplicationError("FORBIDDEN", "Только админ может подтверждать оплату", 403);
  }
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404);
  if (app.paymentAmountKzt <= 0) {
    throw new ApplicationError("PAYMENT_NOT_REQUIRED", "Для этой заявки оплата не требуется", 409);
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
  if (!app) throw new ApplicationError("APPLICATION_NOT_FOUND", "Заявка по платежу не найдена", 404);
  if (app.paymentAmountKzt <= 0) {
    throw new ApplicationError("PAYMENT_NOT_REQUIRED", "Для этой заявки оплата не требуется", 409);
  }
  // Идемпотентность: если уже оплачена — возвращаем без повторного обновления
  if (app.paymentStatus === PaymentStatus.PAID) return app;

  return prisma.application.update({
    where: { id: app.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentProvider: "KASPI",
      paidAt: new Date(),
    },
  });
}
