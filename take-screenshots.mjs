/**
 * Скрипт для создания скриншотов README.
 * Запуск: node take-screenshots.mjs
 * Требует: npx playwright install chromium (один раз)
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:8080";
const API  = "http://localhost:4000";
const OUT  = "./docs/screenshots";
const W    = 1440;
const H    = 900;

mkdirSync(OUT, { recursive: true });

async function loginAs(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Текст кнопок: "Әкімші" | "Жаттықтырушы" | "Спортшы"
  const labelMap = { admin: "Әкімші", coach: "Жаттықтырушы", athlete: "Спортшы" };
  const demoBtn = page.locator("button", { hasText: labelMap[role] }).first();
  if (await demoBtn.count() > 0) {
    await demoBtn.click();
    await page.waitForTimeout(300);
  }

  // Кнопка submit — "Кіру"
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
    await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
}

async function getAdminToken(page) {
  await loginAs(page, "admin");
}

async function shot(page, name, options = {}) {
  await page.waitForTimeout(options.delay ?? 600);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({
    path,
    fullPage: options.fullPage ?? false,
    clip: options.clip,
  });
  console.log(`  ✓ ${name}.png`);
  return path;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await context.newPage();

  console.log("\n🎬 Judo-Arena — скриншоты для README\n");

  // ── 1. Главная страница ─────────────────────────────────────
  console.log("1. Главная страница");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot(page, "01-homepage");

  // Прокрутить вниз и скриншот секции "возможности"
  await page.evaluate(() => window.scrollTo(0, 600));
  await shot(page, "01-homepage-features", { delay: 400 });

  // ── 2. Страница логина ──────────────────────────────────────
  console.log("2. Страница входа");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(page, "02-login", { delay: 800 });

  // ── 3. Логин как ADMIN ──────────────────────────────────────
  console.log("3. Логин — demo кнопка");
  await getAdminToken(page);

  // ── 4. Admin dashboard ─────────────────────────────────────
  console.log("4. Admin dashboard");
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await shot(page, "03-admin-dashboard", { delay: 1000 });

  // ── 5. Список турниров ─────────────────────────────────────
  console.log("5. Список турниров");
  await page.goto(`${BASE}/admin/tournaments`, { waitUntil: "networkidle" });
  await shot(page, "04-tournaments-list", { delay: 1000 });

  // ── 6. Детали турнира — Обзор ──────────────────────────────
  console.log("6. Детали турнира");
  const tournamentLink = page.locator("a[href*='/admin/tournaments/']").first();
  if (await tournamentLink.count() > 0) {
    await tournamentLink.click();
    await page.waitForURL((url) => url.href.includes("/admin/tournaments/"), { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "05-tournament-detail-overview");

    // Таб "Категории" — ищем по частичному тексту
    const tabTexts = ["Категор", "Сетк", "Тор", "Матч"];
    const tabShots = ["06-tournament-categories", "07-tournament-bracket", "07-tournament-bracket", "08-tournament-matches"];
    for (let i = 0; i < tabTexts.length; i++) {
      const tab = page.locator("button", { hasText: new RegExp(tabTexts[i], "i") }).first();
      if (await tab.count() > 0) {
        await tab.click();
        await shot(page, tabShots[i], { delay: 1000 });
      }
    }
  }

  // ── 7. Рейтинг ────────────────────────────────────────────
  console.log("7. Рейтинг");
  await page.goto(`${BASE}/admin/ratings`, { waitUntil: "networkidle" });
  await shot(page, "09-admin-ratings", { delay: 1200 });

  // ── 8. Coach dashboard ─────────────────────────────────────
  console.log("8. Coach dashboard");
  await loginAs(page, "coach");
  await page.goto(`${BASE}/coach`, { waitUntil: "networkidle" });
  await shot(page, "10-coach-dashboard", { delay: 1000 });

  // Заявки тренера
  await page.goto(`${BASE}/coach/applications`, { waitUntil: "networkidle" });
  await shot(page, "11-coach-applications", { delay: 800 });

  // ── 9. Athlete dashboard ───────────────────────────────────
  console.log("9. Athlete dashboard");
  await loginAs(page, "athlete");
  await page.goto(`${BASE}/athlete`, { waitUntil: "networkidle" });
  await shot(page, "12-athlete-dashboard", { delay: 1000 });

  // ── 10. Публичные страницы ─────────────────────────────────
  console.log("10. Публичные страницы");
  await page.goto(`${BASE}/tournaments`, { waitUntil: "networkidle" });
  await shot(page, "13-public-tournaments", { delay: 800 });

  await page.goto(`${BASE}/rankings`, { waitUntil: "networkidle" });
  await shot(page, "14-public-rankings", { delay: 1200 });

  await browser.close();

  console.log(`\n✅ Скриншоты сохранены в ${OUT}/`);
  console.log("   Файлов:", 14);
})().catch((e) => {
  console.error("❌ Ошибка:", e.message);
  process.exit(1);
});
