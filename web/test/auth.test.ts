import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Data reads call connection(), which needs a request scope; outside Next it is a no-op here.
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: async () => {},
}));

const { GET: appEntry } = await import("@/app/app/route");
const { getDb } = await import("@/db/client");
const { projects } = await import("@/db/schema");
const { getAuth } = await import("@/lib/auth");
const { getOrg, getProject, listUserOrgs } = await import("@/lib/data");
const { proxy } = await import("@/proxy");

const PASSWORD = "correct-horse-battery";

async function signUp(email: string) {
  const auth = await getAuth();
  const res = await auth.api.signUpEmail({
    body: { name: email.split("@")[0]!, email, password: PASSWORD },
  });
  return res.user;
}

/** A real session cookie, as the browser would hold it after signing in. */
async function sessionCookie(email: string) {
  const auth = await getAuth();
  const res = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

let alice: { id: string };
let bob: { id: string };

beforeAll(async () => {
  const auth = await getAuth();
  alice = await signUp("alice@example.com");
  bob = await signUp("bob@example.com");
  await signUp("newbie@example.com");
  const org = await auth.api.createOrganization({
    body: { name: "Alice Co", slug: "alice-co", userId: alice.id },
  });
  const db = await getDb();
  await db
    .insert(projects)
    .values({ orgId: org!.id, slug: "secret-mcp", name: "Secret MCP" });
});

describe("tenant isolation through membership", () => {
  it("lets a member read their org and project, with their role", async () => {
    expect(await getOrg(alice.id, "alice-co")).toMatchObject({
      slug: "alice-co",
      role: "owner",
    });
    expect(
      (await getProject(alice.id, "alice-co", "secret-mcp"))?.project.name,
    ).toBe("Secret MCP");
    expect((await listUserOrgs(alice.id)).map((o) => o.slug)).toEqual([
      "alice-co",
    ]);
  });

  it("gives a non-member exactly what a missing org gives: nothing", async () => {
    expect(await getOrg(bob.id, "alice-co")).toBeUndefined();
    expect(await getProject(bob.id, "alice-co", "secret-mcp")).toBeUndefined();
    expect(await getOrg(bob.id, "does-not-exist")).toBeUndefined();
    expect(await listUserOrgs(bob.id)).toEqual([]);
  });
});

describe("/app entry", () => {
  const visit = (cookie?: string) =>
    appEntry(
      new Request("http://localhost:3100/app", {
        headers: cookie ? { cookie } : {},
      }),
    );

  it("sends signed-out visitors to sign-in", async () => {
    const res = await visit();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3100/sign-in?next=/app",
    );
  });

  it("sends a member to their workspace and a new user to onboarding", async () => {
    expect(
      (await visit(await sessionCookie("alice@example.com"))).headers.get(
        "location",
      ),
    ).toBe("http://localhost:3100/app/alice-co");
    expect(
      (await visit(await sessionCookie("newbie@example.com"))).headers.get(
        "location",
      ),
    ).toBe("http://localhost:3100/onboarding");
  });

  it("rejects a forged session cookie", async () => {
    const res = await visit("better-auth.session_token=forged.value");
    expect(res.headers.get("location")).toBe(
      "http://localhost:3100/sign-in?next=/app",
    );
  });
});

describe("proxy", () => {
  it("redirects requests without a session cookie to sign-in, keeping the destination", () => {
    const res = proxy(
      new NextRequest("http://localhost:3100/app/alice-co/secret-mcp?tab=runs"),
    );
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/sign-in");
    expect(to.searchParams.get("next")).toBe(
      "/app/alice-co/secret-mcp?tab=runs",
    );
  });

  it("lets requests with a session cookie through to the page, which validates it", async () => {
    const res = proxy(
      new NextRequest("http://localhost:3100/app/alice-co", {
        headers: { cookie: await sessionCookie("alice@example.com") },
      }),
    );
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("passwords", () => {
  it("enforces the 10-character minimum and stores no plaintext", async () => {
    const auth = await getAuth();
    await expect(
      auth.api.signUpEmail({
        body: { name: "x", email: "short@example.com", password: "123456789" },
      }),
    ).rejects.toThrow();
    const db = await getDb();
    const rows = await db.query.account.findMany();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.password).not.toContain(PASSWORD);
  });
});
