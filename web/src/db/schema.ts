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
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const id = () => uuid().primaryKey().defaultRandom();

// --- Better Auth (core + organization plugin). Keys are the camelCase field names Better Auth
// uses; the snake_case casing maps them to columns. Ids are uuid (advanced.database.generateId).

export const user = pgTable("user", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: id(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable("verification", {
  id: id(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** The tenant. Every project, key and run hangs off an organization. */
export const organization = pgTable("organization", {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: createdAt(),
});

export const member = pgTable(
  "member",
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.organizationId, t.userId), index().on(t.userId)],
);

export const invitation = pgTable("invitation", {
  id: id(),
  organizationId: uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text().notNull(),
  role: text(),
  status: text().notNull().default("pending"),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  inviterId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

// --- ToolGrade

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
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

export type Org = typeof organization.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunInsert = typeof runs.$inferInsert;
