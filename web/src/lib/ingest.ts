import type { RunReport } from "toolgrade/core";
import { z } from "zod";
import type { RunInsert } from "@/db/schema";

const RateSchema = z.object({
  rate: z.number().min(0).max(1),
  low: z.number(),
  high: z.number(),
  n: z.number(),
  passes: z.number(),
});
const DiffSchema = z.object({
  delta: z.number(),
  low: z.number(),
  high: z.number(),
});

/** Validates the fields the platform indexes; the full report is stored as-is. */
const ReportSchema = z
  .object({
    version: z.literal(1),
    suite: z.string().min(1).max(200),
    startedAt: z.string(),
    provider: z.string(),
    agentModel: z.string(),
    judgeModel: z.string(),
    trialsPerTask: z.number().int().min(1),
    tasks: z.array(z.object({ taskId: z.string() }).loose()).min(1),
    overall: z
      .object({
        tools: z
          .object({
            rate: RateSchema,
            trials: z.object({ errors: z.number() }).loose(),
          })
          .loose(),
        baseline: z.object({ rate: RateSchema }).loose().optional(),
        lift: DiffSchema.optional(),
        liftSignificance: z
          .enum(["better", "worse", "not_significant"])
          .optional(),
      })
      .loose(),
    totalCostUsd: z.number().nullable(),
    gate: z.object({ passed: z.boolean() }).loose(),
    trials: z.array(z.unknown()),
  })
  .loose();

export const UploadSchema = z.object({
  report: ReportSchema,
  meta: z
    .object({
      branch: z.string().max(255).optional(),
      commit: z.string().max(64).optional(),
      commitMessage: z.string().max(500).optional(),
    })
    .default({}),
});

export type Upload = z.infer<typeof UploadSchema>;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function toRunRow(
  projectId: string,
  upload: Upload,
  source: "cli" | "demo" = "cli",
): RunInsert {
  const r = upload.report;
  const o = r.overall;
  return {
    projectId,
    source,
    suite: r.suite,
    provider: r.provider,
    agentModel: r.agentModel,
    judgeModel: r.judgeModel,
    trialsPerTask: r.trialsPerTask,
    taskCount: r.tasks.length,
    passRate: o.tools.rate.rate,
    passLow: o.tools.rate.low,
    passHigh: o.tools.rate.high,
    baselineRate: o.baseline?.rate.rate ?? null,
    lift: o.lift?.delta ?? null,
    liftLow: o.lift?.low ?? null,
    liftHigh: o.lift?.high ?? null,
    liftSignificance: o.liftSignificance ?? null,
    gatePassed: r.gate.passed,
    errors: o.tools.trials.errors,
    totalCostUsd: r.totalCostUsd,
    branch: upload.meta.branch ?? null,
    commit: upload.meta.commit ?? null,
    commitMessage: upload.meta.commitMessage ?? null,
    report: r as unknown as RunReport,
  };
}
