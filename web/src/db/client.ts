import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  drizzle as drizzlePglite,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

/** Both drivers expose the same query builder; typed as the PGlite flavour. */
export type Db = PgliteDatabase<typeof schema>;

const migrationsFolder = join(process.cwd(), "drizzle");

function open(): { db: Db; ready: Promise<void> } {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Serverless: few connections per instance, and no prepared statements so a transaction-mode
    // pooler (Neon's "-pooler" host, PgBouncer) works. Migrations run once per deploy
    // (`pnpm db:migrate` in the build), not on every cold start where instances would race.
    const db = drizzlePostgres({
      client: postgres(url, { max: 3, prepare: false }),
      schema,
      casing: "snake_case",
    });
    const migrate = process.env.DB_MIGRATE_ON_CONNECT === "1";
    return {
      db: db as unknown as Db,
      ready: migrate
        ? migratePostgres(db, { migrationsFolder })
        : Promise.resolve(),
    };
  }
  // Zero-infra local mode: embedded Postgres (WASM), single connection, demo/dev only.
  // Vercel's filesystem (and any in-memory state) does not survive past a single invocation,
  // so falling back here in production would silently discard every write.
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not set. PGlite is dev/demo-only and loses all data in production " +
        "(Vercel's filesystem does not persist between invocations) — set DATABASE_URL.",
    );
  }
  const dataDir =
    process.env.PGLITE_DIR ?? join(process.cwd(), ".data", "pglite");
  if (dataDir !== "memory://") mkdirSync(dataDir, { recursive: true });
  const db = drizzlePglite({
    client: new PGlite(dataDir),
    schema,
    casing: "snake_case",
  });
  return { db, ready: migratePglite(db, { migrationsFolder }) };
}

// One connection per process, surviving dev hot reloads.
const g = globalThis as unknown as {
  __toolgradeDb?: { db: Db; ready: Promise<void> };
};

/** Synchronous handle for libraries that need one at construction (Better Auth). Await getDb() before relying on the schema. */
export function dbHandle(): Db {
  g.__toolgradeDb ??= open();
  return g.__toolgradeDb.db;
}

export async function getDb(): Promise<Db> {
  dbHandle();
  const conn = g.__toolgradeDb!;
  try {
    await conn.ready;
  } catch (err) {
    g.__toolgradeDb = undefined;
    throw err;
  }
  return conn.db;
}

export { schema };
