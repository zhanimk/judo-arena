import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/db/**/*.test.ts", "tests/system/smoke.test.ts"],
    environment: "node",
    globals: false,
    // Unit tests must also run on a clean checkout without a developer .env.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://judo:test@127.0.0.1:5433/judo_arena_test",
      REDIS_URL: "redis://127.0.0.1:6379/15",
      JWT_ACCESS_SECRET: "unit_test_access_secret_at_least_32_characters",
      JWT_REFRESH_SECRET: "unit_test_refresh_secret_at_least_32_characters",
    },
    coverage: {
      provider: "v8",
      // Keep the hard gate on deterministic domain logic. Route and adapter
      // behavior is covered by integration/system suites, where broad module
      // mocks make a global source-tree percentage misleading.
      include: [
        "src/services/bracket-engine/*.ts",
        "src/services/match-lifecycle.service.ts",
        "src/services/match-score.service.ts",
        "src/services/match-types.ts",
        "src/validators/auth.schema.ts",
        "src/validators/tournament.schema.ts",
      ],
      exclude: [
        "src/server.ts",
        "src/lib/prisma.ts",
        "src/lib/redis.ts",
        "src/lib/env.ts",
      ],
      reporter: ["text", "lcov", "json-summary"],
      // Минимальный порог — CI падает если покрытие ниже
      thresholds: {
        lines: 90,
        functions: 95,
        branches: 82,
        statements: 88,
      },
    },
  },
});
