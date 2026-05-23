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
  getClubLeaderboard,
  RatingError,
} from "../services/rating.service.js";
import { listAuditLogs } from "../services/audit.service.js";
import {
  toggleClubBlock,
  getClubFullDetails,
  listAllUsers,
  getUserDetails,
  toggleUserBlock,
  setTournamentFeatured,
  archiveTournament,
  getSystemConfig,
  updateSystemConfig,
  getStats,
  createUserByAdmin,
  updateUserByAdmin,
  changeUserClub,
  resetUserPassword,
  createClubByAdmin,
  updateClubByAdmin,
  deleteClubByAdmin,
  createGroupByAdmin,
  updateGroupByAdmin,
  deleteGroupByAdmin,
  AdminManagementError,
} from "../services/admin-management.service.js";
import {
  generateBracketPdf,
  generateTournamentProtocolPdf,
  generateDiplomaPdf,
  PdfError,
} from "../services/pdf.service.js";
import {
  adminForceRemoveEntry,
  adminForceMoveEntry,
} from "../services/application.service.js";

const overrideSchema = z
  .object({
    winnerSide: z.enum(["RED", "BLUE"]),
    reason: z.string().min(3).max(500),
  })
  .strict();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ATHLETE", "COACH", "ADMIN"]),
  name: z.string().min(1),
  surname: z.string().min(1),
  nameLatin: z.string().optional(),
  surnameLatin: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  weightKg: z.number().positive().optional(),
  beltRank: z.string().optional(),
  phone: z.string().optional(),
  preferredLocale: z.enum(["ru", "kk", "en"]).optional(),
  clubId: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  nameLatin: z.string().nullable().optional(),
  surnameLatin: z.string().nullable().optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  weightKg: z.number().positive().nullable().optional(),
  beltRank: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  preferredLocale: z.enum(["ru", "kk", "en"]).optional(),
});

const clubNameSchema = z.object({ ru: z.string().min(1), kk: z.string().optional(), en: z.string().optional() });

const createClubSchema = z.object({
  name: clubNameSchema,
  city: z.string().min(1),
  country: z.string().optional(),
  shortName: z.string().optional(),
  description: z.object({ ru: z.string().optional(), kk: z.string().optional(), en: z.string().optional() }).optional(),
});

const updateClubSchema = z.object({
  name: clubNameSchema.optional(),
  city: z.string().min(1).optional(),
  country: z.string().optional(),
  shortName: z.string().nullable().optional(),
  description: z.object({ ru: z.string().optional(), kk: z.string().optional(), en: z.string().optional() }).nullable().optional(),
});

const groupSchema = z.object({
  name: z.string().min(1),
  ageMin: z.number().int().min(0),
  ageMax: z.number().int().min(0),
});

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
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

const pdfBracketQuerySchema = z.object({
  bracketId: z.string(),
});

const pdfProtocolQuerySchema = z.object({
  tournamentId: z.string(),
});

const pdfDiplomaQuerySchema = z.object({
  athleteId: z.string(),
  tournamentId: z.string(),
  categoryId: z.string(),
});

function attachErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof OverrideError || err instanceof RatingError || err instanceof PdfError || err instanceof AdminManagementError) {
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
}

// ============================================================
// /api/admin/*
// ============================================================
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.post<{ Params: { id: string } }>(
    "/matches/:id/override",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { winnerSide, reason } = overrideSchema.parse(request.body);
      return overrideMatchResult(request.user!.sub, request.params.id, winnerSide, reason);
    },
  );

  app.post<{ Params: { id: string } }>(
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

  // ============================================================
  // КЛУБЫ — полный CRUD
  // ============================================================
  app.post(
    "/clubs",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest) => {
      const input = createClubSchema.parse(request.body);
      return createClubByAdmin(request.user!.sub, input);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/clubs/:id/details",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateClubSchema.parse(request.body);
      return updateClubByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/clubs/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return deleteClubByAdmin(request.user!.sub, request.params.id);
    },
  );

  app.patch<{ Params: { id: string }; Body: { blocked: boolean; reason?: string } }>(
    "/clubs/:id/block",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { blocked: boolean; reason?: string } }>) => {
      return toggleClubBlock(request.user!.sub, request.params.id, request.body.blocked, request.body.reason);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clubs/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getClubFullDetails(request.params.id);
    },
  );

  // ============================================================
  // CLUB GROUPS — полный CRUD
  // ============================================================
  app.post<{ Params: { id: string } }>(
    "/clubs/:id/groups",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = groupSchema.parse(request.body);
      return createGroupByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/club-groups/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = groupSchema.partial().parse(request.body);
      return updateGroupByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/club-groups/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return deleteGroupByAdmin(request.user!.sub, request.params.id);
    },
  );

  // ============================================================
  // ПОЛЬЗОВАТЕЛИ — полный CRUD
  // ============================================================
  app.post(
    "/users",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest) => {
      const input = createUserSchema.parse(request.body);
      return createUserByAdmin(request.user!.sub, input);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/users/:id/profile",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateUserSchema.parse(request.body);
      return updateUserByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/users/:id/club",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { clubId } = z.object({ clubId: z.string().nullable() }).parse(request.body);
      return changeUserClub(request.user!.sub, request.params.id, clubId);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/users/:id/reset-password",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { password } = z.object({ password: z.string().min(6) }).parse(request.body);
      return resetUserPassword(request.user!.sub, request.params.id, password);
    },
  );

  app.get(
    "/users",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request) => {
      const q = request.query as any;
      return listAllUsers({
        role: q.role,
        search: q.search,
        clubId: q.clubId,
        isActive: q.isActive === "true" ? true : q.isActive === "false" ? false : undefined,
        limit: q.limit ? parseInt(q.limit, 10) : 50,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getUserDetails(request.params.id);
    },
  );

  app.patch<{ Params: { id: string }; Body: { active: boolean } }>(
    "/users/:id/active",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { active: boolean } }>) => {
      return toggleUserBlock(request.user!.sub, request.params.id, request.body.active);
    },
  );

  // ============================================================
  // ТУРНИРЫ — featured/archive
  // ============================================================
  app.patch<{ Params: { id: string }; Body: { featured: boolean } }>(
    "/tournaments/:id/feature",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { featured: boolean } }>) => {
      return setTournamentFeatured(request.user!.sub, request.params.id, request.body.featured);
    },
  );

  app.patch<{ Params: { id: string }; Body: { archive: boolean } }>(
    "/tournaments/:id/archive",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { archive: boolean } }>) => {
      return archiveTournament(request.user!.sub, request.params.id, request.body.archive);
    },
  );

  // ============================================================
  // SYSTEM CONFIG
  // ============================================================
  app.get<{ Params: { key: string } }>(
    "/system-config/:key",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { key: string } }>) => {
      const cfg = await getSystemConfig(request.params.key);
      return cfg ?? { key: request.params.key, value: null };
    },
  );

  app.patch<{ Params: { key: string }; Body: { value: unknown } }>(
    "/system-config/:key",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { key: string }; Body: { value: unknown } }>) => {
      return updateSystemConfig(request.user!.sub, request.params.key, request.body.value);
    },
  );

  // ============================================================
  // СТАТИСТИКА
  // ============================================================
  app.get(
    "/stats",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async () => getStats(),
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

  app.get("/clubs", async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
    return getClubLeaderboard({ limit });
  });
}

// ============================================================
// /api/admin/applications/*  — admin entry management
// Bypasses DRAFT check so admin can adjust after weigh-in
// ============================================================
export async function adminApplicationRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", authorize("ADMIN"));

  const moveBodySchema = z.object({ newCategoryId: z.string().min(1) });

  // Force-delete a single entry (any status)
  app.delete<{ Params: { appId: string; entryId: string } }>(
    "/:appId/entries/:entryId",
    async (request, reply) => {
      await adminForceRemoveEntry(request.params.appId, request.params.entryId);
      return reply.code(204).send();
    },
  );

  // Force-move a single entry to a different category (any status)
  app.patch<{ Params: { appId: string; entryId: string } }>(
    "/:appId/entries/:entryId/category",
    async (request, reply) => {
      const { newCategoryId } = moveBodySchema.parse(request.body);
      const result = await adminForceMoveEntry(
        request.params.appId,
        request.params.entryId,
        newCategoryId,
      );
      return reply.send(result);
    },
  );
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

  // PDF диплома — после COMPLETED
  app.get("/diploma", async (request, reply) => {
    const q = pdfDiplomaQuerySchema.parse(request.query);
    const buffer = await generateDiplomaPdf(q.athleteId, q.tournamentId, q.categoryId);
    return reply
      .type("application/pdf")
      .header("Content-Disposition", `attachment; filename="diploma-${q.athleteId}.pdf"`)
      .send(buffer);
  });
}
