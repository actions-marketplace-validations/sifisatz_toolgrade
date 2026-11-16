import {
  CircleAlert,
  CircleCheck,
  Coins,
  Cpu,
  GitCompareArrows,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { wilson } from "toolgrade/core";
import { InView, Spotlight } from "./primitives";
import { SectionHeading } from "./section-heading";

// Pass rates of the 12 runs in the live demo workspace at toolgrade.vercel.app (engine output,
// simulated agent; seeded 2026-11-16), oldest first. Run 8 is the "shorten tool descriptions"
// commit that ToolGrade flagged as a regression.
const DEMO_HISTORY = [
  0.56, 0.83, 0.61, 0.78, 0.89, 0.83, 0.83, 0.28, 0.78, 0.89, 0.94, 0.94,
];
const TASKS = 6;

function Card({
  icon,
  title,
  text,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Spotlight
      className={`reveal rounded-2xl border bg-card ${className ?? ""}`}
    >
      <div className="flex h-full flex-col p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
        <InView className="mt-6 flex-1">{children}</InView>
      </div>
    </Spotlight>
  );
}

export function Bento() {
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <SectionHeading
        eyebrow="Product"
        title="Evidence, not demos"
        text="Everything a team needs to ship tool changes on data instead of vibes."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <Card
          className="md:col-span-4"
          icon={<TrendingUp className="size-4 text-chart-1" aria-hidden />}
          title="Lift with confidence intervals"
          text="Pass rate per run with its 95% band. The dip is a real catch: shorter tool descriptions, flagged before merge."
        >
          <TrendVisual />
        </Card>
        <Card
          className="md:col-span-2"
          icon={<ShieldCheck className="size-4 text-chart-1" aria-hidden />}
          title="Outcome checks"
          text="Assertions query your server after the run - not what the agent claims."
        >
          <ul className="space-y-2 text-xs">
            {[
              { ok: true, text: "tool_called create_note x1" },
              { ok: true, text: "state: 'Offsite agenda' exists" },
              { ok: false, text: "said 'Deleted.' - note still there" },
            ].map((a, i) => (
              <li
                key={a.text}
                className="seq flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2"
                style={{ "--i": i } as React.CSSProperties}
              >
                {a.ok ? (
                  <CircleCheck
                    className="size-3.5 shrink-0 text-status-good"
                    aria-label="passed"
                  />
                ) : (
                  <CircleAlert
                    className="size-3.5 shrink-0 text-status-critical"
                    aria-label="failed"
                  />
                )}
                <span className="truncate font-mono">{a.text}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          className="md:col-span-2"
          icon={
            <GitCompareArrows className="size-4 text-chart-1" aria-hidden />
          }
          title="Regression compare"
          text="Any two runs, task by task, Bonferroni-corrected."
        >
          <RegressionVisual />
        </Card>
        <Card
          className="md:col-span-2"
          icon={<Workflow className="size-4 text-chart-1" aria-hidden />}
          title="Trajectory viewer"
          text="Every tool call, its arguments and result, per trial."
        >
          <ol className="space-y-1.5 font-mono text-[11px]">
            {[
              ["search_notes", '{"query":"q3 planning"}', "n1 | Q3 planning"],
              ["get_note", '{"id":"n1"}', "hire two engineers..."],
            ].map(([name, args, out], i) => (
              <li
                key={name}
                className="seq rounded-lg border bg-background"
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="truncate px-2.5 py-1.5">
                  <span className="text-muted-foreground">{i + 1}.</span>{" "}
                  <span className="font-semibold">{name}</span>
                  <span className="text-muted-foreground">({args})</span>
                </div>
                <div className="truncate border-t px-2.5 py-1 text-muted-foreground">
                  {"->"} {out}
                </div>
              </li>
            ))}
            <li
              className="seq px-1 pt-1 text-muted-foreground"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              answer: &quot;The owner is Dana Reyes.&quot;
            </li>
          </ol>
        </Card>
        <Card
          className="md:col-span-2"
          icon={<Coins className="size-4 text-chart-1" aria-hidden />}
          title="Cost per run"
          text="Tokens and dollars per arm, plus what your tool schemas cost on every request."
        >
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["schema tokens", "~408"],
              ["tools in surface", "5"],
              ["trials", "36"],
              ["local model", "$0"],
            ].map(([k, v], i) => (
              <div
                key={k}
                className="seq rounded-lg border bg-background p-2.5"
                style={{ "--i": i } as React.CSSProperties}
              >
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card
          className="md:col-span-6 lg:col-span-6"
          icon={<Cpu className="size-4 text-chart-1" aria-hidden />}
          title="Any model, any CI"
          text="Grade with the model your users run - or a free local one before you spend a cent."
        >
          <div className="flex flex-wrap gap-2">
            {[
              "Claude (Anthropic API)",
              "OpenAI-compatible APIs",
              "Ollama, local models",
              "GitHub Actions",
              "MCP over stdio",
              "MCP over Streamable HTTP",
              "Postgres",
              "Any CI with Node 20+",
            ].map((c, i) => (
              <span
                key={c}
                className="seq rounded-full border bg-background px-3 py-1 text-xs"
                style={{ "--i": i } as React.CSSProperties}
              >
                {c}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function TrendVisual() {
  const w = 560;
  const h = 150;
  const pad = 6;
  const x = (i: number) =>
    pad + (i / (DEMO_HISTORY.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - v) * (h - 2 * pad);
  const line = DEMO_HISTORY.map(
    (v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`,
  ).join(" ");
  // The band is the engine's own suite-level interval: Wilson at n = 6 tasks.
  const ci = DEMO_HISTORY.map((v) => wilson(v * TASKS, TASKS));
  const hi = ci.map((c, i) => `${i ? "L" : "M"}${x(i)},${y(c.high)}`).join(" ");
  const lo = [...ci]
    .reverse()
    .map((c, i) => `L${x(ci.length - 1 - i)},${y(c.low)}`)
    .join(" ");
  const dip = 7;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full overflow-visible"
        role="img"
        aria-label="Pass rate over 12 demo runs, dipping to 28% on run 8 and recovering to 94%"
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0}
            x2={w}
            y1={y(t)}
            y2={y(t)}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        <path
          d={`${hi} ${lo} Z`}
          className="fade"
          fill="var(--chart-1)"
          fillOpacity={0.12}
        />
        <path
          d={line}
          pathLength={1}
          className="draw"
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(dip)}
          cy={y(DEMO_HISTORY[dip]!)}
          r={5}
          className="fade"
          fill="var(--status-critical)"
          stroke="var(--card)"
          strokeWidth={2}
        />
      </svg>
      <div
        className="fade absolute text-[11px] font-medium"
        style={{
          left: `${(x(dip) / w) * 100}%`,
          top: `${(y(DEMO_HISTORY[dip]!) / h) * 100}%`,
          transform: "translate(-50%, 14px)",
        }}
      >
        <span className="rounded-md border bg-background px-1.5 py-0.5 whitespace-nowrap">
          Regression caught
        </span>
      </div>
    </div>
  );
}

function RegressionVisual() {
  const bars = [
    { label: "Before", value: 1, color: "var(--chart-1)" },
    { label: "After", value: 0.33, color: "var(--status-critical)" },
  ];
  return (
    <div className="flex h-36 items-end justify-center gap-6">
      {bars.map((b, i) => (
        <div
          key={b.label}
          className="flex h-full w-16 flex-col items-center justify-end gap-1.5"
        >
          <span className="text-sm font-semibold tabular-nums">
            {Math.round(b.value * 100)}%
          </span>
          <div className="relative w-full flex-1">
            <div
              className="grow-y absolute inset-x-0 bottom-0 rounded-t-[4px]"
              style={
                {
                  height: `${b.value * 100}%`,
                  background: b.color,
                  "--i": i,
                } as React.CSSProperties
              }
            />
          </div>
          <span className="text-xs text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
