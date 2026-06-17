/**
 * Watch demo: one complete visible flow without finishing the match.
 *
 * Creates:
 * - club
 * - head coach (clubRole OWNER)
 * - 4 athletes
 * - tournament + category
 * - coach application
 * - admin approval
 * - bracket + tatami assignment
 * - live tatami session
 *
 * Then starts the first match and gives RED one WAZA_ARI, but does not finish
 * or confirm it. Playwright opens the useful screens and keeps them open.
 *
 * Run:
 *   npm run demo:watch-flow
 *
 * Optional:
 *   HEADLESS=1 npm run demo:watch-flow
 *   NO_BROWSER=1 npm run demo:watch-flow
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const API = process.env.API_URL ?? "http://localhost:4000";
const PASSWORD = process.env.DEMO_PASSWORD ?? "password123";
const HEADLESS = process.env.HEADLESS === "1";
const NO_BROWSER = process.env.NO_BROWSER === "1";
const RUN = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

const adminEmail = "admin@judo-arena.kz";
const coachEmail = `head.coach.${RUN}@demo.judo`;

const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function step(text) {
  console.log(`\n${colors.blue}▶ ${text}${colors.reset}`);
}

function ok(text) {
  console.log(`${colors.green}  ✓ ${text}${colors.reset}`);
}

function info(text) {
  console.log(`    ${text}`);
}

async function request(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? res.statusText;
    throw new Error(`${method} ${path} -> ${res.status}: ${message}`);
  }
  return data;
}

const GET = (path, token) => request("GET", path, undefined, token);
const POST = (path, body, token) => request("POST", path, body ?? {}, token);
const PATCH = (path, body, token) => request("PATCH", path, body ?? {}, token);

async function loginApi(email) {
  const data = await POST("/api/auth/login", { email, password: PASSWORD });
  return data.accessToken;
}

function dateAfter(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function loginUi(page, email, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (role === "coach") {
    await page.evaluate(() => localStorage.setItem("coach_rules_agreed", "true"));
  }
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/құпиясөз|password/i).fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 12_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function openRolePage(browser, email, role, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await loginUi(page, email, role);
  await page.goto(url, { waitUntil: "networkidle" });
  return page;
}

async function main() {
  console.log(`\n${colors.bold}Judo-Arena watch demo ${RUN}${colors.reset}`);
  console.log(`API:  ${API}`);
  console.log(`WEB:  ${BASE}`);

  step("1. Login admin");
  const adminToken = await loginApi(adminEmail);
  ok(`Admin logged in: ${adminEmail}`);

  step("2. Create club + head coach");
  const club = await POST("/api/admin/clubs", {
    name: {
      kk: `Демо клуб ${RUN}`,
      ru: `Демо клуб ${RUN}`,
      en: `Demo Club ${RUN}`,
    },
    city: "Алматы",
    country: "KZ",
    shortName: `DEMO${RUN.slice(-4)}`,
  }, adminToken);
  ok(`Club: ${club.id}`);

  const coach = await POST("/api/admin/users", {
    email: coachEmail,
    password: PASSWORD,
    role: "COACH",
    name: "Бас",
    surname: "Тренер",
    nameLatin: "Head",
    surnameLatin: "Coach",
    clubId: club.id,
    clubRole: "OWNER",
    preferredLocale: "kk",
  }, adminToken);
  const coachToken = await loginApi(coachEmail);
  ok(`Head coach: ${coach.email}`);

  step("3. Create athletes");
  const athleteInputs = [
    ["Алихан", "Демо", 62],
    ["Нурбол", "Демо", 65],
    ["Дастан", "Демо", 68],
    ["Санжар", "Демо", 71],
  ];
  const athletes = [];
  for (let index = 0; index < athleteInputs.length; index += 1) {
    const [name, surname, weightKg] = athleteInputs[index];
    const athlete = await POST("/api/admin/users", {
      email: `athlete.${RUN}.${index + 1}@demo.judo`,
      password: PASSWORD,
      role: "ATHLETE",
      name,
      surname: `${surname}${index + 1}`,
      nameLatin: `Athlete${index + 1}`,
      surnameLatin: "Demo",
      clubId: club.id,
      gender: "MALE",
      weightKg,
      dateOfBirth: "2007-03-15",
      beltRank: "2 kyu",
      preferredLocale: "kk",
    }, adminToken);
    athletes.push(athlete);
    ok(`${athlete.name} ${athlete.surname}, ${weightKg} kg`);
  }

  step("4. Create tournament + category, then open registration");
  const tournament = await POST("/api/tournaments", {
    name: {
      kk: `Толық процесс демо ${RUN}`,
      ru: `Полный процесс демо ${RUN}`,
      en: `Full Flow Demo ${RUN}`,
    },
    description: {
      kk: "Бір толық демо: спортшы, өтінім, approve, сетка, табло.",
      ru: "Один полный демо-процесс: спортсмен, заявка, approve, сетка, табло.",
    },
    location: "Демо арена",
    city: "Алматы",
    startDate: dateAfter(3),
    endDate: dateAfter(3),
    applicationDeadline: dateAfter(2),
    tatamiCount: 1,
    primaryLocale: "kk",
    weighInLocation: "Демо таразы",
    weighInStart: dateAfter(2.5),
    weighInEnd: dateAfter(2.75),
  }, adminToken);
  ok(`Tournament: ${tournament.id}`);

  const category = await POST(`/api/tournaments/${tournament.id}/categories`, {
    name: { kk: "U21 Ер -73 кг", ru: "U21 Муж -73 кг", en: "U21 Male -73 kg" },
    gender: "MALE",
    ageMin: 14,
    ageMax: 25,
    weightMin: 60,
    weightMax: 73,
    matchDurationSec: 240,
    goldenScoreSec: 0,
    format: "ROUND_ROBIN",
  }, adminToken);
  ok(`Category: ${category.id}`);

  await POST(`/api/tournaments/${tournament.id}/status`, { status: "REGISTRATION_OPEN" }, adminToken);
  ok("Registration opened");

  step("5. Head coach creates and submits application");
  const application = await POST(`/api/tournaments/${tournament.id}/applications`, {
    notes: "Watch demo application",
  }, coachToken);
  ok(`Draft application: ${application.id}`);

  for (const athlete of athletes) {
    await POST(`/api/applications/${application.id}/entries`, {
      athleteId: athlete.id,
      categoryId: category.id,
    }, coachToken);
    ok(`Added: ${athlete.name} ${athlete.surname}`);
  }

  await POST(`/api/applications/${application.id}/submit`, {}, coachToken);
  ok("Application submitted");

  step("6. Admin approves, closes registration, passes weigh-in");
  await POST(`/api/applications/${application.id}/approve`, {
    reviewerNotes: "Watch demo approved",
  }, adminToken);
  ok("Application approved");

  await POST(`/api/tournaments/${tournament.id}/status`, { status: "REGISTRATION_CLOSED" }, adminToken);
  ok("Registration closed");

  const weighIn = await GET(`/api/admin/tournaments/${tournament.id}/weigh-in`, adminToken);
  const entries = (weighIn.applications ?? []).flatMap((app) => app.entries ?? []);
  for (const entry of entries) {
    await PATCH(`/api/admin/application-entries/${entry.id}/weigh-in`, {
      status: "PASSED",
      notes: "Watch demo",
    }, adminToken);
  }
  ok(`Weigh-in PASSED: ${entries.length}`);

  step("7. Generate bracket, assign tatami, start one match without finishing");
  const bracket = await POST(`/api/tournaments/${tournament.id}/categories/${category.id}/bracket`, {}, adminToken);
  ok(`Bracket: ${bracket.id}`);

  await POST(`/api/tournaments/${tournament.id}/brackets/prepare`, {}, adminToken);
  ok("Tatami assigned");

  await POST(`/api/tournaments/${tournament.id}/status`, { status: "IN_PROGRESS" }, adminToken);
  ok("Tournament is IN_PROGRESS");

  const matches = await GET(`/api/matches?tournamentId=${tournament.id}&limit=100`);
  const firstMatch = matches.find((match) =>
    match.tatamiNumber === 1 &&
    match.status === "PENDING" &&
    match.redAthleteId &&
    match.blueAthleteId
  );
  if (!firstMatch) throw new Error("No playable match found on tatami 1");

  const tatamiSession = await POST(`/api/tournaments/${tournament.id}/tatami-sessions`, {
    tatamiNumber: 1,
    judgeName: "Watch Demo Judge",
    ttlHours: 8,
  }, adminToken);
  ok(`Tatami session: ${tatamiSession.judgeUrl}`);

  await POST(`/api/matches/${firstMatch.id}/start`, {}, adminToken);
  await POST(`/api/matches/${firstMatch.id}/score`, { type: "WAZA_ARI", side: "RED" }, adminToken);
  ok("First match started, RED has WAZA_ARI, match is not finished");

  const urls = {
    athlete: `${BASE}/athlete/matches`,
    coachApplication: `${BASE}/coach/applications/${application.id}`,
    adminApplications: `${BASE}/admin/tournaments/${tournament.id}?tab=applications`,
    adminScoreboard: `${BASE}/admin/tournaments/${tournament.id}?tab=scoreboard`,
    liveWall: `${BASE}/live-wall/${tournament.id}?tatami=1`,
    tatami: `${BASE}${tatamiSession.judgeUrl}`,
  };

  step("8. Useful URLs");
  info(`Admin:          ${adminEmail} / ${PASSWORD}`);
  info(`Head coach:     ${coachEmail} / ${PASSWORD}`);
  info(`Athlete:        ${athletes[0].email} / ${PASSWORD}`);
  info(`Coach app:      ${urls.coachApplication}`);
  info(`Admin approve:  ${urls.adminApplications}`);
  info(`Admin tabло:    ${urls.adminScoreboard}`);
  info(`Live wall:      ${urls.liveWall}`);
  info(`Tatami panel:   ${urls.tatami}`);

  if (NO_BROWSER) {
    console.log(`\n${colors.green}Ready. Browser opening skipped because NO_BROWSER=1.${colors.reset}`);
    return;
  }

  step("9. Open browser tabs for watching");
  const browser = await chromium.launch({ headless: HEADLESS });
  const adminPage = await openRolePage(browser, adminEmail, "admin", urls.adminScoreboard);
  await openRolePage(browser, coachEmail, "coach", urls.coachApplication);
  await openRolePage(browser, athletes[0].email, "athlete", urls.athlete);

  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const livePage = await publicContext.newPage();
  await livePage.goto(urls.liveWall, { waitUntil: "networkidle" });
  const tatamiPage = await publicContext.newPage();
  await tatamiPage.goto(urls.tatami, { waitUntil: "networkidle" });
  await adminPage.bringToFront();

  console.log(`\n${colors.green}Demo is ready. The match is live and NOT finished.${colors.reset}`);
  console.log("Press Enter here when you are done watching, then the browser will close.");

  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });

  await browser.close();
}

main().catch((error) => {
  console.error(`\n${colors.yellow}Demo failed:${colors.reset} ${error.message}`);
  console.error("Make sure both servers are running:");
  console.error("  npm run dev");
  process.exit(1);
});
