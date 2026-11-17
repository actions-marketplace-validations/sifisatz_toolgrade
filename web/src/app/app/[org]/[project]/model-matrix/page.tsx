import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { GateBadge, Lift } from "@/components/status";
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
import { getProject, listModelMatrix } from "@/lib/data";
import { dateTime, pct, usd } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Model matrix" };

export default function ModelMatrixPage({
  params,
}: PageProps<"/app/[org]/[project]/model-matrix">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ModelMatrix params={params} />
    </Suspense>
  );
}

async function ModelMatrix({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgSlug, project: projectSlug } = await params;
  const user = await requireUser();
  const found = await getProject(user.id, orgSlug, projectSlug);
  if (!found) notFound();
  const { project, org } = found;
  const base = `/app/${org.slug}/${project.slug}`;
  const rows = await listModelMatrix(project.id);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: project.name, href: base },
          { label: "Model matrix" },
        ]}
        title="Model matrix"
        description="Every agent model this project has run against the same suites, compared side by side."
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No runs yet - the matrix fills in once at least one model has a run
            on record.
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-2 pb-2">
          <CardHeader>
            <CardTitle>Models</CardTitle>
            <CardDescription>
              {rows.length} model{rows.length === 1 ? "" : "s"} seen, newest run
              first. Trend and averages cover every run on record, not just the
              latest.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Latest pass rate</TableHead>
                  <TableHead className="text-right">Avg pass rate</TableHead>
                  <TableHead className="text-right">Latest lift</TableHead>
                  <TableHead>Latest gate</TableHead>
                  <TableHead className="text-right">Avg cost/run</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Last run
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.agentModel} className="relative">
                    <TableCell className="max-w-64">
                      <Link
                        href={`${base}/runs?model=${encodeURIComponent(r.agentModel)}`}
                        className="truncate font-mono text-xs after:absolute after:inset-0"
                      >
                        {r.agentModel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.runCount}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {pct(r.latest.passRate)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {pct(r.avgPassRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Lift value={r.latest.lift} />
                    </TableCell>
                    <TableCell>
                      <GateBadge passed={r.latest.gatePassed} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usd(r.avgCostUsd)}
                    </TableCell>
                    <TableCell>
                      <Sparkline
                        values={r.trend}
                        label={`Pass rate trend for ${r.agentModel}`}
                      />
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                      {dateTime(r.latest.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
