/**
 * Real-DB integration tests for the tournament service.
 *
 * Verifies state-machine transitions and business-rule guards against
 * a live PostgreSQL instance — catches bugs that mocked Prisma can't.
 *
 * Run:  npm run test:db -w @judo-arena/api
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { TournamentStatus } from "@prisma/client";
import { db, cleanup, makeAdmin, makeTournament, makeCategory, requireDb } from "../helpers/db.js";

vi.mock("../../src/services/notification.service.js", () => ({
  broadcast: vi.fn().mockResolvedValue(undefined),
}));

import {
  createTournament,
  getTournament,
  changeStatus,
  updateTournament,
  createCategory,
  deleteCategory,
  TournamentError,
} from "../../src/services/tournament.service.js";

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  await requireDb();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await db.$disconnect();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function tournamentInput(overrides = {}) {
  const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return {
    name: { ru: "Тест", kk: "Тест", en: "Test" },
    location: "Стадион",
    city: "Алматы",
    country: "KZ",
    startDate: start,
    endDate: new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000),
    registrationDeadline: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000),
    bracketFormat: "SE_IJF" as const,
    ...overrides,
  };
}

// ── createTournament ──────────────────────────────────────────────────────

describe("createTournament", () => {
  it("persists tournament with DRAFT status", async () => {
    const admin = await makeAdmin();
    const t = await createTournament(tournamentInput(), admin.id);

    const row = await db.tournament.findUnique({ where: { id: t.id } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe(TournamentStatus.DRAFT);
    expect(row!.createdById).toBe(admin.id);

    await db.tournament.delete({ where: { id: t.id } }).catch(() => {});
  });

  it("rejects endDate before startDate", async () => {
    const admin = await makeAdmin();
    const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await expect(
      createTournament(
        tournamentInput({
          startDate: start,
          endDate: new Date(start.getTime() - 1),
        }),
        admin.id,
      ),
    ).rejects.toThrow();
  });
});

// ── Status transitions ────────────────────────────────────────────────────

describe("changeStatus — valid transitions", () => {
  it("DRAFT → REGISTRATION_OPEN requires at least one category", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);

    // Without categories — must fail
    await expect(
      changeStatus(t.id, TournamentStatus.REGISTRATION_OPEN, admin.id),
    ).rejects.toMatchObject({ code: "NO_CATEGORIES" });

    // Add category, then it succeeds
    await makeCategory(t.id);
    const updated = await changeStatus(t.id, TournamentStatus.REGISTRATION_OPEN, admin.id);
    expect(updated.status).toBe(TournamentStatus.REGISTRATION_OPEN);

    await db.tournament.update({ where: { id: t.id }, data: { status: TournamentStatus.DRAFT } });
  });

  it("DRAFT → CANCELLED is allowed", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);

    const updated = await changeStatus(t.id, TournamentStatus.CANCELLED, admin.id);
    expect(updated.status).toBe(TournamentStatus.CANCELLED);
  });

  it("REGISTRATION_OPEN → REGISTRATION_CLOSED", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id, { status: TournamentStatus.REGISTRATION_OPEN });
    await makeCategory(t.id);

    const updated = await changeStatus(t.id, TournamentStatus.REGISTRATION_CLOSED, admin.id);
    expect(updated.status).toBe(TournamentStatus.REGISTRATION_CLOSED);
  });

  it("REGISTRATION_CLOSED → IN_PROGRESS", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id, { status: TournamentStatus.REGISTRATION_CLOSED });

    const updated = await changeStatus(t.id, TournamentStatus.IN_PROGRESS, admin.id);
    expect(updated.status).toBe(TournamentStatus.IN_PROGRESS);
  });

  it("IN_PROGRESS → COMPLETED", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id, { status: TournamentStatus.IN_PROGRESS });

    const updated = await changeStatus(t.id, TournamentStatus.COMPLETED, admin.id);
    expect(updated.status).toBe(TournamentStatus.COMPLETED);
  });

  it("COMPLETED → no further transitions", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id, { status: TournamentStatus.COMPLETED });

    await expect(
      changeStatus(t.id, TournamentStatus.CANCELLED, admin.id),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("changeStatus — invalid transitions", () => {
  it("DRAFT → IN_PROGRESS is blocked", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);

    await expect(
      changeStatus(t.id, TournamentStatus.IN_PROGRESS, admin.id),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("throws TOURNAMENT_NOT_FOUND for unknown id", async () => {
    const admin = await makeAdmin();
    await expect(
      changeStatus("nonexistent-id", TournamentStatus.CANCELLED, admin.id),
    ).rejects.toMatchObject({ code: "TOURNAMENT_NOT_FOUND" });
  });
});

// ── Categories ────────────────────────────────────────────────────────────

describe("category management", () => {
  it("creates category and persists to DB", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);

    const cat = await createCategory({
      tournamentId: t.id,
      name: { ru: "до 66кг", kk: "до 66кг", en: "u66kg" },
      gender: "MALE",
      ageMin: 18,
      ageMax: 35,
      weightMin: 60,
      weightMax: 66,
    });

    const row = await db.category.findUnique({ where: { id: cat.id } });
    expect(row).not.toBeNull();
    expect(row!.tournamentId).toBe(t.id);

    await db.category.delete({ where: { id: cat.id } }).catch(() => {});
  });

  it("deleteCategory removes the row", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);
    const cat = await makeCategory(t.id);

    await deleteCategory(cat.id);

    const row = await db.category.findUnique({ where: { id: cat.id } });
    expect(row).toBeNull();
  });

  it("blocks REGISTRATION_OPEN when all categories are deleted", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);
    const cat = await makeCategory(t.id);

    await deleteCategory(cat.id);

    await expect(
      changeStatus(t.id, TournamentStatus.REGISTRATION_OPEN, admin.id),
    ).rejects.toMatchObject({ code: "NO_CATEGORIES" });
  });
});

// ── updateTournament ──────────────────────────────────────────────────────

describe("updateTournament", () => {
  it("persists field updates to DB", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id);

    await updateTournament(t.id, { city: "Астана" }, admin.id);

    const row = await db.tournament.findUnique({ where: { id: t.id } });
    expect(row!.city).toBe("Астана");
  });

  it("throws TOURNAMENT_NOT_FOUND for unknown id", async () => {
    const admin = await makeAdmin();
    await expect(
      updateTournament("nonexistent", { city: "X" }, admin.id),
    ).rejects.toMatchObject({ code: "TOURNAMENT_NOT_FOUND" });
  });
});
