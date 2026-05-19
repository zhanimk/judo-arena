/**
 * Сервис управления клубами, группами и спортсменами.
 *
 * Правила доступа:
 *  • Список и просмотр клуба — все (даже без авторизации).
 *  • Создание клуба — COACH (становится создателем + участником) или ADMIN.
 *  • Изменение/удаление клуба — создатель клуба или ADMIN.
 *  • Управление группами и спортсменами клуба — тренер этого клуба или ADMIN.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import type {
  CreateClubInput,
  UpdateClubInput,
  ListClubsQuery,
  CreateClubGroupInput,
  UpdateClubGroupInput,
  CreateAthleteByCoachInput,
  UpdateAthleteInput,
} from "../validators/club.schema.js";
import { UserRole } from "@prisma/client";

export class ClubError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "ClubError";
  }
}

// ============================================================
// КЛУБЫ — CRUD
// ============================================================

export async function listClubs(q: ListClubsQuery) {
  const where: any = {};
  if (q.city) where.city = { contains: q.city, mode: "insensitive" };
  if (q.search) {
    where.OR = [
      { city: { contains: q.search, mode: "insensitive" } },
      { shortName: { contains: q.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.club.findMany({
      where,
      skip: q.offset,
      take: q.limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    }),
    prisma.club.count({ where }),
  ]);

  return { items, total, limit: q.limit, offset: q.offset };
}

export async function getClub(id: string) {
  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      groups: { orderBy: { ageMin: "asc" } },
      _count: { select: { members: true } },
      createdBy: { select: { id: true, name: true, surname: true } },
    },
  });
  if (!club) throw new ClubError("CLUB_NOT_FOUND", "Клуб не найден", 404);
  return club;
}

export async function createClub(creatorUserId: string, input: CreateClubInput) {
  const creator = await prisma.user.findUnique({ where: { id: creatorUserId } });
  if (!creator) throw new ClubError("USER_NOT_FOUND", "Создатель не найден", 404);

  // COACH без клуба становится участником своего нового клуба.
  // COACH уже в клубе — не может создать ещё один (нужно сначала уйти из текущего).
  if (creator.role === UserRole.COACH && creator.clubId) {
    throw new ClubError(
      "COACH_ALREADY_IN_CLUB",
      "Тренер уже состоит в клубе. Сначала выйдите из текущего клуба.",
      409,
    );
  }

  const club = await prisma.club.create({
    data: {
      name: input.name,
      shortName: input.shortName,
      city: input.city,
      country: input.country,
      logoUrl: input.logoUrl,
      description: input.description ?? undefined,
      createdById: creatorUserId,
    },
  });

  // Если создатель — тренер, привязываем его к клубу
  if (creator.role === UserRole.COACH) {
    await prisma.user.update({
      where: { id: creatorUserId },
      data: { clubId: club.id },
    });
  }

  return getClub(club.id);
}

export async function updateClub(actorUserId: string, clubId: string, input: UpdateClubInput) {
  await assertCanManageClub(actorUserId, clubId);

  const club = await prisma.club.update({
    where: { id: clubId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.shortName !== undefined && { shortName: input.shortName }),
      ...(input.city && { city: input.city }),
      ...(input.country && { country: input.country }),
      ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
      ...(input.description && { description: input.description }),
    },
  });
  return getClub(club.id);
}

export async function deleteClub(actorUserId: string, clubId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor || actor.role !== UserRole.ADMIN) {
    throw new ClubError("FORBIDDEN", "Удалять клубы может только админ", 403);
  }
  // Отвязываем участников (не удаляем юзеров!)
  await prisma.user.updateMany({ where: { clubId }, data: { clubId: null } });
  await prisma.club.delete({ where: { id: clubId } });
}

// ============================================================
// ГРУППЫ КЛУБА
// ============================================================

export async function listClubGroups(clubId: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new ClubError("CLUB_NOT_FOUND", "Клуб не найден", 404);
  return prisma.clubGroup.findMany({
    where: { clubId },
    orderBy: { ageMin: "asc" },
  });
}

export async function createClubGroup(
  actorUserId: string,
  clubId: string,
  input: CreateClubGroupInput,
) {
  await assertCanManageClub(actorUserId, clubId);
  return prisma.clubGroup.create({
    data: {
      clubId,
      name: input.name,
      ageMin: input.ageMin,
      ageMax: input.ageMax,
    },
  });
}

export async function updateClubGroup(
  actorUserId: string,
  groupId: string,
  input: UpdateClubGroupInput,
) {
  const group = await prisma.clubGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new ClubError("GROUP_NOT_FOUND", "Группа не найдена", 404);
  await assertCanManageClub(actorUserId, group.clubId);

  if (input.ageMin !== undefined && input.ageMax !== undefined && input.ageMin > input.ageMax) {
    throw new ClubError("INVALID_RANGE", "ageMin должен быть ≤ ageMax", 400);
  }

  return prisma.clubGroup.update({
    where: { id: groupId },
    data: input,
  });
}

export async function deleteClubGroup(actorUserId: string, groupId: string) {
  const group = await prisma.clubGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new ClubError("GROUP_NOT_FOUND", "Группа не найдена", 404);
  await assertCanManageClub(actorUserId, group.clubId);
  await prisma.clubGroup.delete({ where: { id: groupId } });
}

// ============================================================
// СПОРТСМЕНЫ (УЧАСТНИКИ КЛУБА)
// ============================================================

export async function listClubMembers(clubId: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new ClubError("CLUB_NOT_FOUND", "Клуб не найден", 404);
  const members = await prisma.user.findMany({
    where: { clubId, role: UserRole.ATHLETE },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
    select: {
      id: true, email: true, name: true, surname: true,
      nameLatin: true, surnameLatin: true, dateOfBirth: true,
      gender: true, weightKg: true, beltRank: true,
      isActive: true, preferredLocale: true, avatarUrl: true,
    },
  });
  return members;
}

/** Прокси-регистрация: тренер создаёт аккаунт спортсмена для своего клуба. */
export async function createAthleteByCoach(
  actorUserId: string,
  clubId: string,
  input: CreateAthleteByCoachInput,
) {
  await assertCanManageClub(actorUserId, clubId);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ClubError("EMAIL_TAKEN", "Email уже зарегистрирован", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  return prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: UserRole.ATHLETE,
      name: input.name.trim(),
      surname: input.surname.trim(),
      nameLatin: input.nameLatin?.trim(),
      surnameLatin: input.surnameLatin?.trim(),
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      weightKg: input.weightKg,
      beltRank: input.beltRank,
      preferredLocale: input.preferredLocale,
      phone: input.phone,
      clubId,
    },
    select: {
      id: true, email: true, name: true, surname: true,
      nameLatin: true, surnameLatin: true, dateOfBirth: true,
      gender: true, weightKg: true, beltRank: true,
      role: true, clubId: true, createdAt: true,
    },
  });
}

export async function updateAthlete(
  actorUserId: string,
  athleteId: string,
  input: UpdateAthleteInput,
) {
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete || athlete.role !== UserRole.ATHLETE) {
    throw new ClubError("ATHLETE_NOT_FOUND", "Спортсмен не найден", 404);
  }

  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new ClubError("USER_NOT_FOUND", "Актёр не найден", 404);

  const isSelf = actor.id === athlete.id;
  const isAdmin = actor.role === UserRole.ADMIN;
  const isHisCoach = actor.role === UserRole.COACH && actor.clubId !== null && actor.clubId === athlete.clubId;

  if (!isSelf && !isAdmin && !isHisCoach) {
    throw new ClubError("FORBIDDEN", "Нет прав на изменение этого спортсмена", 403);
  }

  // Только админ и тренер могут менять clubId и isActive
  const canChangePrivileged = isAdmin || isHisCoach;
  const data: any = { ...input };
  if (!canChangePrivileged) {
    delete data.clubId;
    delete data.isActive;
  }

  return prisma.user.update({
    where: { id: athleteId },
    data,
    select: {
      id: true, email: true, name: true, surname: true,
      nameLatin: true, surnameLatin: true, dateOfBirth: true,
      gender: true, weightKg: true, beltRank: true,
      phone: true, avatarUrl: true, preferredLocale: true,
      role: true, clubId: true, isActive: true, updatedAt: true,
    },
  });
}

export async function detachAthleteFromClub(actorUserId: string, athleteId: string) {
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete || athlete.role !== UserRole.ATHLETE) {
    throw new ClubError("ATHLETE_NOT_FOUND", "Спортсмен не найден", 404);
  }
  if (!athlete.clubId) {
    throw new ClubError("NOT_IN_CLUB", "Спортсмен не состоит в клубе", 400);
  }
  await assertCanManageClub(actorUserId, athlete.clubId);
  await prisma.user.update({ where: { id: athleteId }, data: { clubId: null } });
}

// ============================================================
// УТИЛИТЫ ПРАВ
// ============================================================

async function assertCanManageClub(actorUserId: string, clubId: string): Promise<void> {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw new ClubError("USER_NOT_FOUND", "Пользователь не найден", 404);
  if (actor.role === UserRole.ADMIN) return;
  if (actor.role === UserRole.COACH && actor.clubId === clubId) return;
  throw new ClubError(
    "FORBIDDEN",
    "Управлять клубом может только его тренер или администратор",
    403,
  );
}
