/**
 * Маршруты матчей и судейских действий.
 *
 *   Чтение (public):
 *     GET    /api/matches?tournamentId=&status=&tatamiNumber=  — список
 *     GET    /api/matches/:id                                  — детали
 *     GET    /api/tatami/:tournamentId/:n/queue                — очередь татами
 *
 *   Управление матчем (ADMIN или валидная судейская сессия):
 *     POST   /api/matches/:id/start         — HAJIME
 *     POST   /api/matches/:id/pause         — MATE
 *     POST   /api/matches/:id/golden-score  — переход в Golden Score
 *     POST   /api/matches/:id/score         — добавить очко
 *     POST   /api/matches/:id/finish        — ручное завершение
 *     PATCH  /api/matches/:id/tatami        — назначить на татами (ADMIN)
 *
 *   Судейские сессии:
 *     POST   /api/matches/:id/judge-session — создать (ADMIN) → выдаёт token
 *     GET    /api/judge/:token              — получить матч по токену (без auth)
 *     POST   /api/judge-sessions/:id/revoke — отозвать (ADMIN)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import {
  createJudgeSessionSchema,
  scoreEventSchema,
  matchControlSchema,
  finishMatchSchema,
  assignTatamiSchema,
  listMatchesQuerySchema,
  startOsaekomiSchema,
  endOsaekomiSchema,
} from "../validators/match.schema.js";
import {
  getMatch,
  listMatches,
  startMatch,
  pauseMatch,
  enterGoldenScore,
  addScoreEvent,
  finishMatchManually,
  assignToTatami,
  getTatamiQueue,
  startOsaekomi,
  endOsaekomi,
  MatchError,
} from "../services/match.service.js";
import {
  createJudgeSession,
  getValidSession,
  revokeSession,
  JudgeSessionError,
} from "../services/judge-session.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { emitMatchEvent } from "../sockets/io.js";

function attachErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof MatchError || err instanceof JudgeSessionError) {
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

/**
 * Проверка авторизации: либо ADMIN, либо валидная судейская сессия через header X-Judge-Token.
 * Возвращает judgeSessionId если по токену, иначе null (для ADMIN).
 */
async function authorizeForMatch(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<string | null | void> {
  const judgeToken = request.headers["x-judge-token"];
  if (typeof judgeToken === "string" && judgeToken.length > 0) {
    try {
      const session = await getValidSession(judgeToken);
      if (session.matchId !== request.params.id) {
        return reply.code(403).send({
          error: "WRONG_MATCH",
          message: "Токен судьи не для этого матча",
        });
      }
      return session.id;
    } catch (err) {
      if (err instanceof JudgeSessionError) {
        return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  }

  // Без судейского токена — нужен ADMIN
  try {
    await authenticate(request, reply);
    if (reply.sent) return;
  } catch {
    return reply.code(401).send({ error: "UNAUTHENTICATED" });
  }
  if (request.user?.role !== "ADMIN") {
    return reply.code(403).send({ error: "FORBIDDEN", message: "Только админ или судья" });
  }
  return null;
}

// ============================================================
// /api/matches/*
// ============================================================

export async function matchRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  // Чтение — публично
  app.get("/", async (request) => {
    const q = listMatchesQuerySchema.parse(request.query);
    return listMatches(q);
  });

  app.get("/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return getMatch(request.params.id);
  });

  // ---- Контрол матча ----
  app.post(
    "/:id/start",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await startMatch(request.params.id, judgeSessionId || undefined);
      emitMatchEvent(match, "match:started", { matchId: match.id, event });
      return reply.send(match);
    },
  );

  app.post(
    "/:id/pause",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await pauseMatch(request.params.id, judgeSessionId || undefined);
      emitMatchEvent(match, "match:event", { matchId: match.id, event });
      return reply.send(match);
    },
  );

  app.post(
    "/:id/golden-score",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await enterGoldenScore(request.params.id, judgeSessionId || undefined);
      emitMatchEvent(match, "match:goldenScore", { matchId: match.id, event });
      return reply.send(match);
    },
  );

  // ---- Очки ----
  app.post(
    "/:id/score",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { type, side } = scoreEventSchema.parse(request.body);
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const result = await addScoreEvent(
        request.params.id,
        type,
        side,
        judgeSessionId || undefined,
      );
      emitMatchEvent(result.match, "match:scoreUpdate", {
        matchId: result.match.id,
        score: result.match.scoreSnapshot,
        event: result.event,
      });
      if (result.autoFinished) {
        emitMatchEvent(result.match, "match:finished", {
          matchId: result.match.id,
          winnerId: result.winnerId,
        });
      }
      return reply.send(result);
    },
  );

  app.post(
    "/:id/finish",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { winnerSide, reason } = finishMatchSchema.parse(request.body);
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const match = await finishMatchManually(
        request.params.id,
        winnerSide,
        reason,
        judgeSessionId || undefined,
      );
      emitMatchEvent(match, "match:finished", {
        matchId: match.id,
        winnerId: match.winnerId,
      });
      return reply.send(match);
    },
  );

  // ---- OSAEKOMI (удержание) ----
  app.post(
    "/:id/osaekomi",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { side } = startOsaekomiSchema.parse(request.body);
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await startOsaekomi(
        request.params.id,
        side,
        judgeSessionId || undefined,
      );
      emitMatchEvent(match, "match:osaekomiStart", {
        matchId: match.id,
        side,
        startedAt: new Date().toISOString(),
        event,
      });
      return reply.send({ match, event });
    },
  );

  app.post(
    "/:id/toketa",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { reason } = endOsaekomiSchema.parse(request.body ?? {});
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const result = await endOsaekomi(
        request.params.id,
        reason,
        judgeSessionId || undefined,
      );
      emitMatchEvent(result.match, "match:osaekomiEnd", {
        matchId: result.match.id,
        durationSec: result.durationSec,
        scoredType: result.scoredType,
        autoFinished: result.autoFinished,
        winnerId: result.winnerId,
      });
      if (result.autoFinished) {
        emitMatchEvent(result.match, "match:finished", {
          matchId: result.match.id,
          winnerId: result.winnerId,
        });
      }
      return reply.send(result);
    },
  );

  // ---- Татами (только ADMIN) ----
  app.patch(
    "/:id/tatami",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { tatamiNumber } = assignTatamiSchema.parse(request.body);
      return assignToTatami(request.params.id, tatamiNumber);
    },
  );

  // ---- Судейские сессии для конкретного матча ----
  app.post(
    "/:id/judge-session",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const input = createJudgeSessionSchema.parse(request.body ?? {});
      const session = await createJudgeSession(request.user!.sub, request.params.id, input);
      return reply.code(201).send({
        ...session,
        judgeUrl: `/judge/${session.token}`,
      });
    },
  );
}

// ============================================================
// /api/judge/:token (для судей, без auth)
// /api/tatami, /api/judge-sessions
// ============================================================

export async function judgeAdjacentRoutes(app: FastifyInstance): Promise<void> {
  attachErrorHandler(app);

  app.get(
    "/judge/:token",
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return getValidSession(request.params.token);
    },
  );

  app.post(
    "/judge-sessions/:id/revoke",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await revokeSession(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  app.get(
    "/tatami/:tournamentId/:n/queue",
    async (request: FastifyRequest<{ Params: { tournamentId: string; n: string } }>) => {
      return getTatamiQueue(request.params.tournamentId, parseInt(request.params.n, 10));
    },
  );
}
