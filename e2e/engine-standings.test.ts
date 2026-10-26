import { test, expect } from "@playwright/test";
const API = process.env.API_URL ?? "http://localhost:4000";
const password = process.env.E2E_PASSWORD ?? "JudoArenaAdmin2026!";

test("RR engine: full registration to a cyclic tie, secretary decision in UI and final ratings", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const auth = await request.post(`${API}/api/auth/login`, {
    data: { email: "admin@judo-arena.kz", password },
  });
  expect(auth.ok()).toBeTruthy();
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const start = new Date(Date.now() + 30 * 86400000);
  const response = await request.post(`${API}/api/tournaments`, {
    headers,
    data: {
      name: { ru: `Engine E2E ${Date.now()}` },
      city: "Алматы",
      location: "Тестовый зал",
      startDate: start.toISOString(),
      endDate: new Date(+start + 86400000).toISOString(),
      entryFeeKzt: 0,
      audience: "ADULT",
    },
  });
  expect(response.status()).toBe(201);
  const tournament = await response.json();
  const categoryResponse = await request.post(
    `${API}/api/tournaments/${tournament.id}/categories`,
    {
      headers,
      data: {
        name: { ru: "Проверка движка RR" },
        gender: "MALE",
        ageMin: 18,
        ageMax: 99,
        weightMin: 0,
        weightMax: 66,
        format: "ROUND_ROBIN",
      },
    },
  );
  expect(categoryResponse.status()).toBe(201);
  const category = await categoryResponse.json();
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const application = await request.post(
      `${API}/api/tournaments/${tournament.id}/manual-entry`,
      {
        headers,
        data: {
          categoryId: category.id,
          participant: {
            name: `Движок${i}`,
            surname: `Спортсмен${i}`,
            dateOfBirth: "2000-01-01",
            gender: "MALE",
            weightKg: 65,
          },
        },
      },
    );
    expect(application.status()).toBe(201);
    const app = await application.json();
    expect(
      (
        await request.post(`${API}/api/applications/${app.id}/approve`, {
          headers,
          data: {},
        })
      ).ok(),
    ).toBeTruthy();
    const entry = app.entries[0];
    ids.push(entry.athleteId);
    expect(
      (
        await request.patch(
          `${API}/api/admin/application-entries/${entry.id}/weigh-in`,
          { headers, data: { status: "PASSED" } },
        )
      ).ok(),
    ).toBeTruthy();
  }
  for (const status of ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"])
    expect(
      (
        await request.post(`${API}/api/tournaments/${tournament.id}/status`, {
          headers,
          data: { status },
        })
      ).ok(),
    ).toBeTruthy();
  const generated = await request.post(
    `${API}/api/tournaments/${tournament.id}/categories/${category.id}/bracket`,
    { headers },
  );
  expect(generated.status()).toBe(201);
  const bracket = await generated.json();
  expect(
    (
      await request.post(`${API}/api/tournaments/${tournament.id}/status`, {
        headers,
        data: { status: "IN_PROGRESS" },
      })
    ).ok(),
  ).toBeTruthy();
  for (const match of bracket.matches) {
    const redIndex = ids.indexOf(match.redAthleteId);
    const blueIndex = ids.indexOf(match.blueAthleteId);
    const side = (redIndex + 1) % 3 === blueIndex ? "RED" : "BLUE";
    expect(
      (
        await request.post(`${API}/api/matches/${match.id}/start`, { headers })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.post(`${API}/api/matches/${match.id}/score`, {
          headers,
          data: { type: "IPPON", side },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await request.post(`${API}/api/matches/${match.id}/confirm`, {
          headers,
        })
      ).ok(),
    ).toBeTruthy();
  }
  const blocked = await request.post(
    `${API}/api/admin/tournaments/${tournament.id}/finalize`,
    { headers },
  );
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error).toBe("STANDINGS_UNRESOLVED");
  await page.addInitScript(() => localStorage.setItem("judo-locale", "ru"));
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@judo-arena.kz");
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto(`/tournaments/${tournament.id}`);
  // Public tournament page keeps the bracket in its dedicated tab.
  const bracketTab = page
    .getByRole("button", { name: "Live-топ", exact: true })
    .first();
  await bracketTab.click();
  const panel = page.getByRole("region", { name: "Разрешение ничьей" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /Ниже/ }).first().click();
  await panel
    .getByLabel("Основание решения")
    .fill("Результат жеребьёвки подтверждён главным судьёй");
  const decisionRequest = page.waitForResponse(
    (r) =>
      r.url().includes("/standings/decision") &&
      r.request().method() === "POST",
  );
  await panel.getByRole("button", { name: "Утвердить порядок мест" }).click();
  expect((await decisionRequest).ok()).toBeTruthy();
  await expect(panel).toHaveCount(0);
  await page.reload();
  await bracketTab.click();
  await expect(panel).toHaveCount(0);
  const refreshed = await (
    await request.get(`${API}/api/brackets/${bracket.id}`)
  ).json();
  expect(refreshed.standings[0].decision.reason).toContain("жеребьёвки");
  const finalized = await request.post(
    `${API}/api/admin/tournaments/${tournament.id}/finalize`,
    { headers },
  );
  expect(finalized.ok()).toBeTruthy();
  const result = await finalized.json();
  expect(result.entriesCount).toBe(3);
  expect(
    result.entries.find((entry: { place: number }) => entry.place === 1)
      .athleteId,
  ).toBe(refreshed.standings[0].rows[0].athleteId);
});
