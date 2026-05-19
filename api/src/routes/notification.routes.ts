/**
 * Маршруты уведомлений.
 *
 *   GET    /api/notifications              — список моих
 *   GET    /api/notifications/unread-count — счётчик непрочитанных
 *   POST   /api/notifications/mark-read    — отметить ВСЕ как прочитанные
 *   POST   /api/notifications/:id/read     — отметить одно
 *   POST   /api/notifications/broadcast    — рассылка (ADMIN)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  broadcast,
  listForUser,
  markAsRead,
  markAllAsRead,
  unreadCount,
  NotificationError,
} from "../services/notification.service.js";

const broadcastSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user"),
    userId: z.string(),
    title: z.string().min(1),
    body: z.string().min(1),
    type: z.string().default("announcement"),
  }),
  z.object({
    kind: z.literal("role"),
    role: z.enum(["ATHLETE", "COACH", "ADMIN"]),
    title: z.string().min(1),
    body: z.string().min(1),
    type: z.string().default("announcement"),
  }),
  z.object({
    kind: z.literal("tournament"),
    tournamentId: z.string(),
    title: z.string().min(1),
    body: z.string().min(1),
    type: z.string().default("tournament_update"),
  }),
  z.object({
    kind: z.literal("club"),
    clubId: z.string(),
    title: z.string().min(1),
    body: z.string().min(1),
    type: z.string().default("announcement"),
  }),
  z.object({
    kind: z.literal("all"),
    title: z.string().min(1),
    body: z.string().min(1),
    type: z.string().default("announcement"),
  }),
]);

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotificationError) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Невалидные данные",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

  app.get("/", { preHandler: [authenticate] }, async (request) => {
    return listForUser(request.user!.sub);
  });

  app.get("/unread-count", { preHandler: [authenticate] }, async (request) => {
    return { count: await unreadCount(request.user!.sub) };
  });

  app.post("/mark-read", { preHandler: [authenticate] }, async (request, reply) => {
    await markAllAsRead(request.user!.sub);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>(
    "/:id/read",
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return markAsRead(request.user!.sub, request.params.id);
    },
  );

  app.post(
    "/broadcast",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request, reply) => {
      const parsed = broadcastSchema.parse(request.body);
      const result = await broadcast(request.user!.sub, {
        type: parsed.type,
        titleKey: parsed.title,
        bodyKey: parsed.body,
        target: parsed as any,
      });
      return reply.code(201).send(result);
    },
  );
}
