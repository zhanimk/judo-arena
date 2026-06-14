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
import { z } from "zod";
import { attachErrorHandler } from "../lib/error-handler.js";
import { authenticated, adminOnly } from "../lib/route-guards.js";
import {
  broadcast,
  listForUser,
  markAsRead,
  markAllAsRead,
  unreadCount,
  listBroadcasts,
  updateBroadcast,
  deleteBroadcast,
  type BroadcastInput,
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

const updateBroadcastSchema = z
  .object({
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(2000),
  })
  .strict();

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get("/", authenticated, async (request) => {
    const qs = request.query as Record<string, string>;
    return listForUser(request.user!.sub, {
      type: qs.type,
      unreadOnly: qs.unreadOnly === "true",
      limit: qs.limit ? Math.min(parseInt(qs.limit, 10) || 50, 200) : undefined,
    });
  });

  app.get("/unread-count", authenticated, async (request) => {
    return { count: await unreadCount(request.user!.sub) };
  });

  app.post("/mark-read", authenticated, async (request, reply) => {
    await markAllAsRead(request.user!.sub);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>(
    "/:id/read",
    authenticated,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return markAsRead(request.user!.sub, request.params.id);
    },
  );

  app.post("/broadcast", adminOnly, async (request, reply) => {
    const parsed = broadcastSchema.parse(request.body);
    const result = await broadcast(request.user!.sub, {
      type: parsed.type,
      titleKey: parsed.title,
      bodyKey: parsed.body,
      target: parsed as BroadcastInput["target"],
    });
    return reply.code(201).send(result);
  });

  app.get("/broadcasts", adminOnly, async (request) => {
    const query = z
      .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(request.query);
    return listBroadcasts(request.user!.sub, query.limit);
  });

  app.patch<{ Params: { id: string } }>(
    "/broadcasts/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateBroadcastSchema.parse(request.body);
      return updateBroadcast(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/broadcasts/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await deleteBroadcast(
        request.user!.sub,
        request.params.id,
      );
      return reply.send(result);
    },
  );
}
