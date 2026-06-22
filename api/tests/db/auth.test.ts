/**
 * Real-DB integration tests for the auth service.
 *
 * Requires a live PostgreSQL + Redis — provided by:
 *   - CI: services declared in ci.yml
 *   - Local: docker compose up postgres redis
 *
 * Run:  npm run test:db -w @judo-arena/api
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import {
  db,
  cleanup,
  makeAdmin,
  makeClub,
  requireDb,
  closeConnections,
} from "../helpers/db.js";

// ── External side-effects that don't belong in unit tests ─────────────────
// Email sending is out of scope — we verify DB state, not SMTP.
vi.mock("../../src/services/email-verification.service.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/services/notification.service.js", () => ({
  broadcast: vi.fn().mockResolvedValue(undefined),
}));

import {
  register,
  login,
  refresh,
  logout,
} from "../../src/services/auth.service.js";
import { verifyRefreshToken } from "../../src/lib/jwt.js";
// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  await requireDb();
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await closeConnections();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function uniqueEmail() {
  return `test-${Math.random().toString(36).slice(2)}@judo-arena.test`;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("register", () => {
  it("creates a user row in the database", async () => {
    const email = uniqueEmail();
    await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Данияр",
      surname: "Сейткали",
      dateOfBirth: new Date("2000-06-15"),
      gender: "MALE",
      preferredLocale: "ru",
    });

    const row = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    expect(row).not.toBeNull();
    expect(row!.role).toBe("ATHLETE");
    expect(row!.emailVerified).toBe(false);
    // password is never stored in plaintext
    expect(row!.passwordHash).not.toBe("Password123!");

    if (row) await db.user.delete({ where: { id: row.id } }).catch(() => {});
  });

  it("normalises email to lowercase", async () => {
    const email = uniqueEmail().replace("test-", "TEST-");
    const { user } = await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Тест",
      surname: "Юзер",
      dateOfBirth: new Date("2002-01-01"),
      gender: "FEMALE",
      preferredLocale: "ru",
    });

    expect(user.email).toBe(email.toLowerCase());

    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it("rejects duplicate email", async () => {
    const email = uniqueEmail();
    await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Первый",
      surname: "Юзер",
      dateOfBirth: new Date("2000-01-01"),
      gender: "MALE",
      preferredLocale: "ru",
    });

    await expect(
      register({
        email,
        password: "OtherPass123!",
        role: "ATHLETE",
        name: "Второй",
        surname: "Юзер",
        dateOfBirth: new Date("2000-01-01"),
        gender: "MALE",
        preferredLocale: "ru",
      }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });

    await db.user.deleteMany({ where: { email: email.toLowerCase() } });
  });

  it("rejects invalid clubId", async () => {
    await expect(
      register({
        email: uniqueEmail(),
        password: "Password123!",
        role: "ATHLETE",
        name: "Тест",
        surname: "Юзер",
        dateOfBirth: new Date("2000-01-01"),
        gender: "MALE",
        preferredLocale: "ru",
        clubId: "nonexistent-club-id",
      }),
    ).rejects.toMatchObject({ code: "CLUB_NOT_FOUND" });
  });

  it("links athlete to existing club", async () => {
    const admin = await makeAdmin();
    const club = await makeClub(admin.id);

    const email = uniqueEmail();
    const { user } = await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Спортсмен",
      surname: "Клубный",
      dateOfBirth: new Date("2001-03-10"),
      gender: "MALE",
      preferredLocale: "ru",
      clubId: club.id,
    });

    expect(user.clubId).toBe(club.id);
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});

describe("login", () => {
  it("returns tokens for correct credentials", async () => {
    const email = uniqueEmail();
    await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Войти",
      surname: "Тест",
      dateOfBirth: new Date("1999-05-20"),
      gender: "MALE",
      preferredLocale: "ru",
    });

    const result = await login({ email, password: "Password123!" });

    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(result.totpRequired).toBe(false);

    await db.user.deleteMany({ where: { email: email.toLowerCase() } });
  });

  it("throws INVALID_CREDENTIALS for wrong password", async () => {
    const email = uniqueEmail();
    await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Войти",
      surname: "Тест",
      dateOfBirth: new Date("1999-05-20"),
      gender: "MALE",
      preferredLocale: "ru",
    });

    await expect(
      login({ email, password: "WrongPassword!" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    await db.user.deleteMany({ where: { email: email.toLowerCase() } });
  });

  it("throws INVALID_CREDENTIALS for unknown email", async () => {
    await expect(
      login({ email: "nobody@judo-arena.test", password: "any" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("throws USER_INACTIVE for deactivated account", async () => {
    const email = uniqueEmail();
    const { user } = await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Заблок",
      surname: "Юзер",
      dateOfBirth: new Date("1998-01-01"),
      gender: "MALE",
      preferredLocale: "ru",
    });

    await db.user.update({ where: { id: user.id }, data: { isActive: false } });

    await expect(
      login({ email, password: "Password123!" }),
    ).rejects.toMatchObject({ code: "USER_INACTIVE" });

    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});

describe("refresh token rotation", () => {
  it("issues new tokens and invalidates old refresh token", async () => {
    const email = uniqueEmail();
    await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Рефреш",
      surname: "Тест",
      dateOfBirth: new Date("2000-01-01"),
      gender: "MALE",
      preferredLocale: "ru",
    });
    const { tokens } = await login({ email, password: "Password123!" });
    const newTokens = await refresh(tokens.refreshToken);

    expect(newTokens.accessToken).toBeTruthy();
    expect(newTokens.refreshToken).not.toBe(tokens.refreshToken);

    // Old refresh token must be invalid now (rotation)
    await expect(refresh(tokens.refreshToken)).rejects.toThrow();

    await db.user.deleteMany({ where: { email: email.toLowerCase() } });
  });
});

describe("logout", () => {
  it("revokes refresh token so it cannot be reused", async () => {
    const email = uniqueEmail();
    const { user } = await register({
      email,
      password: "Password123!",
      role: "ATHLETE",
      name: "Выход",
      surname: "Тест",
      dateOfBirth: new Date("2000-01-01"),
      gender: "MALE",
      preferredLocale: "ru",
    });
    const { tokens } = await login({ email, password: "Password123!" });
    const payload = verifyRefreshToken(tokens.refreshToken);
    await logout(user.id, payload.jti);

    await expect(refresh(tokens.refreshToken)).rejects.toThrow();

    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});
