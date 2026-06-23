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
import { logAudit } from "./audit.service.js";
import crypto from "node:crypto";

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

/** Внутренняя функция для отправки системных уведомлений без проверки прав */
export async function sendSystemNotification(
  input: BroadcastInput & { actorId?: string },
) {
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

  const campaignId = crypto.randomUUID();
  const campaignPayload: Prisma.InputJsonObject = {
    ...(input.payload ?? {}),
    campaignId,
  };

  const data = recipients.map(({ id: userId, locale }) => ({
    userId,
    type: input.type,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    payload: campaignPayload,
    locale,
  }));

  const created =
    data.length > 0
      ? await prisma.notification.createMany({ data })
      : { count: 0 };

  for (const item of data) {
    emitToUser(item.userId, "notification:new", {
      type: item.type,
      titleKey: item.titleKey,
      bodyKey: item.bodyKey,
      payload: item.payload,
    });
  }

  if (input.actorId) {
    await logAudit({
      actorUserId: input.actorId,
      action: "notification.broadcast",
      targetEntity: "NotificationBroadcast",
      targetId: campaignId,
      metadata: {
        title: input.titleKey,
        body: input.bodyKey,
        type: input.type,
        target: input.target as any,
        count: created.count,
      },
    });
  }

  return { id: campaignId, count: created.count };
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

  // Используем внутреннюю функцию
  const result = await sendSystemNotification({
    ...input,
    actorId: actorUserId,
  });

  return {
    id: result.id,
    count: result.count,
    title: input.titleKey,
    body: input.bodyKey,
    type: input.type,
    target: input.target,
    createdAt: new Date().toISOString(),
  };
}

async function assertAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== UserRole.ADMIN) {
    throw new NotificationError("FORBIDDEN", "Тек әкімшіге рұқсат", 403);
  }
}

export async function listBroadcasts(actorUserId: string, limit = 50) {
  await assertAdmin(actorUserId);
  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["notification.broadcast", "notification.system"] },
      targetEntity: "NotificationBroadcast",
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: {
      actor: { select: { id: true, name: true, surname: true } },
    },
  });

  return logs.map((log) => {
    const metadata = (log.metadata ?? {}) as Record<string, unknown>;
    return {
      id: log.targetId,
      title: String(metadata.title ?? ""),
      body: String(metadata.body ?? ""),
      type: String(metadata.type ?? "announcement"),
      target: metadata.target ?? { kind: "all" },
      count: Number(metadata.count ?? 0),
      createdAt: log.createdAt,
      actor: log.actor,
    };
  });
}

export async function updateBroadcast(
  actorUserId: string,
  campaignId: string,
  input: { title: string; body: string },
) {
  await assertAdmin(actorUserId);
  const log = await prisma.auditLog.findFirst({
    where: {
      action: { in: ["notification.broadcast", "notification.system"] },
      targetEntity: "NotificationBroadcast",
      targetId: campaignId,
    },
  });
  if (!log) {
    throw new NotificationError(
      "BROADCAST_NOT_FOUND",
      "Рассылка табылмады",
      404,
    );
  }

  const updated = await prisma.notification.updateMany({
    where: {
      payload: { path: ["campaignId"], equals: campaignId },
    },
    data: { titleKey: input.title, bodyKey: input.body },
  });
  const metadata = (log.metadata ?? {}) as Record<string, unknown>;
  await prisma.auditLog.update({
    where: { id: log.id },
    data: {
      metadata: {
        ...metadata,
        title: input.title,
        body: input.body,
        updatedAt: new Date().toISOString(),
        updatedBy: actorUserId,
      } as Prisma.InputJsonObject,
    },
  });

  await logAudit({
    actorUserId,
    action: "notification.broadcast.update",
    targetEntity: "NotificationBroadcast",
    targetId: campaignId,
    before: { title: metadata.title, body: metadata.body },
    after: input,
    metadata: { recipientsUpdated: updated.count },
  });

  return { id: campaignId, updated: updated.count, ...input };
}

export async function deleteBroadcast(actorUserId: string, campaignId: string) {
  await assertAdmin(actorUserId);
  const log = await prisma.auditLog.findFirst({
    where: {
      action: { in: ["notification.broadcast", "notification.system"] },
      targetEntity: "NotificationBroadcast",
      targetId: campaignId,
    },
  });
  if (!log) {
    throw new NotificationError(
      "BROADCAST_NOT_FOUND",
      "Рассылка табылмады",
      404,
    );
  }

  const deleted = await prisma.notification.deleteMany({
    where: {
      payload: { path: ["campaignId"], equals: campaignId },
    },
  });
  await prisma.auditLog.delete({ where: { id: log.id } });
  await logAudit({
    actorUserId,
    action: "notification.broadcast.delete",
    targetEntity: "NotificationBroadcast",
    targetId: campaignId,
    before: log.metadata,
    metadata: { recipientsDeleted: deleted.count },
  });

  return { id: campaignId, deleted: deleted.count };
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
