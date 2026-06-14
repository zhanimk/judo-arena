/**
 * useRealtimeQuery — комбинация Socket.IO realtime + TanStack Query invalidation.
 *
 * Паттерн:
 *   1. useQuery загружает данные через HTTP
 *   2. Socket.IO events → автоматически инвалидируют кэш → refetch
 *
 * До этого хука в каждом компоненте писали вручную:
 *   useRealtime([`tournament:${id}`], {
 *     "match:scoreUpdate": () => qc.invalidateQueries({ queryKey: [...] }),
 *     "match:finished":    () => qc.invalidateQueries({ queryKey: [...] }),
 *   });
 *
 * Теперь:
 *   useRealtimeQuery({
 *     rooms: [`tournament:${id}`],
 *     events: ["match:scoreUpdate", "match:finished", "match:started"],
 *     queryKey: matchKeys.list({ tournamentId: id }),
 *   });
 */

import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/lib/socket";
import { useMemo } from "react";

interface UseRealtimeQueryOptions {
  /** Socket.IO rooms для подписки */
  rooms: string[];
  /** События, которые триггерят инвалидацию */
  events: string[];
  /** TanStack Query key для инвалидации */
  queryKey: readonly unknown[];
  /** Если false — не подписываться (например, когда нет tournamentId) */
  enabled?: boolean;
}

/**
 * Подписывается на Socket.IO события и автоматически инвалидирует
 * TanStack Query кэш при получении любого из указанных событий.
 */
export function useRealtimeQuery({
  rooms,
  events,
  queryKey,
  enabled = true,
}: UseRealtimeQueryOptions): void {
  const qc = useQueryClient();

  const handlers = useMemo(() => {
    if (!enabled) return {};
    const invalidate = () => qc.invalidateQueries({ queryKey });
    return Object.fromEntries(events.map((event) => [event, invalidate]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, qc, queryKey.join(","), events.join(",")]);

  useRealtime(enabled ? rooms : [], handlers);
}

// ── Пресеты для частых паттернов ─────────────────────────────────────────────

/** Все события изменения матча — для scoreboard и live экранов. */
export const MATCH_EVENTS = [
  "match:started",
  "match:event",
  "match:scoreUpdate",
  "match:pendingResult",
  "match:finished",
  "match:osaekomiStart",
  "match:osaekomiEnd",
  "tatami:queueUpdate",
  "bracket:update",
] as const;

/** События только завершения матча — для bracket view. */
export const BRACKET_EVENTS = ["match:finished", "bracket:update"] as const;

/** События уведомлений. */
export const NOTIFICATION_EVENTS = ["notification:new"] as const;
