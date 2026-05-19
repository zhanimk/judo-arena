/**
 * Сервис управления для админа: блокировка/разблокировка клубов и пользователей,
 * архивирование турниров, список всех пользователей, редактирование SystemConfig.
 */

import { prisma } from "../lib/prisma.js";
import { UserRole } from "@prisma/client";
import { logAudit } from "./audit.service.js";

export class AdminManagementError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "AdminManagementError";
  }
}

async function assertAdmin(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== UserRole.ADMIN) {
    throw new AdminManagementError("FORBIDDEN", "Тек әкімші орындай алады", 403);
  }
}

// ============================================================
// CLUBS
// ============================================================

export async function toggleClubBlock(actorId: string, clubId: string, blocked: boolean, reason?: string) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  const updated = await prisma.club.update({
    where: { id: clubId },
    data: { isBlocked: blocked, blockedReason: blocked ? reason : null },
  });

  await logAudit({
    actorUserId: actorId,
    action: blocked ? "club.block" : "club.unblock",
    targetEntity: "Club",
    targetId: clubId,
    before: { isBlocked: club.isBlocked },
    after: { isBlocked: blocked },
    metadata: reason ? { reason } : undefined,
  });

  return updated;
}

export async function getClubFullDetails(clubId: string) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    include: {
      groups: true,
      members: {
        select: {
          id: true, name: true, surname: true, gender: true, dateOfBirth: true,
          weightKg: true, beltRank: true, role: true, isActive: true, email: true,
        },
      },
      applications: {
        include: {
          tournament: { select: { id: true, name: true, startDate: true, status: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      createdBy: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
  if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  // Total points across all members
  const memberIds = club.members.map((m) => m.id);
  const ratingEntries = await prisma.ratingEntry.findMany({
    where: { athleteId: { in: memberIds } },
  });
  const totalPoints = ratingEntries.reduce((sum, e) => sum + Number(e.points), 0);

  return { ...club, totalPoints, ratingEntriesCount: ratingEntries.length };
}

// ============================================================
// USERS
// ============================================================

export async function listAllUsers(query: {
  role?: UserRole;
  search?: string;
  clubId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  if (query.role) where.role = query.role;
  if (query.clubId) where.clubId = query.clubId;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: "insensitive" } },
      { name: { contains: query.search, mode: "insensitive" } },
      { surname: { contains: query.search, mode: "insensitive" } },
    ];
  }
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, role: true, name: true, surname: true,
        gender: true, weightKg: true, beltRank: true, dateOfBirth: true,
        isActive: true, createdAt: true, clubId: true, preferredLocale: true,
        club: { select: { id: true, name: true, city: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function getUserDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      club: true,
      ratingEntries: {
        include: {
          tournament: { select: { id: true, name: true } },
          category: { select: { gender: true, weightMin: true, weightMax: true } },
        },
        orderBy: { awardedAt: "desc" },
      },
      _count: { select: { redmatches: true, bluematches: true, wonMatches: true } },
    },
  });
  if (!user) throw new AdminManagementError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);
  return user;
}

export async function toggleUserBlock(actorId: string, userId: string, active: boolean) {
  await assertAdmin(actorId);
  if (actorId === userId) {
    throw new AdminManagementError("CANT_SELF_BLOCK", "Өзіңізді блоктай алмайсыз", 400);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminManagementError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);

  const updated = await prisma.user.update({ where: { id: userId }, data: { isActive: active } });

  await logAudit({
    actorUserId: actorId,
    action: active ? "user.unblock" : "user.block",
    targetEntity: "User",
    targetId: userId,
    before: { isActive: user.isActive },
    after: { isActive: active },
  });

  return updated;
}

// ============================================================
// TOURNAMENTS — архив + featured
// ============================================================

export async function setTournamentFeatured(actorId: string, tournamentId: string, featured: boolean) {
  await assertAdmin(actorId);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new AdminManagementError("TOURNAMENT_NOT_FOUND", "Жарыс табылмады", 404);

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: { isFeatured: featured },
  });

  await logAudit({
    actorUserId: actorId,
    action: featured ? "tournament.feature" : "tournament.unfeature",
    targetEntity: "Tournament",
    targetId: tournamentId,
    before: { isFeatured: t.isFeatured },
    after: { isFeatured: featured },
  });

  return updated;
}

export async function archiveTournament(actorId: string, tournamentId: string, archive: boolean) {
  await assertAdmin(actorId);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new AdminManagementError("TOURNAMENT_NOT_FOUND", "Жарыс табылмады", 404);

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: { isArchived: archive },
  });

  await logAudit({
    actorUserId: actorId,
    action: archive ? "tournament.archive" : "tournament.unarchive",
    targetEntity: "Tournament",
    targetId: tournamentId,
    before: { isArchived: t.isArchived },
    after: { isArchived: archive },
  });

  return updated;
}

// ============================================================
// SYSTEM CONFIG
// ============================================================

export async function getSystemConfig(key: string) {
  return prisma.systemConfig.findUnique({ where: { key } });
}

export async function updateSystemConfig(actorId: string, key: string, value: unknown) {
  await assertAdmin(actorId);
  const before = await prisma.systemConfig.findUnique({ where: { key } });

  const updated = await prisma.systemConfig.upsert({
    where: { key },
    update: { value: value as any, updatedBy: actorId },
    create: { key, value: value as any, updatedBy: actorId },
  });

  await logAudit({
    actorUserId: actorId,
    action: "systemconfig.update",
    targetEntity: "SystemConfig",
    targetId: key,
    before: before?.value,
    after: value,
  });

  return updated;
}

// ============================================================
// REPORTS / STATS
// ============================================================

export async function getStats() {
  const [tournaments, users, clubs, matches, ratingEntries] = await Promise.all([
    prisma.tournament.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.club.count(),
    prisma.match.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.ratingEntry.count(),
  ]);
  return {
    tournaments,
    users,
    clubsCount: clubs,
    matches,
    ratingEntriesCount: ratingEntries,
  };
}
