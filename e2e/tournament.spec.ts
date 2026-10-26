import { test, expect, type APIRequestContext } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:4000";

async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: {
      email,
      password: process.env.E2E_PASSWORD ?? "JudoArenaAdmin2026!",
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

test.describe("Tournament Flow", () => {
  test("admin can create a new tournament", async ({ request }) => {
    const adminToken = await apiLogin(request, "admin@judo-arena.kz");

    // Create tournament
    const res = await request.post(`${API}/api/tournaments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: { ru: "E2E Test Championship" },
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        location: "Almaty, Kazakhstan",
        city: "Almaty",
        tatamiCount: 3,
      },
    });

    expect(res.status()).toBe(201);
    const tournament = await res.json();
    expect(tournament.id).toBeDefined();
    expect(tournament.name.ru).toBe("E2E Test Championship");
    expect(tournament.status).toBe("DRAFT");

    const categoryRes = await request.post(
      `${API}/api/tournaments/${tournament.id}/categories`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          gender: "MALE",
          ageMin: 18,
          ageMax: 35,
          weightMin: 60,
          weightMax: 66,
        },
      },
    );
    expect(categoryRes.status()).toBe(201);

    // Publish tournament
    const pubRes = await request.post(
      `${API}/api/tournaments/${tournament.id}/status`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { status: "REGISTRATION_OPEN" },
      },
    );
    expect(pubRes.status()).toBe(200);
  });
});
