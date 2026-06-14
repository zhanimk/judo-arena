/**
 * tatami-offline-queue.ts — Очередь действий судьи при потере сети.
 *
 * Когда сеть пропадает, действия (счёт, старт, стоп) сохраняются в
 * localStorage. При восстановлении соединения очередь автоматически
 * отправляется на сервер в порядке создания.
 *
 * Использование:
 *   const queue = useTatamiOfflineQueue(token, isOnline);
 *   // Вместо прямого вызова api:
 *   queue.enqueue("score", () => api.matches.score(...));
 */

import { useEffect, useRef, useCallback, useState } from "react";

const QUEUE_KEY_PREFIX = "tatami_queue_";
const MAX_QUEUE_SIZE = 50;

export interface QueuedAction {
  id: string;
  type: string;
  timestamp: number;
  retries: number;
}

type QueueEntry = QueuedAction;

function getQueueKey(token: string): string {
  return `${QUEUE_KEY_PREFIX}${token}`;
}

function loadQueue(token: string): QueueEntry[] {
  try {
    const raw = localStorage.getItem(getQueueKey(token));
    if (!raw) return [];
    return JSON.parse(raw) as QueueEntry[];
  } catch {
    return [];
  }
}

function saveQueue(token: string, queue: QueueEntry[]): void {
  try {
    localStorage.setItem(getQueueKey(token), JSON.stringify(queue));
  } catch {
    // localStorage полон — очищаем и пробуем снова
    try {
      localStorage.removeItem(getQueueKey(token));
      localStorage.setItem(getQueueKey(token), JSON.stringify(queue.slice(-10)));
    } catch {
      // Игнорируем — critital path не должен падать из-за storage
    }
  }
}

function clearQueue(token: string): void {
  localStorage.removeItem(getQueueKey(token));
}

/**
 * Hook для управления offline-очередью на татами панели.
 *
 * @param token - токен TatamiSession (используется как ключ storage)
 * @param isOnline - текущий статус сети
 * @param onFlushError - callback при ошибке flush (для показа ошибки пользователю)
 */
export function useTatamiOfflineQueue(
  token: string,
  isOnline: boolean,
  onFlushError?: (msg: string) => void,
) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);

  // Map: actionId → async function to execute
  const pendingFns = useRef<Map<string, () => Promise<unknown>>>(new Map());
  const isFlushingRef = useRef(false);

  // Sync pending count from localStorage on mount
  useEffect(() => {
    const q = loadQueue(token);
    setPendingCount(q.length);
  }, [token]);

  /**
   * Добавляет действие в очередь (при offline) или выполняет сразу (при online).
   * @param actionType - тип для логирования ("score", "start", "pause", ...)
   * @param fn - async функция выполнения действия
   * @returns true если выполнено онлайн, false если добавлено в очередь
   */
  const enqueue = useCallback(
    async (
      actionType: string,
      fn: () => Promise<unknown>,
    ): Promise<{ online: boolean }> => {
      if (isOnline) {
        // Онлайн — выполняем сразу, без очереди
        await fn();
        return { online: true };
      }

      // Офлайн — добавляем в очередь
      const queue = loadQueue(token);
      if (queue.length >= MAX_QUEUE_SIZE) {
        onFlushError?.("Очередь полна. Подождите восстановления сети.");
        return { online: false };
      }

      const entry: QueueEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: actionType,
        timestamp: Date.now(),
        retries: 0,
      };

      pendingFns.current.set(entry.id, fn);
      queue.push(entry);
      saveQueue(token, queue);
      setPendingCount(queue.length);

      return { online: false };
    },
    [isOnline, token, onFlushError],
  );

  /**
   * Пытается выполнить все накопленные действия из очереди.
   * Вызывается автоматически при восстановлении сети.
   */
  const flush = useCallback(async () => {
    if (isFlushingRef.current) return;
    const queue = loadQueue(token);
    if (queue.length === 0) return;

    isFlushingRef.current = true;
    setIsFlushing(true);

    let successCount = 0;
    const failedEntries: QueueEntry[] = [];

    for (const entry of queue) {
      const fn = pendingFns.current.get(entry.id);
      if (!fn) {
        // Функция потеряна (например, после перезагрузки страницы)
        // Не можем повторить — пропускаем с предупреждением
        console.warn(`[OfflineQueue] Lost action fn for id=${entry.id} type=${entry.type}`);
        continue;
      }

      try {
        await fn();
        pendingFns.current.delete(entry.id);
        successCount++;
      } catch (e) {
        entry.retries++;
        if (entry.retries < 3) {
          failedEntries.push(entry);
        } else {
          // После 3 попыток — выбрасываем из очереди
          pendingFns.current.delete(entry.id);
          console.error(`[OfflineQueue] Dropped action after 3 retries: ${entry.type}`);
        }
      }
    }

    saveQueue(token, failedEntries);
    setPendingCount(failedEntries.length);
    isFlushingRef.current = false;
    setIsFlushing(false);

    if (successCount > 0) {
      console.info(`[OfflineQueue] Flushed ${successCount} queued actions for tatami ${token.slice(0, 8)}`);
    }
    if (failedEntries.length > 0) {
      onFlushError?.(`${failedEntries.length} действий не удалось отправить после восстановления сети`);
    }
  }, [token, onFlushError]);

  /** Сбросить очередь (например при смене матча) */
  const clearOfflineQueue = useCallback(() => {
    clearQueue(token);
    pendingFns.current.clear();
    setPendingCount(0);
  }, [token]);

  // Автоматический flush при восстановлении сети
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      // Небольшая задержка чтобы соединение стабилизировалось
      const timer = setTimeout(() => flush(), 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, flush]);

  return {
    enqueue,
    flush,
    clearOfflineQueue,
    pendingCount,
    isFlushing,
  };
}
