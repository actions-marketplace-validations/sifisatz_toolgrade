/** Baseline -> with-tools on a 0-100% track. Both marks also appear as numbers in the row. */
export function Dumbbell({
  tools,
  baseline,
}: {
  tools: number;
  baseline: number | null;
}) {
  const at = (v: number) => `${(v * 100).toFixed(1)}%`;
  const lo = baseline === null ? tools : Math.min(tools, baseline);
  const hi = baseline === null ? tools : Math.max(tools, baseline);
  return (
    <div
      className="relative h-4 w-full min-w-32"
      role="img"
      aria-label={`with tools ${Math.round(tools * 100)}%${baseline === null ? "" : `, baseline ${Math.round(baseline * 100)}%`}`}
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      {[0.25, 0.5, 0.75].map((t) => (
        <div
          key={t}
          className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border"
          style={{ left: at(t) }}
        />
      ))}
      {baseline !== null && (
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/40"
          style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }}
        />
      )}
      {baseline !== null && <Dot left={at(baseline)} color="var(--chart-2)" />}
      <Dot left={at(tools)} color="var(--chart-1)" />
    </div>
  );
}

function Dot({ left, color }: { left: string; color: string }) {
  return (
    <div
      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
      style={{ left, background: color }}
    />
  );
}

export function DumbbellLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-full"
          style={{ background: "var(--chart-1)" }}
        />{" "}
        With tools
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-full"
          style={{ background: "var(--chart-2)" }}
        />{" "}
        No tools (baseline)
      </span>
    </div>
  );
}
