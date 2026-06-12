/**
 * Сервис уведомлений.
 *
 * Админ может создавать уведомления и рассылать их по группам:
 *   - конкретному пользователю
 *   - всем тренерам / спортсменам
 *   - всем участникам турнира (по APPROVED заявкам)
 */

import { prisma } from "../lib/prisma.js";
import { Prisma, UserRole } from "@prisma/client";
import { emitToUser } from "../sockets/io.js";

export class NotificationError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

export interface BroadcastInput {
  type: string; // "announcement", "tournament_update" и т.д.
  titleKey: string;
  bodyKey: string;
  payload?: Prisma.InputJsonObject;
  target:
    | { kind: "user"; userId: string }
    | { kind: "role"; role: "ATHLETE" | "COACH" | "ADMIN" }
    | { kind: "tournament"; tournamentId: string } // всем участникам APPROVED-заявок
    | { kind: "club"; clubId: string }
    | { kind: "all" };
}

/** Создать одно или несколько уведомлений по target. Только админ. */
export async function broadcast(actorUserId: string, input: BroadcastInput) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new NotificationError(
      "FORBIDDEN",
      "Тек әкімші хабарландыру жасай алады",
      403,
    );
  }

  // Собираем список получателей вместе с их предпочтительной локалью
  let recipients: { id: string; locale: "kk" | "ru" | "en" }[] = [];

  switch (input.target.kind) {
    case "user": {
      const user = await prisma.user.findUnique({
        where: { id: input.target.userId },
        select: { id: true, preferredLocale: true },
      });
      if (user)
        recipients = [
          { id: user.id, locale: user.preferredLocale as "kk" | "ru" | "en" },
        ];
      break;
    }
    case "role": {
      const users = await prisma.user.findMany({
        where: { role: input.target.role, isActive: true },
        select: { id: true, preferredLocale: true },
      });
      recipients = users.map((u) => ({
        id: u.id,
        locale: u.preferredLocale as "kk" | "ru" | "en",
      }));
      break;
    }
    case "club": {
      const users = await prisma.user.findMany({
        where: { clubId: input.target.clubId, isActive: true },
        select: { id: true, preferredLocale: true },
      });
      recipients = users.map((u) => ({
        id: u.id,
        locale: u.preferredLocale as "kk" | "ru" | "en",
      }));
      break;
    }
    case "tournament": {
      // Всем у кого есть APPROVED заявка на турнир (тренеры + спортсмены через ApplicationEntry)
      const entries = await prisma.applicationEntry.findMany({
        where: {
          application: {
            tournamentId: input.target.tournamentId,
            status: "APPROVED",
          },
        },
        select: { athleteId: true, application: { select: { clubId: true } } },
      });
      const athleteIds = entries.map((e) => e.athleteId);
      const clubIds = Array.from(
        new Set(entries.map((e) => e.application.clubId)),
      );
      const [athletes, coaches] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: athleteIds } },
          select: { id: true, preferredLocale: true },
        }),
        prisma.user.findMany({
          where: { clubId: { in: clubIds }, role: UserRole.COACH },
          select: { id: true, preferredLocale: true },
        }),
      ]);
      const seen = new Set<string>();
      for (const u of [...athletes, ...coaches]) {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          recipients.push({
            id: u.id,
            locale: u.preferredLocale as "kk" | "ru" | "en",
          });
        }
      }
      break;
    }
    case "all": {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, preferredLocale: true },
      });
      recipients = users.map((u) => ({
        id: u.id,
        locale: u.preferredLocale as "kk" | "ru" | "en",
      }));
      break;
    }
  }

  if (recipients.length === 0) {
    return { count: 0 };
  }

  // Создаём уведомления batch'ем с учётом preferred locale каждого получателя
  const data = recipients.map(({ id: userId, locale }) => ({
    userId,
    type: input.type,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    payload: input.payload ?? Prisma.JsonNull,
    locale,
  }));
  const created = await prisma.notification.createMany({ data });

  // N2: Socket.IO push в личную комнату каждого получателя
  for (const item of data) {
    emitToUser(item.userId, "notification:new", {
      type: item.type,
      titleKey: item.titleKey,
      bodyKey: item.bodyKey,
      payload: item.payload,
    });
  }

  return { count: created.count };
}

/** Список уведомлений текущего пользователя. */
export async function listForUser(
  userId: string,
  opts: { type?: string; unreadOnly?: boolean; limit?: number } = {},
) {
  const where: Record<string, unknown> = { userId };
  if (opts.type) where.type = opts.type;
  if (opts.unreadOnly) where.read = false;
  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? 50, 200),
  });
}

export async function markAsRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!n || n.userId !== userId) {
    throw new NotificationError("NOT_FOUND", "Хабарландыру табылмады", 404);
  }
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
