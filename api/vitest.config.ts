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
      reporter: ["text", "lcov", "json-summary"],
    },
  },
});
