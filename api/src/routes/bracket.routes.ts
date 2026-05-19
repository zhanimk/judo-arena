/**
 * Маршруты турнирных сеток.
 *
 *   POST   /api/tournaments/:tournamentId/categories/:categoryId/bracket  — сгенерировать
 *   GET    /api/tournaments/:tournamentId/categories/:categoryId/bracket  — получить
 *   GET    /api/tournaments/:tournamentId/brackets                        — список сеток турнира
 *   GET    /api/brackets/:id                                              — детали по ID
 *   DELETE /api/brackets/:id                                              — удалить (если нет начатых матчей)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  generateBracket,
  getBracket,
  getBracketByCategory,
  listBracketsForTournament,
  prepareTournamentDraw,
  deleteBracket,
  BracketError,
} from "../services/bracket.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

function attachErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof BracketError) {
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

// Подключается с prefix "/api/tournaments"
export async function bracketTournamentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.post<{ Params: { tournamentId: string; categoryId: string } }>(
    "/:tournamentId/categories/:categoryId/bracket",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (
      request: FastifyRequest<{ Params: { tournamentId: string; categoryId: string } }>,
      reply,
    ) => {
      const b = await generateBracket(
        request.user!.sub,
        request.params.tournamentId,
        request.params.categoryId,
      );
      return reply.code(201).send(b);
    },
  );

  app.get<{ Params: { tournamentId: string; categoryId: string } }>(
    "/:tournamentId/categories/:categoryId/bracket",
    async (request: FastifyRequest<{ Params: { tournamentId: string; categoryId: string } }>) => {
      return getBracketByCategory(request.params.tournamentId, request.params.categoryId);
    },
  );

  app.get<{ Params: { tournamentId: string } }>(
    "/:tournamentId/brackets",
    async (request: FastifyRequest<{ Params: { tournamentId: string } }>) => {
      return listBracketsForTournament(request.params.tournamentId);
    },
  );

  app.post<{ Params: { tournamentId: string } }>(
    "/:tournamentId/brackets/prepare",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { tournamentId: string } }>, reply) => {
      const result = await prepareTournamentDraw(request.user!.sub, request.params.tournamentId);
      return reply.code(201).send(result);
    },
  );
}

// Подключается с prefix "/api/brackets"
export async function bracketDirectRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get<{ Params: { id: string } }>("/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return getBracket(request.params.id);
  });

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteBracket(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );
}
