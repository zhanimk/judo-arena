import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",
        "src/lib/prisma.ts",
        "src/lib/redis.ts",
        "src/lib/env.ts",
      ],
      // CI упадёт если покрытие ниже порогов.
      // Текущий уровень (~50%) — стартовый; повышать по мере роста тестов.
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
