/**
 * Сервис аудит-логирования.
 *
 * Вызывается из admin-сервисов когда нужно зафиксировать важное действие:
 *   • match.override     — переопределение победителя матча
 *   • match.rollback     — откат downstream-цепочки
 *   • tournament.delete  — удаление турнира
 *   • bracket.regenerate — перегенерация сетки
 *   • application.approve/reject
 */

import { prisma } from "../lib/prisma.js";
import { Prisma, UserRole } from "@prisma/client";
import { getRequestContext } from "../lib/request-context.js";

function toJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export interface AuditContext {
  actorUserId: string | null;
  action: string;
  targetEntity: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(ctx: AuditContext): Promise<void> {
  const reqCtx = getRequestContext();
  await prisma.auditLog.create({
    data: {
      actorUserId: ctx.actorUserId,
      action: ctx.action,
      targetEntity: ctx.targetEntity,
      targetId: ctx.targetId,
      before: toJson(ctx.before),
      after: toJson(ctx.after),
      metadata: toJson(ctx.metadata),
      ipAddress: ctx.ipAddress ?? reqCtx.ipAddress,
      userAgent: ctx.userAgent ?? reqCtx.userAgent,
    },
  });
}

export async function getApplicationHistory(
  applicationId: string,
  actorUserId: string,
  actorRole: string,
) {
  // COACH видит только историю своих заявок
  if (actorRole !== UserRole.ADMIN) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { clubId: true },
    });
    if (!application) return [];
    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { clubId: true },
    });
    if (!actor || actor.clubId !== application.clubId) {
      throw Object.assign(new Error("Доступ запрещён"), {
        httpStatus: 403,
        code: "FORBIDDEN",
      });
    }
  }

  return prisma.auditLog.findMany({
    where: { targetEntity: "Application", targetId: applicationId },
    orderBy: { createdAt: "asc" },
    include: {
      actor: { select: { id: true, name: true, surname: true, role: true } },
    },
  });
}

export async function listAuditLogs(query: {
  targetEntity?: string;
  targetId?: string;
  actorUserId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.targetEntity) where.targetEntity = query.targetEntity;
  if (query.targetId) where.targetId = query.targetId;
  if (query.actorUserId) where.actorUserId = query.actorUserId;
  if (query.action) where.action = query.action;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      take: Math.min(query.limit ?? 50, 200),
      skip: Math.max(query.offset ?? 0, 0),
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, surname: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, limit: query.limit ?? 50, offset: query.offset ?? 0 };
}
