/**
 * Vitest config for real-database integration tests.
 *
 * Requires DATABASE_URL and REDIS_URL pointing to live instances.
 * In CI these are provided by the postgres/redis services in ci.yml.
 * Locally: docker compose up postgres redis
 *
 * Run: npm run test:db -w @judo-arena/api
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    globals: false,
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
