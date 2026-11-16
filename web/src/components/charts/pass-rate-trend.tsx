"use client";

import { useRouter } from "next/navigation";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";

export interface TrendPoint {
  id: string;
  label: string;
  commit: string;
  message: string;
  passRate: number;
  band: [number, number];
  baselineRate: number | null;
  gatePassed: boolean;
}

const config = {
  passRate: { label: "With tools", color: "var(--chart-1)" },
  baselineRate: { label: "No tools (baseline)", color: "var(--chart-2)" },
  band: { label: "95% CI", color: "var(--chart-1)" },
} satisfies ChartConfig;

const pctTick = (v: number) => `${Math.round(v * 100)}%`;

export function PassRateTrend({
  points,
  runsHref,
}: {
  points: TrendPoint[];
  runsHref: string;
}) {
  const router = useRouter();
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <ComposedChart
        data={points}
        margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
        onClick={(e) => {
          const i =
            typeof e?.activeTooltipIndex === "number"
              ? e.activeTooltipIndex
              : Number(e?.activeTooltipIndex);
          const p = Number.isFinite(i) ? points[i] : undefined;
          if (p) router.push(`${runsHref}/${p.id}`);
        }}
        className="cursor-pointer"
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
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={pctTick}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Area
          dataKey="band"
          type="monotone"
          stroke="none"
          fill="var(--color-band)"
          fillOpacity={0.12}
          isAnimationActive={false}
          legendType="none"
          activeDot={false}
        />
        <Line
          dataKey="baselineRate"
          type="monotone"
          stroke="var(--color-baselineRate)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          dataKey="passRate"
          type="monotone"
          stroke="var(--color-passRate)"
          strokeWidth={2}
          dot={{
            r: 3.5,
            strokeWidth: 2,
            stroke: "var(--card)",
            fill: "var(--color-passRate)",
          }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={<TrendTooltip />}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  );
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="grid min-w-56 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <div className="font-medium">{p.message}</div>
      <div className="font-mono text-muted-foreground">
        {p.commit} - {p.label}
      </div>
      <Row
        color="var(--chart-1)"
        label="With tools"
        value={`${pctTick(p.passRate)} (CI ${pctTick(p.band[0])}-${pctTick(p.band[1])})`}
      />
      {p.baselineRate !== null && (
        <Row
          color="var(--chart-2)"
          label="No tools"
          value={pctTick(p.baselineRate)}
        />
      )}
      <div className="text-muted-foreground">
        {p.gatePassed ? "Gate passed" : "Gate failed"} - click to open run
      </div>
    </div>
  );
}

function Row({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-[2px]" style={{ background: color }} />
        {label}
      </span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </div>
  );
}
