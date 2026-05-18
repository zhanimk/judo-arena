/**
 * Сервис управления турнирами и категориями.
 *
 * Lifecycle турнира:
 *   DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → IN_PROGRESS → COMPLETED
 *           ↘──────────────────────── CANCELLED ────────────────────────↙
 */

import { prisma } from "../lib/prisma.js";
import type {
  CreateTournamentInput,
  UpdateTournamentInput,
  ListTournamentsQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validators/tournament.schema.js";
import { TournamentStatus, UserRole } from "@prisma/client";

export class TournamentError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = "TournamentError";
  }
}

// Разрешённые переходы статусов
const ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.CANCELLED],
  REGISTRATION_OPEN: [TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.CANCELLED],
  REGISTRATION_CLOSED: [TournamentStatus.IN_PROGRESS, TournamentStatus.REGISTRATION_OPEN, TournamentStatus.CANCELLED],
  IN_PROGRESS: [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [TournamentStatus.DRAFT],
};

// ============================================================
// ТУРНИРЫ — CRUD
// ============================================================

export async function listTournaments(q: ListTournamentsQuery) {
  const where: any = {};
  if (q.status) where.status = q.status;
  if (q.city) where.city = { contains: q.city, mode: "insensitive" };
  if (q.upcoming) where.startDate = { gte: new Date() };
  if (q.search) {
    where.OR = [
      { city: { contains: q.search, mode: "insensitive" } },
      { location: { contains: q.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      skip: q.offset,
      take: q.limit,
      orderBy: { startDate: "asc" },
      include: {
        _count: { select: { categories: true, applications: true } },
      },
    }),
    prisma.tournament.count({ where }),
  ]);

  return { items, total, limit: q.limit, offset: q.offset };
}

export async function getTournament(id: string) {
  const t = await prisma.tournament.findUnique({
    where: { id },
    include: {
      categories: { orderBy: [{ gender: "asc" }, { weightMin: "asc" }] },
      createdBy: { select: { id: true, name: true, surname: true } },
      _count: { select: { applications: true } },
    },
  });
  if (!t) throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  return t;
}

export async function createTournament(creatorUserId: string, input: CreateTournamentInput) {
  return prisma.tournament.create({
    data: {
      name: input.name,
      description: input.description ?? undefined,
      location: input.location,
      city: input.city,
      startDate: input.startDate,
      endDate: input.endDate,
      tatamiCount: input.tatamiCount,
      primaryLocale: input.primaryLocale,
      posterUrl: input.posterUrl,
      status: TournamentStatus.DRAFT,
      createdById: creatorUserId,
    },
  });
}

export async function updateTournament(tournamentId: string, input: UpdateTournamentInput) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);

  // Когда турнир активен — нельзя менять даты
  if (t.status === TournamentStatus.IN_PROGRESS || t.status === TournamentStatus.COMPLETED) {
    if (input.startDate || input.endDate) {
      throw new TournamentError(
        "LOCKED_FIELDS",
        "Даты нельзя менять у активного или завершённого турнира",
        409,
      );
    }
  }

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new TournamentError("INVALID_RANGE", "endDate должна быть ≥ startDate", 400);
  }

  return prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description && { description: input.description }),
      ...(input.location && { location: input.location }),
      ...(input.city && { city: input.city }),
      ...(input.startDate && { startDate: input.startDate }),
      ...(input.endDate && { endDate: input.endDate }),
      ...(input.tatamiCount !== undefined && { tatamiCount: input.tatamiCount }),
      ...(input.primaryLocale && { primaryLocale: input.primaryLocale }),
      ...(input.posterUrl !== undefined && { posterUrl: input.posterUrl }),
    },
  });
}

export async function changeStatus(tournamentId: string, newStatus: TournamentStatus) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);

  const allowed = ALLOWED_TRANSITIONS[t.status];
  if (!allowed.includes(newStatus)) {
    throw new TournamentError(
      "INVALID_TRANSITION",
      `Нельзя перейти из ${t.status} в ${newStatus}. Разрешено: ${allowed.join(", ") || "никуда"}`,
      409,
    );
  }

  // Бизнес-правила: чтобы открыть регистрацию — нужны категории
  if (newStatus === TournamentStatus.REGISTRATION_OPEN) {
    const categoriesCount = await prisma.category.count({ where: { tournamentId } });
    if (categoriesCount === 0) {
      throw new TournamentError(
        "NO_CATEGORIES",
        "Нельзя открыть регистрацию без хотя бы одной категории",
        409,
      );
    }
  }

  return prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: newStatus },
  });
}

export async function deleteTournament(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (t.status !== TournamentStatus.DRAFT && t.status !== TournamentStatus.CANCELLED) {
    throw new TournamentError(
      "CANNOT_DELETE",
      "Удалить можно только турнир в статусе DRAFT или CANCELLED",
      409,
    );
  }
  await prisma.tournament.delete({ where: { id: tournamentId } });
}

// ============================================================
// КАТЕГОРИИ
// ============================================================

export async function listCategories(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  return prisma.category.findMany({
    where: { tournamentId },
    orderBy: [{ gender: "asc" }, { weightMin: "asc" }],
  });
}

export async function createCategory(tournamentId: string, input: CreateCategoryInput) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (t.status !== TournamentStatus.DRAFT) {
    throw new TournamentError(
      "LOCKED",
      "Категории можно создавать только пока турнир в DRAFT",
      409,
    );
  }

  return prisma.category.create({
    data: {
      tournamentId,
      name: input.name ?? undefined,
      gender: input.gender,
      ageMin: input.ageMin,
      ageMax: input.ageMax,
      weightMin: input.weightMin,
      weightMax: input.weightMax,
      matchDurationSec: input.matchDurationSec,
      goldenScoreSec: input.goldenScoreSec,
      format: input.format,
      allowYuko: input.allowYuko,
    },
  });
}

export async function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { tournament: true },
  });
  if (!cat) throw new TournamentError("CATEGORY_NOT_FOUND", "Категория не найдена", 404);
  if (cat.tournament.status !== TournamentStatus.DRAFT) {
    throw new TournamentError("LOCKED", "Категории можно менять только в статусе DRAFT турнира", 409);
  }
  return prisma.category.update({ where: { id: categoryId }, data: input });
}

export async function deleteCategory(categoryId: string) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { tournament: true },
  });
  if (!cat) throw new TournamentError("CATEGORY_NOT_FOUND", "Категория не найдена", 404);
  if (cat.tournament.status !== TournamentStatus.DRAFT) {
    throw new TournamentError("LOCKED", "Удалять категории можно только в DRAFT", 409);
  }
  await prisma.category.delete({ where: { id: categoryId } });
}

// ============================================================
// УТИЛИТЫ
// ============================================================

export async function assertAdmin(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== UserRole.ADMIN) {
    throw new TournamentError("FORBIDDEN", "Операция только для администратора", 403);
  }
}
