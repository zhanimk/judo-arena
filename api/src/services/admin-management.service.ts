/**
 * Сервис управления для админа: блокировка/разблокировка клубов и пользователей,
 * архивирование турниров, список всех пользователей, редактирование SystemConfig.
 * Также: CRUD пользователей, CRUD клубов, CRUD групп клуба.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { Prisma, ClubRole, UserRole, Gender, Locale, MatchStatus, TournamentStatus } from "@prisma/client";
import { logAudit } from "./audit.service.js";
import { env } from "../lib/env.js";

export class AdminManagementError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "AdminManagementError";
  }
}

async function assertAdmin(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== UserRole.ADMIN) {
    throw new AdminManagementError(
      "FORBIDDEN",
      "Тек әкімші орындай алады",
      403,
    );
  }
}

// ============================================================
// CLUBS
// ============================================================

export async function toggleClubBlock(
  actorId: string,
  clubId: string,
  blocked: boolean,
  reason?: string,
) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club)
    throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

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
          id: true,
          name: true,
          surname: true,
          gender: true,
          dateOfBirth: true,
          weightKg: true,
          beltRank: true,
          role: true,
          isActive: true,
          email: true,
          phone: true,
          avatarUrl: true,
          ratingEntries: { select: { points: true } },
          documents: { orderBy: { updatedAt: "desc" as const } },
        },
      },
      applications: {
        include: {
          tournament: {
            select: { id: true, name: true, startDate: true, status: true },
          },
          _count: { select: { entries: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      createdBy: {
        select: { id: true, name: true, surname: true, email: true },
      },
    },
  });
  if (!club)
    throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  // Total points across all members
  const memberIds = club.members.map((m) => m.id);
  const ratingEntries = await prisma.ratingEntry.findMany({
    where: { athleteId: { in: memberIds } },
  });
  const totalPoints = ratingEntries.reduce(
    (sum, e) => sum + Number(e.points),
    0,
  );

  const members = club.members.map((m) => ({
    ...m,
    totalPoints: m.ratingEntries.reduce((sum, e) => sum + Number(e.points), 0),
    ratingEntries: undefined,
  }));

  return {
    ...club,
    members,
    totalPoints,
    ratingEntriesCount: ratingEntries.length,
  };
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
  const where: Prisma.UserWhereInput = { deletedAt: null };
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
  const limit = Math.min(query.limit ?? 50, 200);
  const offset = Math.max(query.offset ?? 0, 0);

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        surname: true,
        avatarUrl: true,
        gender: true,
        weightKg: true,
        beltRank: true,
        dateOfBirth: true,
        isActive: true,
        createdAt: true,
        clubId: true,
        preferredLocale: true,
        club: { select: { id: true, name: true, city: true } },
        documents: { orderBy: { updatedAt: "desc" as const } },
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
          category: {
            select: { gender: true, weightMin: true, weightMax: true },
          },
        },
        orderBy: { awardedAt: "desc" },
      },
      documents: { orderBy: { updatedAt: "desc" } },
      _count: {
        select: { redmatches: true, bluematches: true, wonMatches: true },
      },
    },
  });
  if (!user)
    throw new AdminManagementError(
      "USER_NOT_FOUND",
      "Пайдаланушы табылмады",
      404,
    );
  return user;
}

export async function toggleUserBlock(
  actorId: string,
  userId: string,
  active: boolean,
) {
  await assertAdmin(actorId);
  if (actorId === userId) {
    throw new AdminManagementError(
      "CANT_SELF_BLOCK",
      "Өзіңізді блоктай алмайсыз",
      400,
    );
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw new AdminManagementError(
      "USER_NOT_FOUND",
      "Пайдаланушы табылмады",
      404,
    );

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: active },
  });

  // Немедленно инвалидируем кэш в authenticate — заблокированный не должен ждать 300 сек
  await redis.del(`user-cache:${userId}`);

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

export async function setTournamentFeatured(
  actorId: string,
  tournamentId: string,
  featured: boolean,
) {
  await assertAdmin(actorId);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new AdminManagementError(
      "TOURNAMENT_NOT_FOUND",
      "Жарыс табылмады",
      404,
    );

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

export async function archiveTournament(
  actorId: string,
  tournamentId: string,
  archive: boolean,
) {
  await assertAdmin(actorId);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new AdminManagementError(
      "TOURNAMENT_NOT_FOUND",
      "Жарыс табылмады",
      404,
    );

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

export async function updateSystemConfig(
  actorId: string,
  key: string,
  value: unknown,
) {
  await assertAdmin(actorId);
  const before = await prisma.systemConfig.findUnique({ where: { key } });

  const updated = await prisma.systemConfig.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue, updatedBy: actorId },
    create: { key, value: value as Prisma.InputJsonValue, updatedBy: actorId },
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

export async function createUserByAdmin(
  actorId: string,
  input: {
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
    clubRole?: "OWNER" | "COACH";
  },
) {
  await assertAdmin(actorId);

  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });
  if (existing)
    throw new AdminManagementError("EMAIL_TAKEN", "Бұл email тіркелген", 409);

  if (input.clubId) {
    const club = await prisma.club.findUnique({ where: { id: input.clubId } });
    if (!club)
      throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

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
      clubRole:
        input.role === "COACH" && input.clubId
          ? input.clubRole === "OWNER"
            ? ClubRole.OWNER
            : ClubRole.COACH
          : null,
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

export async function updateUserByAdmin(
  actorId: string,
  userId: string,
  input: {
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
  },
) {
  await assertAdmin(actorId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw new AdminManagementError(
      "USER_NOT_FOUND",
      "Пайдаланушы табылмады",
      404,
    );

  if (input.email && input.email.toLowerCase().trim() !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });
    if (existing)
      throw new AdminManagementError("EMAIL_TAKEN", "Бұл email тіркелген", 409);
  }

  const data: Prisma.UserUpdateInput = {
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.surname !== undefined && { surname: input.surname.trim() }),
    ...(input.nameLatin !== undefined && { nameLatin: input.nameLatin?.trim() || null }),
    ...(input.surnameLatin !== undefined && { surnameLatin: input.surnameLatin?.trim() || null }),
    ...(input.email !== undefined && { email: input.email.toLowerCase().trim() }),
    ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }),
    ...(input.gender !== undefined && { gender: input.gender }),
    ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
    ...(input.beltRank !== undefined && { beltRank: input.beltRank }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.preferredLocale !== undefined && { preferredLocale: input.preferredLocale }),
  };

  const updated = await prisma.user.update({ where: { id: userId }, data });
  // Инвалидируем кэш аутентификации (role/email/name могли измениться)
  await redis.del(`user-cache:${userId}`);

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

export async function changeUserClub(
  actorId: string,
  userId: string,
  clubId: string | null,
) {
  await assertAdmin(actorId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw new AdminManagementError(
      "USER_NOT_FOUND",
      "Пайдаланушы табылмады",
      404,
    );

  if (clubId) {
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club)
      throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      clubId,
      clubRole: user.role === UserRole.COACH && clubId ? ClubRole.COACH : null,
    },
  });
  // Инвалидируем кэш — clubId изменился, authorize использует его
  await redis.del(`user-cache:${userId}`);

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

export async function resetUserPassword(
  actorId: string,
  userId: string,
  newPassword: string,
) {
  await assertAdmin(actorId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw new AdminManagementError(
      "USER_NOT_FOUND",
      "Пайдаланушы табылмады",
      404,
    );

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
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

export async function createClubByAdmin(
  actorId: string,
  input: {
    name: { ru: string; kk?: string; en?: string };
    city: string;
    country?: string;
    shortName?: string;
    description?: { ru?: string; kk?: string; en?: string };
  },
) {
  await assertAdmin(actorId);

  const club = await prisma.club.create({
    data: {
      name: input.name,
      city: input.city.trim(),
      country: input.country ?? "KZ",
      shortName: input.shortName?.trim() || null,
      description: input.description ? (input.description as Prisma.InputJsonValue) : undefined,
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

export async function updateClubByAdmin(
  actorId: string,
  clubId: string,
  input: {
    name?: { ru: string; kk?: string; en?: string };
    city?: string;
    country?: string;
    shortName?: string | null;
    description?: { ru?: string; kk?: string; en?: string } | null;
  },
) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club)
    throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  const data: Prisma.ClubUpdateInput = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.city !== undefined && { city: input.city.trim() }),
    ...(input.country !== undefined && { country: input.country }),
    ...(input.shortName !== undefined && { shortName: input.shortName }),
    ...(input.description !== undefined && {
      description: input.description !== null
        ? (input.description as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    }),
  };

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
  if (!club)
    throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  if (club._count.members > 0) {
    throw new AdminManagementError(
      "CLUB_HAS_MEMBERS",
      `Клубта ${club._count.members} мүше бар. Алдымен оларды шығарыңыз.`,
      400,
    );
  }

  // Soft delete: помечаем deletedAt, деактивируем.
  // Hard delete не используем — клуб может числиться в истории турниров.
  await prisma.club.update({
    where: { id: clubId },
    data: { isActive: false, deletedAt: new Date() },
  });

  await logAudit({
    actorUserId: actorId,
    action: "club.delete",
    targetEntity: "Club",
    targetId: clubId,
    before: { name: club.name, city: club.city },
    after: { deletedAt: new Date().toISOString(), isActive: false },
  });

  return { ok: true };
}

// ============================================================
// CLUB GROUPS — создание + редактирование + удаление
// ============================================================

export async function createGroupByAdmin(
  actorId: string,
  clubId: string,
  input: {
    name: string;
    ageMin: number;
    ageMax: number;
  },
) {
  await assertAdmin(actorId);
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club)
    throw new AdminManagementError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  const group = await prisma.clubGroup.create({
    data: {
      clubId,
      name: input.name.trim(),
      ageMin: input.ageMin,
      ageMax: input.ageMax,
    },
  });

  await logAudit({
    actorUserId: actorId,
    action: "clubgroup.create",
    targetEntity: "ClubGroup",
    targetId: group.id,
    after: {
      clubId,
      name: group.name,
      ageMin: group.ageMin,
      ageMax: group.ageMax,
    },
  });

  return group;
}

export async function updateGroupByAdmin(
  actorId: string,
  groupId: string,
  input: {
    name?: string;
    ageMin?: number;
    ageMax?: number;
  },
) {
  await assertAdmin(actorId);
  const group = await prisma.clubGroup.findUnique({ where: { id: groupId } });
  if (!group)
    throw new AdminManagementError("GROUP_NOT_FOUND", "Топ табылмады", 404);

  const data: Prisma.ClubGroupUpdateInput = {
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.ageMin !== undefined && { ageMin: input.ageMin }),
    ...(input.ageMax !== undefined && { ageMax: input.ageMax }),
  };

  const updated = await prisma.clubGroup.update({
    where: { id: groupId },
    data,
  });

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
  if (!group)
    throw new AdminManagementError("GROUP_NOT_FOUND", "Топ табылмады", 404);

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
// ПОЛЬЗОВАТЕЛЬ — удаление
// ============================================================

export async function deleteUserByAdmin(actorId: string, userId: string) {
  await assertAdmin(actorId);

  if (actorId === userId) {
    throw new AdminManagementError(
      "CANNOT_DELETE_SELF",
      "Өзіңізді жоюға болмайды",
      400,
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    throw new AdminManagementError(
      "USER_NOT_FOUND",
      "Пайдаланушы табылмады",
      404,
    );

  // Soft delete: деактивируем аккаунт и помечаем deletedAt.
  // Hard delete не используем — данные нужны для истории турниров и аудита.
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, deletedAt: new Date() },
  });
  await redis.del(`user-cache:${userId}`);

  await logAudit({
    actorUserId: actorId,
    action: "user.delete",
    targetEntity: "User",
    targetId: userId,
    before: {
      email: user.email,
      role: user.role,
      name: user.name,
      surname: user.surname,
    },
    after: { deletedAt: new Date().toISOString(), isActive: false },
  });

  return { ok: true };
}

// ============================================================
// REPORTS / STATS
// ============================================================

/**
 * Операционные бизнес-метрики для admin dashboard.
 * Отвечает на вопрос "что происходит прямо сейчас и за последние 24 часа".
 */
export async function getBusinessMetrics() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const [
    matchesToday,
    matchesCompleted24h,
    matchDurations,
    activeTatamis,
    activeTournaments,
    peakHourData,
    _categoryLoad,
    liveMatches,
  ] = await Promise.all([
    // Матчи начатые сегодня
    prisma.match.count({
      where: { startedAt: { gte: today } },
    }),

    // Завершённых матчей за 24 часа
    prisma.match.count({
      where: { status: MatchStatus.COMPLETED, finishedAt: { gte: yesterday } },
    }),

    // Длительность завершённых матчей (для среднего)
    prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        finishedAt: { gte: yesterday, not: null },
        startedAt: { not: null },
      },
      select: { startedAt: true, finishedAt: true },
      take: 200,
    }),

    // Активных татами прямо сейчас
    prisma.match.groupBy({
      by: ["tatamiNumber"],
      where: { status: MatchStatus.IN_PROGRESS, tatamiNumber: { not: null } },
      _count: { id: true },
    }),

    // Турниры в процессе
    prisma.tournament.findMany({
      where: { status: { in: [TournamentStatus.IN_PROGRESS, TournamentStatus.REGISTRATION_OPEN] } },
      select: { id: true, name: true, status: true, startDate: true, tatamiCount: true },
      orderBy: { startDate: "desc" },
      take: 5,
    }),

    // Почасовое распределение матчей за 7 дней (пиковый час)
    prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        startedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { startedAt: true },
      take: 1000,
    }),

    // Топ категория по нагрузке (больше всего матчей)
    prisma.match.groupBy({
      by: ["bracketId"],
      where: { status: MatchStatus.COMPLETED, finishedAt: { gte: yesterday } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),

    // Текущие матчи IN_PROGRESS
    prisma.match.count({ where: { status: MatchStatus.IN_PROGRESS } }),
  ]);

  // Среднее время матча в секундах
  const durations = matchDurations
    .filter((m) => m.startedAt && m.finishedAt)
    .map((m) => Math.floor((m.finishedAt!.getTime() - m.startedAt!.getTime()) / 1000));
  const avgDurationSec: number | null = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // Пиковый час дня (0-23)
  const hourCounts: Record<number, number> = {};
  for (const m of peakHourData) {
    if (!m.startedAt) continue;
    const h = m.startedAt.getHours();
    hourCounts[h] = (hourCounts[h] ?? 0) + 1;
  }
  const peakHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];

  // Матчей в очереди (PENDING с татами)
  const matchesInQueue = await prisma.match.count({
    where: { status: MatchStatus.PENDING, tatamiNumber: { not: null } },
  });

  return {
    realtime: {
      liveMatches,
      activeTatamis: activeTatamis.length,
      matchesInQueue,
    },
    today: {
      matchesStarted: matchesToday,
      matchesCompleted: matchesCompleted24h,
      avgMatchDurationSec: avgDurationSec,
      avgMatchDurationMin: avgDurationSec ? Math.round(avgDurationSec / 60 * 10) / 10 : null,
    },
    activeTournaments: activeTournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      startDate: t.startDate,
      tatamiCount: t.tatamiCount,
    })),
    insights: {
      peakHour: peakHour ? { hour: Number(peakHour[0]), matchCount: peakHour[1] } : null,
      hourlyDistribution: hourCounts,
    },
    generatedAt: now.toISOString(),
  };
}

export async function getStats() {
  const [tournaments, users, clubs, matches, ratingEntries] = await Promise.all(
    [
      prisma.tournament.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
      prisma.club.count(),
      prisma.match.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.ratingEntry.count(),
    ],
  );
  return {
    tournaments,
    users,
    clubsCount: clubs,
    matches,
    ratingEntriesCount: ratingEntries,
  };
}

// ============================================================
// FEDERATION ANALYTICS — для отчётов Министерству спорта
// ============================================================

export async function getFederationAnalytics() {
  const now = new Date();
  const currentYear = now.getFullYear();
  // 24 месяца назад для трендов
  const since24m = new Date(now.getFullYear() - 2, now.getMonth(), 1);

  const [
    athletesByMonth,
    tournamentsByMonth,
    matchesByMonth,
    genderBreakdown,
    athletesByCity,
    topClubs,
    allAthletes,
    weightCategories,
    completedTournaments,
    ratingTopAthletes,
  ] = await Promise.all([
    // Регистрации спортсменов по месяцам (createdAt)
    prisma.$queryRaw<Array<{ year: number; month: number; count: bigint }>>`
      SELECT EXTRACT(YEAR FROM "createdAt")::int AS year,
             EXTRACT(MONTH FROM "createdAt")::int AS month,
             COUNT(*) AS count
      FROM "User"
      WHERE role = 'ATHLETE' AND "createdAt" >= ${since24m}
      GROUP BY year, month
      ORDER BY year, month
    `,

    // Турниры по месяцам (startDate)
    prisma.$queryRaw<Array<{ year: number; month: number; count: bigint; status: string }>>`
      SELECT EXTRACT(YEAR FROM "startDate")::int AS year,
             EXTRACT(MONTH FROM "startDate")::int AS month,
             COUNT(*) AS count,
             status
      FROM "Tournament"
      WHERE "startDate" >= ${since24m}
      GROUP BY year, month, status
      ORDER BY year, month
    `,

    // Матчи по месяцам (завершённые)
    prisma.$queryRaw<Array<{ year: number; month: number; count: bigint }>>`
      SELECT EXTRACT(YEAR FROM "finishedAt")::int AS year,
             EXTRACT(MONTH FROM "finishedAt")::int AS month,
             COUNT(*) AS count
      FROM "Match"
      WHERE status = 'COMPLETED' AND "finishedAt" >= ${since24m}
      GROUP BY year, month
      ORDER BY year, month
    `,

    // Пол спортсменов
    prisma.user.groupBy({
      by: ["gender"],
      where: { role: "ATHLETE", isActive: true },
      _count: { id: true },
    }),

    // Спортсмены по городам клубов
    prisma.$queryRaw<Array<{ city: string; count: bigint }>>`
      SELECT c.city, COUNT(u.id) AS count
      FROM "User" u
      JOIN "Club" c ON u."clubId" = c.id
      WHERE u.role = 'ATHLETE' AND u."isActive" = true AND c."isActive" = true
      GROUP BY c.city
      ORDER BY count DESC
      LIMIT 15
    `,

    // Топ клубов по количеству спортсменов
    prisma.$queryRaw<Array<{ clubId: string; name: unknown; city: string; count: bigint }>>`
      SELECT c.id AS "clubId", c.name, c.city, COUNT(u.id) AS count
      FROM "User" u
      JOIN "Club" c ON u."clubId" = c.id
      WHERE u.role = 'ATHLETE' AND u."isActive" = true
      GROUP BY c.id, c.name, c.city
      ORDER BY count DESC
      LIMIT 10
    `,

    // Все спортсмены с dateOfBirth для расчёта возраста
    prisma.user.findMany({
      where: { role: "ATHLETE", isActive: true, dateOfBirth: { not: null } },
      select: { dateOfBirth: true, gender: true },
    }),

    // Популярность весовых категорий
    prisma.$queryRaw<Array<{ gender: string; weightMax: number; count: bigint }>>`
      SELECT c.gender, c."weightMax", COUNT(ae.id) AS count
      FROM "ApplicationEntry" ae
      JOIN "Category" c ON ae."categoryId" = c.id
      GROUP BY c.gender, c."weightMax"
      ORDER BY count DESC
      LIMIT 20
    `,

    // Завершённые турниры за текущий год
    prisma.tournament.findMany({
      where: {
        status: "COMPLETED",
        startDate: { gte: new Date(currentYear, 0, 1) },
      },
      select: { id: true, name: true, city: true, startDate: true, _count: { select: { categories: true } } },
      orderBy: { startDate: "desc" },
    }),

    // Топ-10 спортсменов по рейтингу в текущем году
    prisma.$queryRaw<Array<{ athleteId: string; name: string; surname: string; total: number; clubCity: string | null }>>`
      SELECT re."athleteId",
             u.name,
             u.surname,
             SUM(re.points)::float AS total,
             c.city AS "clubCity"
      FROM "RatingEntry" re
      JOIN "User" u ON re."athleteId" = u.id
      LEFT JOIN "Club" c ON u."clubId" = c.id
      JOIN "Tournament" t ON re."tournamentId" = t.id
      WHERE EXTRACT(YEAR FROM t."startDate") = ${currentYear}
      GROUP BY re."athleteId", u.name, u.surname, c.city
      ORDER BY total DESC
      LIMIT 10
    `,
  ]);

  // Средний возраст по полу
  const ageByGender: Record<string, { count: number; totalAge: number }> = {};
  const nowMs = now.getTime();
  for (const a of allAthletes) {
    if (!a.dateOfBirth) continue;
    const ageYears = (nowMs - new Date(a.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const g = a.gender ?? "UNKNOWN";
    if (!ageByGender[g]) ageByGender[g] = { count: 0, totalAge: 0 };
    ageByGender[g].count++;
    ageByGender[g].totalAge += ageYears;
  }
  const avgAgeByGender = Object.entries(ageByGender).map(([gender, d]) => ({
    gender,
    avgAge: Math.round((d.totalAge / d.count) * 10) / 10,
    count: d.count,
  }));

  return {
    period: { from: since24m.toISOString(), to: now.toISOString() },
    athletes: {
      byMonth: athletesByMonth.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) })),
      byCity: athletesByCity.map((r) => ({ city: r.city, count: Number(r.count) })),
      byGender: genderBreakdown.map((r) => ({ gender: r.gender ?? "UNKNOWN", count: r._count.id })),
      avgAgeByGender,
      topClubs: topClubs.map((r) => ({
        clubId: r.clubId,
        name: r.name,
        city: r.city,
        count: Number(r.count),
      })),
    },
    tournaments: {
      byMonth: tournamentsByMonth.map((r) => ({
        year: r.year,
        month: r.month,
        count: Number(r.count),
        status: r.status,
      })),
      completedThisYear: completedTournaments.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        startDate: t.startDate,
        categoriesCount: t._count.categories,
      })),
    },
    matches: {
      byMonth: matchesByMonth.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) })),
    },
    categories: {
      popularWeightClasses: weightCategories.map((r) => ({
        gender: r.gender,
        weightMax: r.weightMax,
        count: Number(r.count),
      })),
    },
    ratings: {
      topAthletesThisYear: ratingTopAthletes.map((r) => ({
        athleteId: r.athleteId,
        name: r.name,
        surname: r.surname,
        total: r.total,
        clubCity: r.clubCity,
      })),
    },
    generatedAt: now.toISOString(),
  };
}
