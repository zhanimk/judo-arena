import { useCallback, useEffect, useState } from "react";

const QUEUE_KEY_PREFIX = "tatami_queue_";
const OFFLINE_ERROR =
  "Нет связи с сервером. Действие не принято. Восстановите соединение и сверьте счёт перед продолжением.";

/**
 * Scoring requires a server acknowledgement. Legacy queues contained only
 * metadata, not replayable commands, and must be reconciled by the judge.
 * Never replay time-sensitive commands or retry an ambiguous delivery here.
 */
export function useTatamiOfflineQueue(
  token: string,
  isOnline: boolean,
  onFlushError?: (msg: string) => void,
) {
  const [pendingCount, setPendingCount] = useState(0);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${QUEUE_KEY_PREFIX}${token}`);
      const queue: unknown = raw ? JSON.parse(raw) : [];
      setPendingCount(Array.isArray(queue) ? queue.length : 1);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [token]);

  const enqueue = useCallback(
    async (_actionType: string, fn: () => Promise<unknown>) => {
      if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
        throw new Error(OFFLINE_ERROR);
      }
      if (pendingCount || storageError) {
        throw new Error(
          "Есть неподтверждённые действия прошлой сессии. Сверьте счёт и очистите старую очередь.",
        );
      }
      await fn();
      return { online: true };
    },
    [isOnline, pendingCount, storageError],
  );

  const clearOfflineQueue = useCallback(() => {
    try {
      localStorage.removeItem(`${QUEUE_KEY_PREFIX}${token}`);
      setPendingCount(0);
      setStorageError(false);
    } catch {
      onFlushError?.("Не удалось очистить старую очередь. Проверьте доступ к хранилищу браузера.");
    }
  }, [token, onFlushError]);

  return {
    enqueue,
    clearOfflineQueue,
    pendingCount: storageError ? Math.max(1, pendingCount) : pendingCount,
    isFlushing: false,
  };
}
