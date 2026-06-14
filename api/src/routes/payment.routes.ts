/**
 * Платёжные маршруты — FreedomPay KZ.
 *
 *   POST  /api/payments/init                  — создать платёж → redirect URL
 *   POST  /api/payments/webhook               — webhook от FreedomPay (HMAC)
 *   POST  /api/payments/:appId/confirm        — ручное подтверждение (admin)
 *   GET   /api/payments/mock-success          — dev: симуляция успешной оплаты
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { attachErrorHandler } from "../lib/error-handler.js";
import { adminOnly } from "../lib/route-guards.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
  initPayment,
  handleWebhook,
  adminConfirmPayment,
  mockPaymentSuccess,
} from "../services/payment.service.js";

const initSchema = z.object({
  applicationId: z.string().min(1),
});

const confirmSchema = z.object({
  reference: z.string().optional(),
});

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  // Инициировать платёж (авторизованный пользователь — тренер/атлет)
  app.post(
    "/init",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: FastifyRequest, reply) => {
      await authenticate(request, reply);
      if (!request.user) return;

      const { applicationId } = initSchema.parse(request.body);
      const result = await initPayment(applicationId, request.user.email);
      return reply.send(result);
    },
  );

  // Webhook от FreedomPay — без авторизации, с HMAC верификацией внутри сервиса
  app.post(
    "/webhook",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = await handleWebhook(request.body as never);
      return reply.send(result);
    },
  );

  // Ручное подтверждение — только admin
  app.post<{ Params: { appId: string } }>(
    "/:appId/confirm",
    adminOnly,
    async (request, reply) => {
      await authenticate(request, reply);
      if (!request.user) return;
      const { reference } = confirmSchema.parse(request.body ?? {});
      const result = await adminConfirmPayment(request.params.appId, request.user.sub, reference);
      return reply.send(result);
    },
  );

  // Mock success — только dev/staging
  app.get<{ Querystring: { orderId: string } }>(
    "/mock-success",
    { config: { rateLimit: { max: 50, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { orderId } = z
        .object({ orderId: z.string().min(1) })
        .parse(request.query);
      await mockPaymentSuccess(orderId);
      return reply.redirect(`/coach/applications?paymentSuccess=1`);
    },
  );
}
