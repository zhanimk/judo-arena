/**
 * Admin маршруты: Override, Finalize, AuditLog, рейтинг, PDF.
 *
 *   POST   /api/admin/matches/:id/override        — переопределить результат
 *   POST   /api/admin/tournaments/:id/finalize    — закрыть турнир + начислить рейтинг
 *   GET    /api/admin/audit-logs                  — лог действий
 *   GET    /api/admin/applications                — все заявки (один запрос)
 *   GET    /api/admin/tournaments/:id/weigh-in    — таразылау листа
 *   PATCH  /api/admin/application-entries/:id/weigh-in — обновить статус таразылауа
 *
 *   GET    /api/ratings/athletes/:id              — рейтинг спортсмена
 *   GET    /api/ratings/leaderboard               — топ спортсменов
 *   GET    /api/ratings/clubs                     — топ клубов
 *
 *   GET    /api/pdf/bracket?bracketId=            — PDF одной сетки
 *   GET    /api/pdf/tournament-brackets?tournamentId= — PDF всех сеток (один файл)
 *   GET    /api/pdf/protocol?tournamentId=        — итоговый протокол PDF
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { attachErrorHandler } from "../lib/error-handler.js";
import { adminOnly, withRateLimit } from "../lib/route-guards.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { overrideMatchResult } from "../services/admin-override.service.js";
import {
  finalizeTournament,
  getAthleteRating,
  getAthleteStats,
  getLeaderboard,
  getClubLeaderboard,
  getWeightClassLeaderboard,
  getAvailableWeightClasses,
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
  getBusinessMetrics,
  getFederationAnalytics,
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
  deleteUserByAdmin,
} from "../services/admin-management.service.js";
import {
  generateBracketPdf,
  generateAllBracketsPdf,
  generateTournamentProtocolPdf,
} from "../services/pdf.service.js";
import { generateCertificate } from "../services/pdf-certificate.service.js";
import {
  adminForceRemoveEntry,
  adminForceMoveEntry,
  listAllApplicationsAdmin,
} from "../services/application.service.js";
import {
  getTournamentWeighIn,
  updateEntryWeighIn,
} from "../services/weigh-in.service.js";
import { exportTournamentExcel } from "../services/excel-export.service.js";
import { runBackupSafe } from "../services/backup.service.js";
import { updateWeighInSchema } from "../validators/application.schema.js";
import { disconnectUserSockets } from "../sockets/io.js";
import { revokeAllUserTokens } from "../lib/refresh-store.js";
import { redis } from "../lib/redis.js";
import {
  CACHE_PUBLIC_LONG,
  setCacheHeaders,
} from "../lib/cache-headers.js";

const overrideSchema = z
  .object({
    winnerSide: z.enum(["RED", "BLUE"]),
    reason: z.string().min(3).max(500),
  })
  .strict();

const strongPassword = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, "Пароль должен содержать заглавную букву")
  .regex(/[a-z]/, "Пароль должен содержать строчную букву")
  .regex(/[0-9]/, "Пароль должен содержать цифру");

const createUserSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
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
  clubRole: z.enum(["OWNER", "COACH"]).optional(),
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

const clubNameSchema = z.object({
  ru: z.string().min(1),
  kk: z.string().optional(),
  en: z.string().optional(),
});

const createClubSchema = z.object({
  name: clubNameSchema,
  city: z.string().min(1),
  country: z.string().optional(),
  shortName: z.string().optional(),
  description: z
    .object({
      ru: z.string().optional(),
      kk: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

const updateClubSchema = z.object({
  name: clubNameSchema.optional(),
  city: z.string().min(1).optional(),
  country: z.string().optional(),
  shortName: z.string().nullable().optional(),
  description: z
    .object({
      ru: z.string().optional(),
      kk: z.string().optional(),
      en: z.string().optional(),
    })
    .nullable()
    .optional(),
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
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const pdfBracketQuerySchema = z.object({
  bracketId: z.string(),
});

const pdfProtocolQuerySchema = z.object({
  tournamentId: z.string(),
});

const pdfAllBracketsQuerySchema = z.object({
  tournamentId: z.string(),
});

// ============================================================
// /api/admin/*
// ============================================================
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  // GET /api/admin/applications?status=...&tournamentId=...
  app.get(
    "/applications",
    adminOnly,
    async (request) => {
      const q = request.query as { status?: string; tournamentId?: string };
      return listAllApplicationsAdmin(q.status, q.tournamentId);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/matches/:id/override",
    withRateLimit(adminOnly, { max: 20, timeWindow: "1 minute" }),
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { winnerSide, reason } = overrideSchema.parse(request.body);
      return overrideMatchResult(
        request.user!.sub,
        request.params.id,
        winnerSide,
        reason,
      );
    },
  );

  app.post<{ Params: { id: string } }>(
    "/tournaments/:id/finalize",
    withRateLimit(adminOnly, { max: 5, timeWindow: "1 minute" }),
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return finalizeTournament(request.user!.sub, request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/tournaments/:id/weigh-in",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getTournamentWeighIn(request.user!.sub, request.params.id);
    },
  );

  app.patch<{ Params: { entryId: string } }>(
    "/application-entries/:entryId/weigh-in",
    adminOnly,
    async (request: FastifyRequest<{ Params: { entryId: string } }>) => {
      const input = updateWeighInSchema.parse(request.body);
      return updateEntryWeighIn(
        request.user!.sub,
        request.params.entryId,
        input,
      );
    },
  );

  app.get(
    "/audit-logs",
    adminOnly,
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
    adminOnly,
    async (request: FastifyRequest, reply) => {
      const input = createClubSchema.parse(request.body);
      const club = await createClubByAdmin(request.user!.sub, input);
      return reply.code(201).send(club);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/clubs/:id/details",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateClubSchema.parse(request.body);
      return updateClubByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/clubs/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return deleteClubByAdmin(request.user!.sub, request.params.id);
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { blocked: boolean; reason?: string };
  }>(
    "/clubs/:id/block",
    adminOnly,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { blocked: boolean; reason?: string };
      }>,
    ) => {
      return toggleClubBlock(
        request.user!.sub,
        request.params.id,
        request.body.blocked,
        request.body.reason,
      );
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clubs/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getClubFullDetails(request.params.id);
    },
  );

  // ============================================================
  // CLUB GROUPS — полный CRUD
  // ============================================================
  app.post<{ Params: { id: string } }>(
    "/clubs/:id/groups",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = groupSchema.parse(request.body);
      return createGroupByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/club-groups/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = groupSchema.partial().parse(request.body);
      return updateGroupByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/club-groups/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return deleteGroupByAdmin(request.user!.sub, request.params.id);
    },
  );

  // ============================================================
  // ПОЛЬЗОВАТЕЛИ — полный CRUD
  // ============================================================
  app.post(
    "/users",
    adminOnly,
    async (request: FastifyRequest, reply) => {
      const input = createUserSchema.parse(request.body);
      const user = await createUserByAdmin(request.user!.sub, input);
      return reply.code(201).send(user);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/users/:id/profile",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateUserSchema.parse(request.body);
      return updateUserByAdmin(request.user!.sub, request.params.id, input);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/users/:id/club",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { clubId } = z
        .object({ clubId: z.string().nullable() })
        .parse(request.body);
      return changeUserClub(request.user!.sub, request.params.id, clubId);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/users/:id/reset-password",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { password } = z
        .object({ password: strongPassword })
        .parse(request.body);
      return resetUserPassword(request.user!.sub, request.params.id, password);
    },
  );

  app.get<{
    Querystring: {
      role?: string;
      search?: string;
      clubId?: string;
      isActive?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    "/users",
    adminOnly,
    async (request) => {
      const q = request.query;
      return listAllUsers({
        role: q.role as import("@prisma/client").UserRole | undefined,
        search: q.search,
        clubId: q.clubId,
        isActive:
          q.isActive === "true"
            ? true
            : q.isActive === "false"
              ? false
              : undefined,
        limit: Math.min(q.limit ? parseInt(q.limit, 10) : 50, 200),
        offset: Math.max(q.offset ? parseInt(q.offset, 10) : 0, 0),
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/users/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getUserDetails(request.params.id);
    },
  );

  app.patch<{ Params: { id: string }; Body: { active: boolean } }>(
    "/users/:id/active",
    adminOnly,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { active: boolean };
      }>,
    ) => {
      const result = await toggleUserBlock(
        request.user!.sub,
        request.params.id,
        request.body.active,
      );
      // При деактивации — отзываем все токены и выгоняем активные сокеты
      if (!request.body.active) {
        await revokeAllUserTokens(request.params.id);
        await redis.del(`user-cache:${request.params.id}`);
        disconnectUserSockets(request.params.id);
      }
      return result;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/users/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteUserByAdmin(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // ============================================================
  // ТУРНИРЫ — featured/archive
  // ============================================================
  app.patch<{ Params: { id: string }; Body: { featured: boolean } }>(
    "/tournaments/:id/feature",
    adminOnly,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { featured: boolean };
      }>,
    ) => {
      return setTournamentFeatured(
        request.user!.sub,
        request.params.id,
        request.body.featured,
      );
    },
  );

  app.patch<{ Params: { id: string }; Body: { archive: boolean } }>(
    "/tournaments/:id/archive",
    adminOnly,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { archive: boolean };
      }>,
    ) => {
      return archiveTournament(
        request.user!.sub,
        request.params.id,
        request.body.archive,
      );
    },
  );

  // ============================================================
  // SYSTEM CONFIG
  // ============================================================
  app.get<{ Params: { key: string } }>(
    "/system-config/:key",
    adminOnly,
    async (request: FastifyRequest<{ Params: { key: string } }>) => {
      const cfg = await getSystemConfig(request.params.key);
      return cfg ?? { key: request.params.key, value: null };
    },
  );

  app.patch<{ Params: { key: string }; Body: { value: unknown } }>(
    "/system-config/:key",
    adminOnly,
    async (
      request: FastifyRequest<{
        Params: { key: string };
        Body: { value: unknown };
      }>,
    ) => {
      return updateSystemConfig(
        request.user!.sub,
        request.params.key,
        request.body.value,
      );
    },
  );

  // ============================================================
  // СТАТИСТИКА
  // ============================================================
  app.get(
    "/stats",
    adminOnly,
    async () => getStats(),
  );

  // Бизнес-метрики — операционный дашборд (что происходит сейчас + за 24ч)
  app.get(
    "/metrics",
    withRateLimit(adminOnly, { max: 30, timeWindow: "1 minute" }),
    async () => getBusinessMetrics(),
  );

  // Аналитика федерации — отчёты для Министерства спорта
  app.get(
    "/analytics",
    withRateLimit(adminOnly, { max: 10, timeWindow: "1 minute" }),
    async () => getFederationAnalytics(),
  );

  // ---- POST /backup — ручной запуск резервного копирования ----
  app.post(
    "/backup",
    withRateLimit(adminOnly, { max: 2, timeWindow: "1 hour" }),
    async (request, reply) => {
      // Запускаем в фоне — не блокируем ответ
      const result = await runBackupSafe(
        (msg) => request.log.info(msg),
      );
      if (!result) {
        return reply.code(500).send({
          error: "BACKUP_FAILED",
          message: "Резервное копирование завершилось с ошибкой. Проверьте логи.",
        });
      }
      return reply.send({
        ok: true,
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        s3Key: result.s3Key,
        durationMs: result.durationMs,
      });
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
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await getAthleteRating(request.params.id);
      setCacheHeaders(reply, CACHE_PUBLIC_LONG); // Рейтинг спортсмена — 5 мин
      return result;
    },
  );

  // Весовые категории — список доступных для фильтра
  app.get(
    "/weight-classes",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (_request, reply) => {
      const result = await getAvailableWeightClasses();
      setCacheHeaders(reply, CACHE_PUBLIC_LONG); // Весовые классы не меняются
      return result;
    },
  );

  // Рейтинг по весовой категории — сквозной по всем турнирам
  app.get(
    "/weight-class",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request: FastifyRequest, reply) => {
      const { gender, weightMax, limit } = z
        .object({
          gender: z.enum(["MALE", "FEMALE"]),
          weightMax: z.coerce.number().int().positive(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        })
        .parse(request.query);
      const result = await getWeightClassLeaderboard({ gender, weightMax, limit });
      setCacheHeaders(reply, CACHE_PUBLIC_LONG);
      return result;
    },
  );

  // Полная статистика спортсмена — публичная (матчи, победы, типы, рейтинг)
  app.get(
    "/athletes/:id/stats",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await getAthleteStats(request.params.id);
      setCacheHeaders(reply, CACHE_PUBLIC_LONG);
      return result;
    },
  );

  app.get(
    "/leaderboard",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const q = leaderboardQuerySchema.parse(request.query);
      const result = await getLeaderboard(q);
      // Лидерборд пересчитывается после турниров, кэш 5 мин допустим
      setCacheHeaders(reply, CACHE_PUBLIC_LONG);
      return result;
    },
  );

  app.get(
    "/clubs",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { limit } = z
        .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
        .parse(request.query);
      const result = await getClubLeaderboard({ limit });
      setCacheHeaders(reply, CACHE_PUBLIC_LONG);
      return result;
    },
  );
}

// ============================================================
// /api/admin/applications/*  — admin entry management
// Bypasses DRAFT check so admin can adjust after weigh-in
// ============================================================
export async function adminApplicationRoutes(
  app: FastifyInstance,
): Promise<void> {
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

  // PDF сетки — публичный (данные сетки публичны)
  app.get(
    "/bracket",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const q = pdfBracketQuerySchema.parse(request.query);
      const buffer = await generateBracketPdf(q.bracketId);
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="bracket-${q.bracketId}.pdf"`,
        )
        .send(buffer);
    },
  );

  // PDF итогового протокола — публичный (результаты завершённых турниров публичны)
  app.get(
    "/protocol",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const q = pdfProtocolQuerySchema.parse(request.query);
      const buffer = await generateTournamentProtocolPdf(q.tournamentId);
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="protocol-${q.tournamentId}.pdf"`,
        )
        .send(buffer);
    },
  );

  // PDF всех сеток турнира — один файл с обложкой + все категории
  app.get(
    "/tournament-brackets",
    withRateLimit(adminOnly, { max: 10, timeWindow: "1 minute" }),
    async (request, reply) => {
      const q = pdfAllBracketsQuerySchema.parse(request.query);
      const buffer = await generateAllBracketsPdf(q.tournamentId);
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="brackets-${q.tournamentId}.pdf"`,
        )
        .send(buffer);
    },
  );

  // PDF сертификат победителю — публичный (результаты турнира публичны)
  app.get(
    "/certificate",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { athleteId, tournamentId } = z
        .object({
          athleteId: z.string().min(1),
          tournamentId: z.string().min(1),
        })
        .parse(request.query);
      const buffer = await generateCertificate(athleteId, tournamentId);
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="certificate-${athleteId.slice(-8)}.pdf"`,
        )
        .send(buffer);
    },
  );

  // Excel экспорт результатов турнира — ADMIN
  app.get(
    "/export/excel",
    withRateLimit(adminOnly, { max: 5, timeWindow: "1 minute" }),
    async (request, reply) => {
      const { tournamentId } = z
        .object({ tournamentId: z.string().min(1) })
        .parse(request.query);
      const buffer = await exportTournamentExcel(tournamentId);
      const safeName = tournamentId.slice(-10);
      return reply
        .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="tournament-${safeName}.xlsx"`)
        .send(buffer);
    },
  );
}
