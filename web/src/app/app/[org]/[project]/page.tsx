import { GitCompareArrows, Settings, Terminal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiftTrend } from "@/components/charts/lift-trend";
import { PassRateTrend } from "@/components/charts/pass-rate-trend";
import { PageHeader } from "@/components/page-header";
import { RunsTable } from "@/components/runs-table";
import { StatTile } from "@/components/stat-tile";
import { GateBadge, Lift, SignificanceBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProject, listRuns } from "@/lib/data";
import { pct, shortDate, shortSha, signedPct, usd } from "@/lib/format";

export const metadata = { title: "Project" };

export default function ProjectPage({
  params,
}: PageProps<"/app/[org]/[project]">) {
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <Project params={params} />
    </Suspense>
  );
}

async function Project({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgSlug, project: projectSlug } = await params;
  const found = await getProject(orgSlug, projectSlug);
  if (!found) notFound();
  const { project, org } = found;
  const base = `/app/${org.slug}/${project.slug}`;
  const runs = await listRuns(project.id);
  const [latest, previous] = runs;
  const chrono = [...runs].reverse();
  const lastTen = runs.slice(0, 10);
  const gatesPassed = lastTen.filter((r) => r.gatePassed).length;

  const actions = (
    <>
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`${base}/compare`} />}
      >
        <GitCompareArrows /> Compare runs
      </Button>
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`${base}/settings`} />}
      >
        <Settings /> Settings & CI
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: project.name },
        ]}
        title={project.name}
        description={project.description}
        actions={actions}
      />
      {!latest ? (
        <EmptyProject base={base} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Pass rate with tools"
              value={pct(latest.passRate)}
              delta={
                previous
                  ? `${signedPct(latest.passRate - previous.passRate)} vs previous`
                  : undefined
              }
              sub={`95% CI ${pct(latest.passLow)}-${pct(latest.passHigh)} over ${latest.taskCount} tasks`}
            />
            <StatTile
              label="Lift over no-tool baseline"
              value={<Lift value={latest.lift} />}
              sub={
                <span className="inline-flex items-center gap-2">
                  baseline{" "}
                  {latest.baselineRate === null
                    ? "n/a"
                    : pct(latest.baselineRate)}{" "}
                  <SignificanceBadge value={latest.liftSignificance} />
                </span>
              }
            />
            <StatTile
              label="Gate"
              value={
                <GateBadge passed={latest.gatePassed} className="text-sm" />
              }
              sub={`${gatesPassed} of the last ${lastTen.length} runs passed`}
            />
            <StatTile
              label="Cost per run"
              value={usd(latest.totalCostUsd)}
              sub={`${latest.trialsPerTask} trials/task, ${latest.agentModel}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pass rate over time</CardTitle>
              <CardDescription>
                Latest {chrono.length} runs. The band is the 95% confidence
                interval; click a point to open the run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PassRateTrend
                runsHref={`${base}/runs`}
                points={chrono.map((r) => ({
                  id: r.id,
                  label: shortDate(r.createdAt),
                  commit: shortSha(r.commit),
                  message: r.commitMessage ?? "Run",
                  passRate: r.passRate,
                  band: [r.passLow, r.passHigh],
                  baselineRate: r.baselineRate,
                  gatePassed: r.gatePassed,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lift over the no-tool baseline</CardTitle>
              <CardDescription>
                Percentage points gained by giving the agent your tools. Below
                zero, the tools make the agent worse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LiftTrend
                points={chrono.map((r) => ({
                  label: shortDate(r.createdAt),
                  commit: shortSha(r.commit),
                  lift: r.lift,
                  band:
                    r.liftLow !== null && r.liftHigh !== null
                      ? [r.liftLow, r.liftHigh]
                      : null,
                }))}
              />
            </CardContent>
          </Card>

          <Card className="gap-2 pb-2">
            <CardHeader>
              <CardTitle>Runs</CardTitle>
              <CardDescription>
                Every run uploaded for this project, newest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2">
              <RunsTable runs={runs} base={base} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function EmptyProject({ base }: { base: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Terminal className="size-8 text-muted-foreground" aria-hidden />
        <div className="font-medium">No runs yet</div>
        <p className="max-w-md text-sm text-muted-foreground">
          Create an API key and add one step to CI. Every pull request then gets
          a pass rate, a lift over the baseline and a gate verdict.
        </p>
        <Button render={<Link href={`${base}/settings`} />}>Connect CI</Button>
      </CardContent>
    </Card>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-96" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
