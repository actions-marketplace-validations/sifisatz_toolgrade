import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteOrgSection } from "@/components/delete-org-section";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrg } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Organization settings" };

export default function OrgSettingsPage({
  params,
}: PageProps<"/app/[org]/settings">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <OrgSettings params={params} />
    </Suspense>
  );
}

async function OrgSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;
  const user = await requireUser();
  const org = await getOrg(user.id, orgSlug);
  if (!org) notFound();

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: "Settings" },
        ]}
        title="Organization settings"
        description={`General settings for ${org.name}.`}
      />
      {org.role === "owner" ? (
        <DeleteOrgSection orgSlug={org.slug} />
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Only an owner can delete {org.name}.
          </CardContent>
        </Card>
      )}
    </>
  );
}
