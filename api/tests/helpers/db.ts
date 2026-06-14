/**
 * Real-DB test helpers.
 *
 * Usage:
 *   import { db, cleanup, makeAdmin, makeAthlete, makeClub, makeTournament } from "../helpers/db.js";
 *
 * Every factory inserts a record and registers it for cleanup.
 * Call cleanup() in afterEach / afterAll — it deletes all created rows in
 * reverse dependency order so FK constraints don't fire.
 */

import {
  PrismaClient,
  UserRole,
  TournamentStatus,
  type User,
  type Club,
  type Tournament,
} from "@prisma/client";
import bcrypt from "bcryptjs";

export const db = new PrismaClient();

/**
 * Call at the top of beforeAll in DB test suites.
 * Skips the entire suite gracefully when the database is unreachable
 * (e.g. docker not running locally) instead of failing with a cryptic P1001.
 */
export async function requireDb(): Promise<void> {
  try {
    await db.$connect();
    await db.$queryRaw`SELECT 1`;
  } catch {
    console.warn(
      "\n[test:db] Database unreachable — skipping DB integration suite.\nRun: docker compose up postgres redis\n",
    );
    // Re-throw so vitest marks the suite as skipped, not failed
    throw new Error("DATABASE_UNAVAILABLE");
  }
}

// Track created IDs for cleanup (reverse order matters for FK)
const created = {
  matchEvent: [] as string[],
  match: [] as string[],
  bracket: [] as string[],
  applicationEntry: [] as string[],
  application: [] as string[],
  category: [] as string[],
  tournament: [] as string[],
  user: [] as string[],
  club: [] as string[],
};

export async function cleanup(): Promise<void> {
  await db.matchEvent.deleteMany({ where: { id: { in: created.matchEvent } } });
  await db.match.deleteMany({ where: { id: { in: created.match } } });
  await db.bracket.deleteMany({ where: { id: { in: created.bracket } } });
  await db.applicationEntry.deleteMany({
    where: { id: { in: created.applicationEntry } },
  });
  await db.application.deleteMany({
    where: { id: { in: created.application } },
  });
  await db.category.deleteMany({ where: { id: { in: created.category } } });
  await db.tournament.deleteMany({ where: { id: { in: created.tournament } } });
  // users before clubs — members reference clubs
  await db.user.deleteMany({ where: { id: { in: created.user } } });
  await db.club.deleteMany({ where: { id: { in: created.club } } });

  // reset for next test
  for (const key of Object.keys(created) as (keyof typeof created)[]) {
    created[key] = [];
  }
}

// ─── User factories ────────────────────────────────────────────────────────

const DEFAULT_PASSWORD = "Test1234!";

async function createUser(
  overrides: Partial<{
    email: string;
    role: UserRole;
    name: string;
    surname: string;
    dateOfBirth: Date;
    clubId: string | null;
    isActive: boolean;
  }> = {},
): Promise<User & { plainPassword: string }> {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 4); // low rounds — tests only
  const suffix = Math.random().toString(36).slice(2, 8);
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `test-${suffix}@judo-arena.test`,
      passwordHash: hash,
      role: overrides.role ?? UserRole.ATHLETE,
      name: overrides.name ?? "Test",
      surname: overrides.surname ?? "User",
      dateOfBirth: overrides.dateOfBirth ?? new Date("2000-01-01"),
      clubId: overrides.clubId ?? null,
      isActive: overrides.isActive ?? true,
      emailVerified: true,
    },
  });
  created.user.push(user.id);
  return { ...user, plainPassword: DEFAULT_PASSWORD };
}

export async function makeAdmin(overrides = {}) {
  return createUser({ role: UserRole.ADMIN, ...overrides });
}

export async function makeCoach(
  overrides: Parameters<typeof createUser>[0] = {},
) {
  return createUser({ role: UserRole.COACH, ...overrides });
}

export async function makeAthlete(
  overrides: Parameters<typeof createUser>[0] = {},
) {
  return createUser({ role: UserRole.ATHLETE, ...overrides });
}

// ─── Club factory ──────────────────────────────────────────────────────────

export async function makeClub(
  createdById: string,
  overrides: Partial<{ name: object; city: string }> = {},
): Promise<Club> {
  const suffix = Math.random().toString(36).slice(2, 6);
  const club = await db.club.create({
    data: {
      name: overrides.name ?? {
        ru: `Клуб ${suffix}`,
        kk: `Клуб ${suffix}`,
        en: `Club ${suffix}`,
      },
      city: overrides.city ?? "Алматы",
      createdById,
    },
  });
  created.club.push(club.id);
  return club;
}

// ─── Tournament factory ────────────────────────────────────────────────────

export async function makeTournament(
  createdById: string,
  overrides: Partial<{
    status: TournamentStatus;
    startDate: Date;
    endDate: Date;
  }> = {},
): Promise<Tournament> {
  const suffix = Math.random().toString(36).slice(2, 6);
  const start =
    overrides.startDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const end =
    overrides.endDate ?? new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const tournament = await db.tournament.create({
    data: {
      name: {
        ru: `Турнир ${suffix}`,
        kk: `Турнир ${suffix}`,
        en: `Tournament ${suffix}`,
      },
      location: "Спорткомплекс «Балуан Шолак»",
      city: "Алматы",
      startDate: start,
      endDate: end,
      applicationDeadline: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000),
      status: overrides.status ?? TournamentStatus.DRAFT,
      createdById,
    },
  });
  created.tournament.push(tournament.id);
  return tournament;
}

// ─── Category factory ─────────────────────────────────────────────────────

export async function makeCategory(
  tournamentId: string,
  overrides: Partial<{ gender: "MALE" | "FEMALE"; weightMax: number }> = {},
) {
  const suffix = Math.random().toString(36).slice(2, 6);
  const category = await db.category.create({
    data: {
      tournamentId,
      name: {
        ru: `до 66кг ${suffix}`,
        kk: `до 66кг ${suffix}`,
        en: `u66kg ${suffix}`,
      },
      gender: overrides.gender ?? "MALE",
      ageMin: 18,
      ageMax: 35,
      weightMin: 60,
      weightMax: overrides.weightMax ?? 66,
    },
  });
  created.category.push(category.id);
  return category;
}

// Track arbitrary IDs for cleanup (when factories aren't used directly)
export function trackId(table: keyof typeof created, id: string) {
  created[table].push(id);
}
