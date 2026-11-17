import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MembersPanel } from "@/components/members-panel";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrg, listOrgMembers } from "@/lib/data";
import { MANAGE_ROLES, requireUser } from "@/lib/session";

export const metadata = { title: "Members" };

export default function MembersPage({
  params,
}: PageProps<"/app/[org]/members">) {
  return (
    <Suspense fallback={<Skeleton className="h-[500px]" />}>
      <Members params={params} />
    </Suspense>
  );
}

async function Members({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgSlug } = await params;
  const user = await requireUser();
  const org = await getOrg(user.id, orgSlug);
  if (!org) notFound();
  const members = await listOrgMembers(org.id);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: org.name, href: `/app/${org.slug}` },
          { label: "Members" },
        ]}
        title="Members"
        description="Everyone with access to this organization and its projects."
      />
      <Card>
        <CardHeader>
          <CardTitle>
            {members.length} member{members.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            Owners and admins can change roles and remove members. Removing or
            demoting an organization&apos;s only owner is never allowed -
            transfer ownership first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          <MembersPanel
            orgSlug={org.slug}
            members={members}
            currentUserId={user.id}
            canManage={MANAGE_ROLES.has(org.role)}
          />
        </CardContent>
      </Card>
    </>
  );
}
