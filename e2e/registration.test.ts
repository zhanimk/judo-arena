import { test, expect, type Page } from "@playwright/test";
const API = process.env.API_URL ?? "http://localhost:4000";
const password = process.env.E2E_PASSWORD ?? "JudoArenaAdmin2026!";
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test("mixed tournament: admin manual child and unaffiliated adult self application", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem("judo-locale", "ru");
    localStorage.setItem("judo-e2e-rate-limit-bypass", "1");
  });
  const auth = await request.post(`${API}/api/auth/login`, {
    data: { email: "admin@judo-arena.kz", password },
  });
  expect(auth.ok()).toBeTruthy();
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const suffix = Date.now();
  const start = new Date(Date.now() + 45 * 86400000);
  const tournamentRes = await request.post(`${API}/api/tournaments`, {
    headers,
    data: {
      name: { ru: `Регистрация E2E ${suffix}` },
      city: "Алматы",
      location: "Тестовый зал",
      startDate: start.toISOString(),
      endDate: new Date(+start + 86400000).toISOString(),
      audience: "MIXED",
      selfRegistrationEnabled: true,
      clubRegistrationEnabled: true,
    },
  });
  expect(tournamentRes.status()).toBe(201);
  const tournament = await tournamentRes.json();
  const categoryRes = await request.post(
    `${API}/api/tournaments/${tournament.id}/categories`,
    {
      headers,
      data: {
        name: { ru: "Взрослые до 66 кг" },
        gender: "MALE",
        ageMin: 18,
        ageMax: 99,
        weightMin: 0,
        weightMax: 66,
      },
    },
  );
  expect(categoryRes.status()).toBe(201);
  const category = await categoryRes.json();
  const childRes = await request.post(
    `${API}/api/tournaments/${tournament.id}/categories`,
    {
      headers,
      data: {
        name: { ru: "Девочки до 48 кг" },
        gender: "FEMALE",
        ageMin: 4,
        ageMax: 17,
        weightMin: 0,
        weightMax: 48,
      },
    },
  );
  expect(childRes.status()).toBe(201);
  const childCategory = await childRes.json();
  expect(
    (
      await request.post(`${API}/api/tournaments/${tournament.id}/status`, {
        headers,
        data: { status: "REGISTRATION_OPEN" },
      })
    ).ok(),
  ).toBeTruthy();
  const email = `independent-${suffix}@judo-arena.test`;
  expect(
    (
      await request.post(`${API}/api/admin/users`, {
        headers,
        data: {
          email,
          password,
          role: "ATHLETE",
          name: "Взрослый",
          surname: "Без клуба",
          dateOfBirth: "2000-01-01",
          gender: "MALE",
          weightKg: 65,
        },
      })
    ).status(),
  ).toBe(201);

  await login(page, "admin@judo-arena.kz");
  await page.goto(`/admin/tournaments/${tournament.id}`);
  await expect(page.getByLabel("Состав турнира")).toHaveValue("MIXED");
  await expect(
    page.getByLabel("Самостоятельные заявки взрослых (18+)"),
  ).toBeChecked();
  await page.goto(`/admin/tournaments/${tournament.id}?tab=applications`);
  await page
    .getByRole("button", { name: "Ручное добавление", exact: true })
    .click();
  await page
    .getByLabel("Ручное добавление", { exact: true })
    .selectOption("new");
  await page.getByLabel("Имя", { exact: true }).fill("Девочка");
  await page.getByLabel("Фамилия", { exact: true }).fill(`Ручная ${suffix}`);
  await page.getByLabel("Дата рождения", { exact: true }).fill("2015-06-01");
  await page.getByLabel("Вес, кг", { exact: true }).fill("40");
  await page.getByLabel("Пол", { exact: true }).selectOption("FEMALE");
  await page.getByLabel("Выберите категорию").selectOption(childCategory.id);
  await page
    .getByRole("button", { name: "Добавить участника", exact: true })
    .click();
  await expect(
    page.getByText(`Ручная ${suffix} Девочка`, { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("registration-admin.png"),
    fullPage: true,
  });

  await login(page, email);
  await page.goto("/athlete/tournaments");
  await page
    .getByLabel("Выберите турнир", { exact: true })
    .selectOption(tournament.id);
  await page
    .getByLabel("Выберите категорию", { exact: true })
    .selectOption(category.id);
  await page
    .getByRole("button", { name: "Подать заявку", exact: true })
    .click();
  await expect(page.getByText(/Заявка сохранена/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Взрослые до 66 кг", { exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("registration-athlete.png"),
    fullPage: true,
  });
  const applications = await request.get(
    `${API}/api/tournaments/${tournament.id}/applications`,
    { headers },
  );
  const apps = await applications.json();
  expect(apps).toHaveLength(2);
  expect(apps.every((a: { clubId: string | null }) => a.clubId === null)).toBe(
    true,
  );
  expect(apps.map((a: { source: string }) => a.source).sort()).toEqual([
    "ADMIN",
    "SELF",
  ]);
});
