#!/usr/bin/env node

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "admin@judo-arena.kz";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "password123";

const checks = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    checks.push({ name, ok: true, ms: Date.now() - started });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      ms: Date.now() - started,
      error: error.message,
    });
  }
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

await check("API /health is ok", async () => {
  const { response, body } = await jsonFetch(`${API_URL}/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (body.status !== "ok")
    throw new Error(
      `health=${body.status}, db=${body.checks?.db}, redis=${body.checks?.redis}, s3=${body.checks?.s3}, email=${body.checks?.email}`,
    );
});

await check("Web root responds", async () => {
  const response = await fetch(WEB_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
});

let accessToken = "";
await check("Admin login works", async () => {
  const { response, body } = await jsonFetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}: ${body?.message ?? "login failed"}`,
    );
  accessToken = body.accessToken;
  if (!accessToken) throw new Error("missing accessToken");
});

await check("Tournaments API responds", async () => {
  const { response, body } = await jsonFetch(
    `${API_URL}/api/tournaments?limit=5`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!Array.isArray(body.items)) throw new Error("items is not an array");
});

await check("Ratings API responds", async () => {
  const { response, body } = await jsonFetch(
    `${API_URL}/api/ratings/leaderboard?limit=5`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!Array.isArray(body)) throw new Error("leaderboard is not an array");
});

await check("Protected /me works", async () => {
  const { response, body } = await jsonFetch(`${API_URL}/api/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}: ${body?.message ?? "auth failed"}`,
    );
  if (!body.user?.id) throw new Error("missing user");
});

for (const item of checks) {
  const mark = item.ok ? "PASS" : "FAIL";
  console.log(
    `${mark} ${item.name} (${item.ms}ms)${item.error ? ` — ${item.error}` : ""}`,
  );
}

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) process.exit(1);
