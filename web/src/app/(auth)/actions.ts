"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { DEMO_CREDENTIALS_FILE, DEMO_EMAIL, DEMO_ORG_SLUG } from "@/lib/demo";

/** Demo password: DEMO_PASSWORD in hosted environments, else the one `pnpm seed` generated. */
async function demoPassword(): Promise<string | undefined> {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  try {
    const creds = JSON.parse(
      await readFile(join(process.cwd(), DEMO_CREDENTIALS_FILE), "utf8"),
    ) as { password?: string };
    return creds.password;
  } catch {
    return undefined;
  }
}

/** One click into the seeded demo workspace: a real sign-in as the demo user, done server-side. */
export async function signInAsDemo(): Promise<{ error: string }> {
  const password = await demoPassword();
  if (!password)
    return {
      error: "The demo workspace is not set up here. Run `pnpm seed` in web/.",
    };
  const auth = await getAuth();
  try {
    await auth.api.signInEmail({
      body: { email: DEMO_EMAIL, password },
      headers: await headers(),
    });
  } catch {
    return {
      error:
        "Demo sign-in failed. Re-run `pnpm seed` to reset the demo account.",
    };
  }
  redirect(`/app/${DEMO_ORG_SLUG}`);
}
