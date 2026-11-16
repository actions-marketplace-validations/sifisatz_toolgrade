"use client";

import { CircleAlert, Play } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import {
  useCountUp,
  useInViewOnce,
  usePrefersReducedMotion,
} from "./primitives";

// A real run: qwen3:8b via Ollama on examples/notes-suite.yaml, 3 trials per task per arm,
// 2026-11-16. Per-task pass counts below are copied from that run's report.
const TASKS = [
  { id: "find-owner", tools: 3, baseline: 0 },
  { id: "incident-root-cause", tools: 0, baseline: 0 },
  { id: "create-note", tools: 3, baseline: 0 },
  { id: "delete-note", tools: 3, baseline: 0 },
  { id: "no-tool-needed", tools: 3, baseline: 3 },
  { id: "summarize-plan", tools: 2, baseline: 0 },
] as const;
const TRIALS = 3;

type Tick = { arm: "tools" | "baseline"; passed: boolean };
const TICKS: Tick[] = TASKS.flatMap((t) => [
  ...Array.from({ length: TRIALS }, (_, i) => ({
    arm: "tools" as const,
    passed: i < t.tools,
  })),
  ...Array.from({ length: TRIALS }, (_, i) => ({
    arm: "baseline" as const,
    passed: i < t.baseline,
  })),
]);
const STEP_MS = 70;

export function HeroReplay() {
  const [ref, inView] = useInViewOnce<HTMLDivElement>("0px");
  const reduced = usePrefersReducedMotion();
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` is the replay trigger
  useEffect(() => {
    if (!inView || reduced) {
      setDone(true);
      return;
    }
    setDone(false);
    const t = setTimeout(() => setDone(true), TICKS.length * STEP_MS + 400);
    return () => clearTimeout(t);
  }, [inView, reduced, run]);

  const pass = useCountUp(78, done, 1100);
  const base = useCountUp(17, done, 1100);
  const lift = useCountUp(61, done, 1100);
  const pending = inView && !done;

  return (
    <div ref={ref} className="relative">
      <div
        className="absolute -inset-px rounded-2xl bg-gradient-to-b from-foreground/15 to-transparent"
        aria-hidden
      />
      <div className="relative rounded-2xl border bg-card/90 p-5 shadow-2xl shadow-chart-1/10 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">
              notes-server - replay of a real run
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              qwen3:8b via Ollama - 6 tasks x 2 arms x 3 trials
            </div>
          </div>
          {pending ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-chart-1 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-chart-1" />
              </span>
              Running
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-status-critical/30 bg-status-critical/10 px-2 py-0.5 text-xs font-medium">
              <CircleAlert
                className="size-3.5 text-status-critical"
                aria-hidden
              />{" "}
              Gate failed
            </span>
          )}
        </div>

        <div
          className="mt-4 grid grid-cols-12 gap-1"
          role="img"
          aria-label="36 trials: 14 of 18 passed with tools, 3 of 18 without tools"
        >
          {TICKS.map((t, i) => (
            <m.span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length replay; position is the identity
              key={`${run}-${i}`}
              initial={inView && !reduced ? { opacity: 0, scale: 0.4 } : false}
              animate={inView ? { opacity: 1, scale: 1 } : undefined}
              transition={{
                delay: (i * STEP_MS) / 1000,
                type: "spring",
                stiffness: 420,
                damping: 24,
              }}
              className="aspect-square rounded-[4px] border-2"
              style={{
                borderColor:
                  t.arm === "tools" ? "var(--chart-1)" : "var(--chart-2)",
                background: t.passed
                  ? t.arm === "tools"
                    ? "var(--chart-1)"
                    : "var(--chart-2)"
                  : "transparent",
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Key color="var(--chart-1)" filled label="pass with tools" />
          <Key color="var(--chart-2)" filled label="pass, no tools" />
          <Key color="var(--muted-foreground)" label="hollow = failed" />
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-4 border-t pt-4">
          <Stat
            label="With tools"
            value={`${Math.round(pass)}%`}
            sub="CI 39-95%"
          />
          <Stat
            label="No tools"
            value={`${Math.round(base)}%`}
            sub="baseline"
          />
          <Stat
            label="Lift"
            value={`+${Math.round(lift)}pp`}
            sub="CI +5..+83pp"
          />
        </dl>

        <ul
          className={`mt-4 space-y-2 transition-opacity duration-500 ${pending ? "opacity-30" : "opacity-100"}`}
        >
          {TASKS.map((t, i) => (
            <li
              key={t.id}
              className="grid grid-cols-[8.75rem_1fr_2.25rem] items-center gap-3 text-xs"
            >
              <span className="truncate font-mono text-muted-foreground">
                {t.id}
              </span>
              <Track
                tools={t.tools / TRIALS}
                baseline={t.baseline / TRIALS}
                play={done && inView && !reduced}
                delay={i * 0.08}
                replay={`${run}-${done}`}
              />
              <span className="text-right tabular-nums">
                {Math.round((t.tools / TRIALS) * 100)}%
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>78% is below the 80% gate</span>
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
          >
            <Play className="size-3" aria-hidden /> Replay
          </button>
        </div>
      </div>
    </div>
  );
}

function Key({
  color,
  label,
  filled,
}: {
  color: string;
  label: string;
  filled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-[3px] border-2"
        style={{
          borderColor: color,
          background: filled ? color : "transparent",
        }}
      />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
      <dd className="text-xs text-muted-foreground">{sub}</dd>
    </div>
  );
}

/** Baseline -> with-tools on a 0-100% track; the tools marker slides out from the baseline. */
function Track({
  tools,
  baseline,
  play,
  delay,
  replay,
}: {
  tools: number;
  baseline: number;
  play: boolean;
  delay: number;
  replay: string;
}) {
  const span = Math.abs(tools - baseline);
  const lo = Math.min(tools, baseline);
  return (
    <div className="relative h-4">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <m.div
        key={`bar-${replay}`}
        className="absolute top-1/2 h-0.5 origin-left -translate-y-1/2 rounded-full bg-muted-foreground/40"
        style={{ left: `${lo * 100}%`, width: `${span * 100}%` }}
        initial={play ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{
          delay: delay + 0.15,
          duration: 0.7,
          ease: [0.2, 0.7, 0.2, 1],
        }}
      />
      <div
        className="absolute inset-0"
        style={{ transform: `translateX(${baseline * 100}%)` }}
      >
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{ background: "var(--chart-2)" }}
        />
      </div>
      <m.div
        key={`dot-${replay}`}
        className="absolute inset-0"
        initial={play ? { x: `${baseline * 100}%` } : false}
        animate={{ x: `${tools * 100}%` }}
        transition={{
          delay: delay + 0.15,
          duration: 0.7,
          ease: [0.2, 0.7, 0.2, 1],
        }}
      >
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{ background: "var(--chart-1)" }}
        />
      </m.div>
    </div>
  );
}
