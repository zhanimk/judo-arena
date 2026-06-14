import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/system/smoke.test.ts"],
    environment: "node",
    globals: false,
  },
});
