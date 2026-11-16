import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RunReport } from "./runner.js";

const run = promisify(execFile);

export interface RunMeta {
  branch?: string;
  commit?: string;
  commitMessage?: string;
}

export interface UploadResult {
  id: string;
  url: string;
}

/** CI env first (GitHub Actions), then the local git checkout; both optional. */
export async function detectGitMeta(cwd = process.cwd()): Promise<RunMeta> {
  const env = process.env;
  const branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || (await git(cwd, "rev-parse", "--abbrev-ref", "HEAD"));
  const commit = env.GITHUB_SHA || (await git(cwd, "rev-parse", "HEAD"));
  return { ...(branch ? { branch } : {}), ...(commit ? { commit } : {}) };
}

async function git(cwd: string, ...args: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await run("git", args, { cwd, timeout: 5000 });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function uploadReport(baseUrl: string, apiKey: string, report: RunReport, meta: RunMeta, fetchFn: typeof fetch = fetch): Promise<UploadResult> {
  const res = await fetchFn(`${baseUrl.replace(/\/+$/, "")}/api/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ report, meta }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as UploadResult;
}
