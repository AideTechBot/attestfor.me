import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["server/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      include: ["server/**/*.ts", "src/lib/**/*.ts"],
      exclude: [
        "server/**/*.test.ts",
        "src/**/*.test.ts",
        "server/dev-server.ts",
        "server/index.ts",
        "server/app-setup.ts",
        "server/oauth.ts",
        "server/storage.ts",
        "server/cache-ttl.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 85,
        statements: 85,
      },
    },
  },
});
