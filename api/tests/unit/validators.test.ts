import { describe, it, expect } from "vitest";
import {
  createTournamentSchema,
  createCategorySchema,
  listTournamentsQuerySchema,
} from "../../src/validators/tournament.schema.js";
import { registerSchema, loginSchema } from "../../src/validators/auth.schema.js";

// ─── Tournament schema ─────────────────────────────────────────────────────────

describe("createTournamentSchema", () => {
  const base = {
    name: { kk: "Тест жарыс" },
    location: "Almaty Arena",
    city: "Almaty",
    startDate: "2026-09-01",
    endDate: "2026-09-02",
  };

  it("accepts a valid tournament", () => {
    const result = createTournamentSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("requires at least one locale for name", () => {
    const result = createTournamentSchema.safeParse({ ...base, name: {} });
    expect(result.success).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      startDate: "2026-09-05",
      endDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("endDate");
  });

  it("rejects applicationDeadline after startDate", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      applicationDeadline: "2026-09-10",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("applicationDeadline");
  });

  it("rejects invalid mapUrl", () => {
    const result = createTournamentSchema.safeParse({ ...base, mapUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("enforces tatamiCount between 1 and 20", () => {
    expect(createTournamentSchema.safeParse({ ...base, tatamiCount: 0 }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...base, tatamiCount: 21 }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...base, tatamiCount: 10 }).success).toBe(true);
  });
});

// ─── Category schema ───────────────────────────────────────────────────────────

describe("createCategorySchema", () => {
  const base = {
    gender: "MALE",
    ageMin: 18,
    ageMax: 30,
    weightMin: 60,
    weightMax: 66,
  };

  it("accepts a valid category", () => {
    expect(createCategorySchema.safeParse(base).success).toBe(true);
  });

  it("rejects ageMin > ageMax", () => {
    const result = createCategorySchema.safeParse({ ...base, ageMin: 40, ageMax: 20 });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("ageMin");
  });

  it("rejects weightMin >= weightMax", () => {
    const result = createCategorySchema.safeParse({ ...base, weightMin: 66, weightMax: 66 });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("weightMin");
  });

  it("defaults format to SE_IJF", () => {
    const result = createCategorySchema.safeParse(base);
    expect(result.success && result.data.format).toBe("SE_IJF");
  });

  it("accepts ROUND_ROBIN format", () => {
    const result = createCategorySchema.safeParse({ ...base, format: "ROUND_ROBIN" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown format", () => {
    const result = createCategorySchema.safeParse({ ...base, format: "KNOCKOUT" });
    expect(result.success).toBe(false);
  });

  it("rejects matchDurationSec below minimum (60s)", () => {
    const result = createCategorySchema.safeParse({ ...base, matchDurationSec: 30 });
    expect(result.success).toBe(false);
  });
});

// ─── listTournamentsQuerySchema ────────────────────────────────────────────────

describe("listTournamentsQuerySchema", () => {
  it("defaults limit to 50 and offset to 0", () => {
    const result = listTournamentsQuerySchema.safeParse({});
    expect(result.success && result.data.limit).toBe(50);
    expect(result.success && result.data.offset).toBe(0);
  });

  it("coerces string numbers", () => {
    const result = listTournamentsQuerySchema.safeParse({ limit: "10", offset: "5" });
    expect(result.success && result.data.limit).toBe(10);
    expect(result.success && result.data.offset).toBe(5);
  });

  it("rejects limit above 100", () => {
    expect(listTournamentsQuerySchema.safeParse({ limit: 200 }).success).toBe(false);
  });

  it("accepts valid status filter", () => {
    const result = listTournamentsQuerySchema.safeParse({ status: "IN_PROGRESS" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(listTournamentsQuerySchema.safeParse({ status: "LIVE" }).success).toBe(false);
  });
});

// ─── Auth schemas ──────────────────────────────────────────────────────────────

describe("registerSchema", () => {
  const base = {
    email: "athlete@example.com",
    password: "securePass123",
    role: "ATHLETE",
    name: "Иван",
    surname: "Петров",
  };

  it("accepts a valid registration payload", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...base, password: "short" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("8");
  });

  it("rejects ADMIN role registration", () => {
    const result = registerSchema.safeParse({ ...base, role: "ADMIN" });
    expect(result.success).toBe(false);
  });

  it("accepts COACH role", () => {
    expect(registerSchema.safeParse({ ...base, role: "COACH" }).success).toBe(true);
  });

  it("defaults preferredLocale to kk", () => {
    const result = registerSchema.safeParse(base);
    expect(result.success && result.data.preferredLocale).toBe("kk");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects missing email", () => {
    expect(loginSchema.safeParse({ password: "x" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false);
  });

  it("rejects empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
