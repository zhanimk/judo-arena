/**
 * Socket.IO интеграция с Fastify.
 *
 * Комнаты:
 *   tournament:{id}  — публичное табло турнира (любой подключающийся)
 *   bracket:{id}     — обновления конкретной сетки
 *   tatami:{n}       — события на конкретном татами (для зрителей)
 *   user:{id}        — приватные уведомления (только владелец токена)
 *
 * Auth:
 *   Клиент передаёт accessToken в socket.handshake.auth.token (опционально).
 *   Без токена — публичные комнаты доступны, user:* — нет.
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

let io: SocketIOServer | null = null;

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
    app.log.info({ socketId: socket.id, userId: socket.data.userId ?? "anon" }, "Socket connected");

    // Клиент подписывается на комнаты
    socket.on("subscribe", (rooms: string[] | string) => {
      const list = Array.isArray(rooms) ? rooms : [rooms];
      for (const room of list) {
        if (!isValidRoom(room)) continue;

        // user:* rooms require authenticated socket AND matching userId
        if (room.startsWith("user:")) {
          const targetUserId = room.split(":")[1];
          if (!socket.data.userId || socket.data.userId !== targetUserId) {
            app.log.warn({ socketId: socket.id, room }, "Blocked subscribe to foreign user room");
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
  return /^(tournament|bracket|tatami|user):[a-zA-Z0-9_-]+$/.test(room);
}

// ============================================================
// Утилиты для emit из сервисов
// ============================================================

export function emitMatchEvent(
  match: { id: string; tournamentId: string; bracketId: string; tatamiNumber: number | null },
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

export function emitToBracket(bracketId: string, eventName: string, payload: unknown): void {
  if (!io) return;
  io.to(`bracket:${bracketId}`).emit(eventName, payload);
}

export function emitToTournament(tournamentId: string, eventName: string, payload: unknown): void {
  if (!io) return;
  io.to(`tournament:${tournamentId}`).emit(eventName, payload);
}

export function emitToUser(userId: string, eventName: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(eventName, payload);
}
