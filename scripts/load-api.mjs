#!/usr/bin/env node

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const DURATION_SEC = Number(process.env.LOAD_DURATION_SEC ?? 60);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 25);
const SLOW_MS = Number(process.env.LOAD_SLOW_MS ?? 1000);

const endpoints = [
  "/health",
  "/api/tournaments?limit=20",
  "/api/ratings/leaderboard?limit=50",
  "/api/ratings/clubs?limit=20",
  "/api/clubs?limit=20",
];

const deadline = Date.now() + DURATION_SEC * 1000;
const results = [];

async function worker(id) {
  let index = id;
  while (Date.now() < deadline) {
    const path = endpoints[index % endpoints.length];
    index += CONCURRENCY;
    const started = Date.now();
    try {
      const response = await fetch(`${API_URL}${path}`);
      await response.arrayBuffer();
      results.push({ status: response.status, ms: Date.now() - started, path });
    } catch {
      results.push({ status: 0, ms: Date.now() - started, path });
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

const total = results.length;
const failed = results.filter((r) => r.status === 0 || r.status >= 500).length;
const slow = results.filter((r) => r.ms > SLOW_MS).length;
const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
const percentile = (p) =>
  sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;

console.log(
  `API load test: ${total} requests, concurrency=${CONCURRENCY}, duration=${DURATION_SEC}s`,
);
console.log(`Failures: ${failed}`);
console.log(`Slow >${SLOW_MS}ms: ${slow}`);
console.log(
  `Latency p50=${percentile(50)}ms p95=${percentile(95)}ms p99=${percentile(99)}ms`,
);

const byStatus = new Map();
for (const result of results)
  byStatus.set(result.status, (byStatus.get(result.status) ?? 0) + 1);
console.log(
  "Statuses:",
  Object.fromEntries([...byStatus.entries()].sort(([a], [b]) => a - b)),
);

if (failed > 0 || slow / Math.max(total, 1) > 0.05) process.exit(1);
