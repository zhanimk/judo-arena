/**
 * Платёжный сервис — FreedomPay KZ (freedompay.kz).
 *
 * Документация: https://docs.freedompay.kz/api
 *
 * Флоу:
 *  1. POST /api/payments/init   → initPayment() → redirect URL для юзера
 *  2. FreedomPay делает POST на /api/payments/webhook (HMAC-SHA256)
 *  3. POST /api/payments/confirm → adminConfirmPayment() (ручное подтверждение fallback)
 */

import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { PaymentStatus } from "@prisma/client";

export class PaymentError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

// ── FreedomPay API types ───────────────────────────────────────────────────

interface FreedomPayInitRequest {
  merchant_id: string;
  order_id: string;
  amount: number;       // сумма в тиын (KZT × 100)
  currency: "KZT";
  description: string;
  success_url: string;
  fail_url: string;
  back_url: string;
  customer_email?: string;
  lang?: "ru" | "kk" | "en";
}

interface FreedomPayInitResponse {
  status: "success" | "error";
  payment_id?: string;
  payment_url?: string;
  error?: string;
}

interface FreedomPayWebhookPayload {
  payment_id: string;
  order_id: string;
  status: "PAID" | "FAILED" | "PENDING" | "REFUNDED";
  amount: number;
  currency: string;
  merchant_id: string;
  sign: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSign(params: Record<string, string | number>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => k !== "sign")
    .map((k) => `${k}=${params[k]}`)
    .join(";");
  return crypto.createHmac("sha256", secret).update(sorted).digest("hex");
}

// ── Init payment ───────────────────────────────────────────────────────────

export async function initPayment(applicationId: string, userEmail?: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { tournament: { select: { name: true, entryFeeKzt: true } } },
  });

  if (!app) throw new PaymentError("NOT_FOUND", "Application not found", 404);
  if (app.paymentStatus === PaymentStatus.PAID) {
    throw new PaymentError("ALREADY_PAID", "Заявка уже оплачена");
  }
  if (app.paymentStatus === PaymentStatus.NOT_REQUIRED) {
    throw new PaymentError("NOT_REQUIRED", "Оплата не требуется");
  }

  const amountKzt = app.paymentAmountKzt || app.tournament.entryFeeKzt;
  if (!amountKzt || amountKzt <= 0) {
    throw new PaymentError("AMOUNT_ZERO", "Сумма оплаты не задана");
  }

  // Если FreedomPay не сконфигурирован — возвращаем mock URL для разработки
  if (!env.FREEDOMPAY_MERCHANT_ID || !env.FREEDOMPAY_SECRET_KEY) {
    const mockUrl = `${env.APP_URL}/api/payments/mock-success?orderId=${applicationId}`;
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        paymentStatus: PaymentStatus.PENDING,
        paymentProvider: "FREEDOMPAY",
        paymentReference: `mock-${applicationId.slice(-8)}`,
        paymentUrl: mockUrl,
        paymentAmountKzt: amountKzt,
      },
    });
    return { paymentUrl: mockUrl, paymentId: `mock-${applicationId.slice(-8)}`, isMock: true };
  }

  const orderId = applicationId;
  const tournamentName =
    typeof app.tournament.name === "object" && app.tournament.name !== null
      ? ((app.tournament.name as Record<string, string>).kk ??
        (app.tournament.name as Record<string, string>).ru ??
        "Турнир")
      : String(app.tournament.name);

  const payload: FreedomPayInitRequest = {
    merchant_id: env.FREEDOMPAY_MERCHANT_ID,
    order_id: orderId,
    amount: amountKzt * 100,
    currency: "KZT",
    description: `Старт жарнасы: ${tournamentName}`,
    success_url: `${env.APP_URL}/payment/success?orderId=${orderId}`,
    fail_url: `${env.APP_URL}/payment/fail?orderId=${orderId}`,
    back_url: `${env.APP_URL}/coach/applications`,
    customer_email: userEmail,
    lang: "kk",
  };

  const sign = buildSign(
    payload as unknown as Record<string, string | number>,
    env.FREEDOMPAY_SECRET_KEY,
  );

  const resp = await fetch(`${env.FREEDOMPAY_API_URL}/v2/payment/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, sign }),
  });

  if (!resp.ok) {
    throw new PaymentError("GATEWAY_ERROR", `FreedomPay вернул ${resp.status}`, 502);
  }

  const data = (await resp.json()) as FreedomPayInitResponse;
  if (data.status !== "success" || !data.payment_url) {
    throw new PaymentError("GATEWAY_DECLINED", data.error ?? "Шлюз отклонил платёж", 502);
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      paymentStatus: PaymentStatus.PENDING,
      paymentProvider: "FREEDOMPAY",
      paymentReference: data.payment_id ?? null,
      paymentUrl: data.payment_url,
      paymentAmountKzt: amountKzt,
    },
  });

  return { paymentUrl: data.payment_url, paymentId: data.payment_id, isMock: false };
}

// ── Webhook (HMAC-SHA256 верификация) ─────────────────────────────────────

export async function handleWebhook(payload: FreedomPayWebhookPayload): Promise<{ ok: boolean }> {
  if (!env.FREEDOMPAY_SECRET_KEY) {
    throw new PaymentError("NOT_CONFIGURED", "FreedomPay не настроен", 503);
  }

  const { sign, ...rest } = payload;
  const expected = buildSign(rest as unknown as Record<string, string | number>, env.FREEDOMPAY_SECRET_KEY);
  if (sign !== expected) {
    throw new PaymentError("INVALID_SIGN", "Неверная подпись webhook", 400);
  }

  const applicationId = payload.order_id;
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { ok: true }; // idempotent — неизвестный orderId игнорируем

  // Идемпотентность: если уже PAID — просто подтверждаем без повторного обновления
  if (app.paymentStatus === PaymentStatus.PAID) return { ok: true };

  // Проверка суммы: webhook должен подтверждать ту же сумму что была инициирована
  const expectedAmount = (app.paymentAmountKzt ?? 0) * 100;
  if (payload.status === "PAID" && expectedAmount > 0 && payload.amount !== expectedAmount) {
    throw new PaymentError(
      "AMOUNT_MISMATCH",
      `Сумма в webhook (${payload.amount}) не совпадает с ожидаемой (${expectedAmount})`,
      400,
    );
  }

  const newStatus =
    payload.status === "PAID"
      ? PaymentStatus.PAID
      : payload.status === "FAILED"
        ? PaymentStatus.FAILED
        : null;

  if (newStatus) {
    // updateMany + WHERE guard гарантирует атомарность: два одновременных webhook
    // не могут оба записать PAID — второй найдёт 0 строк и ничего не сделает
    await prisma.application.updateMany({
      where: {
        id: applicationId,
        paymentStatus: { not: PaymentStatus.PAID },
      },
      data: {
        paymentStatus: newStatus,
        paymentReference: payload.payment_id,
        paidAt: newStatus === PaymentStatus.PAID ? new Date() : null,
      },
    });
  }

  return { ok: true };
}

// ── Ручное подтверждение (admin fallback) ─────────────────────────────────

export async function adminConfirmPayment(
  applicationId: string,
  actorId: string,
  reference?: string,
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new PaymentError("NOT_FOUND", "Заявка не найдена", 404);
  if (app.paymentStatus === PaymentStatus.PAID) {
    throw new PaymentError("ALREADY_PAID", "Уже помечено как оплачено");
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentProvider: app.paymentProvider ?? "MANUAL",
      paymentReference: reference ?? app.paymentReference ?? `manual-${actorId.slice(-6)}`,
      paidAt: new Date(),
    },
  });

  return { ok: true };
}

// ── Mock success (dev/staging only) ─────────────────────────────────────

export async function mockPaymentSuccess(orderId: string) {
  if (env.NODE_ENV === "production") {
    throw new PaymentError("FORBIDDEN", "Mock недоступен в production", 403);
  }
  await prisma.application.update({
    where: { id: orderId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paidAt: new Date(),
    },
  });
  return { ok: true };
}
