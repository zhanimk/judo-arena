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
import { attachErrorHandler } from "../lib/error-handler.js";
import {
  createJudgeSessionSchema,
  scoreEventSchema,
  finishMatchSchema,
  assignTatamiSchema,
  reorderTatamiQueueSchema,
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
  confirmMatchResult,
  finishMatchManually,
  cancelPendingResult,
  undoLastScoreEvent,
  resetMatch,
  assignToTatami,
  reorderTatamiQueue,
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
import {
  createTatamiSession,
  getValidTatamiSession,
  revokeTatamiSession,
  listTatamiSessions,
  TatamiSessionError,
} from "../services/tatami-session.service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { emitMatchEvent, emitToBracket, emitToTournament } from "../sockets/io.js";
import { logAudit } from "../services/audit.service.js";
import { prisma } from "../lib/prisma.js";


/**
 * Проверка авторизации: ADMIN, X-Judge-Token (per-match) или X-Tatami-Token (per-tatami).
 * Возвращает judgeSessionId / "tatami" / null (ADMIN).
 */
async function authorizeForMatch(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<string | null | void> {
  // 1. Пробуем X-Judge-Token (per-match, старая логика)
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

  // 2. Пробуем X-Tatami-Token (per-tatami, новая логика)
  const tatamiToken = request.headers["x-tatami-token"];
  if (typeof tatamiToken === "string" && tatamiToken.length > 0) {
    try {
      const tatamiSession = await prisma.tatamiSession.findUnique({ where: { token: tatamiToken } });
      if (!tatamiSession) {
        return reply.code(401).send({ error: "INVALID_TOKEN", message: "Невалидный токен татами" });
      }
      if (tatamiSession.isRevoked) {
        return reply.code(403).send({ error: "REVOKED", message: "Сессия татами отозвана" });
      }
      if (tatamiSession.expiresAt < new Date()) {
        return reply.code(403).send({ error: "EXPIRED", message: "Срок действия сессии татами истёк" });
      }
      // Проверяем что матч на правильном татами
      const match = await prisma.match.findUnique({
        where: { id: request.params.id },
        select: { tatamiNumber: true, tournamentId: true },
      });
      if (!match) {
        return reply.code(404).send({ error: "MATCH_NOT_FOUND", message: "Матч не найден" });
      }
      if (match.tournamentId !== tatamiSession.tournamentId || match.tatamiNumber !== tatamiSession.tatamiNumber) {
        return reply.code(403).send({
          error: "WRONG_TATAMI",
          message: "Этот матч не на вашем татами",
        });
      }
      return tatamiSession.id; // используем как actorId
    } catch (err) {
      if (err instanceof TatamiSessionError) {
        return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  }

  // 3. Без токена — нужен ADMIN
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

  app.get<{ Params: { id: string } }>("/:id", async (request: FastifyRequest<{ Params: { id: string } }>) => {
    return getMatch(request.params.id);
  });

  // ---- Контрол матча ----
  app.post<{ Params: { id: string } }>(
    "/:id/start",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await startMatch(request.params.id, judgeSessionId || undefined);
      emitMatchEvent(match, "match:started", { matchId: match.id, event });
      return reply.send(match);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/pause",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await pauseMatch(request.params.id, judgeSessionId || undefined);
      emitMatchEvent(match, "match:event", { matchId: match.id, event });
      return reply.send(match);
    },
  );

  app.post<{ Params: { id: string } }>(
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
  app.post<{ Params: { id: string } }>(
    "/:id/score",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { type, side, version } = scoreEventSchema.parse(request.body);
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const result = await addScoreEvent(
        request.params.id,
        type,
        side,
        judgeSessionId || undefined,
        version,
      );
      emitMatchEvent(result.match, "match:scoreUpdate", {
        matchId: result.match.id,
        score: result.match.scoreSnapshot,
        event: result.event,
      });
      if (result.autoFinished) {
        emitMatchEvent(result.match, "match:pendingResult", {
          matchId: result.match.id,
          winnerId: result.winnerId,
        });
      }
      return reply.send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/finish",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { winnerSide, reason, version } = finishMatchSchema.parse(request.body);
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const match = await finishMatchManually(
        request.params.id,
        winnerSide,
        reason,
        judgeSessionId || undefined,
        version,
      );
      emitMatchEvent(match, "match:pendingResult", {
        matchId: match.id,
        winnerId: match.winnerId,
      });
      return reply.send(match);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/:id/confirm",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const match = await confirmMatchResult(request.params.id, judgeSessionId || undefined);
      // Audit: judge confirmed match result
      logAudit({
        actorUserId: request.user?.sub ?? null,
        action: "match.confirm",
        targetEntity: "Match",
        targetId: match.id,
        after: { winnerId: match.winnerId, judgeSessionId },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }).catch(() => {/* non-blocking */});
      emitMatchEvent(match, "match:finished", {
        matchId: match.id,
        winnerId: match.winnerId,
      });
      emitMatchEvent(match, "tatami:queueUpdate", {
        matchId: match.id,
        tatamiNumber: match.tatamiNumber,
      });
      emitToBracket(match.bracketId, "bracket:update", {
        bracketId: match.bracketId,
        finishedMatchId: match.id,
      });
      emitToTournament(match.tournamentId, "bracket:update", {
        bracketId: match.bracketId,
        finishedMatchId: match.id,
      });
      return reply.send(match);
    },
  );

  // ---- UNDO last score event (judge or admin, during match) ----
  app.post<{ Params: { id: string } }>(
    "/:id/undo",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const match = await undoLastScoreEvent(request.params.id, judgeSessionId || undefined);
      logAudit({
        actorUserId: request.user?.sub ?? null,
        action: "match.undo",
        targetEntity: "Match",
        targetId: match.id,
        metadata: { judgeSessionId },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      }).catch(() => {/* non-blocking */});
      emitMatchEvent(match, "match:scoreUpdate", {
        matchId: match.id,
        score: match.scoreSnapshot,
      });
      return reply.send(match);
    },
  );

  // ---- CANCEL PENDING RESULT (judge or admin, before confirmation) ----
  app.post<{ Params: { id: string } }>(
    "/:id/cancel-result",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const match = await cancelPendingResult(request.params.id, judgeSessionId || undefined);
      emitMatchEvent(match, "match:scoreUpdate", {
        matchId: match.id,
        score: match.scoreSnapshot,
      });
      return reply.send(match);
    },
  );

  // ---- RESET (admin-only: restart match from scratch) ----
  app.post<{ Params: { id: string } }>(
    "/:id/reset",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const match = await resetMatch(request.params.id);
      emitMatchEvent(match, "match:event", { matchId: match.id, type: "reset" });
      emitToBracket(match.bracketId, "bracket:update", {
        bracketId: match.bracketId,
        resetMatchId: match.id,
      });
      emitToTournament(match.tournamentId, "bracket:update", {
        bracketId: match.bracketId,
        resetMatchId: match.id,
      });
      return reply.send(match);
    },
  );

  // ---- OSAEKOMI (удержание) ----
  app.post<{ Params: { id: string } }>(
    "/:id/osaekomi",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { side, version } = startOsaekomiSchema.parse(request.body);
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const { match, event } = await startOsaekomi(
        request.params.id,
        side,
        judgeSessionId || undefined,
        version,
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

  app.post<{ Params: { id: string } }>(
    "/:id/toketa",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const { reason, version } = endOsaekomiSchema.parse(request.body ?? {});
      const judgeSessionId = await authorizeForMatch(request, reply);
      if (reply.sent) return;
      const result = await endOsaekomi(
        request.params.id,
        reason,
        judgeSessionId || undefined,
        version,
      );
      emitMatchEvent(result.match, "match:osaekomiEnd", {
        matchId: result.match.id,
        durationSec: result.durationSec,
        scoredType: result.scoredType,
        autoFinished: result.autoFinished,
        winnerId: result.winnerId,
      });
      if (result.autoFinished) {
        emitMatchEvent(result.match, "match:pendingResult", {
          matchId: result.match.id,
          winnerId: result.winnerId,
        });
      }
      return reply.send(result);
    },
  );

  // ---- Татами (только ADMIN) ----
  app.patch<{ Params: { id: string } }>(
    "/:id/tatami",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { tatamiNumber, queuePosition } = assignTatamiSchema.parse(request.body);
      const match = await assignToTatami(request.params.id, tatamiNumber, queuePosition);
      emitMatchEvent(match, "tatami:queueUpdate", {
        matchId: match.id,
        tatamiNumber: match.tatamiNumber,
        queuePosition: match.queuePosition,
      });
      return match;
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/:id/queue",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { direction } = reorderTatamiQueueSchema.parse(request.body);
      const match = await reorderTatamiQueue(request.params.id, direction);
      emitMatchEvent(match, "tatami:queueUpdate", {
        matchId: match.id,
        tatamiNumber: match.tatamiNumber,
        queuePosition: match.queuePosition,
      });
      return match;
    },
  );

  // ---- Судейские сессии для конкретного матча ----
  app.post<{ Params: { id: string } }>(
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

  // ---- JudgeSession (per-match, legacy) ----
  app.get<{ Params: { token: string } }>(
    "/judge/:token",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) => `judge-token:${req.ip}`,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return getValidSession(request.params.token);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/judge-sessions/:id/revoke",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await revokeSession(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );

  // ---- Tatami queue (public) ----
  app.get<{ Params: { tournamentId: string; n: string } }>(
    "/tatami/:tournamentId/:n/queue",
    async (request: FastifyRequest<{ Params: { tournamentId: string; n: string } }>, reply) => {
      const n = parseInt(request.params.n, 10);
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        return reply.code(400).send({ error: "INVALID_TATAMI", message: "Татами номері 1–20 аралығында болуы керек" });
      }
      return getTatamiQueue(request.params.tournamentId, n);
    },
  );

  // ---- TatamiSession (per-tatami, new) ----

  // Создать сессию на татами (ADMIN)
  app.post<{ Params: { id: string } }>(
    "/tournaments/:id/tatami-sessions",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const body = request.body as { tatamiNumber: number; judgeName?: string; ttlHours?: number };
      const session = await createTatamiSession(request.user!.sub, request.params.id, {
        tatamiNumber: body.tatamiNumber,
        judgeName: body.judgeName,
        ttlHours: body.ttlHours,
      });
      return reply.code(201).send({
        ...session,
        judgeUrl: `/tatami/${session.token}`,
      });
    },
  );

  // Получить текущий матч + очередь по токену (без auth)
  app.get<{ Params: { token: string } }>(
    "/tatami-session/:token",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) => `tatami-token:${req.ip}`,
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return getValidTatamiSession(request.params.token);
    },
  );

  // Список активных сессий для турнира (ADMIN)
  app.get<{ Params: { id: string } }>(
    "/tournaments/:id/tatami-sessions",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      return listTatamiSessions(request.params.id);
    },
  );

  // Отозвать сессию (ADMIN)
  app.post<{ Params: { id: string } }>(
    "/tatami-sessions/:id/revoke",
    { preHandler: [authenticate, authorize("ADMIN")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      await revokeTatamiSession(request.user!.sub, request.params.id);
      return reply.code(204).send();
    },
  );
}
