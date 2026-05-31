/**
 * Серверный таймер удержания (osaekomi).
 *
 * При вызове startOsaekomi() планируется setTimeout на 20 секунд.
 * Если судья не нажал TOKETA вовремя — сервер сам вызывает endOsaekomi
 * с reason="TIME_LIMIT" → Ippon + авто-финиш матча.
 *
 * При рестарте сервера — restoreActiveTimers() сканирует IN_PROGRESS матчи
 * с активным osaekomi и восстанавливает таймеры.
 */

import { prisma } from "../lib/prisma.js";
import { MatchStatus } from "@prisma/client";
import { emitMatchEvent } from "../sockets/io.js";

const IPPON_SEC = 20;

// matchId → timer handle
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Запланировать авто-окончание osaekomi через (IPPON_SEC - already_elapsed) секунд.
 * @param startedAt  ISO-строка момента начала удержания (из scoreSnapshot)
 */
export function scheduleOsaekomiTimer(matchId: string, startedAt: string): void {
  cancelOsaekomiTimer(matchId); // Сбросить предыдущий если был

  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const remaining = Math.max(0, IPPON_SEC - elapsed);

  const handle = setTimeout(async () => {
    activeTimers.delete(matchId);
    await triggerAutoEndOsaekomi(matchId);
  }, remaining * 1000);

  activeTimers.set(matchId, handle);
}

/** Отменить таймер для матча (вызывается при TOKETA, паузе, завершении). */
export function cancelOsaekomiTimer(matchId: string): void {
  const h = activeTimers.get(matchId);
  if (h !== undefined) {
    clearTimeout(h);
    activeTimers.delete(matchId);
  }
}

/** При старте сервера — восстановить таймеры для активных удержаний. */
export async function restoreActiveTimers(): Promise<void> {
  const matches = await prisma.match.findMany({
    where: { status: MatchStatus.IN_PROGRESS },
    select: { id: true, scoreSnapshot: true },
  });

  let restored = 0;
  for (const m of matches) {
    const snap = m.scoreSnapshot as any;
    if (snap?.osaekomi?.startedAt) {
      scheduleOsaekomiTimer(m.id, snap.osaekomi.startedAt);
      restored++;
    }
  }

  if (restored > 0) {
    process.stdout.write(`[osaekomi-timer] Restored ${restored} active timer(s) after restart\n`);
  }
}

// ---- внутренний триггер авто-окончания ----

async function triggerAutoEndOsaekomi(matchId: string): Promise<void> {
  try {
    // Lazy import to avoid circular dependency (match.service imports this module)
    const { endOsaekomi } = await import("./match.service.js");
    const { getIO } = await import("../sockets/io.js");

    const result = await endOsaekomi(matchId, "TIME_LIMIT");

    // Emit real-time update
    try {
      const io = getIO();
      const match = result.match as any;
      emitMatchEvent(
        {
          id: match.id,
          tournamentId: match.tournamentId,
          bracketId: match.bracketId,
          tatamiNumber: match.tatamiNumber,
        },
        result.autoFinished ? "match:finished" : "match:scoreUpdate",
        { matchId, scoredType: result.scoredType, autoFinished: result.autoFinished },
      );
    } catch {
      // IO may not be ready — non-critical
    }
  } catch (err: any) {
    // Match may have already ended or be in a bad state — safe to ignore
    process.stderr.write(`[osaekomi-timer] Auto-end failed for match ${matchId}: ${err?.message}\n`);
  }
}
