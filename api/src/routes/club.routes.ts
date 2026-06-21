/**
 * Маршруты клубов, групп и управления спортсменами клуба.
 *
 *   Клубы:
 *     GET    /api/clubs                       — список (public)
 *     GET    /api/clubs/:id                   — детали (public)
 *     POST   /api/clubs                       — создать (COACH, ADMIN)
 *     PATCH  /api/clubs/:id                   — изменить (создатель или ADMIN)
 *     DELETE /api/clubs/:id                   — удалить (ADMIN)
 *
 *   Группы:
 *     GET    /api/clubs/:id/groups            — список групп клуба (public)
 *     POST   /api/clubs/:id/groups            — создать группу
 *     PATCH  /api/club-groups/:id             — изменить группу
 *     DELETE /api/club-groups/:id             — удалить группу
 *
 *   Спортсмены:
 *     GET    /api/clubs/:id/members           — список спортсменов клуба
 *     POST   /api/clubs/:id/athletes          — прокси-регистрация
 *     PATCH  /api/athletes/:id                — изменить профиль
 *     DELETE /api/athletes/:id/club           — отвязать от клуба
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { attachErrorHandler } from "../lib/error-handler.js";
import {
  requestJoinClub,
  listPendingRequests,
  reviewJoinRequest,
  listMyJoinRequests,
  cancelJoinRequest,
} from "../services/club-join.service.js";
import {
  requestJoinClubAsCoach,
  listMyCoachJoinRequests,
  cancelCoachJoinRequest,
  listPendingCoachRequests,
  reviewCoachJoinRequest,
  removeCoachFromClub,
  transferClubOwnership,
} from "../services/coach-club-join.service.js";
import {
  createClubSchema,
  updateClubSchema,
  listClubsQuerySchema,
  createClubGroupSchema,
  updateClubGroupSchema,
  createAthleteByCoachSchema,
  updateAthleteSchema,
} from "../validators/club.schema.js";
import {
  listClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  listClubGroups,
  createClubGroup,
  updateClubGroup,
  deleteClubGroup,
  listClubMembers,
  createAthleteByCoach,
  bulkImportAthletes,
  updateAthlete,
  detachAthleteFromClub,
  getClubAnalytics,
} from "../services/club.service.js";
import {
  adminOnly,
  coachOrAdmin,
  coachOnly,
  athleteOnly,
  anyRole,
} from "../lib/route-guards.js";

export async function clubRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get<{ Params: { id: string } }>(
    "/:id/analytics",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getClubAnalytics(request.user!.sub, request.params.id);
    },
  );

  // ============================================================
  // КЛУБЫ
  // ============================================================

  app.get("/", async (request) => {
    const q = listClubsQuerySchema.parse(request.query);
    return listClubs(q);
  });

  app.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getClub(request.params.id);
    },
  );

  app.post("/", coachOrAdmin, async (request, reply) => {
    const input = createClubSchema.parse(request.body);
    const club = await createClub(request.user!.sub, input);
    return reply.code(201).send(club);
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateClubSchema.parse(request.body);
      return updateClub(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteClub(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // ============================================================
  // ГРУППЫ (вложены под /clubs/:id/groups)
  // ============================================================

  app.get<{ Params: { id: string } }>(
    "/:id/groups",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return listClubGroups(request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/groups",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createClubGroupSchema.parse(request.body);
      const group = await createClubGroup(
        request.user!.sub,
        request.params.id,
        input,
      );
      return reply.code(201).send(group);
    },
  );

  // ============================================================
  // СПОРТСМЕНЫ КЛУБА
  // ============================================================

  app.get<{ Params: { id: string } }>(
    "/:id/members",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return listClubMembers(request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/athletes",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createAthleteByCoachSchema.parse(request.body);
      const athlete = await createAthleteByCoach(
        request.user!.sub,
        request.params.id,
        input,
      );
      return reply.code(201).send(athlete);
    },
  );

  // ---- POST /:id/athletes/bulk-import — до 200 спортсменов за раз ----
  app.post<{ Params: { id: string }; Body: { rows?: unknown[] } }>(
    "/:id/athletes/bulk-import",
    coachOrAdmin,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { rows?: unknown[] };
      }>,
      reply,
    ) => {
      const { rows } = request.body ?? {};
      if (!Array.isArray(rows)) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          message: "rows должен быть массивом",
        });
      }
      const result = await bulkImportAthletes(
        request.user!.sub,
        request.params.id,
        rows as Parameters<typeof bulkImportAthletes>[2],
      );
      return reply.code(207).send(result);
    },
  );
}

// ============================================================
// Отдельные роуты для управления группами и спортсменами по их ID
// (регистрируются с префиксом /api в server.ts)
// ============================================================

export async function clubAdjacentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  // Группы
  app.patch<{ Params: { id: string } }>(
    "/club-groups/:id",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateClubGroupSchema.parse(request.body);
      return updateClubGroup(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/club-groups/:id",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteClubGroup(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // Спортсмены
  app.patch<{ Params: { id: string } }>(
    "/athletes/:id",
    anyRole,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateAthleteSchema.parse(request.body);
      return updateAthlete(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/athletes/:id/club",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await detachAthleteFromClub(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // ── Клубқа өтінімдер (ClubJoinRequest) ──

  // Спортсмен: отправить заявку в клуб
  app.post<{ Params: { id: string } }>(
    "/clubs/:id/join-request",
    athleteOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await requestJoinClub(
        request.user!.sub,
        request.params.id,
      );
      return reply.code(201).send(result);
    },
  );

  // Спортсмен: посмотреть свои заявки
  app.get("/athlete/join-requests", athleteOnly, async (request) =>
    listMyJoinRequests(request.user!.sub),
  );

  // Спортсмен: отозвать заявку
  app.delete<{ Params: { id: string } }>(
    "/athlete/join-requests/:id",
    athleteOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await cancelJoinRequest(
        request.user!.sub,
        request.params.id,
      );
      return reply.send(result);
    },
  );

  // Тренер: посмотреть входящие PENDING заявки своего клуба
  app.get("/coach/join-requests", coachOnly, async (request) =>
    listPendingRequests(request.user!.sub),
  );

  // Тренер: одобрить или отклонить заявку
  app.post<{ Params: { id: string } }>(
    "/coach/join-requests/:id/review",
    coachOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { approve } = z
        .object({ approve: z.boolean() })
        .parse(request.body);
      return reviewJoinRequest(request.user!.sub, request.params.id, approve);
    },
  );

  // ── Тренерлердің клубқа кіру өтінімдері ──

  app.post<{ Params: { id: string } }>(
    "/clubs/:id/coach-join-request",
    coachOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await requestJoinClubAsCoach(
        request.user!.sub,
        request.params.id,
      );
      return reply.code(201).send(result);
    },
  );

  app.get("/coach/club-join-requests", coachOnly, async (request) =>
    listMyCoachJoinRequests(request.user!.sub),
  );

  app.delete<{ Params: { id: string } }>(
    "/coach/club-join-requests/:id",
    coachOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return cancelCoachJoinRequest(request.user!.sub, request.params.id);
    },
  );

  app.get("/coach/club-join-requests/incoming", coachOnly, async (request) =>
    listPendingCoachRequests(request.user!.sub),
  );

  app.post<{ Params: { id: string } }>(
    "/coach/club-join-requests/:id/review",
    coachOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { approve } = z
        .object({ approve: z.boolean() })
        .parse(request.body);
      return reviewCoachJoinRequest(
        request.user!.sub,
        request.params.id,
        approve,
      );
    },
  );

  app.delete<{ Params: { clubId: string; coachId: string } }>(
    "/clubs/:clubId/coaches/:coachId",
    coachOrAdmin,
    async (
      request: FastifyRequest<{ Params: { clubId: string; coachId: string } }>,
    ) => {
      return removeCoachFromClub(
        request.user!.sub,
        request.params.clubId,
        request.params.coachId,
      );
    },
  );

  app.post<{ Params: { clubId: string; coachId: string } }>(
    "/clubs/:clubId/coaches/:coachId/transfer-owner",
    coachOrAdmin,
    async (
      request: FastifyRequest<{ Params: { clubId: string; coachId: string } }>,
    ) => {
      return transferClubOwnership(
        request.user!.sub,
        request.params.clubId,
        request.params.coachId,
      );
    },
  );
}
