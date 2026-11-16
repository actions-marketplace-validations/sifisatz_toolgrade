import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RunReport } from "toolgrade/core";

const createdAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow();

export const orgs = pgTable("orgs", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: createdAt(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: uuid()
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    repo: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.orgId, t.slug)],
);

export const apiKeys = pgTable("api_keys", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text().notNull(),
  /** First characters of the key, safe to display; the key itself is never stored. */
  prefix: text().notNull(),
  hash: text().notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    /** "cli" for uploaded runs, "demo" for seeded runs from the simulated agent. */
    source: text().notNull().default("cli"),
    suite: text().notNull(),
    provider: text().notNull(),
    agentModel: text().notNull(),
    judgeModel: text().notNull(),
    trialsPerTask: integer().notNull(),
    taskCount: integer().notNull(),
    passRate: doublePrecision().notNull(),
    passLow: doublePrecision().notNull(),
    passHigh: doublePrecision().notNull(),
    baselineRate: doublePrecision(),
    lift: doublePrecision(),
    liftLow: doublePrecision(),
    liftHigh: doublePrecision(),
    liftSignificance: text(),
    gatePassed: boolean().notNull(),
    errors: integer().notNull().default(0),
    totalCostUsd: numeric({ precision: 14, scale: 6, mode: "number" }),
    branch: text(),
    commit: text(),
    commitMessage: text(),
    report: jsonb().$type<RunReport>().notNull(),
  },
  (t) => [index().on(t.projectId, t.createdAt)],
);

export type Org = typeof orgs.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunInsert = typeof runs.$inferInsert;
