/**
 * audit-archival.service.ts — архивирование и очистка старых аудит-логов.
 *
 * Стратегия:
 *   - Логи старше RETAIN_DAYS (по умолчанию 90 дней) удаляются батчами.
 *   - Запускается раз в сутки в 03:00 (сервер) через startAuditArchival().
 *   - Батч-удаление по 500 записей — не блокируем БД одним большим DELETE.
 *
 * Настройка через env:
 *   AUDIT_RETAIN_DAYS=90   (по умолчанию 90, минимум 30)
 */

import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

const DEFAULT_RETAIN_DAYS = 90;
const BATCH_SIZE = 500;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // раз в сутки

let archivalInterval: ReturnType<typeof setInterval> | null = null;

/** Запускает ежесуточную очистку устаревших audit logs. */
export function startAuditArchival(log: (msg: string) => void): void {
  // Первый запуск через 10 минут после старта
  const firstTimer = setTimeout(() => {
    archiveOldAuditLogs(log).catch((err) =>
      log(`[audit-archival] Error: ${err.message}`),
    );
  }, 10 * 60 * 1000);
  firstTimer.unref();

  archivalInterval = setInterval(() => {
    archiveOldAuditLogs(log).catch((err) =>
      log(`[audit-archival] Error: ${err.message}`),
    );
  }, INTERVAL_MS);
  archivalInterval.unref();

  const retainDays = getRetainDays();
  log(`[audit-archival] Scheduler started (retain: ${retainDays}d, interval: 24h, batch: ${BATCH_SIZE})`);
}

export function stopAuditArchival(): void {
  if (archivalInterval) {
    clearInterval(archivalInterval);
    archivalInterval = null;
  }
}

function getRetainDays(): number {
  return env.AUDIT_RETAIN_DAYS ?? DEFAULT_RETAIN_DAYS;
}

/** Удаляет старые audit logs батчами. Возвращает число удалённых записей. */
export async function archiveOldAuditLogs(
  log?: (msg: string) => void,
): Promise<number> {
  const retainDays = getRetainDays();
  const cutoff = new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000);

  // Считаем сколько записей под удаление
  const totalOld = await prisma.auditLog.count({
    where: { createdAt: { lt: cutoff } },
  });

  if (totalOld === 0) {
    log?.(`[audit-archival] No stale logs (cutoff: ${cutoff.toISOString()})`);
    return 0;
  }

  log?.(`[audit-archival] Found ${totalOld} logs older than ${retainDays}d — deleting in batches of ${BATCH_SIZE}`);

  let deleted = 0;

  // Батчевое удаление: находим N старейших ID и удаляем
  while (true) {
    const batch = await prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const { count } = await prisma.auditLog.deleteMany({
      where: { id: { in: batch.map((r) => r.id) } },
    });

    deleted += count;

    // Небольшая пауза между батчами — не перегружаем БД
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  log?.(`[audit-archival] Deleted ${deleted} stale audit logs (older than ${cutoff.toISOString()})`);
  return deleted;
}
