/**
 * E2E Smoke Tests — Judo-Arena
 *
 * Покрывают: публичные страницы, аутентификацию (admin / coach / athlete),
 * базовую навигацию по дашбордам и ключевые UI-элементы.
 *
 * Требования: приложение запущено на BASE_URL (по умолчанию http://localhost:3000).
 * Тестовые аккаунты из seed:
 *   admin@judo-arena.kz   / password123
 *   coach.almaty@judo-arena.kz / password123
 *   rr.01@almaty-demo.demo.judo-arena.kz / password123
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ADMIN_EMAIL = "admin@judo-arena.kz";
const COACH_EMAIL = "coach.almaty@judo-arena.kz";
const ATHLETE_EMAIL = "rr.01@almaty-demo.demo.judo-arena.kz";
const PASSWORD = "password123";

// ============================================================
// Helpers
// ============================================================

async function login(page: Page, email: string, password = PASSWORD) {
  // Clear any existing session before each login to avoid cross-test contamination.
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.evaluate(() =>
    localStorage.setItem("judo-e2e-rate-limit-bypass", "1"),
  );
  // Wait for form to render.
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/құпиясөз|password/i).fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect away from /login.
  await expect(page).not.toHaveURL(`${BASE}/login`, { timeout: 12000 });
}

async function logout(page: Page) {
  // Attempt to navigate to home and clear cookies
  await page.goto(`${BASE}/`);
  await page.context().clearCookies();
}

// ============================================================
// PUBLIC PAGES
// ============================================================

test.describe("Public pages", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/Judo Child League|Judo-Arena/i);
    // Should show hero section
    await expect(page.locator("body")).toContainText(/judo|дзюдо/i);
  });

  test("tournaments list is accessible", async ({ page }) => {
    await page.goto(`${BASE}/tournaments`);
    await expect(page.locator("body")).toContainText(
      /жарыс|турнир|tournament/i,
    );
  });

  test("tournament page shows venue map and event presentation", async ({
    page,
  }) => {
    const response = await page.goto(
      `${BASE}/tournaments/demo-complete-flow-2026`,
    );
    await expect(
      page.getByRole("heading", { name: /демо турнир/i }),
    ).toBeVisible();
    const map = page.locator('iframe[src*="maps.google.com"]');
    await expect(map).toBeVisible();
    expect(response?.headers()["content-security-policy"]).toContain(
      "frame-src",
    );
  });

  test("rankings page loads", async ({ page }) => {
    await page.goto(`${BASE}/rankings`);
    await expect(page.locator("body")).toContainText(
      /рейтинг|рэйтинг|ranking/i,
    );
  });

  test("login page renders form", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder(/құпиясөз|password/i)).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("404 page shows not-found message", async ({ page }) => {
    await page.goto(`${BASE}/this-page-does-not-exist-xyz`);
    await expect(page.locator("body")).toContainText(
      /404|табылмады|не найден/i,
    );
  });
});

// ============================================================
// AUTH — Login / Logout
// ============================================================

test.describe("Authentication", () => {
  test("wrong password shows error", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/құпиясөз|password/i).fill("wrongpassword");
    await page.locator('button[type="submit"]').click();
    // Should stay on login or show error toast/message
    await expect(page.locator("body")).toContainText(
      /қате|ошибка|неверный|incorrect|invalid|error/i,
      { timeout: 6000 },
    );
  });

  test("admin can log in and see dashboard", async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin/, { timeout: 8000 });
    await expect(page.locator("body")).toContainText(/әкімші|admin/i);
  });

  test("coach can log in and see dashboard", async ({ page }) => {
    // Agree to rules so coach lands on /coach, not /coach/onboarding
    await page.goto(`${BASE}/login`);
    await page.evaluate(() =>
      localStorage.setItem("coach_rules_agreed", "true"),
    );
    await login(page, COACH_EMAIL);
    await expect(page).toHaveURL(/\/coach/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(
      /жаттықтырушы|тренер|coach/i,
    );
  });

  test("athlete can log in and see dashboard", async ({ page }) => {
    await login(page, ATHLETE_EMAIL);
    // Athlete may land on /athlete or /athlete/onboarding
    await expect(page).toHaveURL(/\/athlete/, { timeout: 10000 });
    // Just check we're past login — content loads async
    await expect(page.locator("body")).not.toContainText(/кіру|sign in/i);
  });
});

// ============================================================
// ADMIN DASHBOARD
// ============================================================

test.describe("Admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin/, { timeout: 12000 });
  });

  test("admin index shows stats", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    // Should have some numeric stats
    await expect(page.locator("body")).toContainText(/турнир|жарыс|клуб/i);
  });

  test("admin can navigate to tournaments", async ({ page }) => {
    await page.goto(`${BASE}/admin/tournaments`);
    await expect(page.locator("body")).toContainText(/жарыс|турнир/i);
  });

  test("admin can configure tournament map, media and regulation", async ({
    page,
  }) => {
    await page.goto(
      `${BASE}/admin/tournaments/demo-complete-flow-2026?tab=overview`,
    );
    await expect(page.getByText("Афиша және турнир галереясы")).toBeVisible();
    await expect(page.getByText("Турнир регламенті")).toBeVisible();
    await expect(page.getByText("© OpenStreetMap")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(3);
  });

  test("admin can navigate to clubs", async ({ page }) => {
    await page.goto(`${BASE}/admin/clubs`);
    await expect(page.locator("body")).toContainText(/клуб/i);
  });

  test("admin can navigate to users", async ({ page }) => {
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator("body")).toContainText(
      /пайдаланушы|пользователь|user/i,
    );
  });

  test("admin can navigate to audit log", async ({ page }) => {
    await page.goto(`${BASE}/admin/audit`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/аудит/i);
  });

  test("admin can navigate to ratings", async ({ page }) => {
    await page.goto(`${BASE}/admin/ratings`);
    await expect(page.locator("body")).toContainText(/рейтинг/i);
  });

  test("admin can navigate to notifications broadcast", async ({ page }) => {
    await page.goto(`${BASE}/admin/notifications`);
    await expect(page.locator("body")).toContainText(/хабарландыру/i);
  });

  test("admin can navigate to settings", async ({ page }) => {
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(
      /параметр|настройки|settings|жүйе/i,
    );
  });
});

// ============================================================
// COACH DASHBOARD
// ============================================================

test.describe("Coach dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() =>
      localStorage.setItem("coach_rules_agreed", "true"),
    );
    await login(page, COACH_EMAIL);
  });

  test("coach index renders", async ({ page }) => {
    await page.goto(`${BASE}/coach`);
    await expect(page.locator("body")).toContainText(
      /клуб|жаттықтырушы|coach/i,
    );
  });

  test("coach club page loads", async ({ page }) => {
    await page.goto(`${BASE}/coach/club`);
    await expect(page.locator("body")).toContainText(/клуб/i);
  });

  test("coach athletes page loads", async ({ page }) => {
    await page.goto(`${BASE}/coach/athletes`);
    await expect(page.locator("body")).toContainText(
      /спортшы|спортсмен|athlete/i,
    );
  });

  test("coach tournaments page loads", async ({ page }) => {
    await page.goto(`${BASE}/coach/tournaments`);
    await expect(page.locator("body")).toContainText(/жарыс|турнир/i);
  });

  test("coach applications page loads", async ({ page }) => {
    await page.goto(`${BASE}/coach/applications`);
    await expect(page.locator("body")).toContainText(
      /өтінім|заявка|application/i,
    );
  });

  test("coach notifications page shows filter chips", async ({ page }) => {
    await page.goto(`${BASE}/coach/notifications`);
    await expect(page.locator("body")).toContainText(/барлығы|all/i);
    // Filter buttons should be visible
    const filterChips = page
      .locator("button")
      .filter({ hasText: /барлығы|оқылмаған/i });
    await expect(filterChips.first()).toBeVisible();
  });
});

// ============================================================
// ATHLETE DASHBOARD
// ============================================================

test.describe("Athlete dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await login(page, ATHLETE_EMAIL);
    await expect(page).toHaveURL(/\/athlete/, { timeout: 12000 });
  });

  test("athlete page renders (onboarding or dashboard)", async ({ page }) => {
    await page.goto(`${BASE}/athlete`);
    // May redirect to onboarding — either way athlete content appears
    await expect(page.locator("body")).toContainText(
      /спортшы|спортсмен|профиль|онбординг|onboard/i,
    );
  });

  test("athlete notifications page shows filter chips", async ({ page }) => {
    await page.goto(`${BASE}/athlete/notifications`);
    // If redirected to onboarding that's also fine — just check we're on /athlete/*
    await expect(page).toHaveURL(/\/athlete/);
    const body = (await page.locator("body").textContent()) ?? "";
    if (body.match(/хабарландыру|notification/i)) {
      const filterChips = page
        .locator("button")
        .filter({ hasText: /барлығы|оқылмаған/i });
      await expect(filterChips.first()).toBeVisible();
    }
  });
});

// ============================================================
// ACCESS CONTROL
// ============================================================

test.describe("Route protection", () => {
  test("unauthenticated user is redirected from admin", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/admin`);
    // Should redirect to login or show auth error
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test("unauthenticated user is redirected from athlete dashboard", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/athlete`);
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test("coach cannot access admin routes", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/login`);
    await page.evaluate(() =>
      localStorage.setItem("coach_rules_agreed", "true"),
    );
    await login(page, COACH_EMAIL);
    await expect(page).toHaveURL(/\/coach/, { timeout: 12000 });
    await page.goto(`${BASE}/admin/users`);
    // Wait for client-side redirect away from /admin
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 8000 });
  });
});

// ============================================================
// API HEALTH CHECK
// ============================================================

test.describe("API health", () => {
  const API_BASE = process.env.API_URL ?? "http://localhost:4000";

  test("GET /health returns ok status", async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toMatch(/ok|degraded/);
    expect(body.service).toBe("judo-arena-api");
    expect(body.version).toBeTruthy();
    expect(body.checks?.db).toBe("ok");
  });

  test("GET /api/auth/me without token returns 401", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/login with wrong credentials returns 401 or 429", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: `nobody-${Date.now()}@example.com`, password: "wrong" },
    });
    // 401 = wrong credentials, 429 = rate limited (both acceptable)
    expect([401, 429]).toContain(res.status());
  });

  test("POST /api/auth/login rate limit header present", async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: "test@test.com", password: "test" },
    });
    // Rate limit headers should be present
    expect(
      res.headers()["x-ratelimit-limit"] || res.headers()["ratelimit-limit"],
    ).toBeTruthy();
  });
});
