"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useInViewOnce, usePrefersReducedMotion } from "./primitives";

const COMMAND =
  "npx toolgrade run evals/notes-suite.yaml --provider openai --model qwen3:8b";

type Line = { text: string; tone?: "dim" | "good" | "bad" | "strong" };

// Output of the real run on 2026-11-16 (trimmed: cost and failure lines omitted).
const OUTPUT: Line[] = [
  // Per-trial marks in completion order ('.' pass, 'x' fail), as the CLI streamed them.
  { text: "36/36 trials ..x.xxxxxxxx..x.xx..xx.x........xxxx", tone: "dim" },
  { text: "" },
  { text: "task                 with tools  baseline    lift", tone: "strong" },
  { text: "find-owner           100% (3/3)  0% (0/3)    +100pp" },
  { text: "incident-root-cause  0% (0/3)    0% (0/3)    +0pp", tone: "bad" },
  { text: "create-note          100% (3/3)  0% (0/3)    +100pp" },
  { text: "delete-note          100% (3/3)  0% (0/3)    +100pp" },
  { text: "no-tool-needed       100% (3/3)  100% (3/3)  +0pp" },
  { text: "summarize-plan       67% (2/3)   0% (0/3)    +67pp" },
  { text: "" },
  { text: "Pass rate (tools)  78% over 6 tasks   95% CI 39%-95%" },
  {
    text: "Lift               +61pp  95% CI +5pp..+83pp  significant",
    tone: "good",
  },
  { text: "" },
  { text: "PASS no_errors: 0 trial(s) errored", tone: "good" },
  { text: "FAIL min_pass_rate: pass rate 78% vs required 80%", tone: "bad" },
  { text: "PASS min_lift: lift +61pp vs required +30pp", tone: "good" },
  { text: "Gate failed  (exit code 1)", tone: "bad" },
];

const TONE: Record<NonNullable<Line["tone"]>, string> = {
  dim: "text-zinc-500",
  good: "text-emerald-400",
  bad: "text-red-400",
  strong: "text-zinc-100 font-semibold",
};

export function TerminalDemo() {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const [typed, setTyped] = useState(COMMAND.length);
  const [shown, setShown] = useState(OUTPUT.length);
  const [run, setRun] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` is the replay trigger
  useEffect(() => {
    if (!inView || reduced) {
      setTyped(COMMAND.length);
      setShown(OUTPUT.length);
      return;
    }
    setTyped(0);
    setShown(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= COMMAND.length; i++)
      timers.push(setTimeout(() => setTyped(i), 300 + i * 28));
    const outStart = 300 + COMMAND.length * 28 + 500;
    for (let j = 1; j <= OUTPUT.length; j++)
      timers.push(setTimeout(() => setShown(j), outStart + j * 110));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced, run]);

  const typing = typed < COMMAND.length;
  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20"
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
        <span className="size-3 rounded-full bg-zinc-700" />
        <span className="size-3 rounded-full bg-zinc-700" />
        <span className="size-3 rounded-full bg-zinc-700" />
        <span className="ml-2 font-mono text-xs text-zinc-500">
          ~/notes-mcp - real output, qwen3:8b on a laptop
        </span>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <RotateCcw className="size-3" aria-hidden /> replay
        </button>
      </div>
      <pre className="h-[25rem] overflow-hidden p-4 font-mono text-[12.5px] leading-relaxed text-zinc-300">
        <span className="text-emerald-400">$ </span>
        {COMMAND.slice(0, typed)}
        {typing && (
          <span className="caret ml-px inline-block h-4 w-2 translate-y-0.5 bg-zinc-300" />
        )}
        {"\n"}
        {OUTPUT.slice(0, shown).map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed transcript; line order is the identity
          <span key={i} className={`block ${l.tone ? TONE[l.tone] : ""}`}>
            {l.text || " "}
          </span>
        ))}
        {!typing && shown === OUTPUT.length && (
          <span className="block">
            <span className="text-emerald-400">$ </span>
            <span className="caret inline-block h-4 w-2 translate-y-0.5 bg-zinc-300" />
          </span>
        )}
      </pre>
    </div>
  );
}
