import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvitePanel } from "@/components/invite-panel";
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
import { getOrg, listOrgMembers, listPendingInvitations } from "@/lib/data";
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
  const canManage = MANAGE_ROLES.has(org.role);
  const [members, invitations] = await Promise.all([
    listOrgMembers(org.id),
    canManage ? listPendingInvitations(org.id) : Promise.resolve([]),
  ]);

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
      <div className="space-y-6">
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
              canManage={canManage}
            />
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Invite someone</CardTitle>
              <CardDescription>
                There's no outbound email yet - accepting an invitation needs a
                signed-in session with the matching email, and you'll get a link
                to share yourself.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvitePanel orgSlug={org.slug} invitations={invitations} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
