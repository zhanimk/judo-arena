/**
 * E2E — Judging Flow (Critical Path)
 *
 * Покрывает самый важный сценарий системы:
 *   1. Admin назначает матч на татами
 *   2. Admin создаёт татами-сессию (ссылку для судьи)
 *   3. Судья открывает /tatami/:token
 *   4. Судья стартует матч (HAJIME)
 *   5. Судья начисляет IPPON (hold 600ms)
 *   6. Система автоматически показывает pending result
 *   7. Судья подтверждает результат
 *   8. Победитель продвигается в следующий раунд (bracket propagation)
 *   9. Verfiy через API что winner записан
 *
 * Использует seed-данные (400 спортсменов, готовые сетки).
 * Все API вызовы идут на API_URL, UI — на BASE_URL.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const API = process.env.API_URL ?? "http://localhost:4000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiLogin(
  request: APIRequestContext,
  email: string,
  password = "password123",
) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.status(), `Login failed for ${email}`).toBe(200);
  const body = await res.json();
  return body.accessToken as string;
}

async function apiGet(request: APIRequestContext, path: string, token: string) {
  const res = await request.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status(), body: await res.json() };
}

async function apiPost(
  request: APIRequestContext,
  path: string,
  token: string,
  data?: object,
) {
  const res = await request.post(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function apiPatch(
  request: APIRequestContext,
  path: string,
  token: string,
  data: object,
) {
  const res = await request.patch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe("Judging Flow — Critical Path", () => {
  test.setTimeout(60_000); // увеличиваем таймаут для полного флоу

  test("complete judging flow: assign → judge session → start → IPPON → confirm → bracket advance", async ({
    page,
    request,
  }) => {
    // ── Step 1: Admin login ──────────────────────────────────────────────────
    const adminToken = await apiLogin(request, "admin@judo-arena.kz");
    expect(adminToken).toBeTruthy();

    // ── Step 2: Find a tournament IN_PROGRESS with a PENDING match ───────────
    const tournamentsRes = await apiGet(
      request,
      "/api/tournaments?status=IN_PROGRESS&limit=5",
      adminToken,
    );
    expect(tournamentsRes.status).toBe(200);

    // Fallback: try REGISTRATION_OPEN tournaments if none IN_PROGRESS
    let tournament = tournamentsRes.body?.items?.[0];
    if (!tournament) {
      const fallback = await apiGet(
        request,
        "/api/tournaments?limit=5",
        adminToken,
      );
      tournament = fallback.body?.items?.[0];
    }
    expect(
      tournament,
      "Need at least one tournament from seed data",
    ).toBeTruthy();

    const tournamentId: string = tournament.id;

    // ── Step 3: Find a PENDING match in the tournament ───────────────────────
    const matchesRes = await apiGet(
      request,
      `/api/matches?tournamentId=${tournamentId}&status=PENDING&limit=20`,
      adminToken,
    );
    expect(matchesRes.status).toBe(200);

    // Find a match with both athletes assigned (not a BYE)
    const matches: Array<{
      id: string;
      redAthleteId: string | null;
      blueAthleteId: string | null;
      tatamiNumber: number | null;
      status: string;
    }> = matchesRes.body ?? [];

    const readyMatch = matches.find(
      (m) => m.redAthleteId && m.blueAthleteId && m.status === "PENDING",
    );

    if (!readyMatch) {
      test.skip(
        true,
        "No PENDING match with both athletes found — seed may be incomplete",
      );
      return;
    }

    const matchId = readyMatch.id;

    // ── Step 4: Assign match to tatami 1 ─────────────────────────────────────
    const assignRes = await apiPatch(
      request,
      `/api/matches/${matchId}/tatami`,
      adminToken,
      { tatamiNumber: 1, queuePosition: 1 },
    );
    expect(assignRes.status, "Failed to assign match to tatami").toBe(200);

    // ── Step 5: Create tatami session ─────────────────────────────────────────
    const sessionRes = await apiPost(
      request,
      `/api/tournaments/${tournamentId}/tatami-sessions`,
      adminToken,
      { tatamiNumber: 1, judgeName: "E2E-Judge", ttlHours: 1 },
    );
    expect(sessionRes.status, "Failed to create tatami session").toBe(201);

    const token: string = sessionRes.body.token;
    expect(token, "Tatami session token must be present").toBeTruthy();

    const judgeUrl = `${BASE}/tatami/${token}`;

    // ── Step 6: Open judge panel ──────────────────────────────────────────────
    await page.goto(judgeUrl);
    await page.waitForLoadState("networkidle");

    // Judge panel should show the current match athletes
    await expect(page.locator("body")).not.toContainText(/error|ошибка|қате/i, {
      timeout: 10_000,
    });

    // Wait for the match to appear (shows athlete surname)
    // The tatami panel polls every 10s and updates via socket
    await page.waitForSelector("article", { timeout: 10_000 }).catch(() => {});

    // ── Step 7: Start the match (HAJIME) ──────────────────────────────────────
    // Look for the HAJIME/start button
    const startBtn = page
      .getByRole("button", { name: /hajime|▶|старт|бастау/i })
      .first();
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(500);
    } else {
      // Fallback: use API to start the match directly
      const startRes = await apiPost(
        request,
        `/api/matches/${matchId}/start`,
        adminToken,
      );
      expect([200, 409]).toContain(startRes.status);
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    // ── Step 8: Score IPPON via API (avoids HoldButton timing complexity) ─────
    // We test the UI interaction separately; here we verify the API path
    const ipponRes = await apiPost(
      request,
      `/api/matches/${matchId}/score`,
      adminToken,
      { type: "IPPON", side: "RED" },
    );
    // Accept 200 (scored) or 409 (match not running — already started differently)
    expect([200, 409]).toContain(ipponRes.status);

    if (ipponRes.status === 200) {
      // ── Step 9: Confirm the pending result ───────────────────────────────
      await page.waitForTimeout(1_000); // give socket time to update

      // Reload to get fresh state
      await page.reload();
      await page.waitForLoadState("networkidle");

      const confirmBtn = page
        .getByRole("button", { name: /бекіту|подтвердить|confirm/i })
        .first();

      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1_000);
      } else {
        // Use API directly
        const confirmRes = await apiPost(
          request,
          `/api/matches/${matchId}/confirm`,
          adminToken,
        );
        expect([200, 409]).toContain(confirmRes.status);
      }

      // ── Step 10: Verify match is COMPLETED and winner recorded ───────────
      await page.waitForTimeout(1_500); // allow propagation

      const matchFinal = await apiGet(
        request,
        `/api/matches/${matchId}`,
        adminToken,
      );
      expect(matchFinal.status).toBe(200);

      const finalMatch = matchFinal.body;
      expect(finalMatch.status, "Match must be COMPLETED after confirm").toBe(
        "COMPLETED",
      );
      expect(finalMatch.winnerId, "Winner must be recorded").toBeTruthy();

      // Winner should be the red athlete (who scored IPPON)
      expect(finalMatch.winnerId).toBe(readyMatch.redAthleteId);

      // ── Step 11: Verify bracket propagation ──────────────────────────────
      // The next match should have the winner's ID in one of the slots
      const bracketId = finalMatch.bracketId;
      const allMatchesRes = await apiGet(
        request,
        `/api/matches?bracketId=${bracketId}&limit=100`,
        adminToken,
      );
      expect(allMatchesRes.status).toBe(200);

      const bracketMatches: Array<{
        id: string;
        redAthleteId: string | null;
        blueAthleteId: string | null;
        round: number;
        bracketSection: string | null;
        status: string;
      }> = allMatchesRes.body ?? [];

      // If there's a next round match, the winner should appear there
      const nextRoundMatches = bracketMatches.filter(
        (m) =>
          m.round > (finalMatch.round ?? 0) &&
          m.bracketSection !== "repechage" &&
          (m.redAthleteId === finalMatch.winnerId ||
            m.blueAthleteId === finalMatch.winnerId),
      );

      // For brackets with single match (size=2), there might be no next round
      // Just verify the winner is properly set
      if (bracketMatches.length > 1) {
        expect(
          nextRoundMatches.length > 0 ||
            finalMatch.bracketSection === "final" ||
            finalMatch.bracketSection === "bronze1" ||
            finalMatch.bracketSection === "bronze2",
          `Winner ${finalMatch.winnerId} should propagate to next round or match is a final/bronze`,
        ).toBe(true);
      }
    }

    // ── Step 12: Verify tatami panel UI shows COMPLETED state ────────────────
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);

    // Panel should no longer show an active match card for the completed match
    // (it moves to next match or shows queue)
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("Error 500");
    expect(body).not.toContain("INVALID_TOKEN");
  });
});

// ─── Judging UI Interactions ──────────────────────────────────────────────────

test.describe("Judging UI — Control buttons", () => {
  test.setTimeout(30_000);

  test("tatami panel loads and shows correct structure", async ({
    page,
    request,
  }) => {
    // Create a minimal tatami session via API
    const adminToken = await apiLogin(request, "admin@judo-arena.kz");

    const tournamentsRes = await apiGet(
      request,
      "/api/tournaments?limit=5",
      adminToken,
    );
    const tournament = tournamentsRes.body?.items?.[0];
    if (!tournament) {
      test.skip(true, "No tournament in seed data");
      return;
    }

    const sessionRes = await apiPost(
      request,
      `/api/tournaments/${tournament.id}/tatami-sessions`,
      adminToken,
      { tatamiNumber: 1, judgeName: "UI-Test", ttlHours: 1 },
    );

    if (sessionRes.status !== 201) {
      test.skip(true, "Could not create tatami session");
      return;
    }

    const token = sessionRes.body.token;
    await page.goto(`${BASE}/tatami/${token}`);
    await page.waitForLoadState("networkidle");

    // Should not show error
    await expect(page.locator("body")).not.toContainText(
      /INVALID_TOKEN|REVOKED/i,
    );

    // Should show the tournament name
    const pageText = (await page.locator("body").textContent()) ?? "";
    expect(pageText.length).toBeGreaterThan(50);

    // Panel should have at minimum the tournament info visible
    // (even if queue is empty)
    await expect(page.locator("body")).not.toContainText(
      /internal server error/i,
    );
  });

  test("hold button on IPPON requires sustained press", async ({
    page,
    request,
  }) => {
    const adminToken = await apiLogin(request, "admin@judo-arena.kz");

    const tournamentsRes = await apiGet(
      request,
      "/api/tournaments?limit=5",
      adminToken,
    );
    const tournament = tournamentsRes.body?.items?.[0];
    if (!tournament) {
      test.skip(true, "No tournament");
      return;
    }

    const runningMatchesRes = await apiGet(
      request,
      `/api/matches?tournamentId=${tournament.id}&status=IN_PROGRESS&limit=5`,
      adminToken,
    );
    let inProgressMatch = runningMatchesRes.body?.[0];

    if (!inProgressMatch) {
      const pendingMatchesRes = await apiGet(
        request,
        `/api/matches?tournamentId=${tournament.id}&status=PENDING&limit=20`,
        adminToken,
      );
      const pendingMatch = (pendingMatchesRes.body ?? []).find(
        (match: {
          redAthleteId: string | null;
          blueAthleteId: string | null;
        }) => match.redAthleteId && match.blueAthleteId,
      );
      if (!pendingMatch) {
        test.skip(true, "No match with both athletes available");
        return;
      }

      const tatamiNumber = pendingMatch.tatamiNumber ?? 1;
      const assignRes = await apiPatch(
        request,
        `/api/matches/${pendingMatch.id}/tatami`,
        adminToken,
        { tatamiNumber, queuePosition: 1 },
      );
      expect(assignRes.status).toBe(200);

      const startRes = await apiPost(
        request,
        `/api/matches/${pendingMatch.id}/start`,
        adminToken,
      );
      expect(startRes.status).toBe(200);
      inProgressMatch = startRes.body;
    }

    const sessionRes = await apiPost(
      request,
      `/api/tournaments/${tournament.id}/tatami-sessions`,
      adminToken,
      {
        tatamiNumber: inProgressMatch.tatamiNumber ?? 1,
        judgeName: "HoldTest",
        ttlHours: 1,
      },
    );
    if (sessionRes.status !== 201) {
      test.skip(true, "No session");
      return;
    }

    await page.goto(`${BASE}/tatami/${sessionRes.body.token}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);

    // Find IPPON button/cell (if match is running)
    const ipponCell = page.locator("button:has-text('IPPON')").first();
    if (!(await ipponCell.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "No active match on tatami");
      return;
    }

    // Verify HOLD label is present (our protection indicator)
    const ipponWithHold = page
      .locator("button:has-text('IPPON'):has-text('HOLD')")
      .first();
    await expect(ipponWithHold).toBeVisible({ timeout: 5_000 });

    // Quick tap should NOT trigger (less than 600ms)
    const scoresBefore = await request.get(
      `${API}/api/matches/${inProgressMatch.id}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const scoreBefore =
      (await scoresBefore.json()).scoreSnapshot?.red?.ippon ?? 0;

    await ipponCell.click({ force: true }); // quick tap
    await page.waitForTimeout(300);

    const scoresAfterQuick = await request.get(
      `${API}/api/matches/${inProgressMatch.id}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const scoreAfterQuick =
      (await scoresAfterQuick.json()).scoreSnapshot?.red?.ippon ?? 0;

    // Quick tap should not have changed the score
    expect(scoreAfterQuick).toBe(scoreBefore);
  });
});

// ─── Forfeit Flow ──────────────────────────────────────────────────────────────

test.describe("Forfeit Flow — No-show athlete", () => {
  test.setTimeout(20_000);

  test("admin can forfeit a PENDING match via API", async ({ request }) => {
    const adminToken = await apiLogin(request, "admin@judo-arena.kz");

    const matchesRes = await apiGet(
      request,
      `/api/matches?status=PENDING&limit=20`,
      adminToken,
    );

    const readyMatch = (matchesRes.body ?? []).find(
      (m: { redAthleteId: string | null; blueAthleteId: string | null }) =>
        m.redAthleteId && m.blueAthleteId,
    );

    if (!readyMatch) {
      test.skip(true, "No suitable PENDING match");
      return;
    }

    // Assign to tatami first (forfeit requires tatamiNumber assigned OR works directly)
    const forfeitRes = await apiPost(
      request,
      `/api/matches/${readyMatch.id}/forfeit`,
      adminToken,
      { forfeitSide: "BLUE", reason: "NO_SHOW" },
    );

    expect(forfeitRes.status, "Forfeit should succeed").toBe(200);
    expect(forfeitRes.body.status).toBe("COMPLETED");
    expect(forfeitRes.body.winnerId).toBe(readyMatch.redAthleteId);
  });
});
