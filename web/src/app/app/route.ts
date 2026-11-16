import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { member, organization } from "@/db/schema";
import { getAuth } from "@/lib/auth";

/** /app: the user's first workspace, onboarding if they have none, sign-in if signed out. */
export async function GET(request: Request) {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: request.headers });
  const to = (path: string) =>
    Response.redirect(new URL(path, request.url), 307);
  if (!s) return to("/sign-in?next=/app");
  const db = await getDb();
  const [first] = await db
    .select({ slug: organization.slug })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, s.user.id))
    .orderBy(asc(member.createdAt))
    .limit(1);
  return to(first ? `/app/${first.slug}` : "/onboarding");
}
