/**
 * Integration tests for the Auth service layer.
 *
 * Prisma and Redis are mocked — no database connection required.
 * Tests verify the business logic: password hashing, token issuance,
 * duplicate-user rejection, invalid-credential handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies before importing the service ──────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../src/lib/redis.js", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

// bcrypt: hash synchronously returns a fixed value for speed
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashed"),
    compare: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { prisma } from "../../src/lib/prisma.js";
import bcrypt from "bcryptjs";
import { register, login, publicUser } from "../../src/services/auth.service.js";

// ─────────────────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-abc",
  email: "athlete@example.com",
  passwordHash: "$2b$12$hashed",
  role: "ATHLETE" as const,
  name: "Test",
  surname: "User",
  nameLatin: null,
  surnameLatin: null,
  isActive: true,
  clubId: null,
  club: null,
  dateOfBirth: null,
  gender: "MALE" as const,
  weightKg: null,
  beltRank: null,
  phone: null,
  avatarUrl: null,
  preferredLocale: "kk",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── register() ───────────────────────────────────────────────────────────────

describe("register()", () => {
  it("creates a new user and returns tokens", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // no existing user
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

    const result = await register({
      email: "athlete@example.com",
      password: "securePass123",
      role: "ATHLETE",
      name: "Test",
      surname: "User",
      preferredLocale: "kk",
    });

    expect(result.user.email).toBe("athlete@example.com");
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(prisma.user.create).toHaveBeenCalledOnce();
  });

  it("throws if email is already taken", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    await expect(
      register({
        email: "athlete@example.com",
        password: "securePass123",
        role: "ATHLETE",
        name: "Test",
        surname: "User",
        preferredLocale: "kk",
      })
    ).rejects.toThrow();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("hashes the password before saving", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

    await register({
      email: "new@example.com",
      password: "plainPassword",
      role: "ATHLETE",
      name: "A",
      surname: "B",
      preferredLocale: "kk",
    });

    expect(bcrypt.hash).toHaveBeenCalledWith("plainPassword", expect.any(Number));
    const createCall = vi.mocked(prisma.user.create).mock.calls[0]![0] as any;
    expect(createCall.data.passwordHash).toBe("$2b$12$hashed");
    expect(createCall.data).not.toHaveProperty("password");
  });
});

// ─── login() ──────────────────────────────────────────────────────────────────

describe("login()", () => {
  it("returns tokens for valid credentials", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await login({ email: "athlete@example.com", password: "correctPass" });
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.user.id).toBe("user-abc");
  });

  it("throws for unknown email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(
      login({ email: "nobody@example.com", password: "pass" })
    ).rejects.toThrow();
  });

  it("throws for wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      login({ email: "athlete@example.com", password: "wrongPass" })
    ).rejects.toThrow();
  });

  it("throws for inactive account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, isActive: false } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await expect(
      login({ email: "athlete@example.com", password: "correctPass" })
    ).rejects.toThrow();
  });
});

// ─── publicUser() ─────────────────────────────────────────────────────────────

describe("publicUser()", () => {
  it("strips passwordHash from the returned object", () => {
    const safe = publicUser(mockUser as any);
    expect(safe).not.toHaveProperty("passwordHash");
    expect(safe.email).toBe(mockUser.email);
    expect(safe.id).toBe(mockUser.id);
  });
});
