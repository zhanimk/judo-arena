/**
 * Маршруты турниров, категорий и заявок.
 *
 *   Турниры:
 *     GET    /api/tournaments                   — список (public, фильтры)
 *     GET    /api/tournaments/:id               — детали (public)
 *     POST   /api/tournaments                   — создать (ADMIN)
 *     PATCH  /api/tournaments/:id               — изменить (ADMIN)
 *     DELETE /api/tournaments/:id               — удалить (ADMIN, только DRAFT/CANCELLED)
 *     POST   /api/tournaments/:id/status        — сменить статус (ADMIN, lifecycle)
 *
 *   Категории:
 *     GET    /api/tournaments/:id/categories    — список (public)
 *     POST   /api/tournaments/:id/categories    — создать (ADMIN, только DRAFT)
 *     PATCH  /api/categories/:id                — изменить (ADMIN, только DRAFT)
 *     DELETE /api/categories/:id                — удалить (ADMIN, только DRAFT)
 *
 *   Заявки:
 *     GET    /api/tournaments/:id/applications  — список (COACH своего клуба или ADMIN)
 *     POST   /api/tournaments/:id/applications  — создать/получить DRAFT (COACH)
 *     GET    /api/athlete/applications          — заявки текущего спортсмена
 *     GET    /api/applications/:id              — детали
 *     POST   /api/applications/:id/entries      — добавить спортсмена
 *     DELETE /api/applications/:id/entries/:entryId
 *     POST   /api/applications/:id/submit       — отправить
 *     POST   /api/applications/:id/approve      — одобрить (ADMIN)
 *     POST   /api/applications/:id/reject       — отклонить (ADMIN)
 *     POST   /api/applications/:id/withdraw     — отозвать (COACH)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  createTournamentSchema,
  updateTournamentSchema,
  listTournamentsQuerySchema,
  changeStatusSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../validators/tournament.schema.js";
import {
  createApplicationSchema,
  addEntrySchema,
  reviewApplicationSchema,
} from "../validators/application.schema.js";
import {
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  changeStatus,
  deleteTournament,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  TournamentError,
} from "../services/tournament.service.js";
import {
  createOrGetDraftApplication,
  listApplicationsForTournament,
  listAthleteApplicationEntries,
  getApplication,
  addEntry,
  removeEntry,
  submit,
  approve,
  reject,
  withdraw,
  ApplicationError,
} from "../services/application.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

function attachErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof TournamentError || err instanceof ApplicationError) {
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
    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" });
  });
}

// ============================================================
// /api/tournaments/*
// ============================================================

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get("/", async (request) => {
    const q = listTournamentsQuerySchema.parse(request.query);
    return listTournaments(q);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return getTournament(request.params.id);
  });

  app.post(
    "/",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request, reply) => {
      const input = createTournamentSchema.parse(request.body);
      const t = await createTournament(request.user!.sub, input);
      return reply.code(201).send(t);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateTournamentSchema.parse(request.body);
      return updateTournament(request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteTournament(request.params.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/status",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { status } = changeStatusSchema.parse(request.body);
      return changeStatus(request.params.id, status);
    },
  );

  // Категории (вложенные)
  app.get<{ Params: { id: string } }>("/:id/categories", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return listCategories(request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    "/:id/categories",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createCategorySchema.parse(request.body);
      const cat = await createCategory(request.params.id, input);
      return reply.code(201).send(cat);
    },
  );

  // Заявки (вложенные)
  app.get<{ Params: { id: string } }>(
    "/:id/applications",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return listApplicationsForTournament(request.user!.sub, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/applications",
    { preHandler: [authenticate, authorize("COACH")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { notes } = createApplicationSchema.parse(request.body ?? {});
      const app2 = await createOrGetDraftApplication(request.user!.sub, request.params.id, notes);
      return reply.code(201).send(app2);
    },
  );
}

// ============================================================
// /api/categories/:id, /api/applications/*
// ============================================================

export async function tournamentAdjacentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  // Категории
  app.patch<{ Params: { id: string } }>(
    "/categories/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateCategorySchema.parse(request.body);
      return updateCategory(request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/categories/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteCategory(request.params.id);
      return reply.code(204).send();
    },
  );

  app.get(
    "/athlete/applications",
    { preHandler: [authenticate, authorize("ATHLETE")] },
    async (request) => {
      return listAthleteApplicationEntries(request.user!.sub);
    },
  );

  // Заявки
  app.get<{ Params: { id: string } }>(
    "/applications/:id",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getApplication(request.user!.sub, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/entries",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { athleteId, categoryId } = addEntrySchema.parse(request.body);
      const entry = await addEntry(request.user!.sub, request.params.id, athleteId, categoryId);
      return reply.code(201).send(entry);
    },
  );

  app.delete<{ Params: { id: string; entryId: string } }>(
    "/applications/:id/entries/:entryId",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string; entryId: string } }>, reply) => {
      await removeEntry(request.user!.sub, request.params.id, request.params.entryId);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/submit",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return submit(request.user!.sub, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/approve",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { reviewerNotes } = reviewApplicationSchema.parse(request.body ?? {});
      return approve(request.user!.sub, request.params.id, reviewerNotes);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/reject",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { reviewerNotes } = reviewApplicationSchema.parse(request.body ?? {});
      return reject(request.user!.sub, request.params.id, reviewerNotes);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/withdraw",
    { preHandler: [authenticate, authorize("COACH", "ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return withdraw(request.user!.sub, request.params.id);
    },
  );
}
