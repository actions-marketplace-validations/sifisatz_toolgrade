import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { compareRuns, type ToolSurfaceDiff } from "toolgrade/core";
import { PageHeader } from "@/components/page-header";
import { Lift, SignificanceBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProject, getRun, listRuns, type RunSummary } from "@/lib/data";
import { pct, shortDate, shortSha, signedPct } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Compare runs" };

export default function ComparePage({
  params,
  searchParams,
}: PageProps<"/app/[org]/[project]/compare">) {
  return (
    <Suspense fallback={<Skeleton className="h-[500px]" />}>
      <Compare params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Compare({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org: orgSlug, project: projectSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const user = await requireUser();
  const found = await getProject(user.id, orgSlug, projectSlug);
  if (!found) notFound();
  const { project, org } = found;
  const base = `/app/${org.slug}/${project.slug}`;
  const { rows: runs } = await listRuns(project.id);
  const headId = one(query.head) ?? runs[0]?.id;
  const baseId = one(query.base) ?? runs[1]?.id;
  const [head, before] = await Promise.all([
    headId ? getRun(project.id, headId) : undefined,
    baseId ? getRun(project.id, baseId) : undefined,
  ]);
  const cmp =
    head && before ? compareRuns(before.report, head.report) : undefined;
  // A run picked by URL may be older than the listed window; keep it selectable so the form
  // never silently submits a different run.
  const options = [...runs];
  for (const r of [before, head])
    if (r && !options.some((o) => o.id === r.id)) options.push(r);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: project.name, href: base },
          { label: "Compare" },
        ]}
        title="Compare runs"
        description="Did this change make the agent better or worse? Per-task verdicts are Bonferroni-corrected so large suites do not raise false alarms."
      />
      <Card className="mb-6">
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            action={`${base}/compare`}
          >
            <RunSelect
              name="base"
              label="Before"
              runs={options}
              value={before?.id}
            />
            <ArrowRight
              className="mb-2 size-4 text-muted-foreground"
              aria-hidden
            />
            <RunSelect
              name="head"
              label="After"
              runs={options}
              value={head?.id}
            />
            <Button type="submit">Compare</Button>
          </form>
        </CardContent>
      </Card>

      {!cmp || !head || !before ? (
        <p className="text-sm text-muted-foreground">
          Pick two runs to compare. A project needs at least two runs.
        </p>
      ) : (
        <div className="space-y-6">
          <Verdict verdict={cmp.verdict} />
          {cmp.toolSurface.changed && (
            <ToolSurfaceWarning diff={cmp.toolSurface} />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <div className="text-sm text-muted-foreground">
                  Pass rate over {cmp.overall.tasks} matched tasks
                </div>
                <div className="mt-1.5 flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
                  {pct(cmp.overall.before)}{" "}
                  <ArrowRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />{" "}
                  {pct(cmp.overall.after)}
                </div>
              </CardContent>
            </Card>
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <div className="text-sm text-muted-foreground">Change</div>
                <div className="mt-1.5 text-2xl font-semibold tracking-tight">
                  <Lift value={cmp.overall.diff.delta} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  95% CI {signedPct(cmp.overall.diff.low)}..
                  {signedPct(cmp.overall.diff.high)}
                </div>
              </CardContent>
            </Card>
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <div className="text-sm text-muted-foreground">
                  Overall verdict
                </div>
                <div className="mt-2">
                  <SignificanceBadge value={cmp.overall.significance} />
                </div>
                {cmp.unmatched.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Excluded, not graded in both runs:{" "}
                    {cmp.unmatched.join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="gap-2 pb-2">
            <CardHeader>
              <CardTitle>Per task</CardTitle>
              <CardDescription>
                <Link
                  className="underline-offset-4 hover:underline"
                  href={`${base}/runs/${before.id}`}
                >
                  {shortSha(before.commit)} {before.commitMessage}
                </Link>{" "}
                vs{" "}
                <Link
                  className="underline-offset-4 hover:underline"
                  href={`${base}/runs/${head.id}`}
                >
                  {shortSha(head.commit)} {head.commitMessage}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cmp.tasks.map((t) => (
                    <TableRow
                      key={t.taskId}
                      className={cn(
                        t.significance === "worse" && "bg-status-critical/5",
                      )}
                    >
                      <TableCell className="font-mono text-xs font-medium">
                        {t.taskId}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(t.before)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(t.after)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Lift value={t.diff.delta} />
                      </TableCell>
                      <TableCell>
                        <SignificanceBadge value={t.significance} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function RunSelect({
  name,
  label,
  runs,
  value,
}: {
  name: string;
  label: string;
  runs: RunSummary[];
  value?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-8 min-w-72 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {shortSha(r.commit)} - {r.commitMessage ?? "Run"} (
            {shortDate(r.createdAt)}, {pct(r.passRate)})
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolSurfaceWarning({ diff }: { diff: ToolSurfaceDiff }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
      <CircleAlert
        className="mt-0.5 size-5 shrink-0 text-status-warning"
        aria-hidden
      />
      <div className="text-sm">
        <div className="font-semibold">
          Tool surface changed between these runs
        </div>
        <div className="mt-1 text-muted-foreground">
          Any difference above may be explained by this, not by anything else
          that changed.
        </div>
        <dl className="mt-2 space-y-1 font-mono text-xs">
          {diff.added.length > 0 && (
            <div>
              <span className="text-status-good">added</span>{" "}
              {diff.added.join(", ")}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <span className="text-status-critical">removed</span>{" "}
              {diff.removed.join(", ")}
            </div>
          )}
          {diff.changedTools.length > 0 && (
            <div>
              <span className="text-status-warning">changed</span>{" "}
              {diff.changedTools.join(", ")}
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

function Verdict({
  verdict,
}: {
  verdict: "regressed" | "improved" | "no_significant_change";
}) {
  const v = {
    regressed: {
      Icon: CircleAlert,
      color: "text-status-critical",
      box: "border-status-critical/30 bg-status-critical/10",
      title: "Regressed",
      text: "At least one task got significantly worse. In CI this fails the build.",
    },
    improved: {
      Icon: CircleCheck,
      color: "text-status-good",
      box: "border-status-good/30 bg-status-good/10",
      title: "Improved",
      text: "Quality went up significantly, and no task got significantly worse.",
    },
    no_significant_change: {
      Icon: CircleDashed,
      color: "text-muted-foreground",
      box: "border-border",
      title: "No significant change",
      text: "Differences are within noise. Add tasks to detect smaller effects.",
    },
  }[verdict];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", v.box)}>
      <v.Icon className={cn("mt-0.5 size-5 shrink-0", v.color)} aria-hidden />
      <div>
        <div className="font-semibold">{v.title}</div>
        <div className="text-sm text-muted-foreground">{v.text}</div>
      </div>
    </div>
  );
}
