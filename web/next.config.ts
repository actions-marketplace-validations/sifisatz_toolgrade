import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite resolves its WASM and data files from import.meta.url; bundling breaks that.
  serverExternalPackages: ["@electric-sql/pglite"],
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
