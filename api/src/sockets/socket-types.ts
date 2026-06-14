/**
 * Типизированные Socket.IO события для judo-arena.
 *
 * Использование:
 *   Server: new Server<ClientToServerEvents, ServerToClientEvents>(httpServer)
 *   Client: io<ServerToClientEvents, ClientToServerEvents>(url)
 */

// ── Payload types ────────────────────────────────────────────────────────────

export interface MatchScorePayload {
  matchId: string;
  tournamentId: string;
  bracketId: string;
  whiteScore: number;
  blueScore: number;
  whiteWazaari: number;
  blueWazaari: number;
  osaekomiActive: boolean;
  osaekomiHolder: "white" | "blue" | null;
  osaekomiElapsedMs: number;
  durationMs: number;
}

export interface MatchStartedPayload {
  matchId: string;
  tournamentId: string;
  bracketId: string;
  tatamiNumber: number | null;
  whiteAthleteId: string;
  blueAthleteId: string;
}

export interface MatchFinishedPayload {
  matchId: string;
  tournamentId: string;
  bracketId: string;
  winnerId: string | null;
  method: string;
  whiteScore: number;
  blueScore: number;
}

export interface BracketUpdatePayload {
  bracketId: string;
  tournamentId: string;
}

export interface TatamiQueuePayload {
  tatamiNumber: number;
  queue: Array<{ matchId: string; categoryName: string; tatamiOrder: number }>;
}

export interface NotificationPayload {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface SubscribeErrorPayload {
  room?: string;
  reason: "RATE_LIMITED" | "ROOM_LIMIT" | "FORBIDDEN";
}

// ── Server → Client events ───────────────────────────────────────────────────

export interface ServerToClientEvents {
  "match:scoreUpdate": (payload: MatchScorePayload) => void;
  "match:started": (payload: MatchStartedPayload) => void;
  "match:finished": (payload: MatchFinishedPayload) => void;
  "bracket:update": (payload: BracketUpdatePayload) => void;
  "tatami:queueUpdate": (payload: TatamiQueuePayload) => void;
  "notification:new": (payload: NotificationPayload) => void;
  "auth:revoked": () => void;
  "subscribe:error": (payload: SubscribeErrorPayload) => void;
  error: (payload: { reason: string }) => void;
}

// ── Client → Server events ───────────────────────────────────────────────────

export interface ClientToServerEvents {
  subscribe: (rooms: string | string[], ack?: (err: string | null) => void) => void;
  unsubscribe: (rooms: string | string[]) => void;
}

// ── Inter-server events (for Redis adapter) ──────────────────────────────────

export interface InterServerEvents {
  ping: () => void;
}

// ── Socket data ──────────────────────────────────────────────────────────────

export interface SocketData {
  userId: string | null;
  role: string | undefined;
}
