/**
 * Сервис управления для админа: блокировка/разблокировка клубов и пользователей,
 * архивирование турниров, список всех пользователей, редактирование SystemConfig.
 * Также: CRUD пользователей, CRUD клубов, CRUD групп клуба.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { UserRole, Gender, Locale } from "@prisma/client";
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
          ratingEntries: { select: { points: true } },
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

  const members = club.members.map((m) => ({
    ...m,
    totalPoints: m.ratingEntries.reduce((sum, e) => sum + Number(e.points), 0),
    ratingEntries: undefined,
  }));

  return { ...club, members, totalPoints, ratingEntriesCount: ratingEntries.length };
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
// USERS — создание + редактирование + перевод + сброс пароля
// ============================================================

export async function createUserByAdmin(actorId: string, input: {
  email: string;
  password: string;
  role: "ATHLETE" | "COACH" | "ADMIN";
  name: string;
  surname: string;
  nameLatin?: string;
  surnameLatin?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE";
  weightKg?: number;
  beltRank?: string;
  phone?: string;
  preferredLocale?: "ru" | "kk" | "en";
  clubId?: string;
}) {
  await assertAdmin(actorId);

  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (existing) throw new AdminManagementError("EMAIL_TAKEN", "Бұл email тіркелген", 409);

  if (input.clubId) {
    const club = await prisma.club.findUnique({ where: { id: input.clubId } });
    if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role as UserRole,
      name: input.name.trim(),
      surname: input.surname.trim(),
      nameLatin: input.nameLatin?.trim() || null,
      surnameLatin: input.surnameLatin?.trim() || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender as Gender | undefined,
      weightKg: input.weightKg,
      beltRank: input.beltRank || null,
      phone: input.phone || null,
      preferredLocale: (input.preferredLocale as Locale) ?? Locale.kk,
      clubId: input.clubId || null,
    },
  });

  await logAudit({
    actorUserId: actorId,
    action: "user.create",
    targetEntity: "User",
    targetId: user.id,
    after: { email: user.email, role: user.role, clubId: user.clubId },
  });

  const { passwordHash: _ph, ...safeUser } = user;
  return safeUser;
}

export async function updateUserByAdmin(actorId: string, userId: string, input: {
  name?: string;
  surname?: string;
  nameLatin?: string | null;
  surnameLatin?: string | null;
  email?: string;
  dateOfBirth?: string | null;
  gender?: "MALE" | "FEMALE";
  weightKg?: number | null;
  beltRank?: string | null;
  phone?: string | null;
  preferredLocale?: "ru" | "kk" | "en";
}) {
  await assertAdmin(actorId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminManagementError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);

  if (input.email && input.email.toLowerCase().trim() !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
    if (existing) throw new AdminManagementError("EMAIL_TAKEN", "Бұл email тіркелген", 409);
  }

  const data: any = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.surname !== undefined) data.surname = input.surname.trim();
  if (input.nameLatin !== undefined) data.nameLatin = input.nameLatin?.trim() || null;
  if (input.surnameLatin !== undefined) data.surnameLatin = input.surnameLatin?.trim() || null;
  if (input.email !== undefined) data.email = input.email.toLowerCase().trim();
  if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.weightKg !== undefined) data.weightKg = input.weightKg;
  if (input.beltRank !== undefined) data.beltRank = input.beltRank;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.preferredLocale !== undefined) data.preferredLocale = input.preferredLocale;

  const updated = await prisma.user.update({ where: { id: userId }, data });

  await logAudit({
    actorUserId: actorId,
    action: "user.update",
    targetEntity: "User",
    targetId: userId,
    before: { name: user.name, surname: user.surname, email: user.email },
    after: data,
  });

  const { passwordHash: _ph, ...safeUser } = updated;
  return safeUser;
}

export async function changeUserClub(actorId: string, userId: string, clubId: string | null) {
  await assertAdmin(actorId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminManagementError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);

  if (clubId) {
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: { clubId } });

  await logAudit({
    actorUserId: actorId,
    action: "user.changeClub",
    targetEntity: "User",
    targetId: userId,
    before: { clubId: user.clubId },
    after: { clubId },
  });

  const { passwordHash: _ph, ...safeUser } = updated;
  return safeUser;
}

export async function resetUserPassword(actorId: string, userId: string, newPassword: string) {
  await assertAdmin(actorId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminManagementError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logAudit({
    actorUserId: actorId,
    action: "user.resetPassword",
    targetEntity: "User",
    targetId: userId,
  });

  return { ok: true };
}

// ============================================================
// CLUBS — создание + редактирование + удаление
// ============================================================

export async function createClubByAdmin(actorId: string, input: {
  name: { ru: string; kk?: string; en?: string };
  city: string;
  country?: string;
  shortName?: string;
  description?: { ru?: string; kk?: string; en?: string };
}) {
  await assertAdmin(actorId);

  const club = await prisma.club.create({
    data: {
      name: input.name,
      city: input.city.trim(),
      country: input.country ?? "KZ",
      shortName: input.shortName?.trim() || null,
      description: input.description ? (input.description as any) : undefined,
      createdById: actorId,
    },
  });

  await logAudit({
    actorUserId: actorId,
    action: "club.create",
    targetEntity: "Club",
    targetId: club.id,
    after: { name: club.name, city: club.city },
  });

  return club;
}

export async function updateClubByAdmin(actorId: string, clubId: string, input: {
  name?: { ru: string; kk?: string; en?: string };
  city?: string;
  country?: string;
  shortName?: string | null;
  description?: { ru?: string; kk?: string; en?: string } | null;
}) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.city !== undefined) data.city = input.city.trim();
  if (input.country !== undefined) data.country = input.country;
  if (input.shortName !== undefined) data.shortName = input.shortName;
  if (input.description !== undefined) data.description = input.description;

  const updated = await prisma.club.update({ where: { id: clubId }, data });

  await logAudit({
    actorUserId: actorId,
    action: "club.update",
    targetEntity: "Club",
    targetId: clubId,
    before: { name: club.name, city: club.city },
    after: data,
  });

  return updated;
}

export async function deleteClubByAdmin(actorId: string, clubId: string) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    include: { _count: { select: { members: true } } },
  });
  if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  if (club._count.members > 0) {
    throw new AdminManagementError(
      "CLUB_HAS_MEMBERS",
      `Клубта ${club._count.members} мүше бар. Алдымен оларды шығарыңыз.`,
      400,
    );
  }

  await prisma.club.delete({ where: { id: clubId } });

  await logAudit({
    actorUserId: actorId,
    action: "club.delete",
    targetEntity: "Club",
    targetId: clubId,
    before: { name: club.name, city: club.city },
  });

  return { ok: true };
}

// ============================================================
// CLUB GROUPS — создание + редактирование + удаление
// ============================================================

export async function createGroupByAdmin(actorId: string, clubId: string, input: {
  name: string;
  ageMin: number;
  ageMax: number;
}) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  const group = await prisma.clubGroup.create({
    data: { clubId, name: input.name.trim(), ageMin: input.ageMin, ageMax: input.ageMax },
  });

  await logAudit({
    actorUserId: actorId,
    action: "clubgroup.create",
    targetEntity: "ClubGroup",
    targetId: group.id,
    after: { clubId, name: group.name, ageMin: group.ageMin, ageMax: group.ageMax },
  });

  return group;
}

export async function updateGroupByAdmin(actorId: string, groupId: string, input: {
  name?: string;
  ageMin?: number;
  ageMax?: number;
}) {
  await assertAdmin(actorId);
  const group = await prisma.clubGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new AdminManagementError("GROUP_NOT_FOUND", "Топ табылмады", 404);

  const data: any = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.ageMin !== undefined) data.ageMin = input.ageMin;
  if (input.ageMax !== undefined) data.ageMax = input.ageMax;

  const updated = await prisma.clubGroup.update({ where: { id: groupId }, data });

  await logAudit({
    actorUserId: actorId,
    action: "clubgroup.update",
    targetEntity: "ClubGroup",
    targetId: groupId,
    before: { name: group.name, ageMin: group.ageMin, ageMax: group.ageMax },
    after: data,
  });

  return updated;
}

export async function deleteGroupByAdmin(actorId: string, groupId: string) {
  await assertAdmin(actorId);
  const group = await prisma.clubGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new AdminManagementError("GROUP_NOT_FOUND", "Топ табылмады", 404);

  await prisma.clubGroup.delete({ where: { id: groupId } });

  await logAudit({
    actorUserId: actorId,
    action: "clubgroup.delete",
    targetEntity: "ClubGroup",
    targetId: groupId,
    before: { name: group.name },
  });

  return { ok: true };
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
