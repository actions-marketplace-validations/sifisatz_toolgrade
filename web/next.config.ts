import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite resolves its WASM and data files from import.meta.url; bundling breaks that.
  serverExternalPackages: ["@electric-sql/pglite"],
  // No sign-in in the PoC: /app opens the seeded demo workspace.
  redirects: async () => [{ source: "/app", destination: "/app/acme", permanent: false }],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
