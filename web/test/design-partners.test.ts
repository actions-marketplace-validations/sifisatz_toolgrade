import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { designPartnerApplications, productEvents } from "@/db/schema";
import { ApplicationInput, submitApplication } from "@/lib/design-partners";

describe("ApplicationInput", () => {
  it("accepts a minimal valid application", () => {
    const parsed = ApplicationInput.safeParse({
      name: "Dana",
      email: "dana@example.com",
      mcpServer: "A notes server with 5 tools, used by our support team.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const parsed = ApplicationInput.safeParse({
      name: "Dana",
      email: "not-an-email",
      mcpServer: "A notes server.",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty mcpServer description", () => {
    const parsed = ApplicationInput.safeParse({
      name: "Dana",
      email: "dana@example.com",
      mcpServer: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a name longer than 120 characters", () => {
    const parsed = ApplicationInput.safeParse({
      name: "x".repeat(121),
      email: "dana@example.com",
      mcpServer: "A notes server.",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("submitApplication", () => {
  it("stores the application and records design_partner_applied", async () => {
    const db = await getDb();
    const input = ApplicationInput.parse({
      name: "Dana Reyes",
      email: "dana@example.com",
      company: "Acme AI",
      mcpServer: "A notes server with search, create, delete.",
      notes: "Already have a CI pipeline.",
    });
    await submitApplication(db, input);

    const [row] = await db
      .select()
      .from(designPartnerApplications)
      .where(eq(designPartnerApplications.email, "dana@example.com"));
    expect(row).toMatchObject({
      name: "Dana Reyes",
      email: "dana@example.com",
      company: "Acme AI",
      status: "new",
    });

    const events = await db
      .select()
      .from(productEvents)
      .where(eq(productEvents.name, "design_partner_applied"));
    expect(
      events.find((e) => e.properties?.company === "Acme AI"),
    ).toBeDefined();
  });
});
