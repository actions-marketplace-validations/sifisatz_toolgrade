// Seeds the demo workspace. Every demo run is produced by the real ToolGrade engine against the
// real example MCP server; only the model is simulated (a scripted agent with a per-commit
// failure rate), so the numbers, intervals and gates are genuine engine output.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { loadSuite, runSuite, type Script, ScriptedProvider } from "toolgrade";
import { notesAgent } from "../../examples/scripted-agent";
import { getDb } from "../src/db/client";
import { apiKeys, organization, projects, runs, user } from "../src/db/schema";
import { generateApiKey } from "../src/lib/api-keys";
import { getAuth } from "../src/lib/auth";
import {
  DEMO_CREDENTIALS_FILE,
  DEMO_EMAIL,
  DEMO_ORG_SLUG,
} from "../src/lib/demo";
import { toRunRow, UploadSchema } from "../src/lib/ingest";

const SUITE = join(
  import.meta.dirname,
  "..",
  "..",
  "examples",
  "notes-suite.yaml",
);
const DAY = 24 * 60 * 60 * 1000;

const HISTORY: Array<{
  message: string;
  failRate: number;
  vague?: boolean;
  branch?: string;
}> = [
  { message: "Initial notes MCP server", failRate: 0.4 },
  { message: "Add get_note tool", failRate: 0.33 },
  { message: "Return owner in search results", failRate: 0.27 },
  { message: "Document search query syntax", failRate: 0.2 },
  { message: "Add list_tags for topic discovery", failRate: 0.17 },
  {
    message: "Clarify that delete_note needs an id from search",
    failRate: 0.13,
  },
  { message: "Paginate search results", failRate: 0.13 },
  {
    message: "Shorten tool descriptions to save tokens",
    failRate: 0.07,
    vague: true,
    branch: "feat/terse-descriptions",
  },
  { message: "Revert terse tool descriptions", failRate: 0.1 },
  { message: "Add examples to search_notes description", failRate: 0.07 },
  { message: "Case-insensitive tag filter", failRate: 0.07 },
  { message: "Clearer error for unknown note ids", failRate: 0.03 },
];

/** Deterministic PRNG (mulberry32) so a re-seed tells the same story. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulatedAgent(failRate: number, random: () => number): Script {
  return (req) => {
    const turns = req.messages.length;
    const usage = req.jsonSchema
      ? {
          inputTokens: 900 + Math.round(random() * 300),
          outputTokens: 60 + Math.round(random() * 40),
        }
      : {
          inputTokens: 1100 + 450 * (turns - 1) + (req.tools.length ? 620 : 0),
          outputTokens: 80 + Math.round(random() * 90),
        };
    // The simulated failure: the agent gives up on its first tool-enabled turn.
    if (
      !req.jsonSchema &&
      req.tools.length > 0 &&
      turns === 1 &&
      random() < failRate
    ) {
      return { text: "I couldn't find anything relevant in the notes.", usage };
    }
    return { ...notesAgent(req), usage };
  };
}

/** Local dev needs an auth secret; create .env.local once (git-ignored) and load it here. */
function ensureLocalEnv() {
  const file = join(process.cwd(), ".env.local");
  const env = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = env.split("\n").filter(Boolean);
  if (!/^BETTER_AUTH_SECRET=/m.test(env))
    lines.push(`BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
  if (!/^BETTER_AUTH_URL=/m.test(env))
    lines.push("BETTER_AUTH_URL=http://localhost:3100");
  writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k && !process.env[k]) process.env[k] = v.join("=");
  }
}

async function main() {
  ensureLocalEnv();
  const db = await getDb();
  const auth = await getAuth();

  // Reset only the demo user and the demo org (everything else cascades from them).
  await db.delete(user).where(eq(user.email, DEMO_EMAIL));
  await db.delete(organization).where(eq(organization.slug, DEMO_ORG_SLUG));

  const password =
    process.env.DEMO_PASSWORD ?? randomBytes(18).toString("base64url");
  const signUp = await auth.api.signUpEmail({
    body: { name: "Demo user", email: DEMO_EMAIL, password },
  });
  const org = await auth.api.createOrganization({
    body: { name: "Acme AI", slug: DEMO_ORG_SLUG, userId: signUp.user.id },
  });
  if (!org) throw new Error("could not create the demo organization");
  const [notes, local] = await db
    .insert(projects)
    .values([
      {
        orgId: org.id,
        slug: "notes-mcp",
        name: "Notes MCP server",
        description: "Team notes over MCP: search, read, create, delete.",
        repo: "acme/notes-mcp",
      },
      {
        orgId: org.id,
        slug: "notes-mcp-local",
        name: "Notes MCP - local model",
        description:
          "Same suite, graded with an open-weights model on a laptop.",
        repo: "acme/notes-mcp",
      },
    ])
    .returning();

  const start = Date.now() - HISTORY.length * 1.6 * DAY;
  for (const [i, step] of HISTORY.entries()) {
    const suite = await loadSuite(SUITE);
    if ("command" in suite.server)
      suite.server.env.NOTES_SERVER_VAGUE = step.vague ? "1" : "0";
    const report = await runSuite(suite, {
      provider: new ScriptedProvider(
        simulatedAgent(step.failRate, rng(1000 + i)),
      ),
      trials: 3,
      concurrency: 6,
    });
    const upload = UploadSchema.parse({
      report,
      meta: {
        branch: step.branch ?? "main",
        commit: randomBytes(20).toString("hex"),
        commitMessage: step.message,
      },
    });
    const createdAt = new Date(
      start + i * 1.6 * DAY + Math.round(rng(i)() * 6 * 3600 * 1000),
    );
    await db
      .insert(runs)
      .values({ ...toRunRow(notes!.id, upload, "demo"), createdAt });
    console.log(
      `${String(i + 1).padStart(2)}/${HISTORY.length} ${step.message.padEnd(48)} pass ${Math.round(report.overall.tools.rate.rate * 100)}%  gate ${report.gate.passed ? "pass" : "FAIL"}`,
    );
  }

  const keys = [notes!, local!].map((p) => ({
    project: p,
    ...generateApiKey(),
  }));
  await db.insert(apiKeys).values(
    keys.map((k) => ({
      projectId: k.project.id,
      name: "demo CI key",
      prefix: k.prefix,
      hash: k.hash,
    })),
  );
  const dir = join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "demo-api-keys.txt"),
    `${keys.map((k) => `${k.project.slug}=${k.key}`).join("\n")}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    join(process.cwd(), DEMO_CREDENTIALS_FILE),
    JSON.stringify({ email: DEMO_EMAIL, password }),
    { mode: 0o600 },
  );
  console.log(
    `\nSeeded org "${DEMO_ORG_SLUG}" with ${HISTORY.length} demo runs, owned by ${DEMO_EMAIL}.` +
      `\nDemo credentials: ${DEMO_CREDENTIALS_FILE}; API keys: .data/demo-api-keys.txt (both mode 600, git-ignored).`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
