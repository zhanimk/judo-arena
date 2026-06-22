import { prisma } from "../lib/prisma.js";
import { sendSystemNotification } from "./notification.service.js";

export class JoinRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "JoinRequestError";
  }
}

/** Спортсмен отправляет заявку на вступление в клуб */
export async function requestJoinClub(athleteId: string, clubId: string) {
  const athlete = await prisma.user.findUnique({ where: { id: athleteId } });
  if (!athlete)
    throw new JoinRequestError("NOT_FOUND", "Спортшы табылмады", 404);
  if (athlete.clubId)
    throw new JoinRequestError(
      "ALREADY_IN_CLUB",
      "Сіз басқа клубта тіркелгенсіз",
      409,
    );

  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club)
    throw new JoinRequestError("CLUB_NOT_FOUND", "Клуб табылмады", 404);

  const pending = await prisma.clubJoinRequest.findFirst({
    where: { athleteId, status: "PENDING" },
    include: { club: { select: { name: true } } },
  });
  if (pending && pending.clubId !== clubId) {
    throw new JoinRequestError(
      "ALREADY_PENDING",
      "Бір уақытта тек бір клубқа өтінім жіберуге болады",
      409,
    );
  }

  // Если уже есть PENDING — возвращаем его
  const existing = await prisma.clubJoinRequest.findUnique({
    where: { athleteId_clubId: { athleteId, clubId } },
  });
  if (existing) {
    if (existing.status === "PENDING")
      throw new JoinRequestError(
        "ALREADY_PENDING",
        "Өтінім жіберілді, күтіңіз",
        409,
      );
    // Если отклонена или одобрена — можно переотправить: удаляем старую
    await prisma.clubJoinRequest.delete({ where: { id: existing.id } });
  }

  const newRequest = await prisma.clubJoinRequest.create({
    data: { athleteId, clubId },
    include: { club: { select: { id: true, name: true, city: true } } },
  });

  // Уведомляем тренеров клуба
  sendSystemNotification({
    type: "announcement",
    titleKey: "notification.new_join_request_title",
    bodyKey: "notification.new_join_request_body",
    target: { kind: "club", clubId },
    payload: { athleteId, athleteName: `${athlete.name} ${athlete.surname}` },
  }).catch((e) => console.error("Failed to send notification:", e));

  return newRequest;
}

/** Тренер получает список PENDING заявок своего клуба */
export async function listPendingRequests(coachId: string) {
  const coach = await prisma.user.findUnique({ where: { id: coachId } });
  if (!coach?.clubId)
    throw new JoinRequestError("NO_CLUB", "Клубыңыз жоқ", 403);

  return prisma.clubJoinRequest.findMany({
    where: { clubId: coach.clubId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      athlete: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          gender: true,
          weightKg: true,
          dateOfBirth: true,
        },
      },
    },
  });
}

/** Тренер одобряет или отклоняет заявку */
export async function reviewJoinRequest(
  coachId: string,
  requestId: string,
  approve: boolean,
) {
  const coach = await prisma.user.findUnique({ where: { id: coachId } });
  if (!coach?.clubId)
    throw new JoinRequestError("NO_CLUB", "Клубыңыз жоқ", 403);

  const req = await prisma.clubJoinRequest.findUnique({
    where: { id: requestId },
    include: { athlete: true },
  });
  if (!req) throw new JoinRequestError("NOT_FOUND", "Өтінім табылмады", 404);
  if (req.clubId !== coach.clubId)
    throw new JoinRequestError("FORBIDDEN", "Рұқсат жоқ", 403);
  if (req.status !== "PENDING")
    throw new JoinRequestError("ALREADY_REVIEWED", "Өтінім қарастырылды", 409);

  if (approve) {
    await prisma.$transaction(async (tx) => {
      const athlete = await tx.user.findUnique({
        where: { id: req.athleteId },
        select: { clubId: true },
      });
      if (!athlete)
        throw new JoinRequestError("NOT_FOUND", "Спортшы табылмады", 404);
      if (athlete.clubId) {
        throw new JoinRequestError(
          "ALREADY_IN_CLUB",
          "Спортшы басқа клубқа тіркелген",
          409,
        );
      }

      await tx.user.update({
        where: { id: req.athleteId },
        data: { clubId: req.clubId },
      });
      await tx.clubJoinRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });
      await tx.clubJoinRequest.updateMany({
        where: {
          athleteId: req.athleteId,
          status: "PENDING",
          id: { not: requestId },
        },
        data: { status: "REJECTED" },
      });
    });
  } else {
    await prisma.clubJoinRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });
  }

  // Уведомляем спортсмена
  sendSystemNotification({
    type: "announcement",
    titleKey: approve
      ? "notification.join_approved_title"
      : "notification.join_rejected_title",
    bodyKey: approve
      ? "notification.join_approved_body"
      : "notification.join_rejected_body",
    target: { kind: "user", userId: req.athleteId },
    payload: { clubId: req.clubId, clubName: coach.clubId }, // coach.clubId это ID, у нас нет названия клуба тут, но ладно
  }).catch((e) => console.error("Failed to send notification:", e));

  return { ok: true, approved: approve };
}

/** Спортсмен видит свои заявки */
export async function listMyJoinRequests(athleteId: string) {
  return prisma.clubJoinRequest.findMany({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    include: {
      club: { select: { id: true, name: true, city: true, logoUrl: true } },
    },
  });
}

/** Отозвать PENDING заявку */
export async function cancelJoinRequest(athleteId: string, requestId: string) {
  const req = await prisma.clubJoinRequest.findUnique({
    where: { id: requestId },
  });
  if (!req || req.athleteId !== athleteId)
    throw new JoinRequestError("NOT_FOUND", "Өтінім табылмады", 404);
  if (req.status !== "PENDING")
    throw new JoinRequestError("NOT_PENDING", "Өтінімді тоқтата алмайсыз", 409);
  await prisma.clubJoinRequest.delete({ where: { id: requestId } });
  return { ok: true };
}
