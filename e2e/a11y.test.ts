/**
 * Accessibility (a11y) tests using axe-core.
 *
 * Checks WCAG 2.1 AA violations on the key public and authenticated pages.
 * Runs against the same environment as smoke tests (BASE_URL).
 *
 * axe violations are reported with impact level — "critical" and "serious"
 * failures block the build; "moderate"/"minor" are logged as warnings.
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ADMIN_EMAIL = "admin@judo-arena.kz";
const PASSWORD = "password123";

// ── Helper ────────────────────────────────────────────────────────────────

async function analyzeA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    // Third-party widgets injected by browser extensions can cause false positives
    .exclude("#__vconsole")
    .analyze();

  // Log all violations for visibility even if test passes
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
      .join("\n");
    console.warn(`\na11y violations on ${page.url()}:\n${summary}`);
  }

  // Only block on critical and serious
  const blocking = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? ""),
  );

  expect(
    blocking,
    `Critical/serious a11y violations found:\n${blocking.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join("\n")}`,
  ).toHaveLength(0);
}

async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]');
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/құпиясөз|password/i).fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(`${BASE}/login`, { timeout: 12000 });
}

// ── Public pages ──────────────────────────────────────────────────────────

test.describe("a11y — public pages", () => {
  test("landing page", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await analyzeA11y(page);
  });

  test("login page", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('input[type="email"]');
    await analyzeA11y(page);
  });

  test("tournaments list", async ({ page }) => {
    await page.goto(`${BASE}/tournaments`);
    await page.waitForLoadState("networkidle");
    await analyzeA11y(page);
  });

  test("rankings page", async ({ page }) => {
    await page.goto(`${BASE}/rankings`);
    await page.waitForLoadState("networkidle");
    await analyzeA11y(page);
  });
});

// ── Authenticated pages ───────────────────────────────────────────────────

test.describe("a11y — admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });

  test("admin index", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState("networkidle");
    await analyzeA11y(page);
  });

  test("admin tournaments list", async ({ page }) => {
    await page.goto(`${BASE}/admin/tournaments`);
    await page.waitForLoadState("networkidle");
    await analyzeA11y(page);
  });

  test("admin users list", async ({ page }) => {
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState("networkidle");
    await analyzeA11y(page);
  });
});
