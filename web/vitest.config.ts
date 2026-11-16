import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/stubs/empty.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    env: {
      PGLITE_DIR: "memory://",
      BETTER_AUTH_SECRET: "test-secret-0123456789-abcdefghijklmnop",
      BETTER_AUTH_URL: "http://localhost:3100",
    },
  },
});
