/**
 * Admin маршруты: Override, Rollback, AuditLog, рейтинг, PDF.
 *
 *   POST   /api/admin/matches/:id/override   — переопределить результат
 *   POST   /api/admin/tournaments/:id/finalize — закрыть турнир + начислить рейтинг
 *   GET    /api/admin/audit-logs             — лог действий
 *
 *   GET    /api/ratings/athletes/:id         — рейтинг спортсмена
 *   GET    /api/ratings/leaderboard          — топ
 *
 *   GET    /api/pdf/diploma?athleteId=&tournamentId=&categoryId= — диплом
 *   GET    /api/pdf/protocol?tournamentId=                       — протокол
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  overrideMatchResult,
  OverrideError,
} from "../services/admin-override.service.js";
import {
  finalizeTournament,
  getAthleteRating,
  getLeaderboard,
  RatingError,
} from "../services/rating.service.js";
import { listAuditLogs } from "../services/audit.service.js";
import {
  generateBracketPdf,
  generateTournamentProtocolPdf,
  PdfError,
} from "../services/pdf.service.js";

const overrideSchema = z
  .object({
    winnerSide: z.enum(["RED", "BLUE"]),
    reason: z.string().min(3).max(500),
  })
  .strict();

const auditQuerySchema = z.object({
  targetEntity: z.string().optional(),
  targetId: z.string().optional(),
  actorUserId: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const leaderboardQuerySchema = z.object({
  categoryId: z.string().optional(),
  clubId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const pdfBracketQuerySchema = z.object({
  bracketId: z.string(),
});

const pdfProtocolQuerySchema = z.object({
  tournamentId: z.string(),
});

function attachErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof OverrideError || err instanceof RatingError || err instanceof PdfError) {
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
// /api/admin/*
// ============================================================
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.post(
    "/matches/:id/override",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { winnerSide, reason } = overrideSchema.parse(request.body);
      return overrideMatchResult(request.user!.sub, request.params.id, winnerSide, reason);
    },
  );

  app.post(
    "/tournaments/:id/finalize",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return finalizeTournament(request.user!.sub, request.params.id);
    },
  );

  app.get(
    "/audit-logs",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request) => {
      const q = auditQuerySchema.parse(request.query);
      return listAuditLogs(q);
    },
  );
}

// ============================================================
// /api/ratings/*
// ============================================================
export async function ratingRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get(
    "/athletes/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getAthleteRating(request.params.id);
    },
  );

  app.get("/leaderboard", async (request) => {
    const q = leaderboardQuerySchema.parse(request.query);
    return getLeaderboard(q);
  });
}

// ============================================================
// /api/pdf/*
// ============================================================
export async function pdfRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  // PDF сетки — расписание матчей до начала турнира
  app.get("/bracket", async (request, reply) => {
    const q = pdfBracketQuerySchema.parse(request.query);
    const buffer = await generateBracketPdf(q.bracketId);
    return reply
      .type("application/pdf")
      .header("Content-Disposition", `attachment; filename="bracket-${q.bracketId}.pdf"`)
      .send(buffer);
  });

  // PDF итогового протокола — после COMPLETED
  app.get("/protocol", async (request, reply) => {
    const q = pdfProtocolQuerySchema.parse(request.query);
    const buffer = await generateTournamentProtocolPdf(q.tournamentId);
    return reply
      .type("application/pdf")
      .header("Content-Disposition", `attachment; filename="protocol-${q.tournamentId}.pdf"`)
      .send(buffer);
  });
}
