import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { RunsTable } from "@/components/runs-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProject,
  listRunFilterOptions,
  listRunsFiltered,
  type RunCursor,
  type RunFilters,
} from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Run history" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parseCursor(raw: string | undefined): RunCursor | undefined {
  if (!raw) return undefined;
  const sep = raw.lastIndexOf("_");
  if (sep < 0) return undefined;
  const createdAt = new Date(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return undefined;
  return { createdAt, id };
}

const encodeCursor = (c: RunCursor) => `${c.createdAt.toISOString()}_${c.id}`;

export default function RunsPage({
  params,
  searchParams,
}: PageProps<"/app/[org]/[project]/runs">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <RunHistory params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RunHistory({
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

  const gate = one(query.gate);
  const since = one(query.since);
  const until = one(query.until);
  const filters: RunFilters = {
    suite: one(query.suite) || undefined,
    provider: one(query.provider) || undefined,
    agentModel: one(query.model) || undefined,
    branch: one(query.branch) || undefined,
    commit: one(query.commit) || undefined,
    gatePassed:
      gate === "passed" ? true : gate === "failed" ? false : undefined,
    since: since ? new Date(since) : undefined,
    until: until ? new Date(`${until}T23:59:59.999Z`) : undefined,
  };
  const cursor = parseCursor(one(query.cursor));
  const [{ rows, nextCursor }, options] = await Promise.all([
    listRunsFiltered(project.id, filters, cursor),
    listRunFilterOptions(project.id),
  ]);

  const hasFilters = Object.values(filters).some((v) => v !== undefined);
  const nextHref = (() => {
    if (!nextCursor) return undefined;
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (k === "cursor") continue;
      const value = one(v);
      if (value) next.set(k, value);
    }
    next.set("cursor", encodeCursor(nextCursor));
    return `${base}/runs?${next.toString()}`;
  })();

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: project.name, href: base },
          { label: "Run history" },
        ]}
        title="Run history"
        description="Every run uploaded for this project, filterable and paginated - not just the latest 100."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              method="GET"
            >
              <Field label="Suite">
                <Select
                  name="suite"
                  defaultValue={filters.suite}
                  options={options.suites}
                />
              </Field>
              <Field label="Provider">
                <Select
                  name="provider"
                  defaultValue={filters.provider}
                  options={options.providers}
                />
              </Field>
              <Field label="Model">
                <Select
                  name="model"
                  defaultValue={filters.agentModel}
                  options={options.models}
                />
              </Field>
              <Field label="Branch">
                <Select
                  name="branch"
                  defaultValue={filters.branch}
                  options={options.branches}
                />
              </Field>
              <Field label="Commit (prefix)">
                <input
                  name="commit"
                  defaultValue={one(query.commit)}
                  placeholder="a1b2c3d"
                  className="h-9 w-full rounded-md border bg-transparent px-3 font-mono text-sm"
                />
              </Field>
              <Field label="Gate">
                <select
                  name="gate"
                  defaultValue={gate ?? ""}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Any</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                </select>
              </Field>
              <Field label="Since">
                <input
                  type="date"
                  name="since"
                  defaultValue={since}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                />
              </Field>
              <Field label="Until">
                <input
                  type="date"
                  name="until"
                  defaultValue={until}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                />
              </Field>
              <div className="flex items-end gap-2 lg:col-span-4">
                <Button type="submit">Apply filters</Button>
                {hasFilters && (
                  <Button
                    variant="outline"
                    render={<Link href={`${base}/runs`} />}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="gap-2 pb-2">
          <CardHeader>
            <CardTitle>Runs</CardTitle>
            <CardDescription>
              {rows.length === 0
                ? "No runs match these filters."
                : `${rows.length} run${rows.length === 1 ? "" : "s"} on this page.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <RunsTable runs={rows} base={base} />
          </CardContent>
          {nextHref && (
            <CardContent className="flex justify-center border-t pt-4">
              <Button variant="outline" render={<Link href={nextHref} />}>
                Next page
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string | undefined;
  options: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
    >
      <option value="">Any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
