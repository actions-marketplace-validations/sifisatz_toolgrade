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
      // Fake Stripe test-mode values: enough to construct the SDK client and verify webhook
      // signatures locally (no network call), never valid enough to hit the real API with.
      STRIPE_SECRET_KEY: "sk_test_fake_0123456789",
      STRIPE_WEBHOOK_SECRET: "whsec_test_fake_0123456789",
      STRIPE_PRICE_EARLY_ACCESS: "price_test_early_access",
      STRIPE_PRICE_TEAM: "price_test_team",
      STRIPE_PRICE_GROWTH: "price_test_growth",
    },
  },
});
