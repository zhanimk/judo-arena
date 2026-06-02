/**
 * System tests — full HTTP request/response cycle via Fastify inject.
 *
 * These tests build a lightweight Fastify instance (no Socket.IO, silent logger)
 * and test actual HTTP semantics: status codes, response shape, auth enforcement.
 *
 * Run: cd api && npm test
 * Requires: test DB not needed for most tests (mocked or 401/404 paths).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

// ── Mock heavy dependencies so the routes can be imported ────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: vi.fn(),
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

vi.mock("../../src/lib/env.js", () => ({
  env: {
    NODE_ENV: "test",
    JWT_ACCESS_SECRET: "test-access-secret-at-least-32-chars-long",
    JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-chars-long",
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    BCRYPT_ROUNDS: 1,
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW: "1 minute",
    CORS_ORIGIN: "http://localhost:5173",
    API_PORT: 4000,
    API_HOST: "0.0.0.0",
    DATABASE_URL: "postgresql://test",
    REDIS_URL: "redis://test",
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    SMTP_USER: "",
    SMTP_PASS: "",
    EMAIL_FROM: "test@test.com",
    UPLOADS_DIR: "./uploads",
  },
}));

// ── Build a minimal test app ──────────────────────────────────────────────────

import { authRoutes } from "../../src/routes/auth.routes.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { secret: "test-cookie-secret" });

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    service: "judo-arena-api",
    timestamp: new Date().toISOString(),
    db: "connected",
  }));

  // Root
  app.get("/", async () => ({ service: "Judo-Arena API", version: "0.1.0" }));

  // Auth routes
  await app.register(authRoutes, { prefix: "/api/auth" });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─── Health ───────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with service info", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; service: string }>();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("judo-arena-api");
  });
});

describe("GET /", () => {
  it("returns API metadata", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ service: string }>();
    expect(body.service).toBe("Judo-Arena API");
  });
});

// ─── Auth — protected endpoints ───────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns 401 without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with a malformed token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { Authorization: "Bearer not.a.valid.jwt" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Auth — registration validation ───────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("returns 400 for missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "x@x.com" }, // missing password, role, name, surname
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for ADMIN role registration attempt", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "admin@example.com",
        password: "password123",
        role: "ADMIN",
        name: "A",
        surname: "B",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Auth — login validation ──────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("returns 400 for missing body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for non-existent user (prisma returns null)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ghost@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe("CORS headers", () => {
  it("sends Access-Control-Allow-Credentials on /health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

// ─── 404 handling ─────────────────────────────────────────────────────────────

describe("Unknown routes", () => {
  it("returns 404 for undefined paths", async () => {
    const res = await app.inject({ method: "GET", url: "/api/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });
});

// ─── Judge token security ──────────────────────────────────────────────────────
// Tests the getValidSession service logic directly (expired / revoked / invalid).
// These guard the X-Judge-Token path without requiring the full matchRoutes stack.

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: vi.fn(),
    judgeSession: { findUnique: vi.fn() },
  },
}));

describe("Judge token security — getValidSession()", () => {
  it("throws INVALID_TOKEN (401) for unknown token", async () => {
    const { prisma: mockPrisma } = await import("../../src/lib/prisma.js");
    vi.mocked((mockPrisma as any).judgeSession.findUnique).mockResolvedValue(
      null,
    );

    const { getValidSession, JudgeSessionError } =
      await import("../../src/services/judge-session.service.js");
    await expect(getValidSession("no-such-token")).rejects.toMatchObject({
      code: "INVALID_TOKEN",
      httpStatus: 401,
    });
  });

  it("throws REVOKED (403) for a revoked session", async () => {
    const { prisma: mockPrisma } = await import("../../src/lib/prisma.js");
    vi.mocked((mockPrisma as any).judgeSession.findUnique).mockResolvedValue({
      id: "sess-1",
      token: "tok-revoked",
      matchId: "m-1",
      isRevoked: true,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const { getValidSession, JudgeSessionError } =
      await import("../../src/services/judge-session.service.js");
    await expect(getValidSession("tok-revoked")).rejects.toMatchObject({
      code: "REVOKED",
      httpStatus: 403,
    });
  });

  it("throws EXPIRED (403) for an expired session", async () => {
    const { prisma: mockPrisma } = await import("../../src/lib/prisma.js");
    vi.mocked((mockPrisma as any).judgeSession.findUnique).mockResolvedValue({
      id: "sess-2",
      token: "tok-expired",
      matchId: "m-1",
      isRevoked: false,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    });

    const { getValidSession } =
      await import("../../src/services/judge-session.service.js");
    await expect(getValidSession("tok-expired")).rejects.toMatchObject({
      code: "EXPIRED",
      httpStatus: 403,
    });
  });

  it("returns the session for a valid non-expired token", async () => {
    const session = {
      id: "sess-3",
      token: "tok-valid",
      matchId: "m-1",
      isRevoked: false,
      expiresAt: new Date(Date.now() + 3600_000),
      // include match.tournament for auto-invalidate check
      match: {
        tournament: {
          id: "t-1",
          name: "Test Tournament",
          status: "IN_PROGRESS",
          endDate: new Date(Date.now() + 86400_000),
        },
      },
    };
    const { prisma: mockPrisma } = await import("../../src/lib/prisma.js");
    vi.mocked((mockPrisma as any).judgeSession.findUnique).mockResolvedValue(
      session,
    );

    const { getValidSession } =
      await import("../../src/services/judge-session.service.js");
    const result = await getValidSession("tok-valid");
    expect(result.id).toBe("sess-3");
    expect(result.matchId).toBe("m-1");
  });
});
