#!/usr/bin/env node
// Stands in for the real `toolgrade` CLI in test/action-entrypoint.test.ts: records the argv it
// was called with, optionally writes the --markdown file it was asked for, and exits with
// FAKE_EXIT_CODE (default 0) - so the test can check the entrypoint script's argument assembly
// and exit-code/summary handling without a real MCP server, model credentials or npm registry.
import { writeFileSync } from "node:fs";

writeFileSync(process.env.FAKE_CLI_ARGV_FILE, JSON.stringify(process.argv.slice(2)));

const markdownIndex = process.argv.indexOf("--markdown");
if (markdownIndex !== -1) {
  writeFileSync(process.argv[markdownIndex + 1], process.env.FAKE_CLI_MARKDOWN ?? "# fake report\n");
}

process.exit(Number(process.env.FAKE_EXIT_CODE ?? "0"));
