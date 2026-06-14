/**
 * Socket.IO интеграция с Fastify.
 *
 * Комнаты и правила доступа (ACL):
 *   tournament:{id}  — публичное табло турнира (анонимные разрешены)
 *   bracket:{id}     — обновления сетки (анонимные разрешены)
 *   tatami:{n}       — события татами (только аутентифицированные пользователи)
 *   user:{id}        — приватные уведомления (только владелец токена)
 *
 * Auth:
 *   Клиент передаёт accessToken в socket.handshake.auth.token (опционально).
 *   Без токена — только tournament:* и bracket:* доступны.
 *
 * События (server → client):
 *   match:scoreUpdate, match:started, match:finished
 *   bracket:update, tatami:queueUpdate
 */

import type { FastifyInstance } from "fastify";
import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "node:http";
import { env } from "../lib/env.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { redis } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./socket-types.js";

type EmitEvent = keyof ServerToClientEvents;

type TypedIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let io: TypedIO | null = null;

const MAX_ROOMS_PER_SUBSCRIBE = 20;
const MAX_ROOMS_PER_SOCKET = 50;
const MAX_SUBSCRIBE_EVENTS_PER_MINUTE = 120;
/** Максимум любых входящих событий от одного сокета в минуту (защита от flood) */
const MAX_EVENTS_PER_MINUTE = 300;

export function getIO(): TypedIO {
  if (!io) throw new Error("Socket.IO не инициализирован");
  return io;
}

export async function attachSocketIO(app: FastifyInstance): Promise<void> {
  const server = app.server as HTTPServer;
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
    cors: {
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    },
    maxHttpBufferSize: 16 * 1024,
    pingTimeout: 20_000,
    pingInterval: 25_000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    allowRequest: (req, callback) => {
      const ip = clientIp(req);
      const key = `socket:connect:${ip}`;
      redis
        .incr(key)
        .then(async (count) => {
          if (count === 1)
            await redis.expire(key, env.SOCKET_CONNECTION_LIMIT_WINDOW_SEC);
          callback(null, count <= env.SOCKET_CONNECTION_LIMIT_MAX);
        })
        .catch(() => callback(null, false)); // fail-closed: Redis недоступен → запрещаем
    },
  });

  // Verify JWT at handshake — attach userId if valid, allow anonymous otherwise
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.data.userId = payload.sub;
        socket.data.role = payload.role;
      } catch {
        // Invalid token — treat as anonymous (don't reject, just no user:* access)
        socket.data.userId = null;
      }
    } else {
      socket.data.userId = null;
    }
    next();
  });

  io.on("connection", (socket) => {
    app.log.info(
      { socketId: socket.id, userId: socket.data.userId ?? "anon" },
      "Socket connected",
    );

    // Глобальный rate limit на все входящие события от этого сокета
    socket.onAny(async (_event: string) => {
      const total = await incrementSocketCounter(socket.id, "events").catch(() => 1);
      if (total > MAX_EVENTS_PER_MINUTE) {
        app.log.warn({ socketId: socket.id }, "Socket event flood — disconnecting");
        socket.emit("error", { reason: "RATE_LIMITED" });
        socket.disconnect(true);
      }
    });

    // Клиент подписывается на комнаты; поддерживает ack-callback для подтверждения
    socket.on("subscribe", async (rooms: string[] | string, ack?: (err: string | null) => void) => {
      const subscribeCount = await incrementSocketCounter(
        socket.id,
        "subscribe",
      ).catch(() => 1);
      if (subscribeCount > MAX_SUBSCRIBE_EVENTS_PER_MINUTE) {
        socket.emit("subscribe:error", { reason: "RATE_LIMITED" });
        ack?.("RATE_LIMITED");
        return;
      }

      const list = (Array.isArray(rooms) ? rooms : [rooms]).slice(
        0,
        MAX_ROOMS_PER_SUBSCRIBE,
      );
      for (const room of list) {
        if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) {
          socket.emit("subscribe:error", { room, reason: "ROOM_LIMIT" });
          ack?.("ROOM_LIMIT");
          break;
        }

        if (!isValidRoom(room)) {
          app.log.warn(
            { socketId: socket.id, room },
            "Blocked subscribe: invalid room name",
          );
          continue;
        }

        // user:* — только владелец токена
        if (room.startsWith("user:")) {
          const targetUserId = room.split(":")[1];
          if (!socket.data.userId || socket.data.userId !== targetUserId) {
            app.log.warn(
              { socketId: socket.id, room },
              "Blocked subscribe to foreign user room",
            );
            socket.emit("subscribe:error", { room, reason: "FORBIDDEN" });
            ack?.("FORBIDDEN");
            continue;
          }
        }

        // tatami:* — только ADMIN.
        // Зрители и тренеры используют публичное tournament:* табло.
        // Судьи работают через /tatami/:token (REST + tournament:* комната).
        // tatami:N комната содержит приватные события до публичного объявления —
        // поэтому доступ строго ограничен ролью ADMIN.
        if (room.startsWith("tatami:")) {
          if (!socket.data.userId || socket.data.role !== "ADMIN") {
            app.log.warn(
              { socketId: socket.id, room, role: socket.data.role ?? "anon" },
              "Blocked non-admin subscribe to tatami room",
            );
            socket.emit("subscribe:error", { room, reason: "FORBIDDEN" });
            ack?.("FORBIDDEN");
            continue;
          }
          // Re-validate: проверяем активность пользователя при каждой подписке на татами
          const active = await isUserActive(socket.data.userId);
          if (!active) {
            socket.emit("auth:revoked");
            socket.disconnect(true);
            return;
          }
        }

        // user:* — дополнительно проверяем активность при подписке
        if (room.startsWith("user:")) {
          const active = await isUserActive(socket.data.userId!);
          if (!active) {
            socket.emit("auth:revoked");
            socket.disconnect(true);
            return;
          }
        }

        socket.join(room);
      }
      ack?.(null);
    });

    socket.on("unsubscribe", (rooms: string[] | string) => {
      const list = Array.isArray(rooms) ? rooms : [rooms];
      for (const room of list) socket.leave(room);
    });

    socket.on("disconnect", () => {
      app.log.info({ socketId: socket.id }, "Socket disconnected");
    });
  });
}

function isValidRoom(room: string): boolean {
  return /^(tournament|bracket|tatami|user):[a-zA-Z0-9_-]{1,64}$/.test(room);
}

function clientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0)
    return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded[0])
    return forwarded[0].split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

async function incrementSocketCounter(
  socketId: string,
  action: string,
): Promise<number> {
  const key = `socket:${action}:${socketId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count;
}

// ============================================================
// Утилиты для emit из сервисов
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEmit = (event: string, ...args: any[]) => void;

export function emitMatchEvent(
  match: {
    id: string;
    tournamentId: string;
    bracketId: string;
    tatamiNumber: number | null;
  },
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  const rooms = [
    `tournament:${match.tournamentId}`,
    `bracket:${match.bracketId}`,
  ];
  if (match.tatamiNumber !== null) rooms.push(`tatami:${match.tatamiNumber}`);
  for (const r of rooms) (io.to(r).emit as AnyEmit)(eventName, payload);
}

export function emitToBracket(
  bracketId: string,
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  (io.to(`bracket:${bracketId}`).emit as AnyEmit)(eventName, payload);
}

export function emitToTournament(
  tournamentId: string,
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  (io.to(`tournament:${tournamentId}`).emit as AnyEmit)(eventName, payload);
}

export function emitToUser(
  userId: string,
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  (io.to(`user:${userId}`).emit as AnyEmit)(eventName, payload);
}

/**
 * Принудительно отключает все сокеты пользователя.
 * Вызывается при logout-all, деактивации аккаунта, смене пароля.
 */
export function disconnectUserSockets(userId: string): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("auth:revoked");
  // Получаем все сокеты в комнате user:{userId} и дисконнектим
  io.in(`user:${userId}`).disconnectSockets(true);
}

/**
 * Проверяет активность пользователя через Redis-кэш, при промахе — через БД.
 * Используется при подписке на приватные комнаты (tatami:*, user:*).
 */
async function isUserActive(userId: string): Promise<boolean> {
  try {
    const cacheKey = `user-cache:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const user = JSON.parse(cached) as { isActive: boolean };
      return user.isActive;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return user?.isActive ?? false;
  } catch {
    return false; // fail-closed: при ошибке Redis/DB запрещаем доступ к приватным комнатам
  }
}
