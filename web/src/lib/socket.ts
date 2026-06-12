/**
 * Socket.IO клиент-обвязка.
 *
 * Использование:
 *   useRealtime(["tournament:abc"], {
 *     "match:scoreUpdate": (p) => console.log(p),
 *     "match:finished": (p) => ...,
 *   });
 *
 * Передаёт accessToken при подключении — сервер верифицирует его
 * и разрешает подписку на user:{id} только владельцу токена.
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@judo-arena/types";

const WS_URL = import.meta.env.VITE_WS_URL ?? "http://localhost:4000";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
let currentToken: string | null = null;
let onAuthRevoked: (() => void) | null = null;

/** Регистрирует callback, вызываемый при получении auth:revoked от сервера. */
export function setOnAuthRevoked(handler: () => void): void {
  onAuthRevoked = handler;
}

/** Вызывается из auth-store при получении нового accessToken. */
export function updateSocketToken(token: string | null): void {
  currentToken = token;
  // Переподключиться с новым токеном если соединение уже открыто
  if (socket?.connected) {
    stopHeartbeat();
    socket.disconnect();
    socket = null;
  }
}

const HEARTBEAT_INTERVAL_MS = 25_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(s: Socket): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!s.connected) {
      stopHeartbeat();
      return;
    }
    // socket.io уже поддерживает ping/pong через pingInterval/pingTimeout,
    // но явный emit гарантирует что connection остаётся активным за NAT
    s.volatile.emit("ping" as never);
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function getSocket(): AppSocket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket"],
      autoConnect: true,
      auth: currentToken ? { token: currentToken } : {},
    });

    socket.on("connect", () => startHeartbeat(socket!));
    socket.on("disconnect", () => stopHeartbeat());

    // Принудительный выход — сервер отозвал сессию (logout-all, деактивация, смена пароля)
    socket.on("auth:revoked", () => {
      stopHeartbeat();
      onAuthRevoked?.();
    });
  }
  return socket;
}

export function useRealtime(
  rooms: string[],
  handlers: Record<string, (payload: unknown) => void>,
): void {
  // Stable key — only re-subscribe when the room list actually changes
  const roomsKey = rooms.slice().sort().join(",");
  // Keep latest handlers ref so reconnect callback always uses current closures
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Track previous rooms to unsubscribe from removed ones on change
  const prevRoomsRef = useRef<string[]>([]);

  useEffect(() => {
    const s = getSocket();
    const prevRooms = prevRoomsRef.current;

    // Unsubscribe from rooms that are no longer needed
    const removed = prevRooms.filter((r) => !rooms.includes(r));
    if (removed.length > 0) s.emit("unsubscribe", removed);

    // Subscribe to new rooms only
    const added = rooms.filter((r) => !prevRooms.includes(r));
    if (added.length > 0)
      s.emit("subscribe", added, (err: string | null) => {
        if (err) console.warn("[socket] subscribe rejected:", err);
      });
    // First render: prevRooms is empty, subscribe to all
    if (prevRooms.length === 0 && rooms.length > 0)
      s.emit("subscribe", rooms, (err: string | null) => {
        if (err) console.warn("[socket] subscribe rejected:", err);
      });

    prevRoomsRef.current = rooms.slice();

    // Re-subscribe to all current rooms when socket reconnects after network drop
    const onReconnect = () => s.emit("subscribe", rooms);
    s.on("connect", onReconnect);

    const wrappedHandlers: Record<string, (payload: unknown) => void> = {};
    for (const event of Object.keys(handlers)) {
      wrappedHandlers[event] = (payload: unknown) => handlersRef.current[event]?.(payload);
      // Casting needed: useRealtime accepts arbitrary event names at runtime,
      // but AppSocket generics require exact ServerToClientEvents keys.
      (s as Socket).on(event, wrappedHandlers[event]);
    }

    return () => {
      s.off("connect", onReconnect);
      s.emit("unsubscribe", prevRoomsRef.current);
      prevRoomsRef.current = [];
      for (const [event, handler] of Object.entries(wrappedHandlers)) {
        (s as Socket).off(event, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsKey]);
}
