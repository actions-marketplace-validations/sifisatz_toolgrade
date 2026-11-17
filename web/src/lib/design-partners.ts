import { z } from "zod";
import type { Db } from "@/db/client";
import { designPartnerApplications } from "@/db/schema";
import { recordEvent } from "@/lib/analytics";

// The public "/design-partners" form has no account behind it - anyone with the URL can submit.
// Validation here is the only thing standing between that form and the database, so it's
// deliberately strict on length (an unbounded text column is an easy place to dump garbage).
export const ApplicationInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(120).optional(),
  mcpServer: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(2000).optional(),
});

export type ApplicationInput = z.infer<typeof ApplicationInput>;

/** Stores the application and records design_partner_applied - input must already be validated. */
export async function submitApplication(
  db: Db,
  input: ApplicationInput,
): Promise<void> {
  await db.insert(designPartnerApplications).values({
    name: input.name,
    email: input.email,
    company: input.company,
    mcpServer: input.mcpServer,
    notes: input.notes,
  });
  await recordEvent(db, {
    name: "design_partner_applied",
    properties: { company: input.company ?? null },
  });
}
