/**
 * Сервис управления турнирами и категориями.
 *
 * Lifecycle турнира:
 *   DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → IN_PROGRESS → COMPLETED
 *           ↘──────────────────────── CANCELLED ────────────────────────↙
 */

import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import type {
  CreateTournamentInput,
  UpdateTournamentInput,
  ListTournamentsQuery,
  CreateCategoryInput,
  CreateCategoriesBulkInput,
  UpdateCategoryInput,
} from "../validators/tournament.schema.js";
import { Prisma, TournamentStatus, UserRole } from "@prisma/client";
import { broadcast } from "./notification.service.js";

// ---- Redis cache helpers ----
const TOURNAMENT_LIST_TTL = 30; // 30 seconds — short TTL so list stays fresh

function buildListCacheKey(q: ListTournamentsQuery): string {
  return `tournament:list:${JSON.stringify(q)}`;
}

export async function invalidateTournamentListCache(): Promise<void> {
  try {
    const keys = await redis.keys("tournament:list:*");
    if (keys.length > 0) await redis.del(...(keys as [string, ...string[]]));
  } catch {
    // non-critical — cache miss is acceptable
  }
}

export class TournamentError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "TournamentError";
  }
}

// Разрешённые переходы статусов
const ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.CANCELLED],
  REGISTRATION_OPEN: [
    TournamentStatus.REGISTRATION_CLOSED,
    TournamentStatus.CANCELLED,
  ],
  REGISTRATION_CLOSED: [
    TournamentStatus.IN_PROGRESS,
    TournamentStatus.REGISTRATION_OPEN,
    TournamentStatus.CANCELLED,
  ],
  IN_PROGRESS: [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [TournamentStatus.DRAFT],
};

// ============================================================
// ТУРНИРЫ — CRUD
// ============================================================

export async function listTournaments(q: ListTournamentsQuery) {
  // Skip cache for admin queries (includeArchived) — they need fresh data always
  const cacheable = !q.includeArchived;
  const cacheKey = cacheable ? buildListCacheKey(q) : null;

  if (cacheKey) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached)
        return JSON.parse(cached) as ReturnType<typeof _fetchTournaments>;
    } catch {
      // ignore redis errors — fall through to DB
    }
  }

  const result = await _fetchTournaments(q);

  if (cacheKey) {
    try {
      await redis.set(
        cacheKey,
        JSON.stringify(result),
        "EX",
        TOURNAMENT_LIST_TTL,
      );
    } catch {
      // ignore
    }
  }

  return result;
}

async function _fetchTournaments(q: ListTournamentsQuery) {
  const where: Prisma.TournamentWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.city) where.city = { contains: q.city, mode: "insensitive" };
  if (q.upcoming) where.startDate = { gte: new Date() };
  if (q.search) {
    where.OR = [
      { city: { contains: q.search, mode: "insensitive" } },
      { location: { contains: q.search, mode: "insensitive" } },
    ];
  }
  // Hide archived tournaments unless explicitly requested (admin only)
  if (!q.includeArchived) where.isArchived = false;

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
      categories: {
        orderBy: [{ gender: "asc" }, { ageMin: "asc" }, { weightMin: "asc" }],
      },
      createdBy: { select: { id: true, name: true, surname: true } },
      _count: { select: { applications: true } },
    },
  });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  return t;
}

export async function createTournament(
  creatorUserId: string,
  input: CreateTournamentInput,
) {
  const result = await prisma.tournament.create({
    data: {
      name: input.name,
      description: input.description ?? undefined,
      location: input.location,
      city: input.city,
      startDate: input.startDate,
      endDate: input.endDate,
      applicationDeadline: input.applicationDeadline,
      mapUrl: input.mapUrl,
      weighInLocation: input.weighInLocation,
      weighInStart: input.weighInStart,
      weighInEnd: input.weighInEnd,
      tatamiCount: input.tatamiCount,
      primaryLocale: input.primaryLocale,
      posterUrl: input.posterUrl,
      regulationUrl: input.regulationUrl,
      regulationFileName: input.regulationFileName,
      entryFeeKzt: input.entryFeeKzt,
      kaspiPaymentUrl: input.kaspiPaymentUrl,
      status: TournamentStatus.DRAFT,
      createdById: creatorUserId,
    },
  });
  void invalidateTournamentListCache();
  return result;
}

export async function updateTournament(
  tournamentId: string,
  input: UpdateTournamentInput,
) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);

  // Когда турнир активен — нельзя менять даты
  if (
    t.status === TournamentStatus.IN_PROGRESS ||
    t.status === TournamentStatus.COMPLETED
  ) {
    if (input.startDate || input.endDate) {
      throw new TournamentError(
        "LOCKED_FIELDS",
        "Даты нельзя менять у активного или завершённого турнира",
        409,
      );
    }
  }

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new TournamentError(
      "INVALID_RANGE",
      "endDate должна быть ≥ startDate",
      400,
    );
  }
  const nextStartDate = input.startDate ?? t.startDate;
  const nextDeadline =
    input.applicationDeadline === null
      ? null
      : (input.applicationDeadline ?? t.applicationDeadline);
  if (nextDeadline && nextDeadline > nextStartDate) {
    throw new TournamentError(
      "INVALID_APPLICATION_DEADLINE",
      "Дедлайн заявок должен быть не позже даты начала турнира",
      400,
    );
  }
  const nextWeighInStart =
    input.weighInStart === null ? null : (input.weighInStart ?? t.weighInStart);
  const nextWeighInEnd =
    input.weighInEnd === null ? null : (input.weighInEnd ?? t.weighInEnd);
  if (nextWeighInStart && nextWeighInEnd && nextWeighInEnd < nextWeighInStart) {
    throw new TournamentError(
      "INVALID_WEIGH_IN_RANGE",
      "Окончание взвешивания должно быть не раньше начала",
      400,
    );
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
      ...(input.applicationDeadline !== undefined && {
        applicationDeadline: input.applicationDeadline,
      }),
      ...(input.mapUrl !== undefined && { mapUrl: input.mapUrl }),
      ...(input.weighInLocation !== undefined && {
        weighInLocation: input.weighInLocation,
      }),
      ...(input.weighInStart !== undefined && {
        weighInStart: input.weighInStart,
      }),
      ...(input.weighInEnd !== undefined && { weighInEnd: input.weighInEnd }),
      ...(input.tatamiCount !== undefined && {
        tatamiCount: input.tatamiCount,
      }),
      ...(input.primaryLocale && { primaryLocale: input.primaryLocale }),
      ...(input.posterUrl !== undefined && { posterUrl: input.posterUrl }),
      ...(input.regulationUrl !== undefined && {
        regulationUrl: input.regulationUrl,
      }),
      ...(input.regulationFileName !== undefined && {
        regulationFileName: input.regulationFileName,
      }),
      ...(input.entryFeeKzt !== undefined && {
        entryFeeKzt: input.entryFeeKzt,
      }),
      ...(input.kaspiPaymentUrl !== undefined && {
        kaspiPaymentUrl: input.kaspiPaymentUrl,
      }),
      ...(input.youtubeUrls !== undefined && {
        youtubeUrls: input.youtubeUrls ?? Prisma.JsonNull,
      }),
    },
  });
}

export async function changeStatus(
  tournamentId: string,
  newStatus: TournamentStatus,
  actorUserId?: string,
) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);

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
    const categoriesCount = await prisma.category.count({
      where: { tournamentId },
    });
    if (categoriesCount === 0) {
      throw new TournamentError(
        "NO_CATEGORIES",
        "Нельзя открыть регистрацию без хотя бы одной категории",
        409,
      );
    }
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: newStatus },
  });

  // При отмене турнира — уведомляем всех участников + отзываем активные tatami-сессии
  if (newStatus === TournamentStatus.CANCELLED && actorUserId) {
    // Уведомление в фоне — не блокируем ответ
    notifyCancelled(tournamentId, actorUserId, t.name).catch((err) =>
      process.stderr.write(
        `[tournament] Ошибка рассылки отмены: ${err.message}\n`,
      ),
    );

    // Отзываем tatami-сессии в фоне
    prisma.tatamiSession
      .updateMany({
        where: { tournamentId, isRevoked: false },
        data: { isRevoked: true },
      })
      .catch(() => {});
  }

  void invalidateTournamentListCache();
  return updated;
}

/** Рассылает уведомления об отмене всем участникам с APPROVED заявками. */
async function notifyCancelled(
  tournamentId: string,
  actorUserId: string,
  tournamentName: unknown,
): Promise<void> {
  // Находим одного ADMIN для broadcast (broadcast требует actorUserId с ролью ADMIN)
  const admin = await prisma.user.findFirst({
    where: { id: actorUserId, role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!admin) return;

  // Извлекаем короткое название турнира для уведомления
  let nameStr = "";
  if (tournamentName && typeof tournamentName === "object") {
    const n = tournamentName as Record<string, string>;
    nameStr = n.kk ?? n.ru ?? n.en ?? "";
  } else if (typeof tournamentName === "string") {
    nameStr = tournamentName;
  }

  await broadcast(admin.id, {
    type: "tournament_cancelled",
    titleKey: "notification.tournament_cancelled_title",
    bodyKey: "notification.tournament_cancelled_body",
    payload: { tournamentId, tournamentName: nameStr },
    target: { kind: "tournament", tournamentId },
  });
}

export async function deleteTournament(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (
    t.status !== TournamentStatus.DRAFT &&
    t.status !== TournamentStatus.CANCELLED
  ) {
    throw new TournamentError(
      "CANNOT_DELETE",
      "Удалить можно только турнир в статусе DRAFT или CANCELLED",
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    const categories = await tx.category.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    const applications = await tx.application.findMany({
      where: { tournamentId },
      select: { id: true },
    });
    const categoryIds = categories.map((c) => c.id);
    const applicationIds = applications.map((a) => a.id);

    await tx.ratingEntry.deleteMany({ where: { tournamentId } });
    if (applicationIds.length > 0 || categoryIds.length > 0) {
      await tx.applicationEntry.deleteMany({
        where: {
          OR: [
            ...(applicationIds.length > 0
              ? [{ applicationId: { in: applicationIds } }]
              : []),
            ...(categoryIds.length > 0
              ? [{ categoryId: { in: categoryIds } }]
              : []),
          ],
        },
      });
    }
    await tx.application.deleteMany({ where: { tournamentId } });

    // TatamiSession — нет каскада, нужно удалить явно
    await tx.tatamiSession.deleteMany({ where: { tournamentId } });

    // MatchEvent және JudgeSession Bracket -> Match cascade арқылы өшеді.
    await tx.bracket.deleteMany({ where: { tournamentId } });
    await tx.category.deleteMany({ where: { tournamentId } });
    await tx.tournament.delete({ where: { id: tournamentId } });
  });
}

// ============================================================
// КАТЕГОРИИ
// ============================================================

export async function listCategories(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  return prisma.category.findMany({
    where: { tournamentId },
    orderBy: [{ gender: "asc" }, { ageMin: "asc" }, { weightMin: "asc" }],
  });
}

export async function createCategory(
  tournamentId: string,
  input: CreateCategoryInput,
) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
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
      // IJF: U15 и младше → 3 мин; все остальные → 4 мин
      matchDurationSec:
        input.matchDurationSec ?? ijfMatchDuration(input.ageMax),
      goldenScoreSec: input.goldenScoreSec ?? 0, // 0 = без лимита (стандарт IJF)
      format: input.format,
      // Юко: только для категорий где ageMax <= 12 (некоторые региональные федерации)
      allowYuko: input.allowYuko ?? false,
    },
  });
}

export async function createCategoriesBulk(
  tournamentId: string,
  input: CreateCategoriesBulkInput,
) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (t.status !== TournamentStatus.DRAFT) {
    throw new TournamentError(
      "LOCKED",
      "Категории можно создавать только пока турнир в DRAFT",
      409,
    );
  }

  const existing = await prisma.category.findMany({
    where: { tournamentId },
    select: {
      gender: true,
      ageMin: true,
      ageMax: true,
      weightMin: true,
      weightMax: true,
    },
  });
  const categoryKey = (category: {
    gender: string;
    ageMin: number;
    ageMax: number;
    weightMin: number;
    weightMax: number;
  }) =>
    [
      category.gender,
      category.ageMin,
      category.ageMax,
      category.weightMin,
      category.weightMax,
    ].join(":");
  const knownKeys = new Set(existing.map(categoryKey));
  const categoriesToCreate = input.categories.filter((category) => {
    const key = categoryKey(category);
    if (knownKeys.has(key)) return false;
    knownKeys.add(key);
    return true;
  });

  if (categoriesToCreate.length > 0) {
    await prisma.category.createMany({
      data: categoriesToCreate.map((category) => ({
        tournamentId,
        name: category.name ?? undefined,
        gender: category.gender,
        ageMin: category.ageMin,
        ageMax: category.ageMax,
        weightMin: category.weightMin,
        weightMax: category.weightMax,
        matchDurationSec: category.matchDurationSec,
        goldenScoreSec: category.goldenScoreSec,
        format: category.format,
        allowYuko: category.allowYuko,
      })),
    });
  }

  const categories = await prisma.category.findMany({
    where: { tournamentId },
    orderBy: [{ gender: "asc" }, { ageMin: "asc" }, { weightMin: "asc" }],
  });

  return {
    added: categoriesToCreate.length,
    skipped: input.categories.length - categoriesToCreate.length,
    categories,
  };
}

export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { tournament: true },
  });
  if (!cat)
    throw new TournamentError(
      "CATEGORY_NOT_FOUND",
      "Категория не найдена",
      404,
    );
  if (cat.tournament.status !== TournamentStatus.DRAFT) {
    throw new TournamentError(
      "LOCKED",
      "Категории можно менять только в статусе DRAFT турнира",
      409,
    );
  }
  return prisma.category.update({ where: { id: categoryId }, data: input });
}

export async function deleteCategory(categoryId: string) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { tournament: true },
  });
  if (!cat)
    throw new TournamentError(
      "CATEGORY_NOT_FOUND",
      "Категория не найдена",
      404,
    );
  if (cat.tournament.status !== TournamentStatus.DRAFT) {
    throw new TournamentError(
      "LOCKED",
      "Удалять категории можно только в DRAFT",
      409,
    );
  }
  await prisma.category.delete({ where: { id: categoryId } });
}

// ============================================================
// УТИЛИТЫ
// ============================================================

export async function assertAdmin(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== UserRole.ADMIN) {
    throw new TournamentError(
      "FORBIDDEN",
      "Операция только для администратора",
      403,
    );
  }
}

/**
 * Длительность матча по правилам IJF в зависимости от возраста.
 *   ≤ 12 лет  → 2 минуты (120 с)  — юные
 *   ≤ 14 лет  → 3 минуты (180 с)  — Youth / U15
 *   ≥ 15 лет  → 4 минуты (240 с)  — Cadet, Junior, Senior
 */
export function ijfMatchDuration(ageMax: number): number {
  if (ageMax <= 12) return 120;
  if (ageMax <= 14) return 180;
  return 240;
}

// ============================================================
// СТАНДАРТНЫЕ КАТЕГОРИИ IJF
// ============================================================

interface IjfCategoryTemplate {
  gender: "MALE" | "FEMALE";
  ageMin: number;
  ageMax: number;
  weightMin: number;
  weightMax: number; // 999 = открытая весовая категория (+)
  matchDurationSec: number;
  allowYuko: boolean;
}

/**
 * Официальные весовые категории IJF по возрастным группам.
 * Источник: IJF Sport and Organization Rules 2023.
 */
export const IJF_CATEGORIES: Record<string, IjfCategoryTemplate[]> = {
  /** Взрослые (Senior) и юниоры U21 — одинаковые весовые категории */
  SENIOR_MEN: [
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 0,
      weightMax: 60,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 60,
      weightMax: 66,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 66,
      weightMax: 73,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 73,
      weightMax: 81,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 81,
      weightMax: 90,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 90,
      weightMax: 100,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 100,
      weightMax: 999,
      matchDurationSec: 240,
      allowYuko: false,
    },
  ],
  SENIOR_WOMEN: [
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 0,
      weightMax: 48,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 48,
      weightMax: 52,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 52,
      weightMax: 57,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 57,
      weightMax: 63,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 63,
      weightMax: 70,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 70,
      weightMax: 78,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 15,
      ageMax: 99,
      weightMin: 78,
      weightMax: 999,
      matchDurationSec: 240,
      allowYuko: false,
    },
  ],
  /** Кадеты U18 */
  CADET_MEN: [
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 0,
      weightMax: 55,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 55,
      weightMax: 60,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 60,
      weightMax: 66,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 66,
      weightMax: 73,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 73,
      weightMax: 81,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 81,
      weightMax: 90,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "MALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 90,
      weightMax: 999,
      matchDurationSec: 240,
      allowYuko: false,
    },
  ],
  CADET_WOMEN: [
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 0,
      weightMax: 40,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 40,
      weightMax: 44,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 44,
      weightMax: 48,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 48,
      weightMax: 52,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 52,
      weightMax: 57,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 57,
      weightMax: 63,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 63,
      weightMax: 70,
      matchDurationSec: 240,
      allowYuko: false,
    },
    {
      gender: "FEMALE",
      ageMin: 13,
      ageMax: 17,
      weightMin: 70,
      weightMax: 999,
      matchDurationSec: 240,
      allowYuko: false,
    },
  ],
  /** Youth U15 — 3 минуты, Юко разрешено по решению оргкомитета */
  YOUTH_BOYS: [
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 0,
      weightMax: 34,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 34,
      weightMax: 38,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 38,
      weightMax: 42,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 42,
      weightMax: 46,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 46,
      weightMax: 50,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 50,
      weightMax: 55,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 55,
      weightMax: 60,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 60,
      weightMax: 66,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "MALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 66,
      weightMax: 999,
      matchDurationSec: 180,
      allowYuko: true,
    },
  ],
  YOUTH_GIRLS: [
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 0,
      weightMax: 32,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 32,
      weightMax: 36,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 36,
      weightMax: 40,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 40,
      weightMax: 44,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 44,
      weightMax: 48,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 48,
      weightMax: 52,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 52,
      weightMax: 57,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 57,
      weightMax: 63,
      matchDurationSec: 180,
      allowYuko: true,
    },
    {
      gender: "FEMALE",
      ageMin: 11,
      ageMax: 14,
      weightMin: 63,
      weightMax: 999,
      matchDurationSec: 180,
      allowYuko: true,
    },
  ],
};

/**
 * Создать стандартный набор весовых категорий IJF для турнира одним вызовом.
 * @param group — ключ из IJF_CATEGORIES ("SENIOR_MEN", "SENIOR_WOMEN", "CADET_MEN", ...)
 */
export async function createIjfCategories(
  tournamentId: string,
  group: keyof typeof IJF_CATEGORIES,
): Promise<{ count: number }> {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t)
    throw new TournamentError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (t.status !== TournamentStatus.DRAFT) {
    throw new TournamentError(
      "LOCKED",
      "Категории можно создавать только пока турнир в DRAFT",
      409,
    );
  }

  const templates = IJF_CATEGORIES[group];
  await prisma.category.createMany({
    data: templates.map((tpl) => ({
      tournamentId,
      gender: tpl.gender as any,
      ageMin: tpl.ageMin,
      ageMax: tpl.ageMax,
      weightMin: tpl.weightMin,
      // 999 → в БД храним как есть; UI показывает как "+" (открытая категория)
      weightMax: tpl.weightMax,
      matchDurationSec: tpl.matchDurationSec,
      goldenScoreSec: 0,
      allowYuko: tpl.allowYuko,
      format: "SE_IJF" as any,
    })),
    skipDuplicates: false,
  });

  return { count: templates.length };
}
