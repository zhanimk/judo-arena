import { ClubRole, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class CoachClubJoinRequestError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "CoachClubJoinRequestError";
  }
}

const coachSelect = {
  id: true,
  email: true,
  name: true,
  surname: true,
  phone: true,
  avatarUrl: true,
  clubId: true,
  clubRole: true,
};

export async function requestJoinClubAsCoach(coachId: string, clubId: string) {
  const coach = await prisma.user.findUnique({ where: { id: coachId } });
  if (!coach || coach.role !== UserRole.COACH) {
    throw new CoachClubJoinRequestError("COACH_NOT_FOUND", "Тренер табылмады", 404);
  }
  if (coach.clubId) {
    throw new CoachClubJoinRequestError("ALREADY_IN_CLUB", "Тренер қазірдің өзінде клубта", 409);
  }

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club || club.isBlocked || !club.isActive) {
    throw new CoachClubJoinRequestError("CLUB_NOT_AVAILABLE", "Клуб табылмады немесе қолжетімсіз", 404);
  }

  const pending = await prisma.coachClubJoinRequest.findFirst({
    where: { coachId, status: "PENDING" },
    include: { club: { select: { id: true, name: true, city: true } } },
  });
  if (pending && pending.clubId !== clubId) {
    throw new CoachClubJoinRequestError("ACTIVE_REQUEST_EXISTS", "Алдымен ағымдағы өтінімді қайтарыңыз", 409);
  }

  const existing = await prisma.coachClubJoinRequest.findUnique({
    where: { coachId_clubId: { coachId, clubId } },
  });
  if (existing?.status === "PENDING") {
    return prisma.coachClubJoinRequest.findUnique({
      where: { id: existing.id },
      include: { club: { select: { id: true, name: true, city: true, logoUrl: true } } },
    });
  }
  if (existing) await prisma.coachClubJoinRequest.delete({ where: { id: existing.id } });

  return prisma.coachClubJoinRequest.create({
    data: { coachId, clubId },
    include: { club: { select: { id: true, name: true, city: true, logoUrl: true } } },
  });
}

export async function listMyCoachJoinRequests(coachId: string) {
  return prisma.coachClubJoinRequest.findMany({
    where: { coachId },
    orderBy: { createdAt: "desc" },
    include: { club: { select: { id: true, name: true, shortName: true, city: true, logoUrl: true } } },
  });
}

export async function cancelCoachJoinRequest(coachId: string, requestId: string) {
  const req = await prisma.coachClubJoinRequest.findUnique({ where: { id: requestId } });
  if (!req || req.coachId !== coachId) {
    throw new CoachClubJoinRequestError("REQUEST_NOT_FOUND", "Өтінім табылмады", 404);
  }
  if (req.status !== "PENDING") {
    throw new CoachClubJoinRequestError("REQUEST_LOCKED", "Бұл өтінімді қайтаруға болмайды", 400);
  }
  await prisma.coachClubJoinRequest.delete({ where: { id: requestId } });
  return { ok: true };
}

export async function listPendingCoachRequests(ownerId: string) {
  const owner = await assertClubOwner(ownerId);
  return prisma.coachClubJoinRequest.findMany({
    where: { clubId: owner.clubId!, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { coach: { select: coachSelect } },
  });
}

export async function reviewCoachJoinRequest(ownerId: string, requestId: string, approve: boolean) {
  const owner = await assertClubOwner(ownerId);
  const req = await prisma.coachClubJoinRequest.findUnique({
    where: { id: requestId },
    include: { coach: true },
  });
  if (!req) throw new CoachClubJoinRequestError("REQUEST_NOT_FOUND", "Өтінім табылмады", 404);
  if (req.clubId !== owner.clubId) throw new CoachClubJoinRequestError("FORBIDDEN", "Рұқсат жоқ", 403);
  if (req.status !== "PENDING") throw new CoachClubJoinRequestError("REQUEST_ALREADY_REVIEWED", "Өтінім қаралған", 409);

  if (!approve) {
    await prisma.coachClubJoinRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
    return { ok: true };
  }

  await prisma.$transaction(async (tx) => {
    const coach = await tx.user.findUnique({ where: { id: req.coachId }, select: { clubId: true, role: true } });
    if (!coach || coach.role !== UserRole.COACH) {
      throw new CoachClubJoinRequestError("COACH_NOT_FOUND", "Тренер табылмады", 404);
    }
    if (coach.clubId) {
      throw new CoachClubJoinRequestError("COACH_ALREADY_IN_CLUB", "Тренер басқа клубта", 409);
    }
    await tx.user.update({
      where: { id: req.coachId },
      data: { clubId: req.clubId, clubRole: ClubRole.COACH },
    });
    await tx.coachClubJoinRequest.update({ where: { id: requestId }, data: { status: "APPROVED" } });
    await tx.coachClubJoinRequest.updateMany({
      where: { coachId: req.coachId, status: "PENDING", id: { not: requestId } },
      data: { status: "REJECTED" },
    });
  });

  return { ok: true };
}

export async function removeCoachFromClub(ownerId: string, clubId: string, coachId: string) {
  const owner = await assertClubOwner(ownerId, clubId);
  if (owner.id === coachId) {
    throw new CoachClubJoinRequestError("OWNER_CANNOT_REMOVE_SELF", "Алдымен клуб иесін ауыстырыңыз", 400);
  }

  const coach = await prisma.user.findUnique({ where: { id: coachId } });
  if (!coach || coach.role !== UserRole.COACH || coach.clubId !== clubId) {
    throw new CoachClubJoinRequestError("COACH_NOT_FOUND", "Тренер клубта табылмады", 404);
  }
  if (coach.clubRole === ClubRole.OWNER) {
    throw new CoachClubJoinRequestError("CANNOT_REMOVE_OWNER", "Клуб иесін шығаруға болмайды", 400);
  }

  await prisma.user.update({ where: { id: coachId }, data: { clubId: null, clubRole: null } });
  return { ok: true };
}

export async function transferClubOwnership(ownerId: string, clubId: string, coachId: string) {
  const owner = await assertClubOwner(ownerId, clubId);
  if (owner.id === coachId) return { ok: true };

  const nextOwner = await prisma.user.findUnique({ where: { id: coachId } });
  if (!nextOwner || nextOwner.role !== UserRole.COACH || nextOwner.clubId !== clubId) {
    throw new CoachClubJoinRequestError("COACH_NOT_FOUND", "Жаңа иесі осы клубтың тренері болуы керек", 404);
  }

  await prisma.$transaction([
    ...(owner.role === UserRole.COACH
      ? [prisma.user.update({ where: { id: owner.id }, data: { clubRole: ClubRole.COACH } })]
      : []),
    prisma.user.update({ where: { id: coachId }, data: { clubRole: ClubRole.OWNER } }),
    prisma.club.update({ where: { id: clubId }, data: { createdById: coachId } }),
  ]);
  return { ok: true };
}

async function assertClubOwner(userId: string, clubId?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new CoachClubJoinRequestError("USER_NOT_FOUND", "Пайдаланушы табылмады", 404);
  if (user.role === UserRole.ADMIN) {
    if (!clubId) throw new CoachClubJoinRequestError("CLUB_REQUIRED", "Клуб қажет", 400);
    return { ...user, clubId };
  }
  if (user.role !== UserRole.COACH || !user.clubId || user.clubRole !== ClubRole.OWNER) {
    throw new CoachClubJoinRequestError("FORBIDDEN", "Бұл әрекетті тек клуб иесі орындай алады", 403);
  }
  if (clubId && user.clubId !== clubId) {
    throw new CoachClubJoinRequestError("FORBIDDEN", "Бұл басқа клуб", 403);
  }
  return user;
}
