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

let io: SocketIOServer | null = null;

const MAX_ROOMS_PER_SUBSCRIBE = 20;
const MAX_ROOMS_PER_SOCKET = 50;
const MAX_SUBSCRIBE_EVENTS_PER_MINUTE = 120;

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO не инициализирован");
  return io;
}

export async function attachSocketIO(app: FastifyInstance): Promise<void> {
  const server = app.server as HTTPServer;
  io = new SocketIOServer(server, {
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
        .catch(() => callback(null, true));
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

    // Клиент подписывается на комнаты
    socket.on("subscribe", async (rooms: string[] | string) => {
      const subscribeCount = await incrementSocketCounter(
        socket.id,
        "subscribe",
      ).catch(() => 1);
      if (subscribeCount > MAX_SUBSCRIBE_EVENTS_PER_MINUTE) {
        socket.emit("subscribe:error", { reason: "RATE_LIMITED" });
        return;
      }

      const list = (Array.isArray(rooms) ? rooms : [rooms]).slice(
        0,
        MAX_ROOMS_PER_SUBSCRIBE,
      );
      for (const room of list) {
        if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) {
          socket.emit("subscribe:error", { room, reason: "ROOM_LIMIT" });
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
            continue;
          }
        }

        // tatami:* — только аутентифицированные пользователи
        // (анонимные зрители используют публичное tournament:* табло)
        if (room.startsWith("tatami:")) {
          if (!socket.data.userId) {
            app.log.warn(
              { socketId: socket.id, room },
              "Blocked anonymous subscribe to tatami room",
            );
            socket.emit("subscribe:error", { room, reason: "AUTH_REQUIRED" });
            continue;
          }
        }

        socket.join(room);
      }
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
  for (const r of rooms) io.to(r).emit(eventName, payload);
}

export function emitToBracket(
  bracketId: string,
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  io.to(`bracket:${bracketId}`).emit(eventName, payload);
}

export function emitToTournament(
  tournamentId: string,
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  io.to(`tournament:${tournamentId}`).emit(eventName, payload);
}

export function emitToUser(
  userId: string,
  eventName: string,
  payload: unknown,
): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(eventName, payload);
}
