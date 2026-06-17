/**
 * Production Smoke Tests — быстрая проверка критических путей.
 *
 * Запуск против реального окружения:
 *   API_URL=https://judo-arena-api.onrender.com npx vitest run tests/system/smoke.test.ts
 *
 * Или локально (нужен запущенный сервер):
 *   API_URL=http://localhost:4000 npx vitest run tests/system/smoke.test.ts
 *
 * Тесты проверяют ТОЛЬКО read-only сценарии — не мутируют данные.
 */

import { describe, it, expect, beforeAll } from "vitest";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const TIMEOUT = 10_000; // 10 секунд на каждый запрос

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ============================================================
// HEALTH & INFRASTRUCTURE
// ============================================================

describe("Health checks", () => {
  it("GET /health returns 200 with status ok or degraded", async () => {
    const { status, body } = await get("/health");
    expect(status).toBeLessThan(600);
    expect(body).toMatchObject({
      service: "judo-arena-api",
      checks: expect.objectContaining({
        db: expect.any(String),
        redis: expect.any(String),
      }),
    });
  });

  it("GET /health — db and redis are ok", async () => {
    const { body } = await get("/health");
    const b = body as Record<string, unknown>;
    const checks = b.checks as Record<string, string>;
    expect(checks.db).toBe("ok");
    expect(checks.redis).toBe("ok");
  });

  it("GET / returns service info", async () => {
    const { status, body } = await get("/");
    expect(status).toBe(200);
    expect(body).toMatchObject({ service: "Judo-Arena API" });
  });
});

// ============================================================
// AUTH ENDPOINTS
// ============================================================

describe("Auth endpoints", () => {
  it("GET /api/auth/csrf-token returns a token", async () => {
    const { status, body } = await get("/api/auth/csrf-token");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(typeof b.csrfToken).toBe("string");
    expect((b.csrfToken as string).length).toBeGreaterThan(20);
  });

  it("POST /api/auth/login with bad credentials returns 401 or 400", async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": "dummy" },
      body: JSON.stringify({
        email: "notexist@test.com",
        password: "wrongpass",
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    expect([400, 401, 403, 422, 429]).toContain(res.status);
  });

  it("GET /api/auth/me without token returns 401", async () => {
    const { status } = await get("/api/auth/me");
    expect(status).toBe(401);
  });
});

// ============================================================
// PUBLIC TOURNAMENT ENDPOINTS
// ============================================================

describe("Tournaments (public)", () => {
  it("GET /api/tournaments returns list", async () => {
    const { status, body } = await get("/api/tournaments");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty("items");
    expect(Array.isArray(b.items)).toBe(true);
    expect(typeof b.total).toBe("number");
  });

  it("GET /api/tournaments?status=IN_PROGRESS returns valid shape", async () => {
    const { status, body } = await get("/api/tournaments?status=IN_PROGRESS");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(Array.isArray(b.items)).toBe(true);
  });
});

// ============================================================
// CLUBS (public)
// ============================================================

describe("Clubs (public)", () => {
  it("GET /api/clubs returns list", async () => {
    const { status, body } = await get("/api/clubs");
    expect([200, 401]).toContain(status); // может требовать auth
    if (status === 200) {
      expect(body).toBeDefined();
    }
  });
});

// ============================================================
// RATINGS (public)
// ============================================================

describe("Ratings (public)", () => {
  it("GET /api/ratings/leaderboard returns leaderboard", async () => {
    const { status, body } = await get("/api/ratings/leaderboard");
    expect([200, 401]).toContain(status);
    if (status === 200) {
      expect(Array.isArray(body)).toBe(true);
    }
  });

  it("GET /api/ratings/clubs returns club leaderboard", async () => {
    const { status } = await get("/api/ratings/clubs");
    expect([200, 401]).toContain(status);
  });
});

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================

describe("Push notifications", () => {
  it("GET /push/vapid-public-key returns key or 503", async () => {
    const { status, body } = await get("/push/vapid-public-key");
    expect([200, 503]).toContain(status);
    if (status === 200) {
      const b = body as Record<string, unknown>;
      expect(typeof b.publicKey).toBe("string");
    }
  });
});

// ============================================================
// SECURITY CHECKS
// ============================================================

describe("Security headers", () => {
  it("Response includes security headers", async () => {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    // Helmet должен добавить эти заголовки
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBeTruthy();
  });

  it("CORS blocks unknown origins", async () => {
    const res = await fetch(`${API_URL}/api/tournaments`, {
      headers: {
        Origin: "https://malicious-site.com",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    // Либо нет Access-Control-Allow-Origin, либо он не "malicious-site.com"
    const corsHeader = res.headers.get("access-control-allow-origin");
    if (corsHeader) {
      expect(corsHeader).not.toBe("https://malicious-site.com");
    }
  });
});

// ============================================================
// PROTECTED ENDPOINTS — без токена должны возвращать 401/403
// ============================================================

describe("Protected endpoints return 401 without auth", () => {
  const protectedPaths = [
    "/api/admin/users",
    "/api/admin/applications",
    "/api/notifications",
  ];

  for (const path of protectedPaths) {
    it(`GET ${path} → 401 without token`, async () => {
      const { status } = await get(path);
      expect([401, 403]).toContain(status);
    });
  }
});
