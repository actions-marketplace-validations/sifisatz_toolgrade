import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization as organizationPlugin } from "better-auth/plugins/organization";
import { and, count, eq } from "drizzle-orm";
import { dbHandle, getDb } from "@/db/client";
import {
  account,
  invitation,
  member,
  organization,
  rateLimit,
  session,
  user,
  verification,
} from "@/db/schema";
import { logDebug, logError, logInfo, logWarn } from "@/lib/logger";

const AUTH_LOG_FNS = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
};

/** Every org this user is the sole owner of - deleting their account would leave these orphaned. */
export async function soleOwnerOrgs(userId: string): Promise<string[]> {
  const db = await getDb();
  const owned = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")));
  const orphaned: string[] = [];
  for (const { organizationId } of owned) {
    const [row] = await db
      .select({ owners: count() })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.role, "owner"),
        ),
      );
    if ((row?.owners ?? 0) <= 1) orphaned.push(organizationId);
  }
  return orphaned;
}

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(dbHandle(), {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
        organization,
        member,
        invitation,
        rateLimit,
      },
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // Routes Better Auth's own internal logging through our structured logger (see lib/logger.ts)
    // instead of its default plain console output, so auth errors show up with the same
    // requestId-correlatable JSON shape as everything else.
    logger: {
      log: (level, message, ...args) => {
        AUTH_LOG_FNS[level](message, {
          category: "better-auth",
          ...(args.length > 0 ? { details: args } : {}),
        });
      },
    },
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    // Our tables use uuid keys with database defaults.
    advanced: { database: { generateId: "uuid" } },
    // "database" storage so the limit is shared across serverless instances at no extra
    // infrastructure cost, rather than per-instance "memory" counters that barely slow anyone
    // down on Vercel. `enabled` is left at its own default (production only), so the local dev
    // loop and the test suite - which legitimately calls sign-in/sign-up many times quickly -
    // are never rate-limited by accident.
    rateLimit: {
      storage: "database",
      window: 60,
      max: 20,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        // No email provider exists yet (see README), so deletion is immediate rather than
        // email-confirmed - sendDeleteAccountVerification is intentionally left unset. The real
        // safety net is this check: never silently orphan an organization nobody else owns.
        beforeDelete: async (u) => {
          const orphaned = await soleOwnerOrgs(u.id);
          if (orphaned.length > 0) {
            throw new APIError("BAD_REQUEST", {
              message:
                "Transfer ownership or delete your organization(s) before deleting your account.",
            });
          }
        },
      },
    },
    // nextCookies must stay last: it lets server actions set the session cookie.
    plugins: [organizationPlugin(), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const g = globalThis as unknown as { __toolgradeAuth?: Auth };

/** The auth instance, created once the database (and its migrations) are ready. */
export async function getAuth(): Promise<Auth> {
  await getDb();
  g.__toolgradeAuth ??= createAuth();
  return g.__toolgradeAuth;
}
