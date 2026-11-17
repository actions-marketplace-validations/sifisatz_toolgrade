import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const ENTRYPOINT = join(import.meta.dirname, "..", "action", "entrypoint.sh");
const FAKE_CLI = join(import.meta.dirname, "fixtures", "fake-toolgrade-cli.mjs");

// Exercises action.yml's actual shell logic (shared via $GITHUB_ACTION_PATH/action/entrypoint.sh)
// against a fake CLI instead of the real, unpublished npm package - this is the only part of the
// GitHub Action that can be covered without hitting the npm registry, a real MCP server or a
// GitHub Actions runner.
describe("action/entrypoint.sh", () => {
  let dir: string;
  let argvFile: string;
  let summaryFile: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "toolgrade-action-"));
    argvFile = join(dir, "argv.json");
    summaryFile = join(dir, "summary.txt");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function invoke(overrides: Record<string, string | undefined>) {
    // Built as a plain object (not spread into execFile's options) so an explicit `undefined`
    // override can delete a default key entirely, e.g. to simulate GITHUB_STEP_SUMMARY being unset
    // - spreading would instead pass the literal string "undefined" to the subprocess.
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "",
      TOOLGRADE_ACTION_BIN: `node ${FAKE_CLI}`,
      FAKE_CLI_ARGV_FILE: argvFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      TG_SUITE: "suite.yaml",
      TG_VERSION: "latest",
    };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
    try {
      const { stdout, stderr } = await run("bash", [ENTRYPOINT], { cwd: dir, env });
      return { code: 0, stdout, stderr };
    } catch (err) {
      const e = err as { code: number; stdout: string; stderr: string };
      return { code: e.code, stdout: e.stdout, stderr: e.stderr };
    }
  }

  async function argv(): Promise<string[]> {
    return JSON.parse(await readFile(argvFile, "utf8"));
  }

  it("always passes the suite and a markdown path", async () => {
    await invoke({});
    expect(await argv()).toEqual(["run", "suite.yaml", "--markdown", ".toolgrade/summary.md"]);
  });

  it("maps every optional input to its CLI flag only when given", async () => {
    await invoke({
      TG_TRIALS: "5",
      TG_CONCURRENCY: "2",
      TG_FILTER: "my-tag",
      TG_NO_BASELINE: "true",
      TG_BASELINE: "https://app.toolgrade.dev",
      TG_BASELINE_BRANCH: "main",
      TG_MODEL: "claude-opus-5",
      TG_JUDGE_MODEL: "claude-sonnet-5",
      TG_PROVIDER: "openai",
      TG_BASE_URL: "http://localhost:11434/v1",
      TG_API_KEY_ENV: "MY_KEY",
      TG_LOCAL_MODEL: "true",
      TG_UPLOAD_URL: "https://app.toolgrade.dev",
    });
    expect(await argv()).toEqual([
      "run",
      "suite.yaml",
      "--markdown",
      ".toolgrade/summary.md",
      "--trials",
      "5",
      "--concurrency",
      "2",
      "--filter",
      "my-tag",
      "--no-baseline",
      "--baseline",
      "https://app.toolgrade.dev",
      "--baseline-branch",
      "main",
      "--model",
      "claude-opus-5",
      "--judge-model",
      "claude-sonnet-5",
      "--provider",
      "openai",
      "--base-url",
      "http://localhost:11434/v1",
      "--api-key-env",
      "MY_KEY",
      "--local-model",
      "--upload",
      "https://app.toolgrade.dev",
    ]);
  });

  it("passes --compare alone when only that input is given", async () => {
    await invoke({ TG_COMPARE: "previous.json" });
    expect(await argv()).toEqual(["run", "suite.yaml", "--markdown", ".toolgrade/summary.md", "--compare", "previous.json"]);
  });

  it("exports TOOLGRADE_API_KEY from the toolgrade-api-key input without failing", async () => {
    // The fake CLI doesn't read env vars, so this only asserts entrypoint.sh's own export succeeds
    // under `set -u` - --compare vs --baseline mutual exclusivity is the real CLI's job, not the
    // shell script's (see cli.ts).
    await invoke({ TG_API_KEY_INPUT: "tg_from_input" });
    expect(await argv()).toEqual(["run", "suite.yaml", "--markdown", ".toolgrade/summary.md"]);
  });

  it("propagates the CLI's exit code", async () => {
    const ok = await invoke({ FAKE_EXIT_CODE: "0" });
    expect(ok.code).toBe(0);
    const failed = await invoke({ FAKE_EXIT_CODE: "1" });
    expect(failed.code).toBe(1);
  });

  it("appends the markdown summary to GITHUB_STEP_SUMMARY", async () => {
    await invoke({ FAKE_CLI_MARKDOWN: "# hello from the run\n" });
    expect(await readFile(summaryFile, "utf8")).toBe("# hello from the run\n");
  });

  it("does not fail when GITHUB_STEP_SUMMARY is unset (e.g. a local run)", async () => {
    const result = await invoke({ GITHUB_STEP_SUMMARY: undefined });
    expect(result.code).toBe(0);
  });
});
