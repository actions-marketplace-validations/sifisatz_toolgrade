import { FlaskConical, Gauge, ShieldCheck } from "lucide-react";

const PILLARS = [
  {
    Icon: FlaskConical,
    title: "Run both arms",
    text: "Every task runs with your tools and with none, several times, each against a fresh server process.",
  },
  {
    Icon: Gauge,
    title: "Measure the lift",
    text: "Pass rates with 95% intervals and the lift over the no-tool baseline - tasks, not trials, as the sample.",
  },
  {
    Icon: ShieldCheck,
    title: "Gate the merge",
    text: "A failed gate or a significant regression exits non-zero, and the run lands on your dashboard.",
  },
];

export function Pillars() {
  return (
    <section className="border-y bg-muted/30">
      <h2 className="sr-only">How ToolGrade works</h2>
      <div className="mx-auto grid max-w-6xl gap-px overflow-hidden px-6 md:grid-cols-3">
        {PILLARS.map(({ Icon, title, text }, i) => (
          <div
            key={title}
            className="reveal px-2 py-10 md:px-8"
            style={{ animationRangeStart: `entry ${i * 8}%` }}
          >
            <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
              <Icon className="size-4.5 text-chart-1" aria-hidden />
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
