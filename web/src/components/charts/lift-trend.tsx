"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

export interface LiftPoint {
  label: string;
  commit: string;
  lift: number | null;
  band: [number, number] | null;
}

const config = {
  lift: { label: "Lift", color: "var(--chart-1)" },
  band: { label: "95% CI", color: "var(--chart-1)" },
} satisfies ChartConfig;
const pp = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}`;

/** One series: the title names it, so no legend. Zero line = "tools add nothing". */
export function LiftTrend({ points }: { points: LiftPoint[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full">
      <ComposedChart
        data={points}
        margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          domain={[-0.5, 1]}
          ticks={[-0.5, 0, 0.5, 1]}
          tickFormatter={pp}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ReferenceLine
          y={0}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.6}
        />
        <Area
          dataKey="band"
          type="monotone"
          stroke="none"
          fill="var(--color-band)"
          fillOpacity={0.12}
          isAnimationActive={false}
          activeDot={false}
          connectNulls
        />
        <Line
          dataKey="lift"
          type="monotone"
          stroke="var(--color-lift)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
          connectNulls
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            const p = active
              ? (payload?.[0]?.payload as LiftPoint | undefined)
              : undefined;
            if (!p || p.lift === null) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                <div className="font-mono text-muted-foreground">
                  {p.commit} - {p.label}
                </div>
                <div className="mt-1 font-mono tabular-nums">
                  lift {pp(p.lift)}pp{" "}
                  {p.band && `(CI ${pp(p.band[0])}..${pp(p.band[1])})`}
                </div>
              </div>
            );
          }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
