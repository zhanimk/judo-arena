/**
 * @judo-arena/types — общие TypeScript-типы между API и Web.
 *
 * Содержит:
 *   - ScoreSnapshot   — состояние очков матча (JSON в БД)
 *   - UserRole        — роли пользователей
 *   - MatchStatus     — статусы матча
 *   - ApiError        — структура ошибки API
 *   - BracketFormat   — форматы сеток
 *
 * Импорт в API:
 *   import type { ScoreSnapshot } from "@judo-arena/types";
 *
 * Импорт в Web:
 *   import type { ScoreSnapshot, UserRole } from "@judo-arena/types";
 */

// ============================================================
// ПОЛЬЗОВАТЕЛИ
// ============================================================

export type UserRole = "ATHLETE" | "COACH" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
  clubId: string | null;
  locale: string;
}

// ============================================================
// МАТЧИ И ОЧКИ
// ============================================================

export type MatchSide = "RED" | "BLUE";

export type MatchStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/** Счётчики очков одной стороны матча. */
export interface SideScore {
  ippon: number;
  wazaari: number;
  yuko: number;
  shido: number;
  hansoku: boolean;
}

/**
 * ScoreSnapshot — JSON-снапшот состояния матча.
 * Хранится в Match.scoreSnapshot в БД и транслируется по Socket.IO
 * при каждом обновлении счёта.
 */
export interface ScoreSnapshot {
  red: SideScore;
  blue: SideScore;
  isGoldenScore: boolean;
  /** Текущее удержание. null если нет активного osaekomi. */
  osaekomi: {
    side: MatchSide;
    /** ISO datetime строка — момент начала удержания. */
    startedAt: string;
  } | null;
  /** Состояние часов матча. */
  clock: {
    running: boolean;
    /** Накопленное время ДО runningStartedAt (секунды). */
    elapsedSec: number;
    /** ISO datetime строка — момент последнего запуска часов. null если остановлены. */
    runningStartedAt: string | null;
  };
  /**
   * Ожидающий подтверждения результат.
   * Устанавливается при авто-завершении (ippon/hansoku), сбрасывается при confirmMatchResult.
   */
  pendingResult: {
    winnerSide: MatchSide;
    winnerId: string;
    reason: string;
    triggeredBy: string;
    createdAt: string;
  } | null;
}

// ============================================================
// СЕТКИ
// ============================================================

export type BracketFormat = "SE_IJF" | "ROUND_ROBIN" | "MIXED";

// ============================================================
// API
// ============================================================

/** Стандартный формат ошибки API. */
export interface ApiErrorBody {
  error: string;
  message: string;
  issues?: Array<{ path: string[]; message: string }>;
}

/** Стандартный формат пагинированного ответа. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

export type NotificationType =
  | "TOURNAMENT_PUBLISHED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "MATCH_SCHEDULED"
  | "RESULT_POSTED"
  | "SYSTEM";

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  meta?: Record<string, unknown>;
}

// ============================================================
// SOCKET.IO СОБЫТИЯ
// ============================================================

/** Полезная нагрузка события match:scoreUpdate */
export interface MatchScoreUpdatePayload {
  matchId: string;
  score: ScoreSnapshot;
  version: number;
}

/** Полезная нагрузка события match:finished */
export interface MatchFinishedPayload {
  matchId: string;
  winnerId: string;
  score: ScoreSnapshot;
}

/** Полезная нагрузка события bracket:update */
export interface BracketUpdatePayload {
  bracketId: string;
  tournamentId: string;
  updatedMatchIds: string[];
}
