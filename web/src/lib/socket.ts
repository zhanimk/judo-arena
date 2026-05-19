/**
 * Socket.IO клиент-обвязка.
 *
 * Использование:
 *   useRealtime(["tournament:abc"], {
 *     "match:scoreUpdate": (p) => console.log(p),
 *     "match:finished": (p) => ...,
 *   });
 */

import { useEffect } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = import.meta.env.VITE_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket"],
      autoConnect: true,
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

    for (const [event, handler] of Object.entries(handlers)) {
      s.on(event, handler);
    }

    return () => {
      s.emit("unsubscribe", rooms);
      for (const [event, handler] of Object.entries(handlers)) {
        s.off(event, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.join(",")]);
}
