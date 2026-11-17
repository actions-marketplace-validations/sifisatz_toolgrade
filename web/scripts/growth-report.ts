// Prints the activation/monetization funnel from the product_events table (see
// src/lib/analytics.ts): how many orgs signed up, how many went on to create an API key, ship a
// run, or start a checkout, over a given window. Run manually against DATABASE_URL - there is no
// hosted dashboard for this on purpose (see the Phase 8 decision to avoid a third-party vendor).
import { gte } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { productEvents } from "../src/db/schema";
import type { ProductEventName } from "../src/lib/analytics";

const FUNNEL: ProductEventName[] = [
  "org_created",
  "project_created",
  "api_key_created",
  "run_ingested",
  "checkout_started",
  "subscription_started",
];

function parseDays(): number {
  const arg = process.argv[2];
  const days = arg ? Number(arg) : 30;
  if (!Number.isFinite(days) || days <= 0)
    throw new Error("usage: tsx scripts/growth-report.ts [days]");
  return days;
}

async function main() {
  const days = parseDays();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = await getDb();
  const rows = await db
    .select()
    .from(productEvents)
    .where(gte(productEvents.createdAt, since));

  console.log(`Product events in the last ${days} day(s): ${rows.length}\n`);
  console.log("Event                    Count  Distinct orgs");
  for (const name of FUNNEL) {
    const matching = rows.filter((r) => r.name === name);
    const orgs = new Set(
      matching.map((r) => r.organizationId).filter((id) => id !== null),
    );
    console.log(
      `${name.padEnd(24)} ${String(matching.length).padStart(5)}  ${String(orgs.size).padStart(5)}`,
    );
  }

  const funnelSet = new Set<string>(FUNNEL);
  const otherNames = new Set(rows.map((r) => r.name).filter((n) => !funnelSet.has(n)));
  for (const name of otherNames) {
    const count = rows.filter((r) => r.name === name).length;
    console.log(`${name.padEnd(24)} ${String(count).padStart(5)}  (unlisted)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
