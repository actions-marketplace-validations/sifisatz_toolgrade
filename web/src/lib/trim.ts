import type { TrialResult } from "toolgrade/core";

const MAX_OUTPUT = 4_000;
const MAX_ANSWER = 20_000;

const cut = (s: string, max: number) =>
  s.length > max
    ? `${s.slice(0, max)}\n... [${s.length - max} more characters in the stored report]`
    : s;

/**
 * Trials go to the browser as client props for the trial viewer. Long tool outputs are cut so a
 * large report does not turn into a multi-megabyte page; the full report stays in the database.
 */
export function forClient(trials: TrialResult[]): TrialResult[] {
  return trials.map((t) =>
    t.trajectory
      ? {
          ...t,
          trajectory: {
            ...t.trajectory,
            finalText: cut(t.trajectory.finalText, MAX_ANSWER),
            toolCalls: (t.trajectory.toolCalls ?? []).map((c) => ({
              ...c,
              output: cut(c.output, MAX_OUTPUT),
            })),
          },
        }
      : t,
  );
}
