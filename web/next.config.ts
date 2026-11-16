import type { NextConfig } from "next";

const turbopack: NextConfig["turbopack"] = {
  rules: {
    "*.css": {
      loaders: ["@tailwindcss/turbopack"],
      as: "*.css",
    },
  },
};

/**
 * MARKETING_EXPORT=1 builds only the public marketing site as static files (GitHub Pages).
 * Routes are limited to *.marketing.tsx files, so the dashboard, API, proxy and auth - which
 * need a server - are never part of that build.
 */
const marketingExport: NextConfig = {
  output: "export",
  basePath: process.env.PAGES_BASE_PATH || undefined,
  pageExtensions: ["marketing.tsx"],
  images: { unoptimized: true },
  trailingSlash: true,
  // Generated route types here cover only the marketing route, so typechecking the whole app
  // in this build fails spuriously. The full app is typechecked by `tsc` and the server build.
  typescript: { ignoreBuildErrors: true },
  reactCompiler: true,
  turbopack,
};

const app: NextConfig = {
  // PGlite resolves its WASM and data files from import.meta.url; bundling breaks that.
  serverExternalPackages: ["@electric-sql/pglite"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack,
};

export default process.env.MARKETING_EXPORT === "1" ? marketingExport : app;
