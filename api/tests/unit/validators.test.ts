import { describe, it, expect } from "vitest";
import {
  createTournamentSchema,
  createCategorySchema,
  createCategoriesBulkSchema,
  listTournamentsQuerySchema,
  updateCategorySchema,
  updateTournamentSchema,
} from "../../src/validators/tournament.schema.js";
import {
  registerSchema,
  loginSchema,
  updateMeProfileSchema,
  upsertUserDocumentSchema,
} from "../../src/validators/auth.schema.js";

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
    const result = createTournamentSchema.safeParse({
      ...base,
      mapUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weighInEnd before weighInStart", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      weighInStart: "2026-09-01T10:00:00Z",
      weighInEnd: "2026-09-01T08:00:00Z",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("weighInEnd");
  });

  it("accepts weighInEnd equal to weighInStart", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      weighInStart: "2026-09-01T10:00:00Z",
      weighInEnd: "2026-09-01T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("enforces tatamiCount between 1 and 20", () => {
    expect(
      createTournamentSchema.safeParse({ ...base, tatamiCount: 0 }).success,
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...base, tatamiCount: 21 }).success,
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...base, tatamiCount: 10 }).success,
    ).toBe(true);
  });

  it("accepts uploaded poster and gallery URLs", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      posterUrl: "/uploads/images/poster.webp",
      galleryUrls: [
        "/uploads/images/tatami.webp",
        "https://cdn.example.com/medals.webp",
      ],
    });

    expect(result.success).toBe(true);
  });

  it("limits the public gallery to six images", () => {
    const result = createTournamentSchema.safeParse({
      ...base,
      galleryUrls: Array.from(
        { length: 7 },
        (_, index) => `https://cdn.example.com/photo-${index}.webp`,
      ),
    });

    expect(result.success).toBe(false);
  });
});

describe("updateTournamentSchema", () => {
  it("accepts empty YouTube slots while preserving tatami positions", () => {
    const result = updateTournamentSchema.safeParse({
      youtubeUrls: ["https://youtu.be/NJEpE4IlusY", "", ""],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-empty invalid YouTube URL", () => {
    const result = updateTournamentSchema.safeParse({
      youtubeUrls: ["not-a-url", ""],
    });

    expect(result.success).toBe(false);
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

  it("accepts zero as the lower bound for the lightest weight category", () => {
    expect(
      createCategorySchema.safeParse({
        ...base,
        weightMin: 0,
        weightMax: 46,
      }).success,
    ).toBe(true);
  });

  it("accepts 999 as the upper bound for an open weight category", () => {
    expect(
      createCategorySchema.safeParse({
        ...base,
        weightMin: 90,
        weightMax: 999,
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported weight bounds above 300", () => {
    expect(
      createCategorySchema.safeParse({
        ...base,
        weightMin: 90,
        weightMax: 301,
      }).success,
    ).toBe(false);
  });

  it("rejects ageMin > ageMax", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      ageMin: 40,
      ageMax: 20,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("ageMin");
  });

  it("rejects weightMin >= weightMax", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      weightMin: 66,
      weightMax: 66,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("weightMin");
  });

  it("defaults format to SE_IJF", () => {
    const result = createCategorySchema.safeParse(base);
    expect(result.success && result.data.format).toBe("SE_IJF");
  });

  it("accepts ROUND_ROBIN format", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      format: "ROUND_ROBIN",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown format", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      format: "KNOCKOUT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects matchDurationSec below minimum (60s)", () => {
    const result = createCategorySchema.safeParse({
      ...base,
      matchDurationSec: 30,
    });
    expect(result.success).toBe(false);
  });
});

describe("createCategoriesBulkSchema", () => {
  it("accepts the complete U17 template with open male and female categories", () => {
    const categories = (
      [
        ["MALE", [46, 50, 55, 60, 66, 73, 81, 90, 999]],
        ["FEMALE", [40, 44, 48, 52, 57, 63, 70, 999]],
      ] as const
    ).flatMap(([gender, weights]) =>
      weights.map((weightMax, index) => ({
        gender,
        ageMin: 15,
        ageMax: 17,
        weightMin: index === 0 ? 0 : weights[index - 1],
        weightMax,
        matchDurationSec: 180,
        goldenScoreSec: 90,
        format: "SE_IJF",
      })),
    );

    const result = createCategoriesBulkSchema.safeParse({ categories });
    expect(result.success).toBe(true);
    expect(result.success && result.data.categories).toHaveLength(17);
  });

  it("rejects an empty template", () => {
    expect(
      createCategoriesBulkSchema.safeParse({ categories: [] }).success,
    ).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("rejects ageMin greater than ageMax", () => {
    const result = updateCategorySchema.safeParse({
      ageMin: 18,
      ageMax: 15,
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("ageMin");
  });

  it("rejects weightMin greater than or equal to weightMax", () => {
    const result = updateCategorySchema.safeParse({
      weightMin: 66,
      weightMax: 66,
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("weightMin");
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
    const result = listTournamentsQuerySchema.safeParse({
      limit: "10",
      offset: "5",
    });
    expect(result.success && result.data.limit).toBe(10);
    expect(result.success && result.data.offset).toBe(5);
  });

  it("rejects limit above 1000", () => {
    expect(listTournamentsQuerySchema.safeParse({ limit: 1001 }).success).toBe(
      false,
    );
  });

  it("accepts valid status filter", () => {
    const result = listTournamentsQuerySchema.safeParse({
      status: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(
      listTournamentsQuerySchema.safeParse({ status: "LIVE" }).success,
    ).toBe(false);
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
    expect(registerSchema.safeParse({ ...base, role: "COACH" }).success).toBe(
      true,
    );
  });

  it("defaults preferredLocale to kk", () => {
    const result = registerSchema.safeParse(base);
    expect(result.success && result.data.preferredLocale).toBe("kk");
  });

  it("rejects date of birth outside the allowed age range", () => {
    const result = registerSchema.safeParse({
      ...base,
      dateOfBirth: new Date(),
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("Возраст");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects missing email", () => {
    expect(loginSchema.safeParse({ password: "x" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(
      false,
    );
  });

  it("rejects empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

// ─── imageUrlSchema (via updateMeProfileSchema.avatarUrl) ────────────────────

describe("imageUrlSchema", () => {
  const base = { avatarUrl: "" };

  it("accepts /uploads/ prefix", () => {
    expect(
      updateMeProfileSchema.safeParse({ avatarUrl: "/uploads/img.jpg" })
        .success,
    ).toBe(true);
  });

  it("accepts a valid https URL", () => {
    expect(
      updateMeProfileSchema.safeParse({
        avatarUrl: "https://cdn.example.com/img.jpg",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid string that is neither /uploads/ nor a valid URL", () => {
    const result = updateMeProfileSchema.safeParse({ avatarUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts null (nullable field)", () => {
    expect(updateMeProfileSchema.safeParse({ avatarUrl: null }).success).toBe(
      true,
    );
  });
});

// ─── uploadUrlSchema (via upsertUserDocumentSchema.url) ──────────────────────

describe("uploadUrlSchema", () => {
  const base = { type: "BIRTH_CERTIFICATE" as const };

  it("accepts private:documents/ prefix", () => {
    expect(
      upsertUserDocumentSchema.safeParse({
        ...base,
        url: "private:documents/file.pdf",
      }).success,
    ).toBe(true);
  });

  it("accepts /uploads/ prefix", () => {
    expect(
      upsertUserDocumentSchema.safeParse({ ...base, url: "/uploads/file.pdf" })
        .success,
    ).toBe(true);
  });

  it("accepts a valid https URL", () => {
    expect(
      upsertUserDocumentSchema.safeParse({
        ...base,
        url: "https://s3.example.com/doc.pdf",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid string", () => {
    const result = upsertUserDocumentSchema.safeParse({
      ...base,
      url: "bad-url",
    });
    expect(result.success).toBe(false);
  });
});
