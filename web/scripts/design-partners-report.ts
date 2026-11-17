// Lists design-partner applications (newest first) for manual triage - see src/app/
// design-partners for the public form and src/db/schema.ts's designPartnerApplications for the
// `status` field this is meant to be read alongside (update it by hand, e.g. via psql, as
// applicants move through "new" -> "contacted" -> "active"/"declined").
import { desc } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { designPartnerApplications } from "../src/db/schema";

async function main() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(designPartnerApplications)
    .orderBy(desc(designPartnerApplications.createdAt));

  console.log(`${rows.length} application(s)\n`);
  for (const r of rows) {
    console.log(
      `[${r.status}] ${r.name} <${r.email}>${r.company ? ` - ${r.company}` : ""}`,
    );
    console.log(`  ${r.createdAt.toISOString()}`);
    console.log(`  ${r.mcpServer.replace(/\n/g, " ")}`);
    if (r.notes) console.log(`  notes: ${r.notes.replace(/\n/g, " ")}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
