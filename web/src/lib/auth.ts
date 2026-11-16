import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization as organizationPlugin } from "better-auth/plugins/organization";
import { dbHandle, getDb } from "@/db/client";
import {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
} from "@/db/schema";

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
      },
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    // Our tables use uuid keys with database defaults.
    advanced: { database: { generateId: "uuid" } },
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
