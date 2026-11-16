import { ArrowRight, Terminal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { StatTile } from "@/components/stat-tile";
import { DemoBadge, GateBadge, Lift } from "@/components/status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrg, listProjects } from "@/lib/data";
import { pct, timeAgo, usd } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Overview" };

export default function OrgOverview({ params }: PageProps<"/app/[org]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const user = await requireUser();
  const org = await getOrg(user.id, slug);
  if (!org) notFound();
  const list = await listProjects(org.id);
  const withRuns = list.filter((p) => p.latest);
  const failing = withRuns.filter((p) => !p.latest!.gatePassed).length;
  const totalRuns = list.reduce((s, p) => s + p.runCount, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: org.name }]}
        title="Overview"
        description="Every MCP server your team ships, graded against a no-tool baseline on every change."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Projects"
          value={list.length}
          sub={`${withRuns.length} with runs`}
        />
        <StatTile
          label="Runs recorded"
          value={totalRuns}
          sub="uploaded by CI or the CLI"
        />
        <StatTile
          label="Failing gates"
          value={failing}
          sub={failing ? "latest run below its gate" : "all latest runs pass"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((p) => (
          <Link
            key={p.id}
            href={`/app/${org.slug}/${p.slug}`}
            className="group"
          >
            <Card className="h-full transition-colors group-hover:border-foreground/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{p.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {p.description}
                    </CardDescription>
                  </div>
                  {p.latest && <GateBadge passed={p.latest.gatePassed} />}
                </div>
              </CardHeader>
              <CardContent>
                {p.latest ? (
                  <div className="flex items-end justify-between gap-4">
                    <dl className="grid grid-cols-3 gap-6 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Pass rate</dt>
                        <dd className="mt-0.5 text-lg font-semibold">
                          {pct(p.latest.passRate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Lift</dt>
                        <dd className="mt-0.5 text-lg font-semibold">
                          <Lift value={p.latest.lift} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Cost / run</dt>
                        <dd className="mt-0.5 text-lg font-semibold">
                          {usd(p.latest.totalCostUsd)}
                        </dd>
                      </div>
                    </dl>
                    <div className="hidden text-right sm:block">
                      <Sparkline
                        values={p.trend}
                        label={`Pass rate over the last ${p.trend.length} runs`}
                      />
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.runCount} runs - {timeAgo(p.latest.createdAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Terminal className="size-4" aria-hidden /> No runs yet -
                    connect CI from Settings.
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.repo}</span>
                  <span className="flex items-center gap-2">
                    {p.latest?.source === "demo" && <DemoBadge />}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-14 w-72" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
