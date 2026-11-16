import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "@/lib/auth";

/** The signed-in user's session for this request, or null. Validated against the database. */
export const getSession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});

/** The signed-in user; redirects to sign-in when there is none. */
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  return s.user;
}

export const MANAGE_ROLES = new Set(["owner", "admin"]);
