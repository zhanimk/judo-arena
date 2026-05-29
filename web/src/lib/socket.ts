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

import { useEffect } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let currentToken: string | null = null;

/** Вызывается из auth-store при получении нового accessToken. */
export function updateSocketToken(token: string | null): void {
  currentToken = token;
  // Переподключиться с новым токеном если соединение уже открыто
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}

function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket"],
      autoConnect: true,
      auth: currentToken ? { token: currentToken } : {},
    });
  }
  return socket;
}

export function useRealtime(
  rooms: string[],
  handlers: Record<string, (payload: any) => void>,
): void {
  useEffect(() => {
    const s = getSocket();
    s.emit("subscribe", rooms);

    // Re-subscribe when socket reconnects after a network drop
    const onReconnect = () => s.emit("subscribe", rooms);
    s.on("connect", onReconnect);

    for (const [event, handler] of Object.entries(handlers)) {
      s.on(event, handler);
    }

    return () => {
      s.off("connect", onReconnect);
      s.emit("unsubscribe", rooms);
      for (const [event, handler] of Object.entries(handlers)) {
        s.off(event, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.join(",")]);
}
