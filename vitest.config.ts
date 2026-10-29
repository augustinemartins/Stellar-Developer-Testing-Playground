import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "packages",
          include: ["packages/*/test/**/*.test.ts"],
          environment: "node",
        },
      },
      "apps/web/vitest.config.ts",
      {
        test: {
          name: "integration",
          include: ["tests/**/*.test.ts"],
          environment: "node",
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: ["**/fixtures/**", "**/*.d.ts"],
      reporter: ["text-summary", "html", "lcov"],
    },
  },
});
