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
import { ZodError } from "zod";
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
  updateAthlete,
  detachAthleteFromClub,
  ClubError,
} from "../services/club.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

export async function clubRoutes(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ClubError) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Невалидные данные",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if ((err as any).statusCode === 429) return reply.code(429).send({ error: "RATE_LIMIT", message: "Превышен лимит запросов" });
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" });
  });

  // ============================================================
  // КЛУБЫ
  // ============================================================

  app.get("/", async (request) => {
    const q = listClubsQuerySchema.parse(request.query);
    return listClubs(q);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return getClub(request.params.id);
  });

  app.post(
    "/",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request, reply) => {
      const input = createClubSchema.parse(request.body);
      const club = await createClub(request.user!.sub, input);
      return reply.code(201).send(club);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateClubSchema.parse(request.body);
      return updateClub(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteClub(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // ============================================================
  // ГРУППЫ (вложены под /clubs/:id/groups)
  // ============================================================

  app.get<{ Params: { id: string } }>("/:id/groups", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return listClubGroups(request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    "/:id/groups",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createClubGroupSchema.parse(request.body);
      const group = await createClubGroup(request.user!.sub, request.params.id, input);
      return reply.code(201).send(group);
    },
  );

  // ============================================================
  // СПОРТСМЕНЫ КЛУБА
  // ============================================================

  app.get<{ Params: { id: string } }>("/:id/members", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return listClubMembers(request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    "/:id/athletes",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createAthleteByCoachSchema.parse(request.body);
      const athlete = await createAthleteByCoach(request.user!.sub, request.params.id, input);
      return reply.code(201).send(athlete);
    },
  );
}

// ============================================================
// Отдельные роуты для управления группами и спортсменами по их ID
// (регистрируются с префиксом /api в server.ts)
// ============================================================

export async function clubAdjacentRoutes(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ClubError) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Невалидные данные",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if ((err as any).statusCode === 429) return reply.code(429).send({ error: "RATE_LIMIT", message: "Превышен лимит запросов" });
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" });
  });

  // Группы
  app.patch<{ Params: { id: string } }>(
    "/club-groups/:id",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateClubGroupSchema.parse(request.body);
      return updateClubGroup(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/club-groups/:id",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteClubGroup(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // Спортсмены
  app.patch<{ Params: { id: string } }>(
    "/athletes/:id",
    { preHandler: [authenticate] },  // Любой авторизованный, права проверяются внутри
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateAthleteSchema.parse(request.body);
      return updateAthlete(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/athletes/:id/club",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await detachAthleteFromClub(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );
}
