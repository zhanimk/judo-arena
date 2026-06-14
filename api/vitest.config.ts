import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/system/smoke.test.ts"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      // Keep the hard gate on deterministic domain logic. Route and adapter
      // behavior is covered by integration/system suites, where broad module
      // mocks make a global source-tree percentage misleading.
      include: [
        "src/services/bracket-engine/round-robin.ts",
        "src/services/bracket-engine/seeding.ts",
        "src/services/bracket-engine/single-elimination.ts",
        "src/services/bracket-engine/tatami-plan.ts",
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
