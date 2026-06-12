/**
 * Маршруты турниров, категорий и заявок.
 *
 *   Турниры:
 *     GET    /api/tournaments                                        — список (public)
 *     GET    /api/tournaments/:id                                    — детали (public)
 *     POST   /api/tournaments                                        — создать (ADMIN)
 *     PATCH  /api/tournaments/:id                                    — изменить (ADMIN)
 *     DELETE /api/tournaments/:id                                    — удалить (ADMIN)
 *     POST   /api/tournaments/:id/status                            — сменить статус (ADMIN)
 *     POST   /api/tournaments/:id/applications/bulk-approve         — массовое одобрение (ADMIN)
 *
 *   Категории:
 *     GET    /api/tournaments/:id/categories    — список (public)
 *     POST   /api/tournaments/:id/categories    — создать (ADMIN)
 *     PATCH  /api/categories/:id                — изменить (ADMIN)
 *     DELETE /api/categories/:id                — удалить (ADMIN)
 *
 *   Заявки:
 *     GET    /api/tournaments/:id/applications  — список (COACH / ADMIN)
 *     POST   /api/tournaments/:id/applications  — создать/получить DRAFT (COACH)
 *     GET    /api/coach/applications            — заявки тренера
 *     GET    /api/athlete/applications          — заявки спортсмена
 *     GET    /api/applications/:id              — детали
 *     GET    /api/applications/:id/history      — история (COACH / ADMIN)
 *     POST   /api/applications/:id/entries      — добавить запись
 *     DELETE /api/applications/:id/entries/:entryId
 *     POST   /api/applications/:id/payment/kaspi — начать оплату Kaspi (COACH)
 *     POST   /api/applications/:id/submit       — отправить на рассмотрение
 *     POST   /api/applications/:id/payment/paid — подтвердить оплату (ADMIN)
 *     POST   /api/payments/kaspi/callback       — callback оплаты Kaspi
 *     POST   /api/applications/:id/approve      — одобрить (ADMIN)
 *     POST   /api/applications/:id/reject       — отклонить (ADMIN)
 *     POST   /api/applications/:id/withdraw     — отозвать (COACH)
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { attachErrorHandler } from "../lib/error-handler.js";
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
  createIjfCategories,
  IJF_CATEGORIES,
} from "../services/tournament.service.js";

const IJF_GROUP_LABELS: Record<string, string> = {
  SENIOR_MEN: "Сеньоры / Мужчины (-60, -66, -73, -81, -90, -100, +100 кг)",
  SENIOR_WOMEN: "Сеньоры / Женщины (-48, -52, -57, -63, -70, -78, +78 кг)",
  CADET_MEN: "Кадеты U18 / Юноши (-55, -60, -66, -73, -81, -90, +90 кг)",
  CADET_WOMEN:
    "Кадеты U18 / Девушки (-40, -44, -48, -52, -57, -63, -70, +70 кг)",
  YOUTH_BOYS:
    "Юниоры U15 / Мальчики (-34, -38, -42, -46, -50, -55, -60, -66, +66 кг)",
  YOUTH_GIRLS:
    "Юниоры U15 / Девочки (-32, -36, -40, -44, -48, -52, -57, -63, +63 кг)",
};
import {
  createOrGetDraftApplication,
  listApplicationsForTournament,
  listCoachApplications,
  listAthleteApplicationEntries,
  getApplication,
  addEntry,
  removeEntry,
  submit,
  approve,
  reject,
  withdraw,
  bulkApprove,
  initiateKaspiPayment,
  markPaymentPaid,
  confirmKaspiPayment,
} from "../services/application.service.js";
import { getApplicationHistory } from "../services/audit.service.js";
import { env } from "../lib/env.js";
import crypto from "node:crypto";
import {
  CACHE_PUBLIC_SHORT,
  CACHE_PUBLIC_LONG,
  setCacheHeaders,
  makeEtag,
  checkEtag,
} from "../lib/cache-headers.js";
import {
  adminOnly,
  coachOrAdmin,
  coachOnly,
  athleteOnly,
} from "../lib/route-guards.js";

// ============================================================
// /api/tournaments/*
// ============================================================

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get("/", async (request, reply) => {
    const q = listTournamentsQuerySchema.parse(request.query);
    const result = await listTournaments(q);
    // Список турниров кэшируем на 30 сек: меняется редко, зато нагрузка высокая
    setCacheHeaders(reply, CACHE_PUBLIC_SHORT);
    return result;
  });

  app.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const tournament = await getTournament(request.params.id);
      // ETag + кэш: если клиент уже имеет свежую версию — отдаём 304
      const etag = makeEtag(tournament.id, tournament.updatedAt);
      if (checkEtag(request, reply, etag)) return;
      setCacheHeaders(reply, CACHE_PUBLIC_SHORT, etag);
      return tournament;
    },
  );

  app.post("/", adminOnly, async (request, reply) => {
    const input = createTournamentSchema.parse(request.body);
    const t = await createTournament(request.user!.sub, input);
    return reply.code(201).send(t);
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateTournamentSchema.parse(request.body);
      return updateTournament(request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteTournament(request.params.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/status",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { status } = changeStatusSchema.parse(request.body);
      return changeStatus(request.params.id, status, request.user?.sub);
    },
  );

  // Категории (вложенные)
  app.get<{ Params: { id: string } }>(
    "/:id/categories",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const categories = await listCategories(request.params.id);
      // Категории меняются редко — кэшируем дольше
      setCacheHeaders(reply, CACHE_PUBLIC_LONG);
      return categories;
    },
  );

  // Публичный список участников по категории — аналог IJF draw list
  // GET /api/tournaments/:id/categories/:categoryId/participants
  app.get<{ Params: { id: string; categoryId: string } }>(
    "/:id/categories/:categoryId/participants",
    async (
      request: FastifyRequest<{ Params: { id: string; categoryId: string } }>,
    ) => {
      const { id: tournamentId, categoryId } = request.params;
      const entries = await import("../lib/prisma.js").then(({ prisma }) =>
        prisma.applicationEntry.findMany({
          where: {
            categoryId,
            application: { tournamentId, status: "APPROVED" },
          },
          select: {
            id: true,
            weighInStatus: true,
            athlete: {
              select: {
                id: true,
                name: true,
                surname: true,
                nameLatin: true,
                surnameLatin: true,
                gender: true,
                weightKg: true,
                beltRank: true,
                avatarUrl: true,
                club: { select: { id: true, name: true, city: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        }),
      );
      return entries.map((e) => ({
        entryId: e.id,
        weighInStatus: e.weighInStatus,
        athlete: e.athlete,
      }));
    },
  );

  // GET /api/tournaments/:id/participants — все участники по всем категориям (drawsheet)
  app.get<{ Params: { id: string } }>(
    "/:id/participants",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { id: tournamentId } = request.params;
      const { prisma } = await import("../lib/prisma.js");

      const categories = await prisma.category.findMany({
        where: { tournamentId },
        orderBy: [{ gender: "asc" }, { ageMin: "asc" }, { weightMin: "asc" }],
        select: {
          id: true,
          gender: true,
          ageMin: true,
          ageMax: true,
          weightMin: true,
          weightMax: true,
          name: true,
          applicationEntries: {
            where: { application: { status: "APPROVED" } },
            select: {
              id: true,
              weighInStatus: true,
              athlete: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  nameLatin: true,
                  surnameLatin: true,
                  gender: true,
                  weightKg: true,
                  beltRank: true,
                  avatarUrl: true,
                  club: {
                    select: {
                      id: true,
                      name: true,
                      shortName: true,
                      city: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ athlete: { surname: "asc" } }],
          },
        },
      });

      return categories
        .filter((cat) => cat.applicationEntries.length > 0)
        .map((cat) => ({
          categoryId: cat.id,
          gender: cat.gender,
          ageMin: cat.ageMin,
          ageMax: cat.ageMax,
          weightMin: cat.weightMin,
          weightMax: cat.weightMax,
          name: cat.name,
          count: cat.applicationEntries.length,
          athletes: cat.applicationEntries.map((e) => ({
            entryId: e.id,
            weighInStatus: e.weighInStatus,
            athlete: e.athlete,
          })),
        }));
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/categories",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createCategorySchema.parse(request.body);
      const cat = await createCategory(request.params.id, input);
      return reply.code(201).send(cat);
    },
  );

  // Заявки (вложенные)
  app.get<{ Params: { id: string } }>(
    "/:id/applications",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return listApplicationsForTournament(
        request.user!.sub,
        request.params.id,
      );
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/applications",
    coachOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { notes } = createApplicationSchema.parse(request.body ?? {});
      const app2 = await createOrGetDraftApplication(
        request.user!.sub,
        request.params.id,
        notes,
      );
      return reply.code(201).send(app2);
    },
  );

  // AD1: Bulk-одобрение — все SUBMITTED заявки турнира
  // POST /api/tournaments/:id/applications/bulk-approve
  app.post<{ Params: { id: string } }>(
    "/:id/applications/bulk-approve",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { reviewerNotes } = reviewApplicationSchema.parse(
        request.body ?? {},
      );
      return bulkApprove(request.user!.sub, request.params.id, reviewerNotes);
    },
  );
}

// ============================================================
// /api/categories/:id, /api/applications/*
// ============================================================

export async function tournamentAdjacentRoutes(
  app: FastifyInstance,
): Promise<void> {
  attachErrorHandler(app);

  // Категории
  app.patch<{ Params: { id: string } }>(
    "/categories/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const input = updateCategorySchema.parse(request.body);
      return updateCategory(request.params.id, input);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/categories/:id",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await deleteCategory(request.params.id);
      return reply.code(204).send();
    },
  );

  // ── IJF стандартные категории ──────────────────────────────────────────────
  // GET  /api/tournaments/ijf-categories          — список доступных групп
  // POST /api/tournaments/:id/ijf-categories/:group — создать группу категорий
  app.get("/ijf-categories", async () => {
    return {
      groups: Object.keys(IJF_CATEGORIES).map((key) => ({
        key,
        count: IJF_CATEGORIES[key as keyof typeof IJF_CATEGORIES].length,
        label: IJF_GROUP_LABELS[key] ?? key,
      })),
    };
  });

  app.post<{ Params: { id: string; group: string } }>(
    "/:id/ijf-categories/:group",
    adminOnly,
    async (request, reply) => {
      const { id, group } = request.params;
      if (!Object.keys(IJF_CATEGORIES).includes(group)) {
        return reply
          .code(400)
          .send({
            error: "UNKNOWN_GROUP",
            validGroups: Object.keys(IJF_CATEGORIES),
          });
      }
      const result = await createIjfCategories(
        id,
        group as keyof typeof IJF_CATEGORIES,
      );
      return reply.code(201).send(result);
    },
  );

  app.get("/coach/applications", coachOnly, async (request) => {
    return listCoachApplications(request.user!.sub);
  });

  app.get("/athlete/applications", athleteOnly, async (request) => {
    return listAthleteApplicationEntries(request.user!.sub);
  });

  // Заявки
  app.get<{ Params: { id: string } }>(
    "/applications/:id",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getApplication(request.user!.sub, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/entries",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { athleteId, categoryId } = addEntrySchema.parse(request.body);
      const entry = await addEntry(
        request.user!.sub,
        request.params.id,
        athleteId,
        categoryId,
      );
      return reply.code(201).send(entry);
    },
  );

  app.delete<{ Params: { id: string; entryId: string } }>(
    "/applications/:id/entries/:entryId",
    coachOrAdmin,
    async (
      request: FastifyRequest<{ Params: { id: string; entryId: string } }>,
      reply,
    ) => {
      await removeEntry(
        request.user!.sub,
        request.params.id,
        request.params.entryId,
      );
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/submit",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return submit(request.user!.sub, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/payment/kaspi",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return initiateKaspiPayment(request.user!.sub, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/payment/paid",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const body = (request.body ?? {}) as { providerReference?: string };
      return markPaymentPaid(
        request.user!.sub,
        request.params.id,
        body.providerReference,
      );
    },
  );

  app.post("/payments/kaspi/callback", async (request, reply) => {
    const body = (request.body ?? {}) as {
      reference?: string;
      orderId?: string;
    };
    const secret =
      (request.headers["x-kaspi-secret"] as string | undefined) ??
      (request.query as { secret?: string } | undefined)?.secret;
    if (env.KASPI_CALLBACK_SECRET) {
      if (!secret) {
        return reply
          .code(401)
          .send({
            error: "MISSING_SECRET",
            message: "x-kaspi-secret header is required",
          });
      }
      // Timing-safe сравнение — защита от timing-атак
      const expected = Buffer.from(env.KASPI_CALLBACK_SECRET);
      const provided = Buffer.from(secret);
      const valid =
        expected.length === provided.length &&
        crypto.timingSafeEqual(expected, provided);
      if (!valid) {
        return reply
          .code(401)
          .send({
            error: "INVALID_SECRET",
            message: "Invalid callback secret",
          });
      }
    }
    const reference = body.reference ?? body.orderId;
    if (!reference) {
      return reply
        .code(400)
        .send({
          error: "MISSING_REFERENCE",
          message: "reference or orderId is required",
        });
    }
    return confirmKaspiPayment(reference);
  });

  app.post<{ Params: { id: string } }>(
    "/applications/:id/approve",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { reviewerNotes } = reviewApplicationSchema.parse(
        request.body ?? {},
      );
      return approve(request.user!.sub, request.params.id, reviewerNotes);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/reject",
    adminOnly,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { reviewerNotes } = reviewApplicationSchema.parse(
        request.body ?? {},
      );
      return reject(request.user!.sub, request.params.id, reviewerNotes);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/applications/:id/withdraw",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return withdraw(request.user!.sub, request.params.id);
    },
  );

  // AP2: История изменений заявки
  app.get<{ Params: { id: string } }>(
    "/applications/:id/history",
    coachOrAdmin,
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return getApplicationHistory(
        request.params.id,
        request.user!.sub,
        request.user!.role,
      );
    },
  );
}
