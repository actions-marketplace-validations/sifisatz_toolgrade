import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiKeysPanel } from "@/components/api-keys-panel";
import { CodeBlock } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProject, listApiKeys } from "@/lib/data";
import { MANAGE_ROLES, requireUser } from "@/lib/session";

export const metadata = { title: "Settings & CI" };

export default function SettingsPage({
  params,
}: PageProps<"/app/[org]/[project]/settings">) {
  return (
    <Suspense fallback={<Skeleton className="h-[500px]" />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org: orgSlug, project: projectSlug } = await params;
  const user = await requireUser();
  const found = await getProject(user.id, orgSlug, projectSlug);
  if (!found) notFound();
  const { project, org } = found;
  const keys = MANAGE_ROLES.has(found.role)
    ? await listApiKeys(project.id)
    : [];
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  const workflow = `# .github/workflows/toolgrade.yml
name: MCP tool quality
on: [pull_request]
jobs:
  toolgrade:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build
      - run: npx toolgrade run evals/suite.yaml --upload ${origin}
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          TOOLGRADE_API_KEY: \${{ secrets.TOOLGRADE_API_KEY }}`;

  const local = `export TOOLGRADE_API_KEY=tg_...   # a key from this page
npx toolgrade init -o evals/suite.yaml -- node dist/server.js
npx toolgrade run evals/suite.yaml --upload ${origin}`;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: project.name, href: `/app/${org.slug}/${project.slug}` },
          { label: "Settings & CI" },
        ]}
        title="Settings & CI"
        description="Connect this project to CI in two steps: create a key, add one workflow step."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. API keys</CardTitle>
            <CardDescription>
              Keys let the CLI upload run reports to this project. They are
              shown once and stored as SHA-256 hashes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {MANAGE_ROLES.has(found.role) ? (
              <ApiKeysPanel
                orgSlug={org.slug}
                projectSlug={project.slug}
                keys={keys}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                You are a {found.role} of {org.name}. Ask an owner or admin to
                create an API key.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. Add the CI step</CardTitle>
            <CardDescription>
              Store the key as the{" "}
              <code className="font-mono">TOOLGRADE_API_KEY</code> repository
              secret. Every pull request then uploads a run; the step fails when
              the gate fails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock label="GitHub Actions" code={workflow} />
            <CodeBlock label="Or from your terminal" code={local} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
