import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    coverage: {
      include: ["server/**/*.ts"],
      exclude: [
        "server/**/*.test.ts",
        "server/dev-server.ts",
        "server/index.ts",
        "server/app-setup.ts",
        "server/oauth.ts",
        "server/storage.ts",
        "server/cache-ttl.ts",
        "server/routes/keys.ts",
        "server/atproto-repo.ts",
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
