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

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzlePostgres({
      client: postgres(url, { max: 10 }),
      schema,
      casing: "snake_case",
    });
    await migratePostgres(db, { migrationsFolder });
    return db as unknown as Db;
  }
  // Zero-infra local mode: embedded Postgres (WASM), single connection, demo/dev only.
  const dataDir =
    process.env.PGLITE_DIR ?? join(process.cwd(), ".data", "pglite");
  if (dataDir !== "memory://") mkdirSync(dataDir, { recursive: true });
  const db = drizzlePglite({
    client: new PGlite(dataDir),
    schema,
    casing: "snake_case",
  });
  await migratePglite(db, { migrationsFolder });
  return db;
}

// One connection per process, surviving dev hot reloads.
const g = globalThis as unknown as { __toolgradeDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__toolgradeDb ??= open().catch((err) => {
    g.__toolgradeDb = undefined;
    throw err;
  });
  return g.__toolgradeDb;
}

export { schema };
